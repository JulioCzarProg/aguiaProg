-- =====================================================================
-- Indicador360 — RLS, Storage e Realtime
-- =====================================================================
--
-- NOTA DE SEGURANÇA IMPORTANTE
-- ----------------------------
-- O login do Indicador360 é por telefone + código (NÃO usa Supabase Auth),
-- então `auth.uid()` é NULL para os voluntários. Por isso as políticas
-- abaixo liberam acesso ao papel `anon` para o app funcionar com a chave
-- pública. Isso significa que QUALQUER pessoa com a chave anon pode ler/
-- escrever nessas tabelas.
--
-- Para produção, o caminho seguro é mover as operações sensíveis
-- (criar/editar usuários, validar código, apagar dados) para EDGE FUNCTIONS
-- que rodam com a service_role no servidor, e então restringir estas
-- políticas. Os arquivos de edge function ficam em supabase/functions/.
-- =====================================================================

-- Habilitar RLS
alter table eventos        enable row level security;
alter table setores        enable row level security;
alter table usuarios       enable row level security;
alter table designacoes    enable row level security;
alter table localizacoes   enable row level security;
alter table canais         enable row level security;
alter table mensagens      enable row level security;
alter table contagens      enable row level security;
alter table reunioes       enable row level security;
alter table reuniao_participantes enable row level security;
alter table logs_acesso    enable row level security;

-- Política genérica de acesso para o papel anon (app cliente).
-- Cria SELECT/INSERT/UPDATE/DELETE para anon e authenticated em cada tabela.
do $$
declare
  t text;
  tbls text[] := array[
    'eventos','setores','usuarios','designacoes','localizacoes',
    'canais','mensagens','contagens','reunioes','reuniao_participantes','logs_acesso'
  ];
begin
  foreach t in array tbls loop
    execute format('drop policy if exists "%s_anon_all" on %I;', t, t);
    execute format($f$
      create policy "%1$s_anon_all" on %1$I
        for all
        to anon, authenticated
        using (true)
        with check (true);
    $f$, t);
  end loop;
end $$;

-- =====================================================================
-- Realtime
-- =====================================================================
do $$
begin
  alter publication supabase_realtime add table mensagens;
exception when duplicate_object then null; end $$;

do $$
begin
  alter publication supabase_realtime add table localizacoes;
exception when duplicate_object then null; end $$;

do $$
begin
  alter publication supabase_realtime add table designacoes;
exception when duplicate_object then null; end $$;

-- =====================================================================
-- Storage buckets (chat-fotos, chat-audios, logos, avatares)
-- =====================================================================
insert into storage.buckets (id, name, public)
values
  ('chat-fotos',  'chat-fotos',  true),
  ('chat-audios', 'chat-audios', true),
  ('logos',       'logos',       true),
  ('avatares',    'avatares',    true)
on conflict (id) do nothing;

-- Acesso público de leitura + escrita anon nos buckets do app
do $$
declare
  b text;
  buckets text[] := array['chat-fotos','chat-audios','logos','avatares'];
begin
  foreach b in array buckets loop
    execute format('drop policy if exists "%s_read"  on storage.objects;', b);
    execute format('drop policy if exists "%s_write" on storage.objects;', b);
    execute format($f$
      create policy "%1$s_read" on storage.objects
        for select to anon, authenticated
        using (bucket_id = '%1$s');
    $f$, b);
    execute format($f$
      create policy "%1$s_write" on storage.objects
        for insert to anon, authenticated
        with check (bucket_id = '%1$s');
    $f$, b);
  end loop;
end $$;
