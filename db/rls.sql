-- Row level security. Applied by db/migrate.ts after schema migrations; idempotent.
-- The app connects as a privileged role and switches to `app_user` inside withUser() transactions,
-- so every user-scoped query is filtered by these policies even if application code has a bug.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then create role app_user nologin; end if;
end $$;
--> statement-breakpoint
grant usage on schema public to app_user;
--> statement-breakpoint
grant select, insert, update, delete on all tables in schema public to app_user;
--> statement-breakpoint
revoke all on "user", "session", "account", "verification", "jobs", "rate_limits", "outbox" from app_user;
--> statement-breakpoint
grant select (id, name, email, image, locale) on "user" to app_user;
--> statement-breakpoint

create or replace function app_uid() returns text language sql stable as $$ select nullif(current_setting('app.user_id', true), '') $$;
--> statement-breakpoint
create or replace function app_ws_ids() returns setof uuid language sql stable security definer set search_path = public as
$$ select workspace_id from memberships where user_id = app_uid() $$;
--> statement-breakpoint
create or replace function app_tutor_ws_ids() returns setof uuid language sql stable security definer set search_path = public as
$$ select workspace_id from memberships where user_id = app_uid() and role in ('owner','tutor') $$;
--> statement-breakpoint
create or replace function app_student_ids() returns setof uuid language sql stable security definer set search_path = public as
$$ select id from students where user_id = app_uid()
   union select student_id from parent_links where parent_user_id = app_uid() $$;
--> statement-breakpoint

-- helper: (re)create a policy
create or replace function _policy(tbl text, pname text, cmd text, using_expr text, check_expr text default null) returns void language plpgsql as $$
begin
  execute format('drop policy if exists %I on %I', pname, tbl);
  execute format('create policy %I on %I for %s to app_user %s %s', pname, tbl, cmd,
    case when cmd = 'insert' then '' else 'using (' || using_expr || ')' end,
    case when cmd in ('insert','update','all') then 'with check (' || coalesce(check_expr, using_expr) || ')' else '' end);
end $$;
--> statement-breakpoint

do $$
declare t text;
begin
  foreach t in array array['workspaces','memberships','students','invites','parent_links','groups','group_members',
    'subjects','topics','topic_prereqs','questions','question_versions','question_topics','question_media',
    'assessments','assessment_items','blueprint_rules','assignments','attempts','attempt_items',
    'mastery','mastery_events','review_schedule','activity_days','lessons','lesson_students',
    'notifications','notification_prefs','ai_generations','audit_log']
  loop execute format('alter table %I enable row level security', t); end loop;
end $$;
--> statement-breakpoint

-- ── workspace & people ────────────────────────────────────────────────────
select _policy('workspaces','ws_member_read','select','id in (select app_ws_ids())');
--> statement-breakpoint
select _policy('workspaces','ws_owner_write','update','owner_id = app_uid()');
--> statement-breakpoint
select _policy('memberships','mem_read','select','user_id = app_uid() or workspace_id in (select app_tutor_ws_ids())');
--> statement-breakpoint
select _policy('students','students_tutor','all','workspace_id in (select app_tutor_ws_ids())');
--> statement-breakpoint
select _policy('students','students_self_read','select','id in (select app_student_ids())');
--> statement-breakpoint
select _policy('invites','invites_tutor','all','workspace_id in (select app_tutor_ws_ids())');
--> statement-breakpoint
select _policy('parent_links','pl_tutor','all','workspace_id in (select app_tutor_ws_ids())');
--> statement-breakpoint
select _policy('parent_links','pl_self','select','parent_user_id = app_uid()');
--> statement-breakpoint
select _policy('groups','groups_tutor','all','workspace_id in (select app_tutor_ws_ids())');
--> statement-breakpoint
select _policy('group_members','gm_tutor','all','group_id in (select id from groups where workspace_id in (select app_tutor_ws_ids()))');
--> statement-breakpoint

-- ── catalog: global rows (workspace_id is null) readable by everyone signed in ──
select _policy('subjects','subjects_read','select','workspace_id is null or workspace_id in (select app_ws_ids())');
--> statement-breakpoint
select _policy('subjects','subjects_write','all','workspace_id in (select app_tutor_ws_ids())');
--> statement-breakpoint
select _policy('topics','topics_read','select','workspace_id is null or workspace_id in (select app_ws_ids())');
--> statement-breakpoint
select _policy('topics','topics_write','all','workspace_id in (select app_tutor_ws_ids())');
--> statement-breakpoint
select _policy('topic_prereqs','prereqs_read','select','true');
--> statement-breakpoint
select _policy('topic_prereqs','prereqs_write','all','topic_id in (select id from topics where workspace_id in (select app_tutor_ws_ids()))');
--> statement-breakpoint

-- ── question bank: tutors only. Students NEVER read these tables; the server projects
--    a student-safe view (no answer / explanation) through the system connection. ──
select _policy('questions','q_read','select','(workspace_id is null and exists (select 1 from app_tutor_ws_ids())) or workspace_id in (select app_tutor_ws_ids())');
--> statement-breakpoint
select _policy('questions','q_write','all','workspace_id in (select app_tutor_ws_ids())');
--> statement-breakpoint
select _policy('question_versions','qv_read','select','question_id in (select id from questions)');
--> statement-breakpoint
select _policy('question_versions','qv_write','all','question_id in (select id from questions where workspace_id in (select app_tutor_ws_ids()))');
--> statement-breakpoint
select _policy('question_topics','qt_read','select','question_id in (select id from questions)');
--> statement-breakpoint
select _policy('question_topics','qt_write','all','question_id in (select id from questions where workspace_id in (select app_tutor_ws_ids()))');
--> statement-breakpoint
select _policy('question_media','qm_all','all','question_id in (select id from questions where workspace_id in (select app_tutor_ws_ids()))');
--> statement-breakpoint

