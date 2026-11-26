# Supabase Database and Hosting Guide

This guide explains how to create a Supabase PostgreSQL database for the Sports Meet, import existing app data, and run the Express API with Supabase.

## Current database and SQL exports

The API uses Supabase when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured. In production, Supabase storage is required and startup fails if it is unavailable. For local development without Supabase credentials, the API uses `server/data/db.json`; set `STORAGE_BACKEND=json` to explicitly choose local JSON storage.

The checked-in [migration_supabase.sql](./server/data/migration_supabase.sql) creates the complete schema with RLS and server-only grants. `npm run db:push` previews counts; `npm run db:push -- --apply` imports the current local JSON data into an empty Supabase project. The API loads Supabase data at startup and waits for database writes before reporting mutation success.

`npm run db:migrate` and the authenticated Admin SQL export generate SQL snapshots. These include eligible participant and activity records, exclude captain passwords, and skip base64 images. Treat snapshots as sensitive and use them only when bootstrapping a new project.

## 1. Create a Supabase project

1. Sign in to Supabase and create a new project for the Sports Meet.
2. Select the region closest to the college and set a strong database password. Store it in a password manager.
3. Wait for the database to finish provisioning.
4. In **Project Settings → API** (or the current API keys/settings page), record:
   - Project URL (`SUPABASE_URL`)
   - `service_role` secret (`SUPABASE_SERVICE_ROLE_KEY`)
5. Keep the service-role secret on the Express server only. Never put it in React/Vite code, a `VITE_` variable, source control, or a browser request.

Supabase hosts the PostgreSQL database and provides APIs, but it does not host this Express application. Deploy the Node API separately (for example, to a Node-capable application host) or serve it from a platform that supports long-running Express services. The Vite frontend can be deployed separately or served by Express after `npm run build`.

## 2. Create the database schema

Open the project's **SQL Editor**, create a new query, review it, and run this schema in the new/empty project:

```sql
create table if not exists tournament_config (
  id text primary key check (id = 'current'),
  name text not null,
  max_events_per_student integer not null default 3,
  categories jsonb not null default '["Athletics", "Games"]'::jsonb,
  genders jsonb not null default '["Boys", "Girls"]'::jsonb,
  category_points jsonb not null default '{"Athletics":[5,3,1],"Games":[10,6,0]}'::jsonb,
  default_points integer[] not null default '{5,3,1}',
  live_day text not null default 'Day 2',
  schedule jsonb not null default '[]'::jsonb,
  featured_winners jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists houses (
  name text primary key,
  display_order integer not null default 0
);

create table if not exists captains (
  id text primary key,
  house_name text not null unique references houses(name),
  username text not null unique,
  display_name text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists events (
  id text primary key,
  name text not null,
  category text not null check (category in ('Athletics', 'Games')),
  gender text not null check (gender in ('Boys', 'Girls', 'Mixed')),
  event_type text not null default 'track',
  points integer[] not null default '{5,3,1}',
  created_at timestamptz not null default now()
);

create table if not exists students (
  reg_no text primary key,
  full_name text not null,
  house_name text not null references houses(name),
  gender text not null check (gender in ('Boys', 'Girls')),
  picture_url text,
  picture_public_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists registrations (
  id text primary key,
  reg_no text not null references students(reg_no) on delete cascade,
  event_id text not null references events(id) on delete cascade,
  registered_at timestamptz not null default now(),
  unique (reg_no, event_id)
);

create table if not exists results (
  event_id text primary key references events(id) on delete cascade,
  places text[] not null, -- register numbers for individual events; house names for Games/relay
  published_at timestamptz not null default now()
);

create table if not exists judge_submissions (
  event_id text primary key references events(id) on delete cascade,
  judge_name text not null,
  positions jsonb not null,
  submitted_at timestamptz not null default now()
);

-- Retained for compatibility with historical score data.
create table if not exists legacy_scores (
  id text primary key,
  event_id text not null references events(id) on delete cascade,
  reg_no text not null,
  judge_name text not null,
  score numeric(5,2) not null,
  scored_at timestamptz not null default now()
);

create table if not exists gallery_photos (
  id text primary key,
  caption text not null default '',
  secure_url text not null,
  public_id text,
  uploaded_at timestamptz not null default now(),
  width integer,
  height integer,
  format text,
  bytes bigint
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_type text not null,
  actor_id text not null default '',
  actor_name text not null,
  action text not null,
  entity_type text,
  entity_id text,
  subject_reg text,
  summary text not null default ''
);

create index if not exists registrations_event_id_idx on registrations(event_id);
create index if not exists registrations_reg_no_idx on registrations(reg_no);
create index if not exists gallery_photos_uploaded_at_idx on gallery_photos(uploaded_at desc);
create index if not exists gallery_photos_public_id_idx on gallery_photos(public_id);
create index if not exists audit_logs_occurred_at_idx on audit_logs(occurred_at desc);

-- The Express API uses the server-only service role. No browser role has access.
alter table tournament_config enable row level security;
alter table houses enable row level security;
alter table captains enable row level security;
alter table events enable row level security;
alter table students enable row level security;
alter table registrations enable row level security;
alter table results enable row level security;
alter table judge_submissions enable row level security;
alter table legacy_scores enable row level security;
alter table gallery_photos enable row level security;
alter table audit_logs enable row level security;

revoke all on table tournament_config, houses, captains, events, students,
  registrations, results, judge_submissions, legacy_scores, gallery_photos,
  audit_logs from anon, authenticated;

grant all privileges on table tournament_config, houses, captains, events,
  students, registrations, results, judge_submissions, legacy_scores,
  gallery_photos, audit_logs to service_role;
```

