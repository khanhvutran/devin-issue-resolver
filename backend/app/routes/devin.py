from app.db import get_analysis, upsert_analysis
from app.devin_client import build_prompt, create_session, start_polling_thread


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
        return {"error": "Analysis not found"}, 404

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