-- ── assessments ───────────────────────────────────────────────────────────
select _policy('assessments','as_tutor','all','workspace_id in (select app_tutor_ws_ids())');
--> statement-breakpoint
select _policy('assessments','as_student_read','select','id in (select assessment_id from assignments where student_id in (select app_student_ids()))');
--> statement-breakpoint
select _policy('assessment_items','ai_tutor','all','assessment_id in (select id from assessments where workspace_id in (select app_tutor_ws_ids()))');
--> statement-breakpoint
select _policy('blueprint_rules','br_tutor','all','assessment_id in (select id from assessments where workspace_id in (select app_tutor_ws_ids()))');
--> statement-breakpoint
select _policy('assignments','asg_tutor','all','workspace_id in (select app_tutor_ws_ids())');
--> statement-breakpoint
select _policy('assignments','asg_student_read','select','student_id in (select app_student_ids())');
--> statement-breakpoint
select _policy('attempts','att_tutor','all','workspace_id in (select app_tutor_ws_ids())');
--> statement-breakpoint
select _policy('attempts','att_student_read','select','student_id in (select app_student_ids())');
--> statement-breakpoint
select _policy('attempt_items','ati_tutor','all','attempt_id in (select id from attempts where workspace_id in (select app_tutor_ws_ids()))');
--> statement-breakpoint
select _policy('attempt_items','ati_student_read','select','attempt_id in (select id from attempts where student_id in (select app_student_ids()))');
--> statement-breakpoint
-- a student may change only the draft answer of their own in-progress attempt
select _policy('attempt_items','ati_student_answer','update',
  'attempt_id in (select id from attempts where status = ''in_progress'' and student_id in (select id from students where user_id = app_uid()))');
--> statement-breakpoint

-- ── mastery & activity ────────────────────────────────────────────────────
select _policy('mastery','m_tutor','select','student_id in (select id from students where workspace_id in (select app_tutor_ws_ids()))');
--> statement-breakpoint
select _policy('mastery','m_student','select','student_id in (select app_student_ids())');
--> statement-breakpoint
select _policy('mastery_events','me_tutor','select','student_id in (select id from students where workspace_id in (select app_tutor_ws_ids()))');
--> statement-breakpoint
select _policy('mastery_events','me_student','select','student_id in (select app_student_ids())');
--> statement-breakpoint
select _policy('review_schedule','rs_tutor','select','student_id in (select id from students where workspace_id in (select app_tutor_ws_ids()))');
--> statement-breakpoint
select _policy('review_schedule','rs_student','select','student_id in (select app_student_ids())');
--> statement-breakpoint
select _policy('activity_days','ad_tutor','select','student_id in (select id from students where workspace_id in (select app_tutor_ws_ids()))');
--> statement-breakpoint
select _policy('activity_days','ad_student','select','student_id in (select app_student_ids())');
--> statement-breakpoint

-- ── lessons, notifications, ai, audit ──────────────────────────────────────
select _policy('lessons','l_tutor','all','workspace_id in (select app_tutor_ws_ids())');
--> statement-breakpoint
select _policy('lessons','l_student','select','id in (select lesson_id from lesson_students where student_id in (select app_student_ids()))');
--> statement-breakpoint
select _policy('lesson_students','ls_tutor','all','lesson_id in (select id from lessons where workspace_id in (select app_tutor_ws_ids()))');
--> statement-breakpoint
select _policy('lesson_students','ls_student','select','student_id in (select app_student_ids())');
--> statement-breakpoint
select _policy('notifications','n_own','all','user_id = app_uid()');
--> statement-breakpoint
select _policy('notification_prefs','np_own','all','user_id = app_uid()');
--> statement-breakpoint
select _policy('ai_generations','aig_tutor','select','workspace_id in (select app_tutor_ws_ids())');
--> statement-breakpoint
select _policy('audit_log','audit_tutor_read','select','workspace_id in (select app_tutor_ws_ids())');
--> statement-breakpoint
select _policy('audit_log','audit_insert','insert','true','workspace_id in (select app_tutor_ws_ids())');
--> statement-breakpoint

-- answers are frozen once an attempt is submitted (defence against late writes from any code path)
create or replace function _freeze_submitted_answers() returns trigger language plpgsql as $$
begin
  if new.answer is distinct from old.answer
     and exists (select 1 from attempts a where a.id = new.attempt_id and a.submitted_at is not null) then
    raise exception 'attempt already submitted';
  end if;
  return new;
end $$;
--> statement-breakpoint
drop trigger if exists attempt_items_freeze on attempt_items;
--> statement-breakpoint
create trigger attempt_items_freeze before update on attempt_items for each row execute function _freeze_submitted_answers();
--> statement-breakpoint
create extension if not exists pg_trgm;
--> statement-breakpoint
create index if not exists questions_hash_trgm_idx on questions using gin (content_hash gin_trgm_ops);
