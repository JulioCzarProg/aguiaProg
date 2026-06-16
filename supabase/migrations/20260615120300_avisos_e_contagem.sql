-- =====================================================================
-- Indicador360 — Avisos de sistema + fluxo de validação de contagem
-- =====================================================================

-- Avisos (broadcast de sistema, segmentável)
create table if not exists avisos (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid references eventos(id) on delete cascade,
  titulo text,
  mensagem text not null,
  urgente boolean default false,
  alvo_tipo text check (alvo_tipo in ('todos','setor','usuario')) default 'todos',
  alvo_id uuid,
  criado_por uuid references usuarios(id),
  nome_autor text,
  created_at timestamptz default now()
);

alter table avisos enable row level security;
drop policy if exists "avisos_anon_all" on avisos;
create policy "avisos_anon_all" on avisos for all to anon, authenticated using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table avisos;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table contagens;
exception when duplicate_object then null; end $$;

-- Contagens: workflow de validação pelo capitão
alter table contagens add column if not exists status text default 'pendente';
alter table contagens add column if not exists validado_por uuid references usuarios(id);
alter table contagens add column if not exists validado_em timestamptz;
alter table contagens add column if not exists nome_contador text;

create index if not exists idx_contagens_status on contagens(evento_id, status);
