-- =====================================================================
-- Indicador360 — Schema inicial
-- Sistema de gerenciamento de voluntários em congressos/assembleias
-- =====================================================================

-- Eventos (Congresso ou Assembleia)
create table if not exists eventos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text check (tipo in ('congresso','assembleia')),
  local text,
  data_inicio date,
  data_fim date,
  ativo boolean default false,
  mapa_url text,
  created_at timestamptz default now()
);

-- Setores do evento
create table if not exists setores (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid references eventos(id) on delete cascade,
  codigo text not null,
  nome text not null,
  descricao text,
  cor text default 'azul',
  capacidade int,
  pos_x float8,
  pos_y float8,
  largura float8,
  altura float8,
  created_at timestamptz default now()
);

-- Usuários do sistema
create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid references auth.users(id),
  nome text not null,
  telefone text not null unique,
  congregacao text,
  funcao text check (funcao in ('voluntario','capitao','coordenador','admin')) default 'voluntario',
  codigo_acesso text,
  codigo_expira_em timestamptz,
  ativo boolean default true,
  foto_url text,
  ultimo_acesso timestamptz,
  created_at timestamptz default now()
);

-- Designações (voluntário → setor → turno)
create table if not exists designacoes (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid references eventos(id) on delete cascade,
  usuario_id uuid references usuarios(id) on delete cascade,
  setor_id uuid references setores(id) on delete cascade,
  turno text,
  data_designacao date,
  created_at timestamptz default now()
);

-- Localizações em tempo real
create table if not exists localizacoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios(id) on delete cascade unique,
  latitude float8,
  longitude float8,
  setor_id uuid references setores(id),
  updated_at timestamptz default now()
);

-- Canais de chat
create table if not exists canais (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid references eventos(id) on delete cascade,
  nome text not null,
  tipo text default 'grupo',
  setor_id uuid references setores(id) on delete set null,
  nivel_minimo text default 'voluntario',
  created_at timestamptz default now()
);

-- Mensagens do chat
create table if not exists mensagens (
  id uuid primary key default gen_random_uuid(),
  canal_id uuid references canais(id) on delete cascade,
  usuario_id uuid references usuarios(id),
  nome_autor text,
  funcao_autor text,
  texto text,
  tipo text check (tipo in ('texto','imagem','audio')) default 'texto',
  arquivo_url text,
  duracao_audio int,
  urgente boolean default false,
  created_at timestamptz default now()
);

-- Contagens de assistência
create table if not exists contagens (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid references eventos(id),
  setor_id uuid references setores(id),
  usuario_id uuid references usuarios(id),
  turno text,
  periodo text check (periodo in ('manha','tarde')),
  quantidade int,
  created_at timestamptz default now()
);

-- Reuniões agendadas
create table if not exists reunioes (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid references eventos(id),
  titulo text not null,
  descricao text,
  data_hora timestamptz,
  local text,
  criado_por uuid references usuarios(id),
  created_at timestamptz default now()
);

-- Participantes das reuniões
create table if not exists reuniao_participantes (
  reuniao_id uuid references reunioes(id) on delete cascade,
  usuario_id uuid references usuarios(id) on delete cascade,
  primary key (reuniao_id, usuario_id)
);

-- Log de acessos
create table if not exists logs_acesso (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios(id),
  acao text,
  detalhe text,
  ip text,
  created_at timestamptz default now()
);

-- Índices úteis
create index if not exists idx_setores_evento on setores(evento_id);
create index if not exists idx_designacoes_evento on designacoes(evento_id);
create index if not exists idx_designacoes_usuario on designacoes(usuario_id);
create index if not exists idx_designacoes_setor on designacoes(setor_id);
create index if not exists idx_mensagens_canal on mensagens(canal_id, created_at);
create index if not exists idx_contagens_evento on contagens(evento_id);
create index if not exists idx_usuarios_telefone on usuarios(telefone);
