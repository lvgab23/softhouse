import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const enc = (s: string) => encodeURIComponent(s)

interface DiarioResult {
  fonte: string
  fonte_tipo: string
  data_publicacao: string | null
  titulo: string
  resumo: string
  url: string
}

// ── Querido Diário ────────────────────────────────────────────────────────────
async function searchQueridoDiario(termo: string): Promise<DiarioResult[]> {
  try {
    const res = await fetch(
      `https://queridodiario.ok.org.br/api/gazettes?querystring=${enc(termo)}&size=20&offset=0`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) }
    )
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

// ── DOU / INLABS ─────────────────────────────────────────────────────────────
async function searchDOU(termo: string): Promise<DiarioResult[]> {
  const apiEmail = process.env.INLABS_EMAIL
  const apiPass  = process.env.INLABS_PASSWORD
  const apiKey   = process.env.INLABS_API_KEY
  const today    = new Date().toISOString().split('T')[0]
  const past90   = new Date(Date.now() - 90 * 86400_000).toISOString().split('T')[0]
  const linkDOU  = `https://www.in.gov.br/consulta/-/buscar/dou?q=${enc(termo)}&s=todos&exactDate=personalizado&startDate=${past90}&endDate=${today}&sortType=0`

  if (!apiKey && !(apiEmail && apiPass)) {
    return [{ fonte: 'DOU — Diário Oficial da União', fonte_tipo: 'federal', data_publicacao: null,
      titulo: `Buscar "${termo}" no DOU`, resumo: 'Clique para pesquisar no portal (últimos 90 dias).', url: linkDOU }]
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
    if (!sr.ok) throw new Error('failed')
    const d = await sr.json()
    const hits = (d?.hits?.hits || []).slice(0, 10)
    if (!hits.length) throw new Error('empty')
    return hits.map((h: any) => ({
      fonte: `DOU — ${h._source?.secao || 'Seção'}`,
      fonte_tipo: 'federal',
      data_publicacao: h._source?.pubDate?.split('T')[0] || null,
      titulo: h._source?.titulo || h._source?.identifica || 'Publicação DOU',
      resumo: (h._source?.conteudo || '').slice(0, 400),
      url: `https://www.in.gov.br/web/dou/-/${h._source?.urlTitle || ''}`,
    }))
  } catch {
    return [{ fonte: 'DOU — Diário Oficial da União', fonte_tipo: 'federal', data_publicacao: null,
      titulo: `Buscar "${termo}" no DOU`, resumo: 'Clique para pesquisar no portal.', url: linkDOU }]
  }
}

// ── DataJud CNJ ───────────────────────────────────────────────────────────────
const DATAJUD_KEY = process.env.DATAJUD_API_KEY ||
  'cDZHYzlZa0JadVREZDJCendFbGF6cVRyUzNTSnFJSEVkZlhhYmJXMVoxY2hkYWljQ3ZwbmFnbkZzdw=='

const COURTS = [
  { id: 'stf',  nome: 'STF',  tipo: 'judicial_superior' }, { id: 'stj',  nome: 'STJ',  tipo: 'judicial_superior' },
  { id: 'tst',  nome: 'TST',  tipo: 'judicial_superior' }, { id: 'trf1', nome: 'TRF-1', tipo: 'judicial_federal'  },
  { id: 'trf2', nome: 'TRF-2', tipo: 'judicial_federal'  }, { id: 'trf3', nome: 'TRF-3', tipo: 'judicial_federal'  },
  { id: 'trf4', nome: 'TRF-4', tipo: 'judicial_federal'  }, { id: 'trf5', nome: 'TRF-5', tipo: 'judicial_federal'  },
  { id: 'trf6', nome: 'TRF-6', tipo: 'judicial_federal'  }, { id: 'tjsp', nome: 'TJSP',  tipo: 'judicial_estadual' },
  { id: 'tjrj', nome: 'TJRJ',  tipo: 'judicial_estadual' }, { id: 'tjmg', nome: 'TJMG',  tipo: 'judicial_estadual' },
  { id: 'tjrs', nome: 'TJRS',  tipo: 'judicial_estadual' }, { id: 'tjpr', nome: 'TJPR',  tipo: 'judicial_estadual' },
  { id: 'tjba', nome: 'TJBA',  tipo: 'judicial_estadual' }, { id: 'tjpe', nome: 'TJPE',  tipo: 'judicial_estadual' },
  { id: 'tjce', nome: 'TJCE',  tipo: 'judicial_estadual' }, { id: 'tjsc', nome: 'TJSC',  tipo: 'judicial_estadual' },
  { id: 'tjgo', nome: 'TJGO',  tipo: 'judicial_estadual' }, { id: 'tjdf', nome: 'TJDFT', tipo: 'judicial_estadual' },
  { id: 'tjma', nome: 'TJMA',  tipo: 'judicial_estadual' }, { id: 'tjpa', nome: 'TJPA',  tipo: 'judicial_estadual' },
  { id: 'tjes', nome: 'TJES',  tipo: 'judicial_estadual' }, { id: 'tjmt', nome: 'TJMT',  tipo: 'judicial_estadual' },
  { id: 'tjms', nome: 'TJMS',  tipo: 'judicial_estadual' }, { id: 'tjrn', nome: 'TJRN',  tipo: 'judicial_estadual' },
  { id: 'tjpb', nome: 'TJPB',  tipo: 'judicial_estadual' }, { id: 'tjal', nome: 'TJAL',  tipo: 'judicial_estadual' },
  { id: 'tjpi', nome: 'TJPI',  tipo: 'judicial_estadual' }, { id: 'tjse', nome: 'TJSE',  tipo: 'judicial_estadual' },
  { id: 'tjam', nome: 'TJAM',  tipo: 'judicial_estadual' }, { id: 'tjro', nome: 'TJRO',  tipo: 'judicial_estadual' },
  { id: 'tjac', nome: 'TJAC',  tipo: 'judicial_estadual' }, { id: 'tjap', nome: 'TJAP',  tipo: 'judicial_estadual' },
  { id: 'tjrr', nome: 'TJRR',  tipo: 'judicial_estadual' }, { id: 'tjto', nome: 'TJTO',  tipo: 'judicial_estadual' },
]

