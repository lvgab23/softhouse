-- Extend colaboradores table with invite/permissions system
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id);
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS nome TEXT;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pendente';
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS token_convite UUID DEFAULT gen_random_uuid();
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS permissoes JSONB DEFAULT '{
  "dashboard": true,
  "aportes": true,
  "retornos": true,
  "lancamentos": false,
  "patrimonios": false,
  "projetos": true,
  "empresas": false,
  "bens_moveis": false
}';

-- Populate owner_user_id from existing user_id where applicable
UPDATE colaboradores SET owner_user_id = user_id WHERE owner_user_id IS NULL AND user_id IS NOT NULL;

-- Index for token lookups
CREATE UNIQUE INDEX IF NOT EXISTS colaboradores_token_convite_idx ON colaboradores(token_convite);
