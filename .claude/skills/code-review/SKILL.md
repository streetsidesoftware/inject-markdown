---
name: code-review
description: 'Review pull request changes for correctness, safety, and user-facing documentation quality. Use when asked to review code or validate a PR before merge.'
---

# Code Review Skill

Review changes with a correctness-first mindset. Focus on actionable findings, short rationale, and concrete fix suggestions.

## When to use

- User asks for a code review.
- User asks if a PR is ready to merge.
- Otherwise, do not run automatically.

## Primary review priorities

1. **Code correctness** (logic, behavior, edge cases, regressions).
2. **Security and safety** (input handling, injection, path/URL handling, secrets).
3. **Documentation clarity** (concise, readable, accurate).

## Repository-specific rules

- **Versioning policy (blocking):**
  - Version numbers are managed only by **release-please**.
  - Non-release PRs must not modify version fields or release metadata/changelog entries that are release-please owned.
  - Version changes follow Conventional Commits through release automation.
- **CHANGELOG policy (blocking):**
  - `CHANGELOG.md` is auto-generated and must not be manually modified.
  - `CHANGELOG.md` should not be spell checked, linted, or formatted by review workflow expectations.
- **README policy (blocking for user-facing drift):**
  - User-facing docs should avoid implementation details.
  - `README.md` must stay focused on usage, behavior, and outcomes.
  - Implementation details are acceptable in `CONTRIBUTING.md`.

## Review boundaries

- Ignore pure style/nit feedback; linters should catch style issues.
- Prefer high-signal findings over broad commentary.
- Do not request refactors unless needed to prevent defects or ambiguity.

## Validation expectations

- Review and comment primarily on the code diff.
- Check whether lint/build/test outcomes are available and consistent with the changes.
- If validation status is unknown, call it out as a merge risk.
- Do not treat “tests passing” as proof of correctness; still assess logic and edge cases.

## Output format

Report only actionable findings grouped by severity:

- **Critical**: must fix before merge (data loss, security issues, major correctness defects).
- **High**: likely incorrect behavior or significant regression risk.
- **Medium**: correctness or clarity issues with meaningful impact.

For each finding, include:

1. **What is wrong** (concise).
2. **Why it matters** (impact/risk).
3. **What to change** (concrete fix direction; suggestions and fixes are welcome).

If no issues are found, state that explicitly and note any remaining uncertainty (for example, missing validation evidence).

## Tone

- Be concise, direct, and practical.
- Prioritize must-fix feedback.
- Avoid long narrative explanations.
