create table public.support_sessions (
  id uuid not null default gen_random_uuid (),
  anon_id text null,
  ui_lang text null,
  page_path text null,
  meta jsonb null,
  created_at timestamp with time zone null default now(),
  constraint support_sessions_pkey primary key (id)
) TABLESPACE pg_default;