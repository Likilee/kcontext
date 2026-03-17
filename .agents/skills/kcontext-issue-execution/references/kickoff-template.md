# Kickoff Template

Use this when starting a fresh Codex thread from a ready issue.

## First-Line Rule

Always begin the first prompt with:

```text
[Issue #123] Issue title
```

That keeps the Codex thread, branch, PR, and GitHub issue visually aligned.

## Recommended Prompt Shape

```text
[Issue #123] Search API 권한 흐름 정리

Issue:
- #123 https://github.com/owner/repo/issues/123

Branch:
- codex/123-search-api-auth-flow

Please:
- Treat the GitHub issue as the source of truth.
- Implement only the in-scope work from the issue.
- Verify using the issue's Verification section.
- Use Closes #123 only for full completion; otherwise use Refs #123.
```

## Why Keep It Short

- The issue body already carries the detailed contract.
- A short kickoff prompt reduces drift between the thread and the issue.
- The issue number at the top makes Codex app history easier to scan.
