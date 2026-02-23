# Routes and API

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/` | Serve static landing page from `public/index.html` | Open |
| GET | `/roles` | Render role selection page (8 role links) | Open |
| GET | `/help` | Render support form page | Open |
| GET | `/mission?role=<slug>` | Render active Mission 1 from D1 for role | Open |
| GET | `/login` | Passkey sign-in page | Open |
| GET | `/register` | Passkey registration page | Open |
| GET | `/log?role=<slug>&mission=<id>` | Win logging form | Auth required (302 to `/login`) |
| GET | `/admin` | Tier management page (form) | Auth required + Tier 5 |
| POST | `/api/help` | Insert support request into `help_requests` | Open |
| POST | `/api/missions/complete` | Insert mission completion + admin notify | Auth required (401 JSON) |
| POST | `/api/auth/webauthn/register/options` | Start passkey registration | Open |
| POST | `/api/auth/webauthn/register/verify` | Verify passkey registration + create session | Open |
| POST | `/api/auth/webauthn/login/options` | Start passkey login | Open |
| POST | `/api/auth/webauthn/login/verify` | Verify passkey login + create session | Open |
| POST | `/api/auth/logout` | Delete session + clear cookie | Open |
| POST | `/api/admin/tier/set` | Set target user tier with note | Auth required + Tier 5 |
| POST | `/api/admin/bootstrap-tier5` | Emergency tier bootstrap by secret header | `X-ADMIN-KEY` required |

## Session Cookie
- Name: `gmvt_session`
- Flags: `HttpOnly`, `SameSite=Lax`
- Secure/domain behavior:
  - Production: `Secure`, `Domain=go.grassrootsmvt.org`
  - Localhost dev: host-only cookie, no `Secure` to keep local auth functional

## Admin Notifications
Environment vars used by win notification logic:
- `EMAIL_PROVIDER`: `resend` or `none` (fallback)
- `ADMIN_NOTIFY_EMAIL`: destination inbox
- `RESEND_API_KEY`: required when provider is `resend`
- `ADMIN_FROM_EMAIL`: optional sender override (Resend)

## Admin Tier Security
- `ADMIN_KEY` is for emergency bootstrap only (`POST /api/admin/bootstrap-tier5`).
- Do not rely on `vars` value in production. Set a real secret with Wrangler:
  - `npx wrangler secret put ADMIN_KEY`
- The placeholder `ADMIN_KEY` in `wrangler.jsonc` should be treated as unconfigured.
