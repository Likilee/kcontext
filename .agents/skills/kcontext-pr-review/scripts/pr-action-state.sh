#!/bin/bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  pr-action-state.sh [--pr number|url|branch] [--repo owner/name] [--format json|summary]

If --pr is omitted, use the pull request attached to the current branch.
EOF
}

pr_ref=""
github_repo=""
output_format="json"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pr)
      pr_ref="${2:-}"
      shift 2
      ;;
    --repo)
      github_repo="${2:-}"
      shift 2
      ;;
    --format)
      output_format="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ "${output_format}" != "json" && "${output_format}" != "summary" ]]; then
  echo "Unsupported format: ${output_format}" >&2
  exit 1
fi

if [[ -z "${github_repo}" ]]; then
  github_repo="$(gh repo view --json nameWithOwner --jq '.nameWithOwner')"
fi

pr_json_file="$(mktemp)"
thread_json_file="$(mktemp)"
issue_json_file="$(mktemp)"
issue_meta_json_file="$(mktemp)"
trap 'rm -f "${pr_json_file}" "${thread_json_file}" "${issue_json_file}" "${issue_meta_json_file}"' EXIT

pr_json_args=(
  --repo "${github_repo}"
  --json number,title,url,body,state,isDraft,author,headRefName,headRefOid,baseRefName,reviewDecision,mergeStateStatus,mergeable,createdAt,updatedAt,labels,closingIssuesReferences,reviews,comments,statusCheckRollup
)

if [[ -n "${pr_ref}" ]]; then
  gh pr view "${pr_ref}" "${pr_json_args[@]}" > "${pr_json_file}"
else
  gh pr view "${pr_json_args[@]}" > "${pr_json_file}"
fi

pr_number="$(jq -r '.number' "${pr_json_file}")"
repo_owner="${github_repo%%/*}"
repo_name="${github_repo##*/}"

gh api graphql \
  -f query='query($owner:String!, $repo:String!, $number:Int!, $threadLimit:Int!, $commentLimit:Int!) { repository(owner:$owner, name:$repo) { pullRequest(number:$number) { reviewThreads(first:$threadLimit) { nodes { isResolved isOutdated comments(first:$commentLimit) { nodes { author { login } body path line originalLine createdAt url } } } } } } }' \
  -F owner="${repo_owner}" \
  -F repo="${repo_name}" \
  -F number="${pr_number}" \
  -F threadLimit=100 \
  -F commentLimit=20 > "${thread_json_file}"

issue_number="$(python3 - "${pr_json_file}" <<'PY'
from __future__ import annotations

import json
import re
import sys
from pathlib import Path


pr = json.loads(Path(sys.argv[1]).read_text())
closing_refs = pr.get("closingIssuesReferences") or []
if closing_refs:
    print(closing_refs[0]["number"])
    raise SystemExit(0)

body = pr.get("body") or ""
patterns = [
    r"(?im)^\s*[-*]?\s*(?:closes|close|fixes|fix|resolves|resolve|refs|ref)\s*#(?P<number>\d+)\b",
    r"(?i)\b(?:closes|close|fixes|fix|resolves|resolve|refs|ref)\s*#(?P<number>\d+)\b",
]
for pattern in patterns:
    match = re.search(pattern, body)
    if match:
        print(match.group("number"))
        raise SystemExit(0)
PY
)"
if [[ -n "${issue_number}" ]]; then
  gh issue view "${issue_number}" \
    --repo "${github_repo}" \
    --json number,title,url,body,labels,comments,updatedAt > "${issue_json_file}"
  gh api graphql \
    -f query='query($owner:String!, $repo:String!, $number:Int!) { repository(owner:$owner, name:$repo) { issue(number:$number) { number updatedAt body lastEditedAt editor { login } } } }' \
    -F owner="${repo_owner}" \
    -F repo="${repo_name}" \
    -F number="${issue_number}" > "${issue_meta_json_file}"
