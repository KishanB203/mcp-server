# Unified Validation Rules

This file centralizes enforcement inputs used by `validationTool` and PR automation.

Validation gates before PR creation:
1. No `TODO`, `FIXME`, `HACK`, or `XXX` in added lines.
2. No `console.log` in added lines.
3. No possible hardcoded credentials/secrets in added lines.
4. Source changes should include corresponding tests.

If any mandatory gate fails, PR creation is rejected until fixed.
