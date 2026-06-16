-- =====================================================================
-- Indicador360 — Mapa editável: rotação e camada por setor
-- =====================================================================
alter table setores add column if not exists rotacao float8 default 0;
alter table setores add column if not exists camada int default 1;
-- (pos_x, pos_y, largura, altura já existem; passam a ser usados no
--  espaço do editor 0..1000)
