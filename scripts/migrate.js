#!/usr/bin/env node
// Executar: node scripts/migrate.js
// Requer DATABASE_URL no .env.local ou como variável de ambiente
// Obtenha a connection string em:
// https://supabase.com/dashboard/project/pltrjmfcsyeqxrgxvdmz/settings/database

const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

// Carrega .env.local
const envFile = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf8').split('\n')
  for (const line of lines) {
    const match = line.match(/^([^#=]+)=(.+)$/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('\n❌ DATABASE_URL não encontrado no .env.local\n')
  console.error('Adicione ao .env.local:')
  console.error('DATABASE_URL=postgresql://postgres:[SUA-SENHA]@db.pltrjmfcsyeqxrgxvdmz.supabase.co:5432/postgres\n')
  console.error('Obtenha a senha em: https://supabase.com/dashboard/project/pltrjmfcsyeqxrgxvdmz/settings/database\n')
  process.exit(1)
}

const SQL = `
CREATE TABLE IF NOT EXISTS usinas_solares_leituras (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  usina_id uuid NOT NULL REFERENCES usinas_solares(id) ON DELETE CASCADE,
  data date NOT NULL,
  kwh numeric(10,3) NOT NULL DEFAULT 0,
  potencia_pico_kw numeric(10,3),
  eficiencia numeric(6,2),
  source text DEFAULT 'api',
  created_at timestamptz DEFAULT now(),
  UNIQUE(usina_id, data)
);
CREATE INDEX IF NOT EXISTS idx_leituras_usina_data ON usinas_solares_leituras(usina_id, data DESC);
ALTER TABLE usinas_solares_leituras ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS usinas_solares_alarmes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  usina_id uuid NOT NULL REFERENCES usinas_solares(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  severidade text NOT NULL DEFAULT 'warning',
  descricao text,
  ativo boolean DEFAULT true,
  notificado boolean DEFAULT false,
  notificado_em timestamptz,
  created_at timestamptz DEFAULT now(),
  resolvido_em timestamptz
);
CREATE INDEX IF NOT EXISTS idx_alarmes_usina_ativo ON usinas_solares_alarmes(usina_id, ativo);
ALTER TABLE usinas_solares_alarmes ENABLE ROW LEVEL SECURITY;

ALTER TABLE usinas_solares ADD COLUMN IF NOT EXISTS email_alerta text;
ALTER TABLE usinas_solares ADD COLUMN IF NOT EXISTS whatsapp_numero text;
ALTER TABLE usinas_solares ADD COLUMN IF NOT EXISTS alertas_ativo boolean DEFAULT true;
`

async function run() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })
  console.log('\n🔌 Conectando ao banco de dados...')
  await client.connect()
  console.log('✅ Conectado!')
  console.log('⚙️  Aplicando migração...')
  await client.query(SQL)
  await client.end()
  console.log('✅ Migração aplicada com sucesso!\n')
  console.log('Tabelas criadas:')
  console.log('  • usinas_solares_leituras (histórico de geração)')
  console.log('  • usinas_solares_alarmes (alertas e notificações)')
  console.log('  • colunas adicionadas em usinas_solares (email_alerta, whatsapp_numero, alertas_ativo)')
  console.log('\nReinicie o servidor Next.js para que as mudanças tenham efeito.\n')
}

run().catch(err => {
  console.error('\n❌ Erro:', err.message, '\n')
  process.exit(1)
})
