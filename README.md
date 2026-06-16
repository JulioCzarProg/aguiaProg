# Indicador360

Sistema web para gerenciamento de voluntários em congressos e assembleias.
React 18 + Vite + Supabase + Tailwind v3.

## Rodar localmente

```bash
npm install
npm run dev
```

O app abre em http://localhost:5173. Configure `.env` (já criado) com:

```
VITE_SUPABASE_URL=https://hldpkgbrbciquxmtlrot.supabase.co
VITE_SUPABASE_ANON_KEY=...  # chave anon pública
```

> ⚠️ **Nunca** coloque a `service_role` no `.env` do cliente — ela vai para o
> navegador e dá acesso total ao banco. Ela só pode ser usada em edge functions.

## Banco de dados (migrações)

As migrações estão em `supabase/migrations/`:

1. `..._initial_schema.sql` — tabelas
2. `..._rls_storage_realtime.sql` — RLS, buckets de storage, realtime
3. `..._seed_dados_exemplo.sql` — evento, setores, canais e admin de exemplo

### Aplicar com a CLI do Supabase

```bash
# 1. Instale a CLI (escolha um):
npm install -g supabase           # ou
scoop install supabase            # Windows (scoop) / brew install supabase (macOS)

# 2. Faça login (abre o navegador ou use um token):
supabase login                    # ou: export SUPABASE_ACCESS_TOKEN=sbp_xxx

# 3. Linke ao projeto (pede a senha do banco):
supabase link --project-ref hldpkgbrbciquxmtlrot

# 4. Envie todas as migrações:
supabase db push
```

### Alternativa: SQL Editor

Cole o conteúdo dos arquivos de `supabase/migrations/` (na ordem) no
**SQL Editor** do painel do Supabase e execute.

## Primeiro acesso (admin)

O seed cria um admin com telefone **38988887777**. **Edite esse telefone para o
seu WhatsApp** (na tabela `usuarios` ou no arquivo de seed antes do push).

Na tela de login digite esse número → o sistema gera um código de 6 dígitos.
Em desenvolvimento o código aparece no **console do navegador** (F12). Em
produção ele é enviado pelo link do WhatsApp.

## Estrutura

- `src/contexts` — Auth (login por telefone+código) e Evento
- `src/hooks` — chat, localização, contagem, realtime
- `src/pages/voluntario` — Meu Setor, Mapa, Chat, Ajuda
- `src/pages/admin` — Dashboard, Usuários, Setores, Programação, Mapa,
  Reuniões, Contagens, Logs, Configurações
- `src/components` — Mapa do ginásio, chat, áudio, uploads, cards

## Nota de segurança (RLS)

O login é por telefone+código (não usa Supabase Auth), então o app acessa o
banco com a chave anon. As políticas RLS liberam o papel `anon`. Para produção,
mova as operações sensíveis para **edge functions** com a `service_role` e
restrinja as políticas. Veja o comentário em
`supabase/migrations/..._rls_storage_realtime.sql`.
