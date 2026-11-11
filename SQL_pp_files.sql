-- Prestige Pedidos v20 · guarda os PDFs das notas de entrada na nuvem (só para quem está logado)
create table if not exists public.pp_files (
  id text primary key,
  name text,
  data text,
  updated_at timestamptz default now()
);
alter table public.pp_files enable row level security;
create policy "pp files ler" on public.pp_files for select to authenticated using (true);
create policy "pp files inserir" on public.pp_files for insert to authenticated with check (true);
create policy "pp files atualizar" on public.pp_files for update to authenticated using (true) with check (true);
