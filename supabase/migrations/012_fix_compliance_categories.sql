-- Corrige categorias de findings para incluir FINANCEIRO e AMBIENTAL
-- que são usadas pelos engines bacen, pgfn e ibama mas estavam ausentes do CHECK

ALTER TABLE compliance_findings
  DROP CONSTRAINT IF EXISTS compliance_findings_categoria_check;

ALTER TABLE compliance_findings
  ADD CONSTRAINT compliance_findings_categoria_check
  CHECK (categoria IN ('JUDICIAL', 'CADASTRAL', 'TRABALHISTA', 'SANCAO', 'CRIMINAL', 'CREDITO', 'MIDIA', 'FINANCEIRO', 'AMBIENTAL'));
