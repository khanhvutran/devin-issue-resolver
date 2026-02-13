import logging
import math
import os
import re
from typing import Dict, Tuple, Union
from urllib.parse import urlparse

from github import Github, GithubException

logger = logging.getLogger(__name__)

GITHUB_URL_RE = re.compile(r'^https?://github\.com/[^/]+/[^/]+')


def normalize_github_url(url: str) -> Optional[str]:
    """Normalize a GitHub URL to https://github.com/owner/repo."""
    parsed = urlparse(url)
    path_parts = [p for p in parsed.path.strip("/").split("/") if p]
    if len(path_parts) < 2:
        return None
    return f"https://github.com/{path_parts[0]}/{path_parts[1]}"


def issues(github_url: str, page: int = 1, per_page: int = 30) -> Union[Dict, Tuple[Dict, int]]:
    if not GITHUB_URL_RE.match(github_url):
        return {"error": f"'{github_url}' is not a valid GitHub repository URL. Please use a URL like https://github.com/owner/repo."}, 400

    github_url = normalize_github_url(github_url) or github_url

    try:
        token = os.getenv("GITHUB_TOKEN")
        if not token:
            return {"error": "GitHub token is not configured. Please set a GITHUB_TOKEN to access repositories."}, 403

        # Parse github_url to extract owner/repo
        parsed = urlparse(github_url)
        path_parts = [p for p in parsed.path.strip("/").split("/") if p]
        if len(path_parts) < 2:
            return {"error": f"'{github_url}' is not a valid GitHub repository URL. Please use a URL like https://github.com/owner/repo."}, 400
        owner = path_parts[0]
        repo = path_parts[1]
        repo_name = f"{owner}/{repo}"

        g = Github(token, per_page=per_page)
        repo_obj = g.get_repo(repo_name)

        permissions = repo_obj.permissions
        can_push = permissions.push if permissions else False

        paginated_issues = repo_obj.get_issues(state='open')
        total_count = paginated_issues.totalCount
        total_pages = max(1, math.ceil(total_count / per_page))

        page_results = paginated_issues.get_page(page - 1)

        result = []
        for issue in page_results:
            if issue.pull_request is not None:
                continue
            result.append({
                'issue_id': issue.number,
                'issue_title': issue.title,
                'body': issue.body or '',
                'state': issue.state,
                'author': issue.user.login if issue.user else 'unknown',
                'author_avatar': issue.user.avatar_url if issue.user else '',
                'labels': [
                    {'name': label.name, 'color': label.color}
                    for label in issue.labels
                ],
                'created_at': issue.created_at.isoformat() if issue.created_at else '',
                'comment_count': issue.comments,
            })

        return {
            "issues": result,
            "can_push": can_push,
            "pagination": {
                "total_count": total_count,
                "page": page,
                "per_page": per_page,
                "total_pages": total_pages,
            },
        }

    except GithubException as e:
        if e.status in (401, 403, 404):
            return {"error": f"Cannot access repository '{repo_name}'. Your GitHub token may not have permission to view this repository, or the repository does not exist."}, 403
        logger.error("GitHub API error: %s", e)
        return {"error": f"GitHub API error: {e.data.get('message', str(e)) if e.data else str(e)}"}, 403
