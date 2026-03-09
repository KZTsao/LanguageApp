create table public.support_messages (
  id uuid not null default gen_random_uuid (),
  session_id uuid null,
  sender_role text null,
  content text null,
  meta jsonb null,
  is_read boolean null default false,
  created_at timestamp with time zone null default now(),
  client_message_id uuid null,
  is_read_by_admin boolean not null default false,
  is_read_by_user boolean not null default false,
  constraint support_messages_pkey primary key (id),
  constraint support_messages_session_id_fkey foreign KEY (session_id) references support_sessions (id) on delete CASCADE
) TABLESPACE pg_default;

create unique INDEX IF not exists support_messages_session_client_message_uidx on public.support_messages using btree (session_id, client_message_id) TABLESPACE pg_default
where
  (client_message_id is not null);