async function searchDataJud(termo: string): Promise<DiarioResult[]> {
  const batches: typeof COURTS[] = []
  for (let i = 0; i < COURTS.length; i += 8) batches.push(COURTS.slice(i, i + 8))
  const all: DiarioResult[] = []
  for (const batch of batches) {
    const results = await Promise.all(batch.map(async c => {
      try {
        const r = await fetch(`https://api-publica.datajud.cnj.jus.br/api_publica_${c.id}/_search`, {
          method: 'POST',
          headers: { Authorization: `ApiKey ${DATAJUD_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: { multi_match: { query: termo, fields: ['txtEmenta^3', 'txtDecisao', 'orgaoJulgador.descricao'], operator: 'and' } },
            _source: ['numeroProcesso', 'dataAjuizamento', 'classeProcessual', 'orgaoJulgador', 'txtEmenta', 'siglaTribunal'],
            size: 5,
          }),
          signal: AbortSignal.timeout(10000),
        })
        if (!r.ok) return []
        const d = await r.json()
        return (d.hits?.hits || []).map((h: any) => {
          const s = h._source || {}
          return {
            fonte: `${c.nome} — DataJud CNJ`,
            fonte_tipo: c.tipo,
            data_publicacao: s.dataAjuizamento?.split('T')[0] || null,
            titulo: `${s.classeProcessual?.descricao || 'Processo'} nº ${s.numeroProcesso || h._id}`,
            resumo: (s.txtEmenta || `Órgão: ${s.orgaoJulgador?.descricao || '—'}`).slice(0, 350),
            url: `https://www.cnj.jus.br/busca-ativa-de-processos/?numero=${s.numeroProcesso || ''}`,
          } as DiarioResult
        })
      } catch { return [] as DiarioResult[] }
    }))
    all.push(...results.flat())
  }
  return all
}

