from github import Github, GithubException
from typing import List, Dict
from urllib.parse import urlparse
import os


def issues(github_url: str) -> List[Dict]:
    try:
        token = os.getenv("GITHUB_TOKEN")
        if not token:
            raise ValueError("GITHUB_TOKEN environment variable not set")

        # Parse github_url to extract owner/repo
        parsed = urlparse(github_url)
        path_parts = [p for p in parsed.path.strip("/").split("/") if p]
        if len(path_parts) < 2:
            raise ValueError(f"Invalid GitHub URL: {github_url}")
        owner = path_parts[0]
        repo = path_parts[1]
        repo_name = f"{owner}/{repo}"

        g = Github(token)
        repo_obj = g.get_repo(repo_name)

        # Fetch issues (both open and closed, limit to prevent timeouts)
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

        return result

    except GithubException as e:
        print(f"GitHub API error: {e}")
        return []
