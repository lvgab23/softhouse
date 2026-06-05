import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const clean = (s: string = '') => s.replace(/^﻿/, '').replace(/[^\x20-\x7E]/g, '').trim()
const enc   = (s: string) => encodeURIComponent(s)

function sbAdmin() {
  return createAdmin(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  )
}

interface DiarioResult {
  fonte: string
  fonte_tipo: string
  data_publicacao: string | null
  titulo: string
  resumo: string
  url: string
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. QUERIDO DIÁRIO — Municipal + Estadual (API pública, sem chave)
// ─────────────────────────────────────────────────────────────────────────────
async function searchQueridoDiario(termo: string): Promise<DiarioResult[]> {
  try {
    const url = `https://queridodiario.ok.org.br/api/gazettes?querystring=${enc(termo)}&size=15&offset=0`
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) })
    if (!res.ok) return []
    const data = await res.json()
    return (data.gazettes || []).map((g: any) => ({
      fonte: `DO Municipal — ${g.territory_name} (${g.state_code})`,
      fonte_tipo: 'municipal',
      data_publicacao: g.date || null,
      titulo: `Publicação em ${g.territory_name}/${g.state_code}`,
      resumo: (g.excerpts || []).slice(0, 2).join(' [...] ') || 'Clique para ver a publicação completa.',
      url: g.url || 'https://queridodiario.ok.org.br/',
    }))
  } catch { return [] }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. INLABS / DOU — Diário Oficial da União (Federal)
