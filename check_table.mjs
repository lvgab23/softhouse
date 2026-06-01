import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!URL || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const sql = `
CREATE TABLE IF NOT EXISTS bens_moveis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT DEFAULT 'veiculo',
  marca TEXT, modelo TEXT, ano INTEGER, placa TEXT, renavam TEXT, cor TEXT,
  km_atual DECIMAL(12,1), combustivel TEXT,
  valor_aquisicao DECIMAL(15,2), valor_atual DECIMAL(15,2),
  data_aquisicao DATE, seguro_apolice TEXT, seguro_vencimento DATE,
  ipva_vencimento DATE, status TEXT DEFAULT 'ativo',
  cidade TEXT, estado TEXT, notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE bens_moveis ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bens_moveis' AND policyname='Users manage own bens_moveis') THEN
    EXECUTE 'CREATE POLICY "Users manage own bens_moveis" ON bens_moveis FOR ALL USING (auth.uid() = user_id)';
  END IF;
END $$;
`

// Try the query endpoint used by Supabase Studio
const res = await fetch(`${URL}/rest/v1/`, {
  method: 'GET',
  headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
})
const paths = await res.json()
console.log('Available paths:', JSON.stringify(paths).substring(0, 300))
