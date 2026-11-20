# DCAS Sports Meet – Changes, Progress Tracker & Database Migration Guide

This document records the major structural changes implemented in the Sports Meet management system, tracks current progress, and provides a comparative recommendation of the best **free cloud database services** for production deployment.

---

## 1. Summary of Changes Implemented

### A. Dual Category Architecture (Games & Athletics)
The sports meet is now categorized into two distinct domains:
1. **Athletics** (e.g., 100m Sprint, 200m Sprint, 400m Race, Long Jump, High Jump, Shot Put, 4x100m Relay).
2. **Games** (e.g., Football, Volleyball, Cricket, Badminton, Tug of War, Throwball, Table Tennis).

Each category is further partitioned into two distinct gender divisions:
- **👦 Boys**
- **👧 Girls**

### B. Admin Panel Overhaul
The Admin Desk (`src/pages/Admin.tsx`) has been transformed into a control center:
1. **Separated Event Management**:
   - Primary category tabs: **🏃 Athletics** and **⚽ Games**.
   - Sub-selector pills: **👦 Boys** and **👧 Girls**.
   - Admin can add, edit, or delete events separately for Boys and Girls under both categories.
   - Event creation supports custom event types (`track`, `field`, `team`, `court`, `judged`).
2. **Predefined Points Configuration**:
   - Admin can define default points awarded for 1st, 2nd, and 3rd place for **Athletics** (default: `5, 3, 1`) and **Games** (default: `10, 6, 2`).
   - Individual events can specify their own custom predefined points or inherit category defaults.
3. **Team / House Name Management**:
   - Admin can rename any existing team (e.g., changing "Falcon" to "Falcon Warriors").
   - Admin can add new teams or remove teams.
   - Changes are immediately reflected in registrations, live standings, and point calculations.
4. **Live Podium Publishing**:
   - Direct podium entry inputs (1st, 2nd, 3rd) right beside each event card.
   - One-click publishing that calculates house points and medal tally automatically.
   - One-click "Undo" button to revert accidental publications.
   - Direct "🎨 Create Poster" shortcut on every published event.
5. **Participant Roster & CSV Export**:
   - Searchable table of registered participants.
   - Comprehensive CSV download (`/api/export.csv`) including `RegNo, Name, House, Gender, Category, EventId, EventName, RegisteredAt`.

### C. Access Control & Privacy for Poster Studio
- **Removed from Public View**: The "Poster" link has been removed from the public bottom navigation bar (`src/components/BottomNav.tsx`).
- **Admin PIN Protection**: Accessing `#/poster` directly or through the interface is now protected with `PinGate role="admin"` (`src/pages/Poster.tsx`). Only authorized administrators with the Admin PIN can open the Poster Studio and download high-resolution (1080×1350) graphics.
- **Admin Launcher**: Added a direct button inside the Admin Control Desk to launch the Poster Studio with one click.

### D. Local Database Persistence (`server/data/db.json`)
- All configured events, team names, category points, student registrations, scores, and podium results are dynamically persisted in `server/data/db.json`.
- Uses atomic writes (`.tmp` write + rename) to prevent database corruption during concurrent writes.
- Ensures the administrator's configuration persists across server restarts and deployments.

### E. Public Interface Enhancements
- **Student Registration (`Register.tsx`)**:
  - Dynamically loads configured teams from the local database.
  - Category selector for **Boys** and **Girls**.
  - Events are split and organized under **🏃 Athletics** and **⚽ Games** with predefined points badges (`5/3/1 pts`, `10/6/2 pts`).
- **Live Results (`Results.tsx`)**:
  - Real-time house standings table with medals and point totals.
  - Filter event cards by **Category** (All / Athletics / Games) and **Gender** (All / Boys / Girls).
  - Displays points awarded for each podium finisher.
- **My Points (`Points.tsx`)**:
  - Shows registered student's events with their category tag, qualification status, and exact points contributed to their house.

---

## 2. Progress Tracker

| Feature / Requirement | Status | Details |
|---|---|---|
| Split into Games & Athletics | ✅ Complete | Two top-level categories configured with custom defaults |
| Split into Boys & Girls | ✅ Complete | Separate event pools and registrations for Boys and Girls |
| Admin event entry by category & gender | ✅ Complete | Interactive tabs and forms for entering events separately |
| Predefined points per category & event | ✅ Complete | Athletics (5/3/1) & Games (10/6/2) defaults + per-event override |
| Admin team / house name management | ✅ Complete | Rename, add, and remove teams dynamically |
| Local database persistence | ✅ Complete | Stored in `server/data/db.json` with auto-initialization |
| Private Poster Studio (PIN-gated) | ✅ Complete | Removed from public nav; gated with Admin PIN |
| Student registration with categories | ✅ Complete | Dynamic houses, category filter, and max limit enforcement |
| Live results filtered by category/gender | ✅ Complete | Filterable podiums with real-time points updates |
| Student point lookup | ✅ Complete | Breakdown of points earned per event |
| Registration CSV export | ✅ Complete | Full export with category and gender data |
| Cloud Database Migration & Guide | ✅ Complete | Detailed analysis below with schema and connection code |

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
   - Supabase has built-in Realtime subscriptions. When an admin publishes an event result, the scoreboard on all student phones updates **instantaneously** without needing 4-second polling intervals.
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

### 4. Comparison Summary

| Provider | Engine | Free Storage | Real-time Updates | Web UI Table Editor | Best For |
|---|---|---|---|---|---|
| **Supabase** | PostgreSQL | 500 MB | ✅ Built-in | ✅ Outstanding | **#1 Pick: Live sports events & non-tech admins** |
| **Neon** | PostgreSQL | 500 MB | ❌ Needs Polling | 🟡 Basic | Developer-friendly Postgres with branching |
| **Turso** | libSQL (SQLite) | 9 GB | ❌ Needs Polling | 🟡 Web Shell | Ultra-lightweight edge SQLite |
| **MongoDB Atlas**| Document NoSQL | 512 MB | 🟡 Change Streams | 🟡 Standard | Direct JSON document preservation |

---

## 4. Production Database Schema Design (PostgreSQL / Supabase)

When migrating to Supabase or PostgreSQL, execute the following SQL schema in the SQL Editor:

```sql
-- 1. Tournament Settings & Config
CREATE TABLE tournament_config (
  id TEXT PRIMARY KEY DEFAULT 'current',
  name TEXT NOT NULL DEFAULT 'DCAS Sports Meet 2026',
  max_events_per_student INT NOT NULL DEFAULT 3,
  athletics_points INT[] NOT NULL DEFAULT '{5, 3, 1}',
  games_points INT[] NOT NULL DEFAULT '{10, 6, 2}',
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  places TEXT[] NOT NULL, -- Array of reg_no: [1st, 2nd, 3rd]
  published_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Judge Scores
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

## 5. Node.js Supabase Migration Code Sample

To connect `server/index.js` to Supabase:

```javascript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const db = createClient(supabaseUrl, supabaseKey);

// Fetching all events:
const { data: events, error } = await db.from("events").select("*");

// Publishing a result:
const { error: pubError } = await db.from("results").upsert({
  event_id: eid,
  places: placesArray,
  published_at: new Date().toISOString()
});
```