// ─────────────────────────────────────────────────────────────────────────────
async function searchDOU(termo: string): Promise<DiarioResult[]> {
  const apiEmail = process.env.INLABS_EMAIL
  const apiPass  = process.env.INLABS_PASSWORD
  const apiKey   = process.env.INLABS_API_KEY
  const today    = new Date().toISOString().split('T')[0]
  const past90   = new Date(Date.now() - 90 * 86400_000).toISOString().split('T')[0]
  const linkDOU  = `https://www.in.gov.br/consulta/-/buscar/dou?q=${enc(termo)}&s=todos&exactDate=personalizado&startDate=${past90}&endDate=${today}&sortType=0`

  // Sem credenciais → link direto
  if (!apiKey && !(apiEmail && apiPass)) {
    return [{ fonte: 'DOU — Diário Oficial da União', fonte_tipo: 'federal', data_publicacao: null,
      titulo: `Buscar "${termo}" no DOU`, resumo: 'Clique para pesquisar no portal do DOU (últimos 90 dias).', url: linkDOU }]
  }

  try {
    let token = apiKey || ''
    if (!token && apiEmail && apiPass) {
      const lr = await fetch(`https://inlabs.in.gov.br/logar.php?email=${enc(apiEmail)}&password=${enc(apiPass)}`)
      if (lr.ok) token = (await lr.json())?.token || ''
    }
    if (!token) throw new Error('no token')
    const sr = await fetch(
      `https://inlabs.in.gov.br/index.php?q=${enc(termo)}&s=DOU&df=${past90}&dt=${today}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) }
    )
    if (!sr.ok) throw new Error('search failed')
    const d = await sr.json()
    const hits = (d?.hits?.hits || []).slice(0, 10)
    if (!hits.length) throw new Error('empty')
    return hits.map((h: any) => ({
      fonte: `DOU — ${h._source?.secao || 'Seção'} (${h._source?.pubDate?.split('T')[0] || ''})`,
      fonte_tipo: 'federal',
      data_publicacao: h._source?.pubDate?.split('T')[0] || null,
      titulo: h._source?.titulo || h._source?.identifica || 'Publicação DOU',
      resumo: (h._source?.conteudo || '').slice(0, 400) + '...',
      url: `https://www.in.gov.br/web/dou/-/${h._source?.urlTitle || ''}`,
    }))
  } catch {
    return [{ fonte: 'DOU — Diário Oficial da União', fonte_tipo: 'federal', data_publicacao: null,
      titulo: `Buscar "${termo}" no DOU`, resumo: 'Clique para pesquisar no portal do DOU (últimos 90 dias).', url: linkDOU }]
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CNJ DATAJUD — Processos judiciais em todos os tribunais
//    Chave pública documentada pelo CNJ para acesso à API pública
// ─────────────────────────────────────────────────────────────────────────────
const DATAJUD_KEY = process.env.DATAJUD_API_KEY ||
  'cDZHYzlZa0JadVREZDJCendFbGF6cVRyUzNTSnFJSEVkZlhhYmJXMVoxY2hkYWljQ3ZwbmFnbkZzdw=='

const DATAJUD_COURTS: { id: string; nome: string; tipo: string }[] = [
  // Superiores
  { id: 'stf',   nome: 'STF — Supremo Tribunal Federal',         tipo: 'judicial_superior' },
  { id: 'stj',   nome: 'STJ — Superior Tribunal de Justiça',     tipo: 'judicial_superior' },
  { id: 'tst',   nome: 'TST — Tribunal Superior do Trabalho',    tipo: 'judicial_superior' },
  { id: 'stm',   nome: 'STM — Superior Tribunal Militar',        tipo: 'judicial_superior' },
  // TRFs
  { id: 'trf1',  nome: 'TRF-1 (DF/Norte/Centro-Oeste)',         tipo: 'judicial_federal'  },
  { id: 'trf2',  nome: 'TRF-2 (RJ/ES)',                         tipo: 'judicial_federal'  },
  { id: 'trf3',  nome: 'TRF-3 (SP/MS)',                         tipo: 'judicial_federal'  },
  { id: 'trf4',  nome: 'TRF-4 (RS/SC/PR)',                      tipo: 'judicial_federal'  },
  { id: 'trf5',  nome: 'TRF-5 (Nordeste)',                      tipo: 'judicial_federal'  },
  { id: 'trf6',  nome: 'TRF-6 (MG)',                            tipo: 'judicial_federal'  },
  // Estaduais
  { id: 'tjsp',  nome: 'TJSP — Tribunal de Justiça de SP',      tipo: 'judicial_estadual' },
  { id: 'tjrj',  nome: 'TJRJ — Tribunal de Justiça do RJ',      tipo: 'judicial_estadual' },
  { id: 'tjmg',  nome: 'TJMG — Tribunal de Justiça de MG',      tipo: 'judicial_estadual' },
  { id: 'tjrs',  nome: 'TJRS — Tribunal de Justiça do RS',      tipo: 'judicial_estadual' },
  { id: 'tjpr',  nome: 'TJPR — Tribunal de Justiça do PR',      tipo: 'judicial_estadual' },
  { id: 'tjba',  nome: 'TJBA — Tribunal de Justiça da BA',      tipo: 'judicial_estadual' },
  { id: 'tjpe',  nome: 'TJPE — Tribunal de Justiça de PE',      tipo: 'judicial_estadual' },
  { id: 'tjce',  nome: 'TJCE — Tribunal de Justiça do CE',      tipo: 'judicial_estadual' },
  { id: 'tjgo',  nome: 'TJGO — Tribunal de Justiça de GO',      tipo: 'judicial_estadual' },
  { id: 'tjsc',  nome: 'TJSC — Tribunal de Justiça de SC',      tipo: 'judicial_estadual' },
  { id: 'tjdf',  nome: 'TJDFT — Tribunal de Justiça do DF',     tipo: 'judicial_estadual' },
  { id: 'tjma',  nome: 'TJMA — Tribunal de Justiça do MA',      tipo: 'judicial_estadual' },
  { id: 'tjpa',  nome: 'TJPA — Tribunal de Justiça do PA',      tipo: 'judicial_estadual' },
  { id: 'tjes',  nome: 'TJES — Tribunal de Justiça do ES',      tipo: 'judicial_estadual' },
  { id: 'tjmt',  nome: 'TJMT — Tribunal de Justiça do MT',      tipo: 'judicial_estadual' },
  { id: 'tjms',  nome: 'TJMS — Tribunal de Justiça do MS',      tipo: 'judicial_estadual' },
  { id: 'tjrn',  nome: 'TJRN — Tribunal de Justiça do RN',      tipo: 'judicial_estadual' },
  { id: 'tjpb',  nome: 'TJPB — Tribunal de Justiça da PB',      tipo: 'judicial_estadual' },
  { id: 'tjal',  nome: 'TJAL — Tribunal de Justiça de AL',      tipo: 'judicial_estadual' },
  { id: 'tjpi',  nome: 'TJPI — Tribunal de Justiça do PI',      tipo: 'judicial_estadual' },
  { id: 'tjse',  nome: 'TJSE — Tribunal de Justiça de SE',      tipo: 'judicial_estadual' },
  { id: 'tjam',  nome: 'TJAM — Tribunal de Justiça do AM',      tipo: 'judicial_estadual' },
  { id: 'tjro',  nome: 'TJRO — Tribunal de Justiça de RO',      tipo: 'judicial_estadual' },
  { id: 'tjac',  nome: 'TJAC — Tribunal de Justiça do AC',      tipo: 'judicial_estadual' },
  { id: 'tjap',  nome: 'TJAP — Tribunal de Justiça do AP',      tipo: 'judicial_estadual' },
  { id: 'tjrr',  nome: 'TJRR — Tribunal de Justiça de RR',      tipo: 'judicial_estadual' },
  { id: 'tjto',  nome: 'TJTO — Tribunal de Justiça do TO',      tipo: 'judicial_estadual' },
]

async function searchOneDataJud(termo: string, court: typeof DATAJUD_COURTS[0]): Promise<DiarioResult[]> {
  try {
    const res = await fetch(
      `https://api-publica.datajud.cnj.jus.br/api_publica_${court.id}/_search`,
      {
        method: 'POST',
        headers: { Authorization: `ApiKey ${DATAJUD_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: { multi_match: { query: termo, fields: ['txtEmenta^3', 'txtDecisao', 'orgaoJulgador.descricao'], operator: 'and' } },
          _source: ['numeroProcesso', 'dataAjuizamento', 'classeProcessual', 'orgaoJulgador', 'txtEmenta', 'siglaTribunal'],
          size: 5,
        }),
        signal: AbortSignal.timeout(10000),
      }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.hits?.hits || []).map((h: any) => {
      const src = h._source || {}
      return {
        fonte: court.nome,
        fonte_tipo: court.tipo,
        data_publicacao: src.dataAjuizamento?.split('T')[0] || null,
        titulo: `${src.classeProcessual?.descricao || 'Processo'} nº ${src.numeroProcesso || h._id}`,
        resumo: (src.txtEmenta || `Órgão: ${src.orgaoJulgador?.descricao || '—'}`).slice(0, 350),
        url: `https://www.cnj.jus.br/busca-ativa-de-processos/?numero=${src.numeroProcesso || ''}`,
      }
    })
  } catch { return [] }
}

async function searchDataJud(termo: string): Promise<DiarioResult[]> {
  const batches: Array<typeof DATAJUD_COURTS> = []
  for (let i = 0; i < DATAJUD_COURTS.length; i += 8) batches.push(DATAJUD_COURTS.slice(i, i + 8))
  const results: DiarioResult[] = []
  for (const batch of batches) {
    const batchResults = await Promise.all(batch.map(c => searchOneDataJud(termo, c)))
    results.push(...batchResults.flat())
  }
  return results
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. DIÁRIOS OFICIAIS ESTADUAIS — links de busca diretos para todos os estados
// ─────────────────────────────────────────────────────────────────────────────
function getStateDOLinks(termo: string): DiarioResult[] {
  const q = enc(termo)
  const states = [
    { uf: 'AC', nome: 'Acre',                url: `https://diario.ac.gov.br/pesquisa?q=${q}` },
    { uf: 'AL', nome: 'Alagoas',             url: `https://www.jusbrasil.com.br/diarios/busca/?q=${q}&s=AL` },
    { uf: 'AM', nome: 'Amazonas',            url: `https://www.jusbrasil.com.br/diarios/busca/?q=${q}&s=AM` },
    { uf: 'AP', nome: 'Amapá',               url: `https://diariooficial.ap.gov.br/busca?q=${q}` },
    { uf: 'BA', nome: 'Bahia',               url: `https://djo.ba.gov.br/pesquisa?q=${q}` },
    { uf: 'CE', nome: 'Ceará',               url: `https://www.jusbrasil.com.br/diarios/busca/?q=${q}&s=CE` },
    { uf: 'DF', nome: 'Distrito Federal',    url: `https://www.dodf.df.gov.br/index/pesquisa-resultado?q=${q}` },
    { uf: 'ES', nome: 'Espírito Santo',      url: `https://ioes.dio.es.gov.br/busca?q=${q}` },
    { uf: 'GO', nome: 'Goiás',               url: `https://www.diariooficial.go.gov.br/busca?q=${q}` },
    { uf: 'MA', nome: 'Maranhão',            url: `https://www.jusbrasil.com.br/diarios/busca/?q=${q}&s=MA` },
    { uf: 'MG', nome: 'Minas Gerais',        url: `https://www.iof.mg.gov.br/pesquisa?q=${q}` },
    { uf: 'MS', nome: 'Mato Grosso do Sul',  url: `https://www.jusbrasil.com.br/diarios/busca/?q=${q}&s=MS` },
    { uf: 'MT', nome: 'Mato Grosso',         url: `https://www.jusbrasil.com.br/diarios/busca/?q=${q}&s=MT` },
    { uf: 'PA', nome: 'Pará',                url: `https://www.ioepa.gov.br/pesquisa?q=${q}` },
    { uf: 'PB', nome: 'Paraíba',             url: `https://www.jusbrasil.com.br/diarios/busca/?q=${q}&s=PB` },
    { uf: 'PE', nome: 'Pernambuco',          url: `https://www.diariooficial.pe.gov.br/busca?q=${q}` },
    { uf: 'PI', nome: 'Piauí',               url: `https://www.jusbrasil.com.br/diarios/busca/?q=${q}&s=PI` },
    { uf: 'PR', nome: 'Paraná',              url: `https://www.iopr.pr.gov.br/pesquisa?q=${q}` },
    { uf: 'RJ', nome: 'Rio de Janeiro',      url: `https://www.jusbrasil.com.br/diarios/busca/?q=${q}&s=RJ` },
    { uf: 'RN', nome: 'Rio Grande do Norte', url: `https://www.diof.rn.gov.br/busca?q=${q}` },
    { uf: 'RO', nome: 'Rondônia',            url: `https://diariooficial.ro.gov.br/busca?q=${q}` },
    { uf: 'RR', nome: 'Roraima',             url: `https://www.jusbrasil.com.br/diarios/busca/?q=${q}&s=RR` },
    { uf: 'RS', nome: 'Rio Grande do Sul',   url: `https://www.ioergs.rs.gov.br/pesquisa?q=${q}` },
    { uf: 'SC', nome: 'Santa Catarina',      url: `https://www.doe.sea.sc.gov.br/busca?q=${q}` },
    { uf: 'SE', nome: 'Sergipe',             url: `https://www.jusbrasil.com.br/diarios/busca/?q=${q}&s=SE` },
    { uf: 'SP', nome: 'São Paulo',           url: `https://www.imprensaoficial.com.br/DO/BuscaDO2001Resultado_11_3.aspx?filtro=1&tipobusca=simples&q=${q}` },
    { uf: 'TO', nome: 'Tocantins',           url: `https://diariooficial.to.gov.br/busca?q=${q}` },
  ]
  return states.map(s => ({
    fonte: `DO Estadual — ${s.nome} (${s.uf})`,
    fonte_tipo: 'estadual',
    data_publicacao: null,
    titulo: `Buscar "${termo}" no Diário Oficial de ${s.nome}`,
    resumo: `Clique para pesquisar publicações no Diário Oficial do Estado de ${s.nome}.`,
    url: s.url,
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. DJe — Diário de Justiça Eletrônico dos tribunais (links diretos)
// ─────────────────────────────────────────────────────────────────────────────
function getDJeLinks(termo: string): DiarioResult[] {
  const q = enc(termo)
  const courts = [
    // Superiores
    { nome: 'STF — Diário de Justiça',    tipo: 'judicial_superior', url: `https://jurisprudencia.stf.jus.br/pages/search?base=acordaos&sinonimo=true&plural=true&page=1&pageSize=10&queryString=${q}` },
    { nome: 'STJ — Diário de Justiça',    tipo: 'judicial_superior', url: `https://scon.stj.jus.br/SCON/pesquisar.jsp?livre=${q}` },
    { nome: 'TST — Jurisprudência',       tipo: 'judicial_superior', url: `https://jurisprudencia.tst.jus.br/#livre&ordenacao=RELEVANCIA&query=${q}` },
    { nome: 'TSE — Jurisprudência',       tipo: 'judicial_superior', url: `https://www.tse.jus.br/jurisprudencia/pesquisa-de-jurisprudencia?q=${q}` },
    { nome: 'STM — Jurisprudência',       tipo: 'judicial_superior', url: `https://www.stm.jus.br/jurisprudencia/pesquisa?q=${q}` },
    // TRFs
    { nome: 'TRF-1 (DF/Norte/CO)',        tipo: 'judicial_federal',  url: `https://jurisprudencia.trf1.jus.br/busca/?key=${q}` },
    { nome: 'TRF-2 (RJ/ES)',              tipo: 'judicial_federal',  url: `https://www10.trf2.jus.br/jurisprudencia/?q=${q}` },
    { nome: 'TRF-3 (SP/MS)',              tipo: 'judicial_federal',  url: `https://web.trf3.jus.br/base-textual/Home/ListaColecao?query=${q}` },
    { nome: 'TRF-4 (RS/SC/PR)',           tipo: 'judicial_federal',  url: `https://jurisprudencia.trf4.jus.br/pesquisa/pesquisa.php?tipo=1&descricao=${q}` },
    { nome: 'TRF-5 (Nordeste)',           tipo: 'judicial_federal',  url: `https://www.trf5.jus.br/Jurisprudencia/JurisServlet?op=exibir&tipo=1&termoPesquisa=${q}` },
    { nome: 'TRF-6 (MG)',                 tipo: 'judicial_federal',  url: `https://www.trf6.jus.br/jurisprudencia?q=${q}` },
    // DJe Estaduais
    { nome: 'TJSP — DJe',                 tipo: 'judicial_estadual', url: `https://esaj.tjsp.jus.br/cdje/consultaSimples.do?nomParticipante=${q}` },
    { nome: 'TJRJ — DJe',                 tipo: 'judicial_estadual', url: `https://www3.tjrj.jus.br/consultadje/?nomeParticipante=${q}` },
    { nome: 'TJMG — DJe',                 tipo: 'judicial_estadual', url: `https://www5.tjmg.jus.br/jurisprudencia/pesquisaPalavrasEspelhoAcordao.do?&termo=${q}` },
    { nome: 'TJRS — DJe',                 tipo: 'judicial_estadual', url: `https://www.tjrs.jus.br/novo/buscas-e-processos/pesquisa-de-jurisprudencia/?q=${q}` },
    { nome: 'TJPR — DJe',                 tipo: 'judicial_estadual', url: `https://www.tjpr.jus.br/consulta-diario-dje?q=${q}` },
    { nome: 'TJSC — DJe',                 tipo: 'judicial_estadual', url: `https://busca.tjsc.jus.br/jurisprudencia/#main_top?q=${q}` },
    { nome: 'TJBA — DJe',                 tipo: 'judicial_estadual', url: `https://www.tjba.jus.br/jurisprudencia/pesquisa?q=${q}` },
    { nome: 'TJPE — DJe',                 tipo: 'judicial_estadual', url: `https://jurisprudencia.tjpe.jus.br/jurisprudencia/pesquisar?q=${q}` },
    { nome: 'TJCE — DJe',                 tipo: 'judicial_estadual', url: `https://www.tjce.jus.br/jurisprudencia?q=${q}` },
    { nome: 'TJGO — DJe',                 tipo: 'judicial_estadual', url: `https://www.tjgo.jus.br/jurisprudencia/?q=${q}` },
    { nome: 'TJDF — DJe',                 tipo: 'judicial_estadual', url: `https://pesquisajuris.tjdft.jus.br/IndexadorAcordaos-web/sistj?visaoId=tjdf.sistj.acordaoeletronico.buscaindexada.apresentacao.VisaoBuscaAcordaoGet&numeroDoDocumento=&parametroPesquisa=EXPRESSAO_QUALQUER&termoDaPesquisa=${q}` },
    { nome: 'TJMA — DJe',                 tipo: 'judicial_estadual', url: `https://jurisprudencia.tjma.jus.br/pesquisa?q=${q}` },
    { nome: 'TJPA — DJe',                 tipo: 'judicial_estadual', url: `https://www.tjpa.jus.br/PortalExterno/jurisprudencia?q=${q}` },
    { nome: 'TJES — DJe',                 tipo: 'judicial_estadual', url: `https://sistemas.tjes.jus.br/ediario/index.php?q=${q}` },
    { nome: 'TJMT — DJe',                 tipo: 'judicial_estadual', url: `https://jurisprudencia.tjmt.jus.br/acordaos?q=${q}` },
    { nome: 'TJMS — DJe',                 tipo: 'judicial_estadual', url: `https://esaj.tjms.jus.br/cjsg/resultadoCompleta.do?q=${q}` },
    { nome: 'TJRN — DJe',                 tipo: 'judicial_estadual', url: `https://jurisprudencia.tjrn.jus.br/jurisprudencia?q=${q}` },
    { nome: 'TJPB — DJe',                 tipo: 'judicial_estadual', url: `https://jurisprudencia.tjpb.jus.br/pesquisa?q=${q}` },
    { nome: 'TJAL — DJe',                 tipo: 'judicial_estadual', url: `https://jurisprudencia.tjal.jus.br/pesquisa?q=${q}` },
    { nome: 'TJPI — DJe',                 tipo: 'judicial_estadual', url: `https://jurisprudencia.tjpi.jus.br/pesquisa?q=${q}` },
    { nome: 'TJSE — DJe',                 tipo: 'judicial_estadual', url: `https://jurisprudencia.tjse.jus.br/jurisprudencia/pesquisa?q=${q}` },
    { nome: 'TJAM — DJe',                 tipo: 'judicial_estadual', url: `https://consultasaj.tjam.jus.br/cjsg/resultadoCompleta.do?q=${q}` },
    { nome: 'TJRO — DJe',                 tipo: 'judicial_estadual', url: `https://jurisprudencia.tjro.jus.br/pesquisa?q=${q}` },
    { nome: 'TJAC — DJe',                 tipo: 'judicial_estadual', url: `https://esaj.tjac.jus.br/cjsg/resultadoCompleta.do?q=${q}` },
    { nome: 'TJAP — DJe',                 tipo: 'judicial_estadual', url: `https://tjap.jus.br/jurisprudencia?q=${q}` },
    { nome: 'TJRR — DJe',                 tipo: 'judicial_estadual', url: `https://www.tjrr.jus.br/jurisprudencia?q=${q}` },
    { nome: 'TJTO — DJe',                 tipo: 'judicial_estadual', url: `https://jurisprudencia.tjto.jus.br/pesquisa?q=${q}` },
    // Especializados
    { nome: 'JusBrasil — Agregador Geral', tipo: 'judicial_estadual', url: `https://www.jusbrasil.com.br/jurisprudencia/busca?q=${q}` },
    { nome: 'CNJ — Busca Ativa',           tipo: 'judicial_superior', url: `https://www.cnj.jus.br/busca-ativa-de-processos/?numero=${q}` },
  ]
  return courts.map(c => ({
    fonte: c.nome, fonte_tipo: c.tipo, data_publicacao: null,
    titulo: `Buscar "${termo}" — ${c.nome}`,
    resumo: `Link direto para pesquisa de intimações, notificações e decisões no ${c.nome}.`,
    url: c.url,
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()

  const query = supabase.from('diarios_monitorados').select('*').eq('ativo', true)
  if (id) query.eq('id', id)

  const { data: termos, error: termoErr } = await query
  if (termoErr) return NextResponse.json({ error: termoErr.message }, { status: 500 })
  if (!termos?.length) return NextResponse.json({ error: 'Nenhum termo encontrado' }, { status: 404 })

  const sb = sbAdmin()
  const summaries: Record<string, number> = {}

  for (const t of termos) {
    // Executa todas as buscas em paralelo
    const [qdResults, douResults, djResults] = await Promise.all([
      searchQueridoDiario(t.termo),
      searchDOU(t.termo),
      searchDataJud(t.termo),
    ])

    const stateLinks = getStateDOLinks(t.termo)
    const djeLinks   = getDJeLinks(t.termo)

    const allResults = [...qdResults, ...douResults, ...djResults, ...stateLinks, ...djeLinks]
    summaries[t.id] = allResults.length

    // Apaga resultados anteriores e insere novos
    await sb.from('diarios_resultados').delete().eq('monitorado_id', t.id)
    if (allResults.length > 0) {
      await sb.from('diarios_resultados').insert(
        allResults.map(r => ({
          monitorado_id: t.id,
          fonte: r.fonte, fonte_tipo: r.fonte_tipo,
          data_publicacao: r.data_publicacao || null,
          titulo: r.titulo, resumo: r.resumo, url: r.url, lido: false,
        }))
      )
    }

    const realResults = qdResults.length + djResults.length
    await sb.from('diarios_monitorados').update({
      ultima_busca: new Date().toISOString(),
      total_resultados: allResults.length,
      novos_resultados: realResults,
    }).eq('id', t.id)
  }

  return NextResponse.json({ ok: true, summaries })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const { data: mon } = await supabase.from('diarios_monitorados').select('id').eq('id', id).single()
  if (!mon) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: resultados } = await supabase
    .from('diarios_resultados').select('*').eq('monitorado_id', id)
    .order('fonte_tipo').order('data_publicacao', { ascending: false })

  await supabase.from('diarios_resultados').update({ lido: true }).eq('monitorado_id', id).eq('lido', false)
  await supabase.from('diarios_monitorados').update({ novos_resultados: 0 }).eq('id', id)

  return NextResponse.json(resultados || [])
}
