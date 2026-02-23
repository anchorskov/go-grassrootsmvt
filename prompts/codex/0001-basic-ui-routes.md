Goal:
Implement basic UI routes for go.grassrootsmvt.org in the existing Cloudflare Workers SSR project.

Routes:
1) GET / serves public/index.html (existing behavior).
2) GET /roles renders a simple, mobile-first HTML page listing the 8 roles as buttons/links:
   Hand, Specialist, Dispatcher, Scout, Land Man, Support, Foreman, Campaign Lead.
   Each role link goes to /mission?role=<slug>.
3) GET /help renders a simple, mobile-first HTML page with:
   - short “no one joins and gets lost” message
   - a simple form posting to /api/help (API stub is fine for now)
   - link back to /roles

Constraints:
- Do not add new dependencies.
- Keep same-origin design. Do not hardcode hosts.
- Use server-side rendering for /roles and /help (return Response with HTML).
- Provide before/after edits for any changed files, including exact relative paths.
- Update docs/02-routes-and-api.md with a route table for these paths and /api/help stub.

Files likely involved:
- src/index.js (or the current Worker entry file under src/)
- docs/02-routes-and-api.md

Testing:
- Provide curl commands to verify 200 responses for /, /roles, /help.
- Provide one example URL for /mission?role=hand (placeholder ok).
