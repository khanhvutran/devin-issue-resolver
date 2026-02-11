import json
import logging
import os
import re
import time
import threading
from typing import Any, Callable, Dict, List, Optional, Tuple

import requests

from app.db import update_analysis

logger = logging.getLogger(__name__)

DEVIN_API_BASE = "https://api.devin.ai/v1"
POLL_INTERVAL = 15

STRUCTURED_OUTPUT_SCHEMA = {
    "plan": "A detailed, step-by-step implementation plan to resolve the issue",
    "confidence_score": 7,
}


def _headers() -> Dict[str, str]:
    token = os.environ.get("DEVIN_API_KEY", "")
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def build_prompt(github_url: str, issue_id: int, issue_title: str) -> str:
    schema_json = json.dumps(STRUCTURED_OUTPUT_SCHEMA, indent=2)
    return (
        f"Analyze the GitHub repository at {github_url} and specifically issue #{issue_id}: "
        f'"{issue_title}". '
        "Review the codebase and the issue, then provide:\n"
        "1. A detailed implementation plan to resolve this issue\n"
        "2. A confidence score from 1-10 on how likely this plan will succeed\n\n"
        "IMPORTANT: Your final message MUST be ONLY valid JSON with no other text, "
        "no markdown fences, and no explanation. Use this exact schema:\n"
        f"{schema_json}\n\n"
        "Where:\n"
        '- "plan" is a string with your detailed step-by-step implementation plan\n'
        '- "confidence_score" is an integer from 1 to 10\n\n'
        "Return ONLY the JSON object as your final message. Nothing else."
    )


def create_session(prompt: str) -> Tuple[str, str]:
    resp = requests.post(
        f"{DEVIN_API_BASE}/sessions",
        headers=_headers(),
        json={"prompt": prompt},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    return data.get("session_id"), data.get("url", "")


def get_session(session_id: str) -> Dict[str, Any]:
    resp = requests.get(
        f"{DEVIN_API_BASE}/sessions/{session_id}",
        headers=_headers(),
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def terminate_session(session_id: str) -> None:
    try:
        resp = requests.delete(
            f"{DEVIN_API_BASE}/sessions/{session_id}",
            headers=_headers(),
            timeout=30,
        )
        resp.raise_for_status()
    except requests.RequestException as e:
        logger.error("Error terminating session %s: %s", session_id, e)


def _extract_devin_message(messages: List[Dict[str, Any]]) -> Optional[str]:
    """Extract the last Devin message text from a list of session messages."""
    if not messages:
        return None

    devin_text = ""
    for msg in reversed(messages):
        if msg.get("type") == "devin":
            devin_text = msg.get("message", "")
            break

    if not devin_text:
        devin_text = messages[-1].get("message", "")

    if not devin_text:
        return None

    stripped = devin_text.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*\n?", "", stripped)
        stripped = re.sub(r"\n?```\s*$", "", stripped)

    return stripped


def _get_session_messages(session: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Extract messages from a session response, preferring structured output."""
    structured_output = session.get("structured_output") or {}
    messages = structured_output.get("messages", [])
    if not messages:
        messages = session.get("messages", [])
    return messages


def parse_devin_response(messages: List[Dict[str, Any]]) -> Tuple[Optional[str], Optional[int]]:
    text = _extract_devin_message(messages)
    if text is None:
        return None, None

    try:
        data = json.loads(text)
        plan = data.get("plan")
        confidence = data.get("confidence_score")
        if isinstance(confidence, int):
            confidence = max(1, min(10, confidence))
        else:
            confidence = None
        return plan, confidence
    except (json.JSONDecodeError, AttributeError):
        return text, None


def parse_fix_response(messages: List[Dict[str, Any]]) -> Optional[str]:
    text = _extract_devin_message(messages)
    if text is None:
        return None

    try:
        data = json.loads(text)
        return data.get("pr_url")
    except (json.JSONDecodeError, AttributeError):
        return None


def _poll_session(
    session_id: str,
    github_url: str,
    issue_id: int,
    on_complete: Callable[[List[Dict[str, Any]]], None],
    on_stopped: Callable[[], None],
    on_error: Callable[[Exception], None],
    status_key: str,
) -> None:
    """Shared polling loop for both analysis and fix sessions."""
    try:
        update_analysis(github_url, issue_id, **{status_key: "analyzing"})

        while True:
            time.sleep(POLL_INTERVAL)

            try:
                session = get_session(session_id)
            except requests.RequestException as e:
                logger.warning("Error polling session %s: %s", session_id, e)
                continue

            status = session.get("status_enum", "")

            if status in ("blocked", "finished"):
                messages = _get_session_messages(session)
                on_complete(messages)
                terminate_session(session_id)
                return

            if status == "stopped":
                on_stopped()
                return

    except Exception as e:
        logger.error("Polling error for session %s: %s", session_id, e)
        on_error(e)


def poll_session(session_id: str, github_url: str, issue_id: int) -> None:
    def on_complete(messages):
        plan, confidence = parse_devin_response(messages)
        update_analysis(
            github_url, issue_id,
            status="completed",
            plan=plan or "No plan was generated.",
            confidence_score=confidence,
        )

    def on_stopped():
        update_analysis(
            github_url, issue_id,
            status="failed",
            plan="Session was stopped before completion.",
        )

    def on_error(e):
        update_analysis(
            github_url, issue_id,
            status="failed",
            plan=f"Error during analysis: {str(e)}",
        )

    _poll_session(session_id, github_url, issue_id, on_complete, on_stopped, on_error, "status")


def poll_fix_session(session_id: str, github_url: str, issue_id: int) -> None:
    def on_complete(messages):
        pr_url = parse_fix_response(messages)
        update_analysis(github_url, issue_id, fix_status="completed", pr_url=pr_url)

    def on_stopped():
        update_analysis(github_url, issue_id, fix_status="failed")

    def on_error(_e):
        update_analysis(github_url, issue_id, fix_status="failed")

    _poll_session(session_id, github_url, issue_id, on_complete, on_stopped, on_error, "fix_status")


def _start_polling_thread(target: Callable[..., None], session_id: str, github_url: str, issue_id: int) -> threading.Thread:
    thread = threading.Thread(
        target=target,
        args=(session_id, github_url, issue_id),
        daemon=True,
    )
    thread.start()
    return thread


def start_polling_thread(session_id: str, github_url: str, issue_id: int) -> threading.Thread:
    return _start_polling_thread(poll_session, session_id, github_url, issue_id)


def build_fix_prompt(github_url: str, issue_id: int, issue_title: str, plan: str) -> str:
    return (
        f"You are tasked with fixing a GitHub issue.\n\n"
        f"Repository: {github_url}\n"
        f"Issue #{issue_id}: \"{issue_title}\"\n\n"
        f"Implementation plan:\n{plan}\n\n"
        "Instructions:\n"
        "1. Clone the repository and create a new branch for the fix\n"
        "2. Implement the fix following the plan above\n"
        "3. Commit your changes and push the branch\n"
        "4. Open a pull request that references issue #{issue_id}\n\n"
        "IMPORTANT: Your final message MUST be ONLY valid JSON with no other text, "
        "no markdown fences, and no explanation. Use this exact schema:\n"
        '{"pr_url": "https://github.com/owner/repo/pull/123"}\n\n'
        "Where pr_url is the URL of the pull request you created.\n"
        "Return ONLY the JSON object as your final message. Nothing else."
    )


def start_fix_polling_thread(session_id: str, github_url: str, issue_id: int) -> threading.Thread:
    return _start_polling_thread(poll_fix_session, session_id, github_url, issue_id)
