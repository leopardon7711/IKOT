-- IKOT 本番用 Supabase SQL
-- Supabase Dashboard > SQL Editor に、このファイルを丸ごと貼って Run。
-- その後 Authentication > Providers で Anonymous Sign-Ins を ON にする。
-- ブラウザには publishable/anon key のみ入れる。service_role key は絶対に入れない。

create extension if not exists pgcrypto;

create table if not exists public.ikot_families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.ikot_family_members (
  family_id uuid not null references public.ikot_families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (family_id,user_id)
);

create table if not exists public.ikot_places (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.ikot_families(id) on delete cascade,
  name text not null,
  who text not null default '俺',
  state text not null default '行きたい',
  category text not null default 'その他',
  source_url text,
  place text,
  budget text,
  ages text,
  duration text,
  photo_url text,
  memo text,
  votes integer not null default 0,
  created_by uuid not null default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ikot_votes (
  place_id uuid not null references public.ikot_places(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(place_id,user_id)
);

create index if not exists ikot_family_members_user_idx on public.ikot_family_members(user_id);
create index if not exists ikot_places_family_idx on public.ikot_places(family_id);
create index if not exists ikot_votes_place_idx on public.ikot_votes(place_id);

alter table public.ikot_families enable row level security;
alter table public.ikot_family_members enable row level security;
alter table public.ikot_places enable row level security;
alter table public.ikot_votes enable row level security;

create or replace function public.ikot_is_member(p_family uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.ikot_family_members m where m.family_id=p_family and m.user_id=auth.uid());
$$;

create or replace function public.ikot_make_code()
returns text language plpgsql as $$
declare c text;
begin
  loop
    c := upper(substr(encode(gen_random_bytes(5),'hex'),1,6));
    exit when not exists(select 1 from public.ikot_families where invite_code=c);
  end loop;
  return c;
end;
$$;

create or replace function public.ikot_create_family(p_name text)
returns table(id uuid,name text,invite_code text)
language plpgsql security definer set search_path=public as $$
declare fid uuid; code text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  code := public.ikot_make_code();
  insert into public.ikot_families(name,invite_code,created_by) values(coalesce(nullif(trim(p_name),''),'IKOTファミリー'),code,auth.uid()) returning ikot_families.id into fid;
  insert into public.ikot_family_members(family_id,user_id,role) values(fid,auth.uid(),'owner');
  return query select f.id,f.name,f.invite_code from public.ikot_families f where f.id=fid;
end;
$$;

create or replace function public.ikot_join_family(p_code text)
returns table(id uuid,name text,invite_code text)
language plpgsql security definer set search_path=public as $$
declare fid uuid;
begin
  select f.id into fid from public.ikot_families f where upper(f.invite_code)=upper(trim(p_code));
  if fid is null then raise exception 'family not found'; end if;
  insert into public.ikot_family_members(family_id,user_id,role) values(fid,auth.uid(),'member')
    on conflict (family_id,user_id) do nothing;
  return query select f.id,f.name,f.invite_code from public.ikot_families f where f.id=fid;
end;
$$;

create or replace function public.ikot_my_family()
returns table(id uuid,name text,invite_code text)
language sql stable security definer set search_path=public as $$
  select f.id,f.name,f.invite_code
  from public.ikot_families f
  join public.ikot_family_members m on m.family_id=f.id
  where m.user_id=auth.uid()
  order by m.joined_at desc limit 1;
$$;

create or replace function public.ikot_vote(p_place_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.ikot_places p join public.ikot_family_members m on m.family_id=p.family_id where p.id=p_place_id and m.user_id=auth.uid()) then
    raise exception 'not a family member';
  end if;
  insert into public.ikot_votes(place_id,user_id) values(p_place_id,auth.uid()) on conflict do nothing;
  update public.ikot_places p set votes=(select count(*) from public.ikot_votes v where v.place_id=p.id), updated_at=now() where p.id=p_place_id;
end;
$$;

drop policy if exists "family members read families" on public.ikot_families;
create policy "family members read families" on public.ikot_families for select to authenticated
using (public.ikot_is_member(id));

drop policy if exists "members read membership" on public.ikot_family_members;
create policy "members read membership" on public.ikot_family_members for select to authenticated
using (public.ikot_is_member(family_id));

drop policy if exists "members read places" on public.ikot_places;
create policy "members read places" on public.ikot_places for select to authenticated
using (public.ikot_is_member(family_id));

drop policy if exists "members insert places" on public.ikot_places;
create policy "members insert places" on public.ikot_places for insert to authenticated
with check (public.ikot_is_member(family_id) and created_by=auth.uid());

drop policy if exists "members update places" on public.ikot_places;
create policy "members update places" on public.ikot_places for update to authenticated
using (public.ikot_is_member(family_id))
with check (public.ikot_is_member(family_id));

drop policy if exists "members delete places" on public.ikot_places;
create policy "members delete places" on public.ikot_places for delete to authenticated
using (public.ikot_is_member(family_id));

drop policy if exists "members read votes" on public.ikot_votes;
create policy "members read votes" on public.ikot_votes for select to authenticated
using (exists(select 1 from public.ikot_places p where p.id=place_id and public.ikot_is_member(p.family_id)));

grant execute on function public.ikot_create_family(text) to authenticated;
grant execute on function public.ikot_join_family(text) to authenticated;
grant execute on function public.ikot_my_family() to authenticated;
grant execute on function public.ikot_vote(uuid) to authenticated;

-- Realtime: Supabase Dashboard > Database > Replication で ikot_places を realtime 対象に追加。


-- ===== 2026-08 安定化パッチ =====
-- 既存環境に再実行しても、古い再帰RLSを削除して安全なポリシーへ揃える。
create extension if not exists pgcrypto with schema extensions;

create or replace function public.ikot_is_family_member(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.ikot_family_members
    where family_id=p_family_id and user_id=auth.uid()
  );
$$;

create or replace function public.ikot_is_member(p_family uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.ikot_is_family_member(p_family);
$$;

create or replace function public.ikot_make_code()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare c text;
begin
  loop
    c := upper(substr(encode(gen_random_bytes(6),'hex'),1,8));
    exit when not exists(select 1 from public.ikot_families where invite_code=c);
  end loop;
  return c;
end;
$$;

create or replace function public.ikot_create_family(p_name text)
returns table(id uuid,name text,invite_code text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare fid uuid; code text;
begin
  if auth.uid() is null then raise exception 'ログインが必要です'; end if;
  code := public.ikot_make_code();
  insert into public.ikot_families(name,invite_code,created_by)
  values(coalesce(nullif(trim(p_name),''),'IKOTファミリー'),code,auth.uid())
  returning ikot_families.id into fid;
  insert into public.ikot_family_members(family_id,user_id,role)
  values(fid,auth.uid(),'owner') on conflict do nothing;
  return query select f.id,f.name,f.invite_code from public.ikot_families f where f.id=fid;
end;
$$;

-- 同じ人がもう一度押したら投票を取り消す（トグル式）
create or replace function public.ikot_vote(p_place_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists(
    select 1 from public.ikot_places p
    where p.id=p_place_id and public.ikot_is_family_member(p.family_id)
  ) then
    raise exception 'not a family member';
  end if;

  if exists(select 1 from public.ikot_votes where place_id=p_place_id and user_id=auth.uid()) then
    delete from public.ikot_votes where place_id=p_place_id and user_id=auth.uid();
  else
    insert into public.ikot_votes(place_id,user_id) values(p_place_id,auth.uid());
  end if;

  update public.ikot_places p
  set votes=(select count(*) from public.ikot_votes v where v.place_id=p.id), updated_at=now()
  where p.id=p_place_id;
end;
$$;

-- 過去に作ったポリシー名も含めて削除し、循環参照しない形へ統一。
drop policy if exists "members can view family members" on public.ikot_family_members;
drop policy if exists "members read membership" on public.ikot_family_members;
drop policy if exists "メンバーは家族メンバーを見ることができます" on public.ikot_family_members;
create policy "メンバーは家族メンバーを見ることができます"
on public.ikot_family_members for select to authenticated
using (user_id=auth.uid() or public.ikot_is_family_member(family_id));

drop policy if exists "family members read families" on public.ikot_families;
create policy "family members read families"
on public.ikot_families for select to authenticated
using (public.ikot_is_family_member(id));

drop policy if exists "members read places" on public.ikot_places;
drop policy if exists "メンバーは場所を見ることができます" on public.ikot_places;
create policy "メンバーは場所を見ることができます"
on public.ikot_places for select to authenticated
using (public.ikot_is_family_member(family_id));

drop policy if exists "members insert places" on public.ikot_places;
drop policy if exists "メンバーは場所を挿入できます" on public.ikot_places;
create policy "メンバーは場所を挿入できます"
on public.ikot_places for insert to authenticated
with check (public.ikot_is_family_member(family_id) and created_by=auth.uid());

drop policy if exists "members update places" on public.ikot_places;
drop policy if exists "メンバーは場所を更新できます" on public.ikot_places;
create policy "メンバーは場所を更新できます"
on public.ikot_places for update to authenticated
using (public.ikot_is_family_member(family_id))
with check (public.ikot_is_family_member(family_id));

drop policy if exists "members delete places" on public.ikot_places;
drop policy if exists "メンバーは場所を削除できます" on public.ikot_places;
create policy "メンバーは場所を削除できます"
on public.ikot_places for delete to authenticated
using (public.ikot_is_family_member(family_id));

drop policy if exists "members read votes" on public.ikot_votes;
create policy "members read votes"
on public.ikot_votes for select to authenticated
using (exists(select 1 from public.ikot_places p where p.id=place_id and public.ikot_is_family_member(p.family_id)));

grant execute on function public.ikot_is_family_member(uuid) to authenticated;
grant execute on function public.ikot_create_family(text) to authenticated;
grant execute on function public.ikot_join_family(text) to authenticated;
grant execute on function public.ikot_my_family() to authenticated;
grant execute on function public.ikot_vote(uuid) to authenticated;

-- ===== v6: 動画URL保存対応 =====
alter table public.ikot_places add column if not exists video_url text;
