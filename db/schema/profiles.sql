create table public.profiles (
  id uuid not null,
  email text null,
  full_name text null,
  plan text not null default 'free'::text,
  created_at timestamp with time zone not null default now(),
  visit_count bigint not null default 0,
  last_visit_at timestamp with time zone null,
  llm_tokens_in_total bigint not null default 0,
  llm_tokens_out_total bigint not null default 0,
  llm_tokens_total bigint not null default 0,
  tts_chars_total bigint not null default 0,
  constraint profiles_pkey primary key (id)
) TABLESPACE pg_default;