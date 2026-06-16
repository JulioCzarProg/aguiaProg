-- =====================================================================
-- Indicador360 — Dados de exemplo (seed)
-- Cria um evento, setores, canais e um usuário administrador para
-- o primeiro acesso. Ajuste o telefone do admin para o SEU WhatsApp.
-- =====================================================================

-- Admin inicial (TROQUE o telefone para o seu, com DDD, só dígitos)
insert into usuarios (nome, telefone, congregacao, funcao)
values ('Administrador', '38988887777', 'Sede', 'admin')
on conflict (telefone) do nothing;

-- Evento de exemplo
do $$
declare
  ev_id uuid;
begin
  select id into ev_id from eventos where nome = 'Congresso Regional 2026' limit 1;
  if ev_id is null then
    insert into eventos (nome, tipo, local, data_inicio, data_fim, ativo)
    values ('Congresso Regional 2026', 'congresso', 'Ginásio Central', '2026-07-10', '2026-07-12', true)
    returning id into ev_id;

    -- Setores
    insert into setores (evento_id, codigo, nome, descricao, cor, capacidade, pos_x, pos_y, largura, altura) values
      (ev_id, 'A1', 'Entrada Principal', 'Recepção e orientação', 'azul',    8, 6,  14, 18, 12),
      (ev_id, 'A2', 'Estacionamento',    'Apoio ao trânsito',     'verde',  10, 29, 14, 18, 12),
      (ev_id, 'B1', 'Arquibancada Leste','Acomodação',            'amarelo', 6, 52, 14, 18, 12),
      (ev_id, 'B2', 'Arquibancada Oeste','Acomodação',            'laranja', 6, 75, 14, 18, 12),
      (ev_id, 'C1', 'Limpeza',           'Conservação',           'roxo',    5, 6,  46, 18, 12),
      (ev_id, 'D1', 'Primeiros Socorros','Atendimento médico',    'vermelho',4, 29, 46, 18, 12);

    -- Canais de chat
    insert into canais (evento_id, nome, tipo, nivel_minimo) values
      (ev_id, 'Geral',    'grupo', 'voluntario'),
      (ev_id, 'Capitães', 'grupo', 'capitao');
  end if;
end $$;
