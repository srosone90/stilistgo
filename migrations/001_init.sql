-- Le Ribelle Salon — Database migration
-- Run this in the Supabase Dashboard → SQL Editor

-- Transactions table
create table if not exists transactions (
  id            text          primary key,
  type          text          not null check (type in ('income', 'expense')),
  date          date          not null,
  amount        numeric(10,2) not null check (amount > 0),
  -- Income fields
  category      text,
  source        text,
  method        text,
  -- Expense fields
  supplier      text,
  expense_type  text,
  due_date      date,
  status        text,
  -- Common
  notes         text          default '',
  created_at    timestamptz   default now()
);

-- Settings table (single row, id = 1)
create table if not exists app_settings (
  id          integer       primary key default 1,
  tax_rate    numeric(5,2)  default 25,
  dark_mode   boolean       default true,
  updated_at  timestamptz   default now()
);

-- Default settings row
insert into app_settings (id, tax_rate, dark_mode)
values (1, 25, true)
on conflict (id) do nothing;

-- Enable Row Level Security
alter table transactions   enable row level security;
alter table app_settings   enable row level security;

-- Policies: allow everything (single-user private app)
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename='transactions' and policyname='Allow all'
  ) then
    create policy "Allow all" on transactions for all using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where tablename='app_settings' and policyname='Allow all'
  ) then
    create policy "Allow all" on app_settings for all using (true) with check (true);
  end if;
end $$;
