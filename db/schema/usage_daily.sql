create table public.usage_daily (
  user_id uuid not null,
  day date not null,
  llm_completion_tokens bigint not null default 0,
  tts_chars bigint not null default 0,
  updated_at timestamp with time zone not null default now(),
  asr_seconds bigint not null default 0,
  llm_tokens_in bigint not null default 0,
  llm_tokens_out bigint not null default 0,
  llm_tokens_total bigint not null default 0,
  constraint usage_daily_pkey primary key (user_id, day)
) TABLESPACE pg_default;