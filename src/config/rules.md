# Unified Validation Rules

This file centralizes enforcement inputs used by `validationTool` and PR automation.

Primary standards are defined in:
- `rules/coding-standard.md`
- `rules/architecture.md`
- `rules/naming-rule.md`
- `rules/testing-rule.md`
- `rules/backend-coding-standards.md`
- `rules/db-coding-standards.md`
- `rules/frontend-coding-standards.md`

Validation gates before PR creation:
1. No `TODO`, `FIXME`, `HACK`, or `XXX` in added lines.
2. No `console.log` in added lines.
3. No possible hardcoded credentials/secrets in added lines.
4. Source changes should include corresponding tests.

If any mandatory gate fails, PR creation is rejected until fixed.
