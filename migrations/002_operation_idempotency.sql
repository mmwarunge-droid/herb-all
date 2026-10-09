CREATE TABLE operation_receipts (key_hash text PRIMARY KEY, administrator_id uuid NOT NULL REFERENCES administrators(id), request_hash text NOT NULL, response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX operation_receipts_created ON operation_receipts(created_at);
