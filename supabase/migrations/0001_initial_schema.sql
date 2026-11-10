-- =============================================================================
-- PCMS — 0001 : schéma initial
--
-- À exécuter une seule fois sur un projet Supabase vierge :
--   Supabase Dashboard > SQL Editor > coller ce fichier > Run
--   (ou `supabase db push` si la CLI Supabase est installée)
--
-- Périmètre V1 : profils et rôles, documents, brouillons IA, calendrier
-- éditorial, tâches, journal d'activité. Toutes les tables sont protégées par
-- Row Level Security : aucune donnée n'est accessible sans session.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Types énumérés
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'editor', 'reader');

create type public.document_status as enum ('brouillon', 'en_revue', 'valide', 'archive');

create type public.ai_draft_status as enum ('brouillon', 'en_revue', 'approuve', 'rejete');

create type public.calendar_status as enum (
  'idee', 'en_preparation', 'en_revue', 'pret', 'publie', 'annule'
);

create type public.task_status as enum ('a_faire', 'en_cours', 'bloque', 'termine');

create type public.task_priority as enum ('basse', 'normale', 'haute');

-- -----------------------------------------------------------------------------
-- Utilitaires
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Met à jour la colonne updated_at à chaque modification.';

-- -----------------------------------------------------------------------------
-- Profils
--
-- Un profil est créé automatiquement pour chaque compte auth.users. Le rôle par
-- défaut est « reader » (lecture seule) : l''élévation vers « admin » ou
-- « editor » est un acte administratif explicite (voir README).
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  role        public.user_role not null default 'reader',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Profil applicatif de chaque utilisateur, avec son rôle.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Fonctions d''autorisation (utilisées par les politiques RLS)
-- SECURITY DEFINER + search_path vide : évite toute récursion sur profiles.
-- -----------------------------------------------------------------------------
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role = 'admin' from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.can_write()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role in ('admin', 'editor') from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke all on function public.current_user_role() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.can_write() from public;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_write() to authenticated;

-- -----------------------------------------------------------------------------
-- Création automatique du profil à l''inscription
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Garde-fou : interdiction de s''auto-promouvoir
--
-- Une session authentifiée non admin ne peut pas modifier son propre rôle.
-- Les sessions sans utilisateur (SQL Editor, service_role) ne sont pas
-- bloquées, afin de laisser la voie d''administration explicite ouverte.
-- -----------------------------------------------------------------------------
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Modification du rôle interdite : seul un administrateur peut changer un rôle.';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- -----------------------------------------------------------------------------
-- Documents
-- -----------------------------------------------------------------------------
create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (length(trim(title)) > 0),
  description   text,
  category      text,
  status        public.document_status not null default 'brouillon',
  storage_path  text not null unique,
  file_name     text not null,
  mime_type     text not null,
  size_bytes    bigint not null check (size_bytes > 0),
  uploaded_by   uuid not null references auth.users (id) on delete restrict,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.documents is
  'Métadonnées des documents déposés. Les fichiers vivent dans le bucket privé « documents ».';

create index documents_created_at_idx on public.documents (created_at desc);
create index documents_uploaded_by_idx on public.documents (uploaded_by);
create index documents_status_idx on public.documents (status);

