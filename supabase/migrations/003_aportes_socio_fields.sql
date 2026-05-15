-- Add socio_nome to aportes table for partner contribution tracking
-- Run in Supabase SQL Editor

ALTER TABLE aportes ADD COLUMN IF NOT EXISTS socio_nome TEXT;

-- Note: Use tipo = 'aporte_socio' to identify partner contributions.
-- The existing 'tipo' column (TEXT) already supports this without schema changes.
