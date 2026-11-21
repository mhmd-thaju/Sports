-- Sports Meet Supabase schema setup.
-- Run only once in a new Supabase project. For current JSON data, use the
-- authenticated Admin SQL export or `npm run db:migrate`.

create table if not exists tournament_config (
  id text primary key check (id = 'current'),
  name text not null,
  max_events_per_student integer not null default 3,
  categories jsonb not null default '["Athletics", "Games"]'::jsonb,
  genders jsonb not null default '["Boys", "Girls"]'::jsonb,
  category_points jsonb not null default '{"Athletics":[5,3,1],"Games":[10,5,2]}'::jsonb,
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
  places text[] not null,
  published_at timestamptz not null default now()
);

create table if not exists judge_submissions (
  event_id text primary key references events(id) on delete cascade,
  judge_name text not null,
  positions jsonb not null,
  submitted_at timestamptz not null default now()
);

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
create index if not exists audit_logs_occurred_at_idx on audit_logs(occurred_at desc);

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
