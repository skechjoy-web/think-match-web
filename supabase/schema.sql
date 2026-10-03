-- THINK & MATCH: khởi tạo cơ sở dữ liệu Supabase.
-- Dán toàn bộ nội dung này vào Supabase > SQL Editor rồi bấm Run. Chạy lại nhiều lần cũng an toàn.

create table if not exists public.tm_state (
  id int primary key,
  version bigint not null default 0,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.tm_public (
  id int primary key,
  version bigint not null default 0,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.tm_questions (
  id text primary key,
  grp text not null check (grp in ('main','backup','tie','est')),
  q_vi text not null default '',
  q_en text not null default '',
  a_vi text not null default '',
  a_en text not null default '',
  num text not null default '',
  unit text not null default '',
  enabled boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.tm_staff (
  user_id uuid primary key,
  email text not null,
  role text not null check (role in ('admin','mc')),
  created_at timestamptz not null default now()
);
create table if not exists public.tm_matches (
  id bigserial primary key,
  finished_at timestamptz not null default now(),
  data jsonb not null
);
create table if not exists public.tm_meta (
  key text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.tm_state (id) values (1) on conflict (id) do nothing;
insert into public.tm_public (id) values (1) on conflict (id) do nothing;

-- Khóa toàn bộ bảng: chỉ server (service role) đọc/ghi được.
alter table public.tm_state enable row level security;
alter table public.tm_public enable row level security;
alter table public.tm_questions enable row level security;
alter table public.tm_staff enable row level security;
alter table public.tm_matches enable row level security;
alter table public.tm_meta enable row level security;

-- Riêng trạng thái công khai (không có đáp án, không có vị trí hình) được đọc để đồng bộ màn hình người chơi.
drop policy if exists tm_public_read on public.tm_public;
create policy tm_public_read on public.tm_public for select to anon, authenticated using (true);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tm_public') then
    alter publication supabase_realtime add table public.tm_public;
  end if;
end $$;

-- Ghi trạng thái trận có kiểm tra phiên bản (tránh hai thao tác ghi đè nhau).
create or replace function public.tm_commit(p_version bigint, p_data jsonb, p_pub jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare v bigint;
begin
  update public.tm_state set version = version + 1, data = p_data, updated_at = now()
    where id = 1 and version = p_version returning version into v;
  if v is null then return -1; end if;
  update public.tm_public set version = v, data = p_pub, updated_at = now() where id = 1;
  return v;
end $$;
revoke all on function public.tm_commit(bigint, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.tm_commit(bigint, jsonb, jsonb) to service_role;

-- Kho ảnh và nhạc tải lên (đọc công khai, chỉ server cấp quyền tải lên).
insert into storage.buckets (id, name, public) values ('tm-assets', 'tm-assets', true) on conflict (id) do nothing;

-- Mã khởi tạo tài khoản Admin đầu tiên (chỉ người mở được Supabase mới thấy mã này).
insert into public.tm_meta (key, data)
  select 'setup', jsonb_build_object('code', upper(substr(md5(gen_random_uuid()::text), 1, 8)))
  where not exists (select 1 from public.tm_staff where role = 'admin')
on conflict (key) do nothing;

select coalesce((select data->>'code' from public.tm_meta where key = 'setup'), 'Đã có tài khoản Admin') as "MA_KHOI_TAO";
