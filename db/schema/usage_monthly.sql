create table public.usage_monthly (
  user_id uuid not null,
  ym date not null,
  llm_tokens_in bigint not null default 0,
  llm_tokens_out bigint not null default 0,
  llm_tokens_total bigint not null default 0,
  tts_chars_total bigint not null default 0,
  updated_at timestamp with time zone not null default now(),
  asr_seconds_total bigint not null default 0,
  constraint usage_monthly_pkey primary key (user_id, ym)
) TABLESPACE pg_default;

create index IF not exists usage_monthly_user_id_idx on public.usage_monthly using btree (user_id) TABLESPACE pg_default;

create index IF not exists usage_monthly_ym_idx on public.usage_monthly using btree (ym) TABLESPACE pg_default;