import { checkCNPJ } from './engines/cnpj'
import { checkTransparencia } from './engines/transparencia'
import { checkDataJud } from './engines/datajud'
import { checkEscavador } from './engines/escavador'
import { checkPEP } from './engines/pep'
import { checkBacen } from './engines/bacen'
import { checkPGFN } from './engines/pgfn'
import { checkSAJ } from './engines/saj'
import { checkTJMG } from './engines/tjmg'
import { checkTJRJ } from './engines/tjrj'
import { checkTJRS } from './engines/tjrs'
import { checkSuperiores } from './engines/superiores'
import { checkSancoesInternacionais } from './engines/sancoes-internacionais'
import { checkIBAMA } from './engines/ibama'
import { checkCVM } from './engines/cvm'
import { checkMidia } from './engines/midia'
import { calcularScore } from './score'
import { ComplianceResult, EngineResult, Finding } from './types'

export async function runCompliance(
  documento: string,
  tipo: 'CPF' | 'CNPJ',
  processos: string[] = [],
  nome: string = '',
): Promise<ComplianceResult> {
  const engines: EngineResult[] = []

  const tasks: Promise<EngineResult>[] = [
    // Fontes de sanções e cadastro (APIs abertas)
    checkTransparencia(documento, tipo),
    checkDataJud(processos),
    checkPEP(documento, tipo),
    checkBacen(documento, tipo),
    checkPGFN(documento, tipo),
    // Tribunais estaduais — SAJ (16 TJs)
    checkSAJ(documento),
    // Tribunais estaduais — portais próprios
    checkTJMG(documento, nome),
    checkTJRJ(documento, nome),
    checkTJRS(documento, nome),
    // Tribunais superiores, TRFs e TRTs (STJ, STF, TST, TSE, TRF1-6, TRT1-24)
    checkSuperiores(documento, nome),
  ]

  if (tipo === 'CNPJ') {
    tasks.unshift(checkCNPJ(documento))
  }

  if (process.env.ESCAVADOR_API_KEY) {
    tasks.push(checkEscavador(documento, tipo, nome))
  }

  // Novas fontes — sempre ativas (sem chave necessária para OFAC SDN, IBAMA e CVM)
  tasks.push(checkSancoesInternacionais(documento, tipo, nome))
  tasks.push(checkIBAMA(documento, tipo))
  tasks.push(checkCVM(documento, tipo, nome))
  if (nome) tasks.push(checkMidia(nome, tipo))

  const settled = await Promise.allSettled(tasks)
  for (const r of settled) {
    if (r.status === 'fulfilled') engines.push(r.value)
  }

  const allFindings: Finding[] = engines.flatMap(e => e.findings)
  const { score, nivel } = calcularScore(allFindings)

  const cnpjEngine = engines.find(e => e.engine === 'Receita Federal')
  const nomeRF = cnpjEngine?.metadata?.razao_social || nome

  return {
    documento,
    tipo,
    nome: nomeRF,
    score_total: score,
    nivel_risco: nivel,
    findings: allFindings,
    engines: Object.fromEntries(engines.map(e => [e.engine, e])),
    resumo: {
      judicial: allFindings.filter(f => f.categoria === 'JUDICIAL').length,
      cadastral: allFindings.filter(f => f.categoria === 'CADASTRAL').length,
      trabalhista: allFindings.filter(f => f.categoria === 'TRABALHISTA').length,
      sancao: allFindings.filter(f => f.categoria === 'SANCAO').length,
      criminal: allFindings.filter(f => f.categoria === 'CRIMINAL').length,
      financeiro: allFindings.filter(f => f.categoria === 'FINANCEIRO').length,
      ambiental: allFindings.filter(f => f.categoria === 'AMBIENTAL').length,
      midia: allFindings.filter(f => f.categoria === 'MIDIA').length,
      total: allFindings.length,
    },
  }
}
