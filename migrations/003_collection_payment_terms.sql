-- Preserve existing order terms; only newly placed collection orders opt in.
ALTER TABLE orders ADD COLUMN collection_pay_on_pickup boolean NOT NULL DEFAULT false;
ALTER TABLE orders ADD CONSTRAINT collection_payment_method CHECK (NOT collection_pay_on_pickup OR delivery_method='collection');
