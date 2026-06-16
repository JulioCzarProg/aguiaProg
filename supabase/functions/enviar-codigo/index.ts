// Edge Function: enviar-codigo
// Gera o código de acesso, salva no banco (service_role) e envia pelo
// WhatsApp via Meta Cloud API. O código nunca é exposto ao navegador
// (exceto se MODO_DEV=true, apenas para testes antes do template aprovado).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...cors, 'Content-Type': 'application/json' }
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { telefone } = await req.json()
    const digitos = String(telefone || '').replace(/\D/g, '')
    if (digitos.length < 10) return json({ error: 'Telefone inválido.' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: u } = await supabase
      .from('usuarios').select('id, nome, ativo').eq('telefone', digitos).maybeSingle()

    if (!u) return json({ error: 'Telefone não cadastrado. Procure o coordenador.' }, 404)
    if (!u.ativo) return json({ error: 'Cadastro inativo. Procure o coordenador.' }, 403)

    const codigo = String(Math.floor(100000 + Math.random() * 900000))
    const expira = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    await supabase.from('usuarios')
      .update({ codigo_acesso: codigo, codigo_expira_em: expira }).eq('id', u.id)

    const token = Deno.env.get('WHATSAPP_TOKEN')
    const phoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
    const modoDev = Deno.env.get('MODO_DEV') === 'true'

    // Sem credenciais Meta: modo de teste devolve o código (não usar em produção)
    if (!token || !phoneId) {
      if (modoDev) return json({ ok: true, nome: u.nome, dev_codigo: codigo })
      return json({ error: 'Envio de WhatsApp não configurado.' }, 503)
    }

    const template = Deno.env.get('WHATSAPP_TEMPLATE') || 'codigo_acesso'
    const lang = Deno.env.get('WHATSAPP_LANG') || 'pt_BR'
    const para = digitos.length <= 11 ? `55${digitos}` : digitos

    // Template de AUTENTICAÇÃO da Meta (corpo + botão "copiar código")
    const payload = {
      messaging_product: 'whatsapp',
      to: para,
      type: 'template',
      template: {
        name: template,
        language: { code: lang },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: codigo }] },
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: codigo }] }
        ]
      }
    }

    const resp = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const body = await resp.json()
    if (!resp.ok) {
      console.error('WhatsApp erro:', JSON.stringify(body))
      return json({ error: 'Falha ao enviar o código pelo WhatsApp.', detalhe: body?.error?.message }, 502)
    }

    return json({ ok: true, nome: u.nome })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
