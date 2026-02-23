# Data Model

## Seed Data
- `migrations/0002_seed_roles_and_mission1.sql` defines the canonical role and Mission 1 seed set.
- Seeded roles use fixed sort order increments of 10 (`10..80`) for stable UI ordering.
- Seeded Mission 1 rows use deterministic IDs in the format `<role_slug>-m1`.
- Seed migrations are idempotent (`INSERT OR IGNORE` in `0002`, upsert correction in `0003`).
