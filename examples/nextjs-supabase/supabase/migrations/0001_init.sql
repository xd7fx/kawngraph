-- Initial schema for the example merchant store.

create table stores (
  id uuid primary key default gen_random_uuid(),
  zid_store_id text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table store_tokens (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores (id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index store_tokens_store_id_idx on store_tokens (store_id);
