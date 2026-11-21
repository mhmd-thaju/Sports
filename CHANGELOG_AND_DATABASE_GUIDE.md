# DCAS Sports Meet – Changes, Progress Tracker & Database Migration Guide

This document records the major structural changes implemented in the Sports Meet management system, tracks current progress, and provides a comparative recommendation of the best **free cloud database services** for production deployment.

---

## 1. Summary of Changes Implemented

### A. Dual Category Architecture (Games & Athletics – Faithful to Sportsitem.txt)
All existing default items have been completely removed and replaced with the exact data specified in `Sportsitem.txt`:
1. **Games** (Points: **1st: 10, 2nd: 5, 3rd: 2**):
   - **👦 Boys Items**: Football, Cricket, Volleyball, Badminton, Chess.
   - **👧 Girls Items**: Throwball, Badminton, Mini Dodgeball, Kho-Kho, Chess.
2. **Athletics** (Points: **1st: 5, 2nd: 3, 3rd: 1**):
   - **👦 Boys Items**: 100m, 200m, 400m, 1500m, Highjump, Longjump, Shotput, Discus Throw, Javelin, 4 x 100m Relay.
   - **👧 Girls Items**: 100m, 200m, 400m, 600m, Highjump, Longjump, Shotput, Discus Throw, Javelin, 4 x 100m Relay.

### B. Bug Fix: Admin Deletion Now Properly Reflected Across the Site
- **Root Cause Identified**: The `api()` helper function previously only sent `POST` or `GET` based on whether a body was passed. When an admin deleted an event, it passed `{}` which triggered a `POST /api/admin/event/:id` request instead of `DELETE /api/admin/event/:id`. Express only had a `DELETE` route, returning a 404, so the item was never deleted in the backend database. Furthermore, `usePoll` previously took 10 to 60 seconds to refresh, so deletions were not immediately visible.
- **Solution Implemented**:
  1. Updated `api()` in `src/api.ts` to support explicit HTTP methods (`DELETE`, `POST`, `GET`, `PUT`).
  2. Added multiple route fallbacks in `server/index.js` (`DELETE /api/admin/event/:id`, `POST /api/admin/event/:id/delete`, and `POST /api/admin/event/:id`).
  3. Added an instant event bus (`sportsmeet:refresh`) in `src/hooks.ts` and `src/localDb.ts` so all components and pollers immediately refresh the moment an event is deleted or modified.
  4. Fixed `server/index.js` so that when `disk.events` is modified or emptied, it does not resurrect old defaults on server restart.

### C. Complete Local Database Persistence & Client Sync
- Every action performed on the site is persistently saved to local DB:
  - **Backend**: `server/data/db.json` with atomic writes.
  - **Frontend**: `localStorage` (`dcas_sportsmeet_local_db_v2`) with automatic two-way fallback. If the backend is running, it saves to `db.json` and syncs with `localStorage`. If running in client-only preview (e.g. Figma Make), it saves to `localStorage`.
  - Actions tracked: Event additions, edits, deletions, team/house renames and additions, predefined points updates, student registrations, judge position submissions, podium publishing, and unpublishing.

### D. Production Cloud Migration Pipeline
When hosting the application in production:
1. **One-Click Export in Admin Desk**:
   - **Download Local DB (JSON)**: Exports `sportsmeet-db.json` with all tournament settings, teams, events, registrations, and results.
   - **Export Supabase / PostgreSQL SQL**: Generates a complete, ready-to-execute `.sql` migration file containing table creation (`tournament_config`, `teams`, `events`, `registrations`, `results`, `judge_submissions`, `scores`) and `INSERT` statements with all current data.
2. **CLI Migration Script**:
   - Run `npm run db:migrate` (or `node server/migrate.js`) to generate `server/data/migration_supabase.sql`.
   - Run the script in the Supabase SQL Editor to populate your production database in seconds!

### E. Additional Bug Fixes
- **TypeScript Error in `Admin.tsx`**: Fixed `error TS2322: Type 'unknown' is not assignable to type 'ReactNode'` by properly casting reduction values to `Number`.
- **Games Points Default**: Corrected Games default points from `10, 6, 2` to `10, 5, 2` across backend and frontend to match `Sportsitem.txt`.
- **Dynamic Standings on Home Screen**: Connected `src/pages/Home.tsx` to live database standings so renamed houses and published podiums reflect on the landing page in real time.
- **Admin Logout / PIN Clearing**: Added an explicit Logout button on the Admin desk to easily lock the panel or switch PINs.

---

## 2. Progress Tracker

