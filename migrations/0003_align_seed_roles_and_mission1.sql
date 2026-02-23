-- migrations/0003_align_seed_roles_and_mission1.sql
PRAGMA foreign_keys = ON;

INSERT INTO roles (role_slug, role_name, sort_order, is_active) VALUES
  ('hand', 'Hand', 10, 1),
  ('specialist', 'Specialist', 20, 1),
  ('dispatcher', 'Dispatcher', 30, 1),
  ('scout', 'Scout', 40, 1),
  ('land-man', 'Land Man', 50, 1),
  ('support', 'Support', 60, 1),
  ('foreman', 'Foreman', 70, 1),
  ('campaign-lead', 'Campaign Lead', 80, 1)
ON CONFLICT(role_slug) DO UPDATE SET
  role_name = excluded.role_name,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

INSERT INTO missions (mission_id, role_slug, mission_order, title, instructions, is_active) VALUES
  ('hand-m1', 'hand', 1, 'Send 3 invites', 'Send 3 personal invites to people you already know. Ask for one five-minute yes: pick a role and start.', 1),
  ('specialist-m1', 'specialist', 1, 'Make the first call', 'Complete setup, then make one successful call. Log the outcome and one follow-up.', 1),
  ('dispatcher-m1', 'dispatcher', 1, 'Send the first batch', 'Send the first batch of texts, then tag replies that need a human follow-up.', 1),
  ('scout-m1', 'scout', 1, 'Find two rooms', 'Find 2 meeting spaces in your town, VFW hall, church basement, library room. Log name, address, contact.', 1),
  ('land-man-m1', 'land-man', 1, 'Set the date and the first 10', 'Pick a date for a living room talk and write down the first 10 names to invite. Start RSVPs.', 1),
  ('support-m1', 'support', 1, 'Clear one roadblock', 'Answer one inbound question or route one stuck volunteer to the right role. No one gets lost.', 1),
  ('foreman-m1', 'foreman', 1, 'Claim a lane', 'Claim a town or county lane and assign Mission 1 to one new volunteer today.', 1),
  ('campaign-lead-m1', 'campaign-lead', 1, 'Verify the system', 'Confirm roles, missions, and support flow work end-to-end. Fix one friction point.', 1)
ON CONFLICT(mission_id) DO UPDATE SET
  role_slug = excluded.role_slug,
  mission_order = excluded.mission_order,
  title = excluded.title,
  instructions = excluded.instructions,
  is_active = excluded.is_active;
