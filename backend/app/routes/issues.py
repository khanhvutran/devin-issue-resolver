import logging
import os
import re
from typing import List, Dict, Tuple, Union
from urllib.parse import urlparse

from github import Github, GithubException

logger = logging.getLogger(__name__)

GITHUB_URL_RE = re.compile(r'^https?://github\.com/[^/]+/[^/]+')


def issues(github_url: str) -> Union[Dict, Tuple[Dict, int]]:
    # Validate URL format
    if not GITHUB_URL_RE.match(github_url):
        return {"error": f"'{github_url}' is not a valid GitHub repository URL. Please use a URL like https://github.com/owner/repo."}, 400

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

        g = Github(token)
        repo_obj = g.get_repo(repo_name)

        # Check permissions
        permissions = repo_obj.permissions
        can_push = permissions.push if permissions else False

        # Fetch issues (open only, limit to prevent timeouts)
        github_issues = list(repo_obj.get_issues(state='open'))[:100]

        result = []
        for issue in github_issues:
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

        return {"issues": result, "can_push": can_push}

    except GithubException as e:
        if e.status in (401, 403, 404):
            return {"error": f"Cannot access repository '{repo_name}'. Your GitHub token may not have permission to view this repository, or the repository does not exist."}, 403
        logger.error("GitHub API error: %s", e)
        return {"error": f"GitHub API error: {e.data.get('message', str(e)) if e.data else str(e)}"}, 403
