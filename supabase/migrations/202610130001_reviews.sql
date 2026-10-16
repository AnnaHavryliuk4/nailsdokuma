-- Nailsdokuma public reviews with admin-only moderation.
-- Browser clients use only the Supabase publishable key. RLS is the authority.
create table if not exists public.review_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null check (char_length(btrim(customer_name)) between 2 and 60),
  rating smallint not null check (rating between 1 and 5),
  review_text text not null check (char_length(btrim(review_text)) between 10 and 1000),
  language text not null default 'tr' check (language in ('tr', 'ua')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists reviews_status_created_idx on public.reviews (status, created_at desc);

create or replace function public.is_review_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.review_admins a
    where a.user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_review_admin() from public, anon;
grant execute on function public.is_review_admin() to authenticated;

alter table public.reviews enable row level security;
alter table public.review_admins enable row level security;

revoke all on public.reviews from public, anon, authenticated;
revoke all on public.review_admins from public, anon, authenticated;
-- Clear possible column-level grants too before granting the minimum below.
revoke insert (id, customer_name, rating, review_text, language, status, created_at) on public.reviews from public, anon, authenticated;
revoke update (id, customer_name, rating, review_text, language, status, created_at) on public.reviews from public, anon, authenticated;
revoke select (user_id, created_at) on public.review_admins from public, anon, authenticated;
revoke insert (user_id, created_at) on public.review_admins from public, anon, authenticated;
revoke update (user_id, created_at) on public.review_admins from public, anon, authenticated;
grant select on public.reviews to anon, authenticated;
grant insert (customer_name, rating, review_text, language) on public.reviews to anon, authenticated;
grant update (status) on public.reviews to authenticated;
grant delete on public.reviews to authenticated;
grant select (user_id) on public.review_admins to authenticated;

-- These feature tables are dedicated to this review system. Remove every previous
-- policy on them so a leftover permissive policy cannot widen access on a rerun.
do $policy_reset$
declare
  existing_policy record;
begin
  for existing_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('reviews', 'review_admins')
  loop
    execute format('drop policy %I on %I.%I', existing_policy.policyname, existing_policy.schemaname, existing_policy.tablename);
  end loop;
end;
$policy_reset$;

create policy "Anyone reads approved reviews"
  on public.reviews for select to anon
  using (status = 'approved');
create policy "Signed-in visitors read approved reviews"
  on public.reviews for select to authenticated
  using (status = 'approved');
create policy "Admins read every review"
  on public.reviews for select to authenticated
  using ((select public.is_review_admin()));
create policy "Visitors submit pending reviews"
  on public.reviews for insert to anon, authenticated
  with check (status = 'pending');
create policy "Admins moderate reviews"
  on public.reviews for update to authenticated
  using ((select public.is_review_admin()))
  with check ((select public.is_review_admin()));
create policy "Admins delete reviews"
  on public.reviews for delete to authenticated
  using ((select public.is_review_admin()));
create policy "Users can verify own admin membership"
  on public.review_admins for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Admins can view admin memberships"
  on public.review_admins for select to authenticated
  using ((select public.is_review_admin()));

create or replace function public.guard_review_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'pending' then
    raise exception 'New reviews must be pending';
  end if;
  new.customer_name := btrim(new.customer_name);
  new.review_text := btrim(new.review_text);
  if char_length(new.customer_name) not between 2 and 60 then
    raise exception 'Name must contain 2 to 60 characters';
  end if;
  if char_length(new.review_text) not between 10 and 1000 then
    raise exception 'Review must contain 10 to 1000 characters';
  end if;
  if exists (
    select 1 from public.reviews r
    where lower(r.customer_name) = lower(new.customer_name)
      and lower(r.review_text) = lower(new.review_text)
      and r.created_at > now() - interval '5 minutes'
  ) then
    raise exception 'Duplicate review submitted recently';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_review_submission() from public, anon, authenticated;
drop trigger if exists guard_review_submission on public.reviews;
create trigger guard_review_submission
  before insert on public.reviews
  for each row execute function public.guard_review_submission();

-- Admin bootstrap (run manually after creating the owner in Authentication > Users):
-- insert into public.review_admins (user_id)
-- values ('PASTE-ADMIN-USER-UID-HERE')
-- on conflict do nothing;