// ── Links estaduais + tribunais ───────────────────────────────────────────────
function getLinks(termo: string): DiarioResult[] {
  const q = enc(termo)
  const stateLinks: DiarioResult[] = [
    { fonte: 'DO SP — Imprensa Oficial', fonte_tipo: 'estadual', data_publicacao: null, titulo: `Buscar no DO de São Paulo`, resumo: '', url: `https://www.imprensaoficial.com.br/DO/BuscaDO2001Resultado_11_3.aspx?filtro=1&tipobusca=simples&q=${q}` },
    { fonte: 'DO RJ', fonte_tipo: 'estadual', data_publicacao: null, titulo: `Buscar no DO do Rio de Janeiro`, resumo: '', url: `https://www.jusbrasil.com.br/diarios/busca/?q=${q}&s=RJ` },
    { fonte: 'DO MG — IOF', fonte_tipo: 'estadual', data_publicacao: null, titulo: `Buscar no DO de Minas Gerais`, resumo: '', url: `https://www.iof.mg.gov.br/pesquisa?q=${q}` },
    { fonte: 'DO RS', fonte_tipo: 'estadual', data_publicacao: null, titulo: `Buscar no DO do RS`, resumo: '', url: `https://www.ioergs.rs.gov.br/pesquisa?q=${q}` },
    { fonte: 'DO PR', fonte_tipo: 'estadual', data_publicacao: null, titulo: `Buscar no DO do Paraná`, resumo: '', url: `https://www.iopr.pr.gov.br/pesquisa?q=${q}` },
    { fonte: 'DO BA', fonte_tipo: 'estadual', data_publicacao: null, titulo: `Buscar no DO da Bahia`, resumo: '', url: `https://djo.ba.gov.br/pesquisa?q=${q}` },
    { fonte: 'DO DF', fonte_tipo: 'estadual', data_publicacao: null, titulo: `Buscar no DO do DF`, resumo: '', url: `https://www.dodf.df.gov.br/index/pesquisa-resultado?q=${q}` },
    { fonte: 'JusBrasil — Todos os estados', fonte_tipo: 'estadual', data_publicacao: null, titulo: `Buscar em todos os DOs estaduais`, resumo: 'Agregador de diários oficiais estaduais.', url: `https://www.jusbrasil.com.br/diarios/busca/?q=${q}` },
  ]
  const courtLinks: DiarioResult[] = [
    { fonte: 'STF', fonte_tipo: 'judicial_superior', data_publicacao: null, titulo: 'Buscar no STF', resumo: '', url: `https://jurisprudencia.stf.jus.br/pages/search?base=acordaos&queryString=${q}` },
    { fonte: 'STJ', fonte_tipo: 'judicial_superior', data_publicacao: null, titulo: 'Buscar no STJ', resumo: '', url: `https://scon.stj.jus.br/SCON/pesquisar.jsp?livre=${q}` },
    { fonte: 'TST', fonte_tipo: 'judicial_superior', data_publicacao: null, titulo: 'Buscar no TST', resumo: '', url: `https://jurisprudencia.tst.jus.br/#livre&query=${q}` },
    { fonte: 'CNJ — Busca Ativa', fonte_tipo: 'judicial_superior', data_publicacao: null, titulo: 'Busca processual CNJ', resumo: '', url: `https://www.cnj.jus.br/busca-ativa-de-processos/?numero=${q}` },
    { fonte: 'TRF-1', fonte_tipo: 'judicial_federal', data_publicacao: null, titulo: 'Buscar no TRF-1', resumo: '', url: `https://jurisprudencia.trf1.jus.br/busca/?key=${q}` },
    { fonte: 'TRF-2', fonte_tipo: 'judicial_federal', data_publicacao: null, titulo: 'Buscar no TRF-2', resumo: '', url: `https://www10.trf2.jus.br/jurisprudencia/?q=${q}` },
    { fonte: 'TRF-3', fonte_tipo: 'judicial_federal', data_publicacao: null, titulo: 'Buscar no TRF-3', resumo: '', url: `https://web.trf3.jus.br/base-textual/Home/ListaColecao?query=${q}` },
    { fonte: 'TRF-4', fonte_tipo: 'judicial_federal', data_publicacao: null, titulo: 'Buscar no TRF-4', resumo: '', url: `https://jurisprudencia.trf4.jus.br/pesquisa/pesquisa.php?tipo=1&descricao=${q}` },
    { fonte: 'TRF-5', fonte_tipo: 'judicial_federal', data_publicacao: null, titulo: 'Buscar no TRF-5', resumo: '', url: `https://www.trf5.jus.br/Jurisprudencia/JurisServlet?op=exibir&tipo=1&termoPesquisa=${q}` },
    { fonte: 'TRF-6', fonte_tipo: 'judicial_federal', data_publicacao: null, titulo: 'Buscar no TRF-6', resumo: '', url: `https://www.trf6.jus.br/jurisprudencia?q=${q}` },
    { fonte: 'TJSP — DJe', fonte_tipo: 'judicial_estadual', data_publicacao: null, titulo: 'Buscar no TJSP', resumo: '', url: `https://esaj.tjsp.jus.br/cdje/consultaSimples.do?nomParticipante=${q}` },
    { fonte: 'TJRJ — DJe', fonte_tipo: 'judicial_estadual', data_publicacao: null, titulo: 'Buscar no TJRJ', resumo: '', url: `https://www3.tjrj.jus.br/consultadje/?nomeParticipante=${q}` },
    { fonte: 'TJMG', fonte_tipo: 'judicial_estadual', data_publicacao: null, titulo: 'Buscar no TJMG', resumo: '', url: `https://www5.tjmg.jus.br/jurisprudencia/pesquisaPalavrasEspelhoAcordao.do?termo=${q}` },
    { fonte: 'JusBrasil — Jurisprudência', fonte_tipo: 'judicial_estadual', data_publicacao: null, titulo: 'Buscar jurisprudência no JusBrasil', resumo: 'Agregador de jurisprudência de todos os tribunais.', url: `https://www.jusbrasil.com.br/jurisprudencia/busca?q=${q}` },
  ]
  return [...stateLinks, ...courtLinks]
}

// ── POST /api/diarios-oficiais/pesquisar ──────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { termo, tipo } = await req.json()
  if (!termo?.trim()) return NextResponse.json({ error: 'termo obrigatório' }, { status: 400 })

  const [qdResults, douResults, djResults] = await Promise.all([
    searchQueridoDiario(termo),
    searchDOU(termo),
    searchDataJud(termo),
  ])
  const links = getLinks(termo)
  const all = [...qdResults, ...douResults, ...djResults, ...links]

  return NextResponse.json({
    ok: true,
    termo,
    tipo: tipo || 'nome',
    total: all.length,
    reais: qdResults.length + djResults.length,
    resultados: all,
  })
}
