-- =====================================================================
-- Indicador360 — Horários de contagem, tipo de elemento no mapa,
-- e ajustes de contagem (dia/turno/origem)
-- =====================================================================

-- Mapa: tipo de elemento e pontos (polígono)
alter table setores add column if not exists tipo text default 'setor';   -- setor | bloco | palco | tela
alter table setores add column if not exists pontos jsonb;                 -- polígono opcional

-- Chat: grupo/equipe do canal
alter table canais add column if not exists grupo text;

-- Contagem: origem (voluntário/capitão) e dia
alter table contagens add column if not exists origem text default 'voluntario'; -- voluntario | capitao
alter table contagens add column if not exists dia text;                   -- ex.: 'Sexta'

-- Horários de contagem por turno
create table if not exists horarios_contagem (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid references eventos(id) on delete cascade,
  turno text not null,            -- ex.: 'Sex Manhã'
  hora text not null,             -- 'HH:MM'
  antecedencia_min int default 10,
  created_at timestamptz default now(),
  unique (evento_id, turno)
);
alter table horarios_contagem enable row level security;
drop policy if exists "horarios_anon_all" on horarios_contagem;
create policy "horarios_anon_all" on horarios_contagem for all to anon, authenticated using (true) with check (true);