There are no policies for `anon` or `authenticated`. Keep database access behind the Express API using the server-only service role. Do not add browser-facing policies for student or audit data.

The schema separates student identity from event registration, so one participant can enter multiple events without duplicating their name and photo. Gallery photos and registration pictures are separate data and must never be mixed in public gallery responses.

## 3. Add server environment variables

Add these variables to the local `.env` file and to the API host's secret settings:

```dotenv
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_server_only_service_role_secret
STORAGE_BACKEND=supabase
ADMIN_PIN=use-a-unique-secret-of-at-least-8-characters
JUDGE_PIN=use-a-different-unique-secret-of-at-least-8-characters
ADMIN_NAME=George
JUDGE_NAME=Judge
```

`ADMIN_PIN` and `JUDGE_PIN` are required, must differ, and must each be at least eight characters. The API refuses to start without them. The login page verifies the PIN with the server; actor names are fixed by server configuration rather than entered by the browser. Keep Supabase and Cloudinary credentials on the server only. The repository ignores `.env*`; never commit the real `.env`.

## 4. Run the Express API with Supabase

The browser already calls the Express API through `src/api.ts`. Keep that architecture: React should call the app's `/api/...` endpoints, and only the server should communicate with Supabase using the service-role key.

The API uses Supabase's REST interface from the server with the service-role key; no Supabase key or database credential is sent to the browser. On startup it loads the schema tables into the API process, and each mutation synchronizes the state to Supabase before returning success. Do not start multiple API instances: the current business-rule checks use a single server-side state cache and are not yet protected by database transactions across multiple instances.

The server loads the normalized tables into its in-memory state when it starts and synchronizes every mutation to Supabase before returning success:

- Load/save tournament settings, houses, and events.
- Create/update students and event registrations.
- Retrieve registrations for the Admin Desk and student points lookup.
- Save and retrieve judge submissions.
- Publish/unpublish results and calculate house standings from published places.
- Add/list/delete gallery photo metadata.
- Store activity events in `audit_logs` and expose them only through an authorized Admin API.
- Import/export database data without exposing service credentials.

Supabase is the configured runtime source of truth; the JSON file is not a fallback when Supabase mode is selected. Public and protected API reads use the state loaded from Supabase, and writes are persisted to Supabase.

## 5. Preserve the app's business rules and authentication

The API must continue to enforce the existing Sports Meet rules:

- A student can enter up to three individual Athletics events and one relay.
- A house can enter up to three participants per Athletics event and four relay runners.
- Games have no per-student event cap, and registrations from one house/event form one house team.
- Judges must submit a complete set of unique positions before an admin can publish the top three.

