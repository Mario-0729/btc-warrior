-- BTC 戰士 全網排行榜：在 Supabase 的 SQL Editor 貼上整段，按 Run。
create table public.scores (
  player uuid primary key,
  name text not null check (char_length(name) between 1 and 12),
  peak bigint not null check (peak between 0 and 1000000000000),
  cleared boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.scores enable row level security;
create policy "anyone can read" on public.scores for select to anon using (true);
revoke all on public.scores from anon, authenticated;
grant select (name, peak, cleared, updated_at) on public.scores to anon;

create function public.submit_score(p_player uuid, p_name text, p_peak bigint, p_cleared boolean)
returns void language sql security definer set search_path = public as $$
  insert into scores (player, name, peak, cleared)
  values (p_player, left(p_name, 12), p_peak, p_cleared)
  on conflict (player) do update set
    name = excluded.name,
    peak = greatest(scores.peak, excluded.peak),
    cleared = scores.cleared or excluded.cleared,
    updated_at = now();
$$;
revoke all on function public.submit_score(uuid, text, bigint, boolean) from public;
grant execute on function public.submit_score(uuid, text, bigint, boolean) to anon;
