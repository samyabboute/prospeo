-- ═══════════════════════════════════════════════════════════════
--  PROSPEO — Complete Supabase Database Setup
--  Run this entire script in Supabase → SQL Editor → New Query
--  European Standards · GDPR Compliant · Row Level Security
-- ═══════════════════════════════════════════════════════════════

-- ── 1. LEADS TABLE ──────────────────────────────────────────────
create table if not exists leads (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references auth.users(id) on delete cascade not null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  -- Contact
  first_name      text not null,
  last_name       text not null,
  email           text,
  phone           text,
  job_title       text,

  -- Company
  company         text,
  client_type     text check (client_type in ('company','freelancer','individual')) default 'company',
  country         text default 'FR',
  vat_number      text,

  -- Pipeline
  stage           text check (stage in ('new','contacted','qualified','proposal','won','lost')) default 'new',
  deal_value      numeric(12,2),
  expected_close_date date,
  probability     integer check (probability between 0 and 100) default 50,

  -- Meta
  source          text,  -- how you found this lead
  notes           text,
  tags            text[]
);

-- ── 2. CLIENTS TABLE ────────────────────────────────────────────
create table if not exists clients (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references auth.users(id) on delete cascade not null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  -- Type
  client_type     text check (client_type in ('company','freelancer','individual')) default 'company',

  -- Company info
  company         text,
  vat_number      text,
  vat_verified    boolean default false,
  website         text,
  industry        text,
  company_size    text,

  -- Contact person
  first_name      text not null,
  last_name       text not null,
  email           text not null,
  phone           text,
  job_title       text,

  -- Address (EU standard)
  street          text,
  city            text,
  postal_code     text,
  country         text default 'FR',

  -- Meta
  notes           text,
  tags            text[]
);

-- ── 3. EVENTS / CALENDAR TABLE ──────────────────────────────────
create table if not exists events (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references auth.users(id) on delete cascade not null,
  created_at      timestamptz default now(),

  title           text not null,
  event_date      date not null,
  event_time      time,
  duration        integer default 60,  -- minutes
  type            text check (type in ('meeting','call','task','deadline')) default 'meeting',

  -- Links
  client          text,  -- free text or client id
  lead_id         uuid references leads(id) on delete set null,
  client_id       uuid references clients(id) on delete set null,

  -- Details
  location        text,
  description     text,
  reminder        boolean default false,
  completed       boolean default false
);

-- ── 4. INVOICES TABLE ───────────────────────────────────────────
create table if not exists invoices (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references auth.users(id) on delete cascade not null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  -- Identification
  invoice_number  text not null,
  type            text check (type in ('invoice','quote','credit')) default 'invoice',
  status          text check (status in ('draft','sent','paid','overdue','cancelled')) default 'draft',

  -- Client
  client_name     text not null,
  client_email    text,
  client_address  text,
  client_vat      text,
  client_id       uuid references clients(id) on delete set null,

  -- Dates
  issue_date      date not null,
  due_date        date,
  paid_date       date,

  -- Amounts (EU: HT + TVA = TTC)
  currency        text default 'EUR',
  line_items      jsonb,         -- [{desc, qty, unit_price, total_ht}]
  subtotal        numeric(12,2), -- Total HT
  vat_rate        numeric(5,2) default 20.00,
  vat_amount      numeric(12,2), -- Montant TVA
  total           numeric(12,2), -- Total TTC

  -- EU compliance
  notes           text,          -- Payment terms, IBAN, legal mentions
  legal_mention   text           -- e.g. "TVA non applicable art. 293B CGI"
);

-- ══ ROW LEVEL SECURITY ══════════════════════════════════════════
-- Each user can only see and modify their own data

alter table leads   enable row level security;
alter table clients enable row level security;
alter table events  enable row level security;
alter table invoices enable row level security;

-- Leads
create policy "leads: user owns" on leads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Clients
create policy "clients: user owns" on clients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Events
create policy "events: user owns" on events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Invoices
create policy "invoices: user owns" on invoices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ══ AUTO-UPDATE updated_at ══════════════════════════════════════
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger leads_updated_at   before update on leads   for each row execute function update_updated_at();
create trigger clients_updated_at before update on clients for each row execute function update_updated_at();
create trigger invoices_updated_at before update on invoices for each row execute function update_updated_at();

-- ══ INDEXES (performance) ══════════════════════════════════════
create index if not exists idx_leads_user   on leads(user_id);
create index if not exists idx_leads_stage  on leads(stage);
create index if not exists idx_clients_user on clients(user_id);
create index if not exists idx_events_user  on events(user_id);
create index if not exists idx_events_date  on events(event_date);
create index if not exists idx_invoices_user on invoices(user_id);
create index if not exists idx_invoices_status on invoices(status);

-- ══ DEMO USER SETUP (OPTIONAL) ════════════════════════════════
-- After running this script, create a demo account in:
-- Supabase → Authentication → Users → Invite user
-- Email: demo@prospeo.app  Password: Demo1234!

-- ══ DONE ══════════════════════════════════════════════════════
-- Tables created: leads, clients, events, invoices
-- RLS enabled: each user sees only their own data
-- Triggers: updated_at auto-managed
-- Indexes: optimized for common queries