Keep those checks on the server. Registration additions are serialized within the API process so simultaneous requests on one instance cannot exceed the caps. The current schema does not enforce those caps across multiple API instances; keep one instance until transaction-backed registration checks are added.

Admins and house captains can bulk-register up to 100 participants from CSV or Excel using the in-app templates. Add participant images as separate files named with the register number (or set the `Photo File` column); images are uploaded to the Cloudinary participant-registration folder. The API validates the complete batch before saving, and rejects it without partial registration writes if any row violates the rules. Keep the spreadsheet and participant photos available to the importer until it reports completion.

House-captain credentials are stored in the `captains` table with scrypt password hashes, not plaintext. Admin and judge PINs remain server environment secrets; never return them from public `/api/config`.

RLS is enabled with no public write policies in the schema above. The server uses the service-role key and must perform authorization for every admin, judge, and captain endpoint. If the frontend is later allowed to query Supabase directly, add only the narrow public read policies required for events, published results, and gallery photos; never expose student registration tables or service-role credentials.

## 6. Migrate the current JSON data safely

The source of truth before cutover is `server/data/db.json`. Make a backup and inspect the file before importing.

Map the data as follows:

| JSON data | Supabase destination |
|---|---|
| `config` name, limits, categories, genders, point settings, live day, schedule, featured winners | One `tournament_config` row |
| `config.houses` | `houses` |
| `events` | `events` |
| Distinct participant identity from `regs` | `students` |
| Each `regs` row | `registrations` |
| `results` | `results` |
| `judgeSubmissions` | `judge_submissions` |
| Historical `scores` | `legacy_scores` |
| `config.gallery` | `gallery_photos` |
| `config.captains` | A new `captains` table after hashing passwords |
| Audit records | `audit_logs` |

The current dashboard attributes Admin actions to George, Judge actions to the server-configured Judge name, and captain/media actions to their authenticated account. Public points lookups record the register number searched but cannot prove who made the request because student lookups have no login. Gallery opens and download-button clicks are anonymous interaction events; a click does not prove that the image finished downloading.

The direct importer `npm run db:push -- --apply` reads `server/data/db.json`, uses the service-role key, imports in foreign-key order, and verifies row counts. It refuses to run if any target table already contains rows. The migration run completed for the current project; use it only for a new empty target, not for repeat syncs. There were no captain accounts in the source database. New captain credentials are stored in Supabase as scrypt hashes.

`npm run db:migrate` remains a SQL snapshot generator and does not write to Supabase. It skips base64/data-URL images rather than copying image contents into SQL. The generated SQL and JSON exports contain participant details and must be kept private.

The direct importer uploads embedded registration/gallery images to separate Cloudinary folders, then imports only the resulting URL and asset `public_id` into `students` / `gallery_photos`. See the [Cloudinary integration guide](./CLOUDINARY_INTEGRATION_GUIDE.md).

The importer ran against the configured project. The current import had no captain or gallery rows; embedded participant photos were moved to Cloudinary's registration folder.

After import, compare counts and spot-check:

- Event records and configured houses.
- Distinct students and registration rows.
- Published result places and judge submissions.
- Schedule, featured winners, live-day value, points configuration, gallery photos, and captain logins.
- Student points and house standings against the current app.

## 7. Deploy and cut over

1. Deploy the Express API to a Node application host. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STORAGE_BACKEND=supabase`, distinct `ADMIN_PIN` / `JUDGE_PIN`, `ADMIN_NAME`, and `JUDGE_NAME` in that host's environment settings.
2. Deploy the Vite frontend to a static host or serve `dist/` from Express. Configure the frontend to call the deployed Express API over HTTPS.
3. Confirm CORS or same-origin proxy configuration permits only the deployed frontend origin.
4. Test public pages, captain registration, Admin Desk, judging, publishing, and gallery uploads against the deployed API.
5. Run a single API instance. The current in-memory cache and multi-table persistence do not provide cross-instance transactions.
6. Keep a protected backup of the original JSON file until the deployment has been verified.

For ongoing operation, configure automated database backups, monitor Supabase storage/connection limits, and test restoring a backup before the sports event.
