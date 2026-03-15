# Review Checklist

## PR Contract

- Check whether the PR links a representative issue with `Closes #...` or `Refs #...`.
- Check whether the PR scope still matches the linked issue.
- Check whether newer human PR/issue feedback has already changed the effective contract.
- Check whether the PR summary and verification are specific enough to audit.
- Do not re-review a head commit that already has a Codex review marker unless new human input arrived.

## Repo-Specific Risks

### Web

- Keep dependency flow inward: UI -> Application -> Domain.
- Reject direct `@supabase/*` imports in UI components.
- Reject new barrel files.
- Keep semantic token usage and dark-only frontend rules intact.
- Watch for `noUncheckedIndexedAccess` hazards and missing null checks.

### CLI

- Preserve explicit input/output flow.
- Prefer pure, stateless command behavior.
- Keep type hints and Ruff compliance.

### Supabase / Infra

- Check migrations and access-policy changes for unintended public exposure.
- Check scripts and CI changes for hidden coupling or skipped quality gates.

## Review Output

- Lead with findings, not summary.
- Prioritize bugs, regressions, architecture violations, and missing tests.
- If there are no findings, say so explicitly and note remaining risk or test gaps.
- Ask for changes only when the PR is not safe to merge as-is.
- Codex-authored reviews must include `[codex-review]` and the hidden Codex marker for the current head SHA.
