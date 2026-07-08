-- Reagent Log — full schema. Run this once in a NEW Supabase project's SQL Editor.

create table if not exists reagents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department text not null,
  lot_number text not null,
  unit text not null,
  quantity_received numeric not null,
  current_quantity numeric not null,
  expiry_date date not null,
  date_added date not null default current_date,
  added_by text not null,
  low_stock_threshold numeric not null default 0,
  -- Receiving inspection checklist (yes/no)
  intact_container boolean not null default true,
  complete_compound boolean not null default true,
  expiration_validity boolean not null default true,
  lot_matches_kit boolean not null default true,
  storage_condition_ok boolean not null default true,
  -- QC testing
  tested_by_qc boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists consumption_logs (
  id uuid primary key default gen_random_uuid(),
  reagent_id uuid references reagents(id) on delete cascade,
  amount numeric not null,
  date date not null,
  used_by text not null,
  note text,
  created_at timestamptz default now()
);

create table if not exists app_config (
  id int primary key default 1,
  lab_username text not null default 'lab',
  lab_password text not null default 'lab',
  admin_username text not null default 'basil',
  admin_password text not null default 'admin123',
  low_stock_default_percent numeric not null default 15
);

insert into app_config (id) values (1) on conflict (id) do nothing;

create table if not exists reagent_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department text not null,
  unit text not null default 'mL',
  created_at timestamptz default now()
);

alter table reagents enable row level security;
alter table consumption_logs enable row level security;
alter table app_config enable row level security;
alter table reagent_presets enable row level security;

create policy "allow all reagents" on reagents for all using (true) with check (true);
create policy "allow all consumption_logs" on consumption_logs for all using (true) with check (true);
create policy "allow all app_config" on app_config for all using (true) with check (true);
create policy "allow all reagent_presets" on reagent_presets for all using (true) with check (true);

-- Note: this is an open (RLS "allow all") setup — fine for an internal lab tool
-- with no patient data. Anyone with the app link and Supabase keys can read/write.
