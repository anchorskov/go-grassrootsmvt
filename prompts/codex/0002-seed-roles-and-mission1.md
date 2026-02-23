Goal:
Seed the D1 database go_db with:
1) roles (8 rows)
2) Mission 1 entries for each role (8 rows)

Requirements:
- Create migration: migrations/0002_seed_roles_and_mission1.sql
- Roles must match exactly:
  hand, specialist, dispatcher, scout, land-man, support, foreman, campaign-lead
- Mission 1 copy must be short and Wyomingized.
- Mission IDs should be deterministic:
  <role_slug>-m1

Data to insert:

Roles (role_slug, role_name, sort_order):
1 hand | Hand | 10
2 specialist | Specialist | 20
3 dispatcher | Dispatcher | 30
4 scout | Scout | 40
5 land-man | Land Man | 50
6 support | Support | 60
7 foreman | Foreman | 70
8 campaign-lead | Campaign Lead | 80

Missions (mission_id, role_slug, mission_order, title, instructions):
hand-m1 | hand | 1 | Send 3 invites | Send 3 personal invites to people you already know. Ask for one five-minute yes: pick a role and start.
specialist-m1 | specialist | 1 | Make the first call | Complete setup, then make one successful call. Log the outcome and one follow-up.
dispatcher-m1 | dispatcher | 1 | Send the first batch | Send the first batch of texts, then tag replies that need a human follow-up.
scout-m1 | scout | 1 | Find two rooms | Find 2 meeting spaces in your town, VFW hall, church basement, library room. Log name, address, contact.
land-man-m1 | land-man | 1 | Set the date and the first 10 | Pick a date for a living room talk and write down the first 10 names to invite. Start RSVPs.
support-m1 | support | 1 | Clear one roadblock | Answer one inbound question or route one stuck volunteer to the right role. No one gets lost.
foreman-m1 | foreman | 1 | Claim a lane | Claim a town or county lane and assign Mission 1 to one new volunteer today.
campaign-lead-m1 | campaign-lead | 1 | Verify the system | Confirm roles, missions, and support flow work end-to-end. Fix one friction point.

Implementation notes:
- Use INSERT statements.
- Make the migration idempotent:
  - Use INSERT OR IGNORE for roles and missions.
  - Or delete and reinsert by role_slug and mission_id, but keep it safe.
- Update docs/03-data-model.md with a short note describing seed data.

Do not change src/index.js in this prompt.

Provide exact file diffs.