create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Brouillons IA
--
-- Le contenu généré est toujours un brouillon soumis à relecture humaine :
-- la valeur par défaut de statut le rappelle et la colonne reviewed_by permet
-- de tracer qui a validé.
-- -----------------------------------------------------------------------------
create table public.ai_drafts (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (length(trim(title)) > 0),
  brief         text not null check (length(trim(brief)) > 0),
  content       text not null,
  provider      text not null,
  model         text,
  status        public.ai_draft_status not null default 'brouillon',
  created_by    uuid not null references auth.users (id) on delete restrict,
  reviewed_by   uuid references auth.users (id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.ai_drafts is
  'Contenus générés par l''assistant. Toujours des brouillons jusqu''à validation humaine.';

create index ai_drafts_created_by_idx on public.ai_drafts (created_by);
create index ai_drafts_status_idx on public.ai_drafts (status);

create trigger ai_drafts_set_updated_at
  before update on public.ai_drafts
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Calendrier éditorial
-- -----------------------------------------------------------------------------
create table public.calendar_entries (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (length(trim(title)) > 0),
  channel       text not null,
  summary       text,
  status        public.calendar_status not null default 'idee',
  planned_for   timestamptz not null,
  document_id   uuid references public.documents (id) on delete set null,
  owner_id      uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index calendar_entries_planned_for_idx on public.calendar_entries (planned_for);
create index calendar_entries_status_idx on public.calendar_entries (status);

create trigger calendar_entries_set_updated_at
  before update on public.calendar_entries
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Tâches
-- -----------------------------------------------------------------------------
create table public.tasks (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null check (length(trim(title)) > 0),
  details             text,
  status              public.task_status not null default 'a_faire',
  priority            public.task_priority not null default 'normale',
  due_at              timestamptz,
  assignee_id         uuid references auth.users (id) on delete set null,
  calendar_entry_id   uuid references public.calendar_entries (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index tasks_status_idx on public.tasks (status);
create index tasks_due_at_idx on public.tasks (due_at);
create index tasks_assignee_idx on public.tasks (assignee_id);

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Journal d''activité
--
-- Alimenté uniquement par des triggers : aucune politique d''insertion n''est
-- accordée aux clients, le journal ne peut donc pas être falsifié depuis
-- l''application.
-- -----------------------------------------------------------------------------
create table public.activity_log (
  id           bigint generated always as identity primary key,
  actor_id     uuid references auth.users (id) on delete set null,
  action       text not null,
  entity_type  text not null,
  entity_id    text,
  summary      text,
  created_at   timestamptz not null default now()
);

create index activity_log_created_at_idx on public.activity_log (created_at desc);

create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity_id text;
  v_summary   text;
begin
  v_entity_id := coalesce(
    (to_jsonb(new) ->> 'id'),
    (to_jsonb(old) ->> 'id')
  );
  v_summary := coalesce(
    (to_jsonb(new) ->> 'title'),
    (to_jsonb(old) ->> 'title')
  );

  insert into public.activity_log (actor_id, action, entity_type, entity_id, summary)
  values (
    auth.uid(),
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    v_entity_id,
    v_summary
  );

  return null;
end;
$$;

create trigger documents_log_activity
  after insert or update or delete on public.documents
  for each row execute function public.log_activity();

create trigger ai_drafts_log_activity
  after insert or update or delete on public.ai_drafts
  for each row execute function public.log_activity();

create trigger calendar_entries_log_activity
  after insert or update or delete on public.calendar_entries
  for each row execute function public.log_activity();

create trigger tasks_log_activity
  after insert or update or delete on public.tasks
  for each row execute function public.log_activity();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.profiles         enable row level security;
alter table public.documents        enable row level security;
alter table public.ai_drafts        enable row level security;
alter table public.calendar_entries enable row level security;
alter table public.tasks            enable row level security;
alter table public.activity_log     enable row level security;

-- --- profiles ---------------------------------------------------------------
-- Tout membre authentifié voit l''annuaire (indispensable pour affecter une
-- tâche) ; seul l''intéressé ou un administrateur modifie une fiche.
create policy "profiles_select_authenticated"
  on public.profiles for select to authenticated
  using (true);

create policy "profiles_update_self_or_admin"
  on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy "profiles_delete_admin"
  on public.profiles for delete to authenticated
  using (public.is_admin());

-- --- documents --------------------------------------------------------------
create policy "documents_select_authenticated"
  on public.documents for select to authenticated
  using (true);

create policy "documents_insert_writers"
  on public.documents for insert to authenticated
  with check (public.can_write() and uploaded_by = auth.uid());

create policy "documents_update_writers"
  on public.documents for update to authenticated
  using (public.can_write())
  with check (public.can_write());

create policy "documents_delete_admin"
  on public.documents for delete to authenticated
  using (public.is_admin());

-- --- ai_drafts --------------------------------------------------------------
-- Les rédacteurs voient tous les brouillons ; les lecteurs ne voient que les leurs.
create policy "ai_drafts_select_author_or_writer"
  on public.ai_drafts for select to authenticated
  using (created_by = auth.uid() or public.can_write());

create policy "ai_drafts_insert_writers"
  on public.ai_drafts for insert to authenticated
  with check (public.can_write() and created_by = auth.uid());

create policy "ai_drafts_update_author_or_admin"
  on public.ai_drafts for update to authenticated
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

create policy "ai_drafts_delete_admin"
  on public.ai_drafts for delete to authenticated
  using (public.is_admin());

-- --- calendar_entries -------------------------------------------------------
create policy "calendar_select_authenticated"
  on public.calendar_entries for select to authenticated
  using (true);

create policy "calendar_insert_writers"
  on public.calendar_entries for insert to authenticated
  with check (public.can_write());

create policy "calendar_update_writers"
  on public.calendar_entries for update to authenticated
  using (public.can_write())
  with check (public.can_write());

create policy "calendar_delete_admin"
  on public.calendar_entries for delete to authenticated
  using (public.is_admin());

-- --- tasks ------------------------------------------------------------------
create policy "tasks_select_authenticated"
  on public.tasks for select to authenticated
  using (true);

create policy "tasks_insert_writers"
  on public.tasks for insert to authenticated
  with check (public.can_write());

-- Le titulaire d''une tâche peut la faire avancer, même en lecture seule.
create policy "tasks_update_writer_or_assignee"
  on public.tasks for update to authenticated
  using (public.can_write() or assignee_id = auth.uid())
  with check (public.can_write() or assignee_id = auth.uid());

create policy "tasks_delete_admin"
  on public.tasks for delete to authenticated
  using (public.is_admin());

-- --- activity_log -----------------------------------------------------------
-- Lecture seule côté client. L''écriture passe par le trigger SECURITY DEFINER.
create policy "activity_log_select_authenticated"
  on public.activity_log for select to authenticated
  using (true);
