<!-- ai_contract.md -->

# AI Contract for go.grassrootsmvt.org

## Non-negotiables
- Same-origin only: UI calls /api/... with relative paths
- Mission 1 must be completable in 5 minutes
- Logging is minimal (3 fields max)
- No one joins and gets lost: every flow ends with a next step

## Change rules
- Always reference exact file paths
- Provide before/after for any edited file
- Avoid new dependencies unless required

## Security
- Validate inputs on all /api endpoints
- Add basic rate limiting on POST endpoints before public promotion
- Do not store sensitive personal data unless explicitly required

## Documentation
- Update docs when routes, data model, or architecture change
## Local development and production database workflow
- Default: develop and test against local D1 first.
- Apply migrations locally: npx wrangler d1 migrations apply go_db --local
- Apply migrations to production: npx wrangler d1 migrations apply go_db
- UI and API must work in both environments without code changes.

## Access model
- Open browse + gated writes: public GET routes stay open; `/log` and write APIs require auth.
- Passkeys-first auth is the default path for user sign-in and account bootstrap.
