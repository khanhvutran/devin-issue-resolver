from github import Github, GithubException
from typing import List, Dict
import os


def issues() -> List[Dict[str, str]]:
    try:
        token = os.getenv("GITHUB_TOKEN")
        if not token:
            raise ValueError("GITHUB_TOKEN environment variable not set")
        
        g = Github(token)
        
        # Get repo from environment or config
        repo_name = os.getenv("GITHUB_REPO", "owner/repo-name")
        repo = g.get_repo(repo_name)
        
        # Fetch issues (limit to prevent timeouts)
        github_issues = list(repo.get_issues(state='open'))[:100]
        
        result = []
        for issue in github_issues:
            result.append({
                'issue_id': str(issue.number),
                'issue_title': str(issue.title)
            })
        
        return result
        
    except GithubException as e:
        # Log error and return empty list or raise
        print(f"GitHub API error: {e}")
        return []