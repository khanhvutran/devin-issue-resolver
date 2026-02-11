from app.db import get_analysis, upsert_analysis, update_analysis, delete_analysis as db_delete_analysis
from app.devin_client import (
    build_prompt,
    build_fix_prompt,
    create_session,
    start_polling_thread,
    start_fix_polling_thread,
)


def analyze(body):
    github_url = body["github_url"]
    issue_id = body["issue_id"]
    issue_title = body.get("issue_title", f"Issue #{issue_id}")

    existing = get_analysis(github_url, issue_id)
    if existing and existing["status"] in ("pending", "analyzing"):
        return {
            "session_id": existing["session_id"],
            "status": existing["status"],
            "devin_url": existing.get("devin_url", ""),
        }, 202

    prompt = build_prompt(github_url, issue_id, issue_title)

    try:
        session_id, devin_url = create_session(prompt)
    except Exception as e:
        return {"error": f"Failed to create Devin session: {str(e)}"}, 500

    upsert_analysis(
        github_url,
        issue_id,
        session_id=session_id,
        status="pending",
        devin_url=devin_url,
        plan=None,
        confidence_score=None,
    )

    start_polling_thread(session_id, github_url, issue_id)

    return {
        "session_id": session_id,
        "status": "pending",
        "devin_url": devin_url,
    }, 202


def get_analysis_status(github_url, issue_id):
    analysis = get_analysis(github_url, issue_id)
    if analysis is None:
        return {
            "github_url": github_url,
            "issue_id": issue_id,
            "status": "not_found",
        }

    return {
        "github_url": analysis["github_url"],
        "issue_id": analysis["issue_id"],
        "session_id": analysis["session_id"],
        "status": analysis["status"],
        "plan": analysis.get("plan"),
        "confidence_score": analysis.get("confidence_score"),
        "devin_url": analysis.get("devin_url"),
        "created_at": analysis.get("created_at"),
        "updated_at": analysis.get("updated_at"),
    }


def fix_issue(body):
    github_url = body["github_url"]
    issue_id = body["issue_id"]
    issue_title = body.get("issue_title", f"Issue #{issue_id}")
    plan = body["plan"]

    existing = get_analysis(github_url, issue_id)
    if existing and existing.get("fix_status") in ("pending", "analyzing"):
        return {
            "session_id": existing.get("fix_session_id"),
            "status": existing["fix_status"],
            "devin_url": existing.get("fix_devin_url", ""),
        }, 202

    prompt = build_fix_prompt(github_url, issue_id, issue_title, plan)

    try:
        session_id, devin_url = create_session(prompt)
    except Exception as e:
        return {"error": f"Failed to create Devin fix session: {str(e)}"}, 500

    update_analysis(
        github_url,
        issue_id,
        fix_session_id=session_id,
        fix_status="pending",
        fix_devin_url=devin_url,
        pr_url=None,
    )

    start_fix_polling_thread(session_id, github_url, issue_id)

    return {
        "session_id": session_id,
        "status": "pending",
        "devin_url": devin_url,
    }, 202


def get_fix_status(github_url, issue_id):
    analysis = get_analysis(github_url, issue_id)
    if analysis is None or analysis.get("fix_status") is None:
        return {
            "github_url": github_url,
            "issue_id": issue_id,
            "fix_status": "not_found",
        }

    return {
        "github_url": analysis["github_url"],
        "issue_id": analysis["issue_id"],
        "fix_status": analysis.get("fix_status"),
        "fix_session_id": analysis.get("fix_session_id"),
        "fix_devin_url": analysis.get("fix_devin_url"),
        "pr_url": analysis.get("pr_url"),
    }


def remove_analysis(github_url, issue_id):
    analysis = get_analysis(github_url, issue_id)
    if analysis is None:
        return {"error": "Analysis not found"}, 404

    db_delete_analysis(github_url, issue_id)
    return None, 204