| Feature / Requirement | Status | Details |
|---|---|---|
| Items from `Sportsitem.txt` | ✅ Complete | Exactly 30 items (10 Games + 20 Athletics) populated |
| Old items removed | ✅ Complete | Removed Tug of War, Basketball 3x3, Table Tennis, etc. |
| Admin deletion reflected | ✅ Complete | Fixed HTTP method bug & added instant refresh event bus |
| Predefined points per category | ✅ Complete | Athletics (5/3/1) & Games (10/5/2) faithful to `Sportsitem.txt` |
| Local database persistence | ✅ Complete | Stored in `server/data/db.json` + `localStorage` fallback |
| Cloud Database Migration tool | ✅ Complete | `npm run db:migrate`, Admin SQL/JSON export buttons |
| Admin team / house management | ✅ Complete | Rename, add, and remove teams dynamically |
| Participation limits | ✅ Complete | Athletics: 3 per house per event (4 relay), up to 3 individual events plus relay per student; Games: one roster per house, no student cap |
| Judge placings & admin publishing | ✅ Complete | Judges submit unique ranks for all participants/teams; admins publish podiums |
| Private Poster Studio (PIN-gated) | ✅ Complete | Restricted to Admin PIN |
| Victory poster text layout | ✅ Complete | Wrapped text and a separate podium area prevent overlap |
| Live results filtered by category/gender | ✅ Complete | Filterable podiums with real-time points updates |
| Live Home standings | ✅ Complete | Real-time house standings reflected on Home page |
| TypeScript check | ✅ Complete | 0 TypeScript errors across the codebase |

---

## 3. Best Free Database Services for Deployment

When moving from local JSON storage (`server/data/db.json`) to a production cloud database, the following free-tier services are recommended:

### 🥇 Top Recommendation: Supabase (Serverless PostgreSQL)
**Website:** [supabase.com](https://supabase.com)

#### Why it's the best fit for DCAS Sports Meet:
1. **Generous Free Tier**:
   - **500 MB** PostgreSQL database (ample storage for thousands of participants, scores, and events).
   - Up to **50,000 monthly active users**.
   - Unlimited API requests.
2. **Real-time WebSockets out of the box**:
   - Supabase has built-in Realtime subscriptions. When an admin publishes an event result, the scoreboard on all student phones updates **instantaneously** without needing polling intervals.
3. **Intuitive Visual Table Editor**:
   - Non-technical faculty and sports coordinators can view, edit, or export student registrations directly in the Supabase browser dashboard (similar to Airtable / Google Sheets).
4. **Row-Level Security (RLS)**:
   - Allows public read access for live results while restricting write operations to admins.

---

### 🥈 Runner Up: Neon Postgres (Serverless Postgres)
**Website:** [neon.tech](https://neon.tech)

#### Strengths:
- **0.5 GB** free storage with autoscaling and scale-to-zero compute.
- Standard PostgreSQL connection string compatible with Node.js (`pg`, Prisma, Drizzle).
- **Database Branching**: Allows testing event schema changes on a branch before applying them to the live tournament database.

---

### 🥉 Best Lightweight Alternative: Turso (libSQL / Edge SQLite)
**Website:** [turso.tech](https://turso.tech)

#### Strengths:
- **9 GB free storage** and up to 500 databases on the free plan.
- SQLite-compatible: Code migration from local JSON/SQLite is trivial.
- Microsecond latency at the edge with zero cold-start delay.

---

## 4. Production Database Schema Design (PostgreSQL / Supabase)

When migrating to Supabase or PostgreSQL, execute the following SQL schema in the SQL Editor (or use the one generated by `npm run db:migrate`):

```sql
-- 1. Tournament Settings & Config
CREATE TABLE tournament_config (
  id TEXT PRIMARY KEY DEFAULT 'current',
  name TEXT NOT NULL DEFAULT 'DCAS Sports Meet 2026',
  max_events_per_student INT NOT NULL DEFAULT 3,
  athletics_points INT[] NOT NULL DEFAULT '{5, 3, 1}',
  games_points INT[] NOT NULL DEFAULT '{10, 5, 2}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Teams / Houses
CREATE TABLE teams (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Events (Games & Athletics with Boys & Girls)
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Athletics', 'Games')),
  gender TEXT NOT NULL CHECK (gender IN ('Boys', 'Girls', 'Mixed')),
  event_type TEXT NOT NULL DEFAULT 'track',
  points INT[] NOT NULL DEFAULT '{5, 3, 1}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Student Registrations
CREATE TABLE registrations (
  id TEXT PRIMARY KEY,
  reg_no TEXT NOT NULL,
  name TEXT NOT NULL,
  team_name TEXT NOT NULL REFERENCES teams(name) ON UPDATE CASCADE,
  gender TEXT NOT NULL CHECK (gender IN ('Boys', 'Girls')),
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(reg_no, event_id)
);

-- 5. Published Results (Podium Places)
CREATE TABLE results (
  event_id TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  places TEXT[] NOT NULL, -- Array of register numbers or house names: [1st, 2nd, 3rd]
  published_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Judge Placings Submitted for Admin Review
CREATE TABLE judge_submissions (
  event_id TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  judge_name TEXT NOT NULL,
  positions JSONB NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Legacy Judge Scores
CREATE TABLE scores (
  id SERIAL PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  reg_no TEXT NOT NULL,
  judge_name TEXT NOT NULL,
  score NUMERIC(5, 2) NOT NULL CHECK (score >= 0 AND score <= 100),
  scored_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, reg_no, judge_name)
);
```

---

## 5. How to Migrate Local DB to Supabase in Production

1. Run `npm run db:migrate` in your terminal, or click **"🐘 Export Supabase / PostgreSQL SQL"** in the Admin Control Desk.
2. Sign up on [supabase.com](https://supabase.com) and create a new project.
3. In the left navigation, click on **SQL Editor**.
4. Paste the generated SQL script from `server/data/migration_supabase.sql` and click **Run**.
5. All 30 events from `Sportsitem.txt`, your house configurations, predefined points, and existing registrations will be live in Supabase!
