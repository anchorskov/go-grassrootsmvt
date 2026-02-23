<!-- README.md -->

# go.grassrootsmvt.org

Volunteer mission engine for go.grassrootsmvt.org.

Promise:
No one joins and gets lost. Everyone gets a mission.

## Roles (v1)
- Hand
- Specialist
- Dispatcher
- Scout
- Land Man
- Support
- Foreman
- Campaign Lead

## UI routes (planned)
- /            Start Here
- /roles       Choose role
- /mission     Mission 1 by role
- /log         Log win
- /scoreboard  Metrics we control
- /help        Backstop

## API routes (planned)
- GET  /api/health
- GET  /api/roles
- GET  /api/missions/next?role=...
- POST /api/missions/complete
- GET  /api/scoreboard?range=week
- POST /api/help

## Tech
- Cloudflare Workers (SSR / full-stack)
- Static assets in /public
- Worker code in /src
- D1 planned for persistence

## Dev
Deploy:
- npm run deploy