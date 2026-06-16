-- =====================================================================
-- Indicador360 — Conversas individuais (DM) no chat
-- =====================================================================
alter table canais add column if not exists participantes uuid[];

do $$ begin
  alter publication supabase_realtime add table canais;
exception when duplicate_object then null; end $$;