else
  printf 'null\n' > "${issue_json_file}"
  printf 'null\n' > "${issue_meta_json_file}"
fi

python3 - "${output_format}" "${pr_json_file}" "${thread_json_file}" "${issue_json_file}" "${issue_meta_json_file}" <<'PY'
from __future__ import annotations

import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


output_format = sys.argv[1]
pr = json.loads(Path(sys.argv[2]).read_text())
threads = json.loads(Path(sys.argv[3]).read_text())
issue_text = Path(sys.argv[4]).read_text().strip()
issue_meta_text = Path(sys.argv[5]).read_text().strip()
issue = None if issue_text == "null" else json.loads(issue_text)
issue_meta = None if issue_meta_text == "null" else (((json.loads(issue_meta_text).get("data") or {}).get("repository") or {}).get("issue"))

MARKER_RE = re.compile(
    r"<!--\s*codex:automation=(?P<automation>[^\s>]+)\s+kind=(?P<kind>[^\s>]+)\s+head=(?P<head>[^\s>]+)(?:\s+state=(?P<state>[^\s>]+))?(?:\s+source=(?P<source>[^\s>]+))?\s*-->"
)
BOT_AUTHORS = {
    "dependabot",
    "dependabot[bot]",
    "github-actions",
    "github-actions[bot]",
    "renovate",
    "renovate[bot]",
    "vercel",
}
CONTRACT_KEYWORDS = [
    "closes #",
    "refs #",
    "acceptance criteria",
    "acceptance",
    "ac ",
    "ac1",
    "ac2",
    "ac3",
    "linked issue",
    "scope",
    "in scope",
    "out of scope",
    "verification",
    "contract",
    "issue body",
    "pr body",
    "이슈",
    "수용 기준",
    "범위",
    "검증",
    "정리해",
    "정리해 주세요",
    "closes",
    "refs",
]
ACTIONABLE_PATTERNS = [
    r"\[p[0-2]\]",
    r"\brequest changes\b",
    r"\bfix(?:ed|es|ing)?\b",
    r"\bchange(?:d|s|ing)?\b",
    r"\bupdate(?:d|s|ing)?\b",
    r"\bremove(?:d|s|ing)?\b",
    r"\badd(?:ed|s|ing)?\b",
    r"\brevert(?:ed|s|ing)?\b",
    r"\brename(?:d|s|ing)?\b",
    r"\bneeds?\b",
    r"\bmust\b",
    r"\bshould\b",
    r"\btoo broad\b",
    r"\bmissing\b",
    r"\bstill\b",
    r"`?closes #\d+`?.*(?:too broad|missing|still|not|insufficient)",
    r"`?refs #\d+`?",
    r"아직",
    r"미충족",
    r"부족",
    r"필요",
    r"해야",
    r"고쳐",
    r"수정",
    r"반영 필요",
    r"추가해",
    r"삭제하자",
    r"바꿔",
    r"막아",
]
NON_ACTIONABLE_PATTERNS = [
    r"\bno findings\b",
    r"블로킹 코드 이슈는 찾지 못했습니다",
    r"명시적 코드 finding은 없습니다",
    r"검토 범위",
    r"확인한 범위",
    r"리뷰 반영 내용 공유",
    r"조치:",
    r"검증:",
    r"\blooks good\b",
    r"\bsafe to merge\b",
    r"문제없",
]


