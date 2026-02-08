import json
import os
import re
import time
import threading
import requests

from app.db import update_analysis

DEVIN_API_BASE = "https://api.devin.ai/v1"
POLL_INTERVAL = 15

STRUCTURED_OUTPUT_SCHEMA = {
    "plan": "A detailed, step-by-step implementation plan to resolve the issue",
    "confidence_score": 7,
}


def _headers():
    token = os.environ.get("DEVIN_API_KEY", "")
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def build_prompt(github_url, issue_id, issue_title):
    schema_json = json.dumps(STRUCTURED_OUTPUT_SCHEMA, indent=2)
    return (
        f"Analyze the GitHub repository at {github_url} and specifically issue #{issue_id}: "
        f'"{issue_title}". '
        "Review the codebase and the issue, then provide:\n"
        "1. A detailed implementation plan to resolve this issue\n"
        "2. A confidence score from 1-10 on how likely this plan will succeed\n\n"
        "Please update the structured output with your results using this exact JSON format. "
        "Update it as soon as you have your analysis ready:\n"
        f"{schema_json}\n\n"
        "Where:\n"
        '- "plan" is a string with your detailed step-by-step implementation plan\n'
        '- "confidence_score" is an integer from 1 to 10\n'
    )


def create_session(prompt):
    resp = requests.post(
        f"{DEVIN_API_BASE}/sessions",
        headers=_headers(),
        json={"prompt": prompt},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    return data.get("session_id"), data.get("url", "")


def get_session(session_id):
    resp = requests.get(
        f"{DEVIN_API_BASE}/sessions/{session_id}",
        headers=_headers(),
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def terminate_session(session_id):
    try:
        resp = requests.delete(
            f"{DEVIN_API_BASE}/sessions/{session_id}",
            headers=_headers(),
            timeout=30,
        )
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"Error terminating session {session_id}: {e}")


def parse_devin_response(messages):
    if not messages:
        return None, None

    # Find the last message from Devin (API uses "type" not "role")
    devin_text = ""
    for msg in reversed(messages):
        if msg.get("type") == "devin":
            devin_text = msg.get("message", "")
            break

    if not devin_text:
        # Fallback: use the last message regardless of type
        devin_text = messages[-1].get("message", "")

    if not devin_text:
        return None, None

    # Extract plan
    plan_match = re.search(r"PLAN:\s*\n(.*?)(?=\nCONFIDENCE:|\Z)", devin_text, re.DOTALL)
    plan = plan_match.group(1).strip() if plan_match else devin_text.strip()

    # Extract confidence score
    confidence_match = re.search(r"CONFIDENCE:\s*(\d+)", devin_text)
    confidence = int(confidence_match.group(1)) if confidence_match else None
    if confidence is not None:
        confidence = max(1, min(10, confidence))

    return plan, confidence


def poll_session(session_id, github_url, issue_id):
    try:
        update_analysis(github_url, issue_id, status="analyzing")

        while True:
            time.sleep(POLL_INTERVAL)

            try:
                session = get_session(session_id)
            except requests.RequestException as e:
                print(f"Error polling session {session_id}: {e}")
                continue

            status = session.get("status_enum", "")

            if status in ("blocked", "finished"):
                structured_output = session.get("structured_output") or {}
                messages = structured_output.get("messages", [])
                if not messages:
                    messages = session.get("messages", [])

                plan, confidence = parse_devin_response(messages)

                update_analysis(
                    github_url,
                    issue_id,
                    status="completed",
                    plan=plan or "No plan was generated.",
                    confidence_score=confidence,
                )
                terminate_session(session_id)
                return

            if status == "stopped":
                update_analysis(
                    github_url,
                    issue_id,
                    status="failed",
                    plan="Session was stopped before completion.",
                )
                return

    except Exception as e:
        print(f"Polling error for session {session_id}: {e}")
        update_analysis(
            github_url,
            issue_id,
            status="failed",
            plan=f"Error during analysis: {str(e)}",
        )


def start_polling_thread(session_id, github_url, issue_id):
    thread = threading.Thread(
        target=poll_session,
        args=(session_id, github_url, issue_id),
        daemon=True,
    )
    thread.start()
    return thread
