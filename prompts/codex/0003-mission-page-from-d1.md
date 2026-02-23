Goal:
Update GET /mission?role=<slug> to load Mission 1 from D1.

Files:
- src/index.js

Behavior:
- Validate role exists in roles table and is_active=1
- Fetch Mission 1 from missions where role_slug=<slug>, mission_order=1, is_active=1
- Render mission title + instructions
- Add link to /log?role=<slug>&mission=<mission_id> (log page can be placeholder for now)

Constraints:
- Use env.go_db (binding name is "go_db") to access D1.
- Must work in local dev and production without code changes.
- Keep HTML minimal and mobile-first.
- Keep /roles and /help behavior unchanged.
- Provide before/after diff for src/index.js only.