def parse_ts(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def marker(body: str | None) -> dict[str, str] | None:
    if not body:
        return None
    match = MARKER_RE.search(body)
    if not match:
        return None
    return {key: value for key, value in match.groupdict().items() if value is not None}


def excerpt(body: str | None, limit: int = 220) -> str:
    text = re.sub(r"\s+", " ", body or "").strip()
    if len(text) <= limit:
        return text
    return text[: limit - 3] + "..."


def contains_contract_keywords(body: str | None) -> bool:
    haystack = (body or "").lower()
    return any(keyword in haystack for keyword in CONTRACT_KEYWORDS)


def is_bot_author(author: str | None) -> bool:
    if not author:
        return False
    login = author.lower()
    return login in BOT_AUTHORS or login.endswith("[bot]")


def contains_actionable_keywords(body: str | None) -> bool:
    haystack = (body or "").lower()
    has_actionable_pattern = any(re.search(pattern, haystack) for pattern in ACTIONABLE_PATTERNS)
    if not has_actionable_pattern:
        return False
    if any(re.search(pattern, haystack) for pattern in NON_ACTIONABLE_PATTERNS):
        return False
    return True


head_sha = pr["headRefOid"]
pr_created_at = parse_ts(pr.get("createdAt"))

codex_actions_current_head: list[dict[str, Any]] = []
all_human_inputs: list[dict[str, Any]] = []
open_human_threads: list[dict[str, Any]] = []


def add_codex_action(
    *,
    body: str | None,
    created_at: str | None,
    url: str | None,
    author: str | None,
    source_type: str,
) -> None:
    meta = marker(body)
    if not meta or meta.get("head") != head_sha:
        return
    codex_actions_current_head.append(
        {
            "automation": meta.get("automation"),
            "kind": meta.get("kind"),
            "state": meta.get("state"),
            "source": source_type,
            "author": author,
            "created_at": created_at,
            "url": url,
            "body_excerpt": excerpt(body),
        }
    )


def add_human_input(
    *,
    body: str | None,
    created_at: str | None,
    url: str | None,
    author: str | None,
    source_type: str,
    actionable_override: bool = False,
    allow_keyword_actionable: bool = True,
) -> None:
    if is_bot_author(author):
        return
    if marker(body):
        return
    all_human_inputs.append(
        {
            "source": source_type,
            "author": author,
            "created_at": created_at,
            "url": url,
            "body": body or "",
            "body_excerpt": excerpt(body),
            "contract_signal": contains_contract_keywords(body),
            "actionable_signal": actionable_override
            or (allow_keyword_actionable and contains_actionable_keywords(body)),
        }
    )


for review in pr.get("reviews", []):
    body = review.get("body") or ""
    created_at = review.get("submittedAt") or review.get("createdAt")
    url = review.get("url") or review.get("html_url")
    author = review.get("author", {}).get("login") or review.get("user", {}).get("login")
    add_codex_action(
        body=body,
        created_at=created_at,
        url=url,
        author=author,
        source_type="pr_review",
    )
    add_human_input(
        body=body,
        created_at=created_at,
        url=url,
        author=author,
        source_type="pr_review",
        actionable_override=(review.get("state") == "CHANGES_REQUESTED"),
    )

for comment in pr.get("comments", []):
    body = comment.get("body") or ""
    add_codex_action(
        body=body,
        created_at=comment.get("createdAt"),
        url=comment.get("url"),
        author=(comment.get("author") or {}).get("login"),
        source_type="pr_comment",
    )
    add_human_input(
        body=body,
        created_at=comment.get("createdAt"),
        url=comment.get("url"),
        author=(comment.get("author") or {}).get("login"),
        source_type="pr_comment",
    )

thread_nodes = (((threads.get("data") or {}).get("repository") or {}).get("pullRequest") or {}).get(
    "reviewThreads", {}
).get("nodes", [])

for thread in thread_nodes:
    latest_human_comment: dict[str, Any] | None = None
    for comment in (thread.get("comments") or {}).get("nodes", []):
        body = comment.get("body") or ""
        add_codex_action(
            body=body,
            created_at=comment.get("createdAt"),
            url=comment.get("url"),
            author=(comment.get("author") or {}).get("login"),
            source_type="review_thread_comment",
        )
        if marker(body):
            continue
        add_human_input(
            body=body,
            created_at=comment.get("createdAt"),
            url=comment.get("url"),
            author=(comment.get("author") or {}).get("login"),
            source_type="review_thread_comment",
            actionable_override=(not thread.get("isResolved")),
            allow_keyword_actionable=(not thread.get("isResolved")),
        )
        if latest_human_comment is None or (
            parse_ts(comment.get("createdAt")) or datetime.min.replace(tzinfo=None)
        ) > (parse_ts(latest_human_comment.get("createdAt")) or datetime.min.replace(tzinfo=None)):
            latest_human_comment = comment

    if not thread.get("isResolved") and latest_human_comment is not None:
        open_human_threads.append(
            {
                "path": latest_human_comment.get("path") or "general",
                "line": latest_human_comment.get("line") or latest_human_comment.get("originalLine") or 0,
                "author": (latest_human_comment.get("author") or {}).get("login"),
                "created_at": latest_human_comment.get("createdAt"),
                "url": latest_human_comment.get("url"),
                "body": latest_human_comment.get("body") or "",
                "body_excerpt": excerpt(latest_human_comment.get("body")),
                "contract_signal": contains_contract_keywords(latest_human_comment.get("body")),
            }
        )

issue_comments_since_pr: list[dict[str, Any]] = []
issue_is_blocked = False
if issue is not None:
    issue_is_blocked = any(label.get("name") == "status:blocked" for label in issue.get("labels", []))
    for comment in issue.get("comments", []):
        created_at = parse_ts(comment.get("createdAt"))
        if pr_created_at is not None and created_at is not None and created_at < pr_created_at:
            continue
        body = comment.get("body") or ""
        add_codex_action(
            body=body,
            created_at=comment.get("createdAt"),
            url=comment.get("url"),
            author=(comment.get("author") or {}).get("login"),
            source_type="issue_comment",
        )
        if marker(body):
            continue
        if is_bot_author((comment.get("author") or {}).get("login")):
            continue
        item = {
            "source": "issue_comment",
            "author": (comment.get("author") or {}).get("login"),
            "created_at": comment.get("createdAt"),
            "url": comment.get("url"),
            "body": body,
            "body_excerpt": excerpt(body),
            "contract_signal": contains_contract_keywords(body),
            "actionable_signal": contains_actionable_keywords(body),
        }
        issue_comments_since_pr.append(item)
        all_human_inputs.append(item)

if issue is not None and issue_meta is not None:
    issue_last_edited_at = parse_ts(issue_meta.get("lastEditedAt"))
    issue_editor = ((issue_meta.get("editor") or {}).get("login"))
    if (
        issue_last_edited_at is not None
        and pr_created_at is not None
        and issue_last_edited_at > pr_created_at
        and not is_bot_author(issue_editor)
    ):
        all_human_inputs.append(
            {
                "source": "issue_body_edit",
                "author": issue_editor,
                "created_at": issue_meta.get("lastEditedAt"),
                "url": issue.get("url"),
                "body": issue_meta.get("body") or "",
                "body_excerpt": excerpt(issue_meta.get("body")),
                "contract_signal": True,
                "actionable_signal": True,
            }
        )


def latest_ts(items: list[dict[str, Any]]) -> datetime | None:
    parsed = [parse_ts(item.get("created_at")) for item in items if item.get("created_at")]
    parsed = [value for value in parsed if value is not None]
    if not parsed:
        return None
    return max(parsed)


last_codex_action_at = latest_ts(codex_actions_current_head)
has_codex_review_on_head = any(item.get("kind") == "review" for item in codex_actions_current_head)

human_inputs_after_last_codex = []
for item in all_human_inputs:
    item_ts = parse_ts(item.get("created_at"))
    if last_codex_action_at is None:
        if item.get("actionable_signal"):
            human_inputs_after_last_codex.append(item)
        continue
    if item_ts is not None and item_ts > last_codex_action_at:
        human_inputs_after_last_codex.append(item)

human_action_required = [item for item in human_inputs_after_last_codex if item.get("actionable_signal")]

contract_sync_suggested = any(item.get("contract_signal") for item in human_action_required) or any(
    thread.get("contract_signal") for thread in open_human_threads
)

latest_human_input_at = latest_ts(all_human_inputs)

if pr.get("state") != "OPEN":
    next_actor = "done_for_now"
    reason = "Pull request is not open."
elif pr.get("isDraft"):
    next_actor = "done_for_now"
    reason = "Draft pull requests are not reviewed automatically."
elif issue_is_blocked:
    next_actor = "blocked"
    reason = "Linked issue is explicitly blocked."
elif open_human_threads or human_action_required:
    next_actor = "codex_followup"
    if open_human_threads:
        reason = "There are unresolved human review threads on the current head."
    elif last_codex_action_at is None:
        reason = "There is actionable human feedback on the current head and no Codex marker yet."
    else:
        reason = "There is newer actionable human input after the last Codex action on the current head."
elif not has_codex_review_on_head:
    next_actor = "codex_review"
    reason = "Current head has no Codex review marker."
else:
    next_actor = "waiting_human"
    reason = "Codex already acted on the current head and there is no newer human input."

result = {
    "pr": {
        "number": pr["number"],
        "title": pr["title"],
        "url": pr["url"],
        "state": pr["state"],
        "is_draft": pr["isDraft"],
        "head_ref": pr["headRefName"],
        "head_sha": head_sha,
        "base_ref": pr["baseRefName"],
        "review_decision": pr.get("reviewDecision"),
        "updated_at": pr.get("updatedAt"),
    },
    "linked_issue": None
    if issue is None
    else {
        "number": issue["number"],
        "title": issue["title"],
        "url": issue["url"],
        "labels": [label["name"] for label in issue.get("labels", [])],
    },
    "next_actor": next_actor,
    "reason": reason,
    "bootstrap_mode": last_codex_action_at is None,
    "issue_blocked": issue_is_blocked,
    "has_codex_review_on_head": has_codex_review_on_head,
    "last_codex_action_at": None if last_codex_action_at is None else last_codex_action_at.isoformat(),
    "latest_human_input_at": None if latest_human_input_at is None else latest_human_input_at.isoformat(),
    "codex_actions_current_head": codex_actions_current_head,
    "human_inputs_since_codex": human_action_required,
    "human_inputs_after_last_codex": human_inputs_after_last_codex,
    "open_human_threads": open_human_threads,
    "issue_comments_since_pr": issue_comments_since_pr,
    "contract_sync_suggested": contract_sync_suggested,
}

if output_format == "json":
    print(json.dumps(result, ensure_ascii=False, indent=2))
    sys.exit(0)

issue_text = (
    f"#{result['linked_issue']['number']} {result['linked_issue']['title']}"
    if result["linked_issue"] is not None
    else "none"
)
print(f"#{pr['number']} {pr['title']}")
print(f"next_actor: {next_actor}")
print(f"reason: {reason}")
print(f"head: {head_sha[:7]} | branch: {pr['headRefName']} -> {pr['baseRefName']}")
print(f"linked_issue: {issue_text}")
print(f"codex_review_on_head: {'yes' if has_codex_review_on_head else 'no'}")
print(f"bootstrap_mode: {'yes' if last_codex_action_at is None else 'no'}")
print(f"human_inputs_since_codex: {len(human_action_required)}")
print(f"open_human_threads: {len(open_human_threads)}")
print(f"contract_sync_suggested: {'yes' if contract_sync_suggested else 'no'}")
if last_codex_action_at is not None:
    print(f"last_codex_action_at: {last_codex_action_at.isoformat()}")
if latest_human_input_at is not None:
    print(f"latest_human_input_at: {latest_human_input_at.isoformat()}")
PY
