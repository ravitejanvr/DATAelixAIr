
-- Add rxnorm_id to drug_master
ALTER TABLE public.drug_master ADD COLUMN IF NOT EXISTS rxnorm_id text;
CREATE UNIQUE INDEX IF NOT EXISTS drug_master_rxnorm_id_idx ON public.drug_master(rxnorm_id) WHERE rxnorm_id IS NOT NULL;

-- Add rxnorm_id to drug_brands
ALTER TABLE public.drug_brands ADD COLUMN IF NOT EXISTS rxnorm_id text;
CREATE UNIQUE INDEX IF NOT EXISTS drug_brands_rxnorm_id_idx ON public.drug_brands(rxnorm_id) WHERE rxnorm_id IS NOT NULL;

-- Add unique constraint on brand_name if not already present
CREATE UNIQUE INDEX IF NOT EXISTS drug_brands_brand_name_unique_idx ON public.drug_brands(brand_name) WHERE brand_name IS NOT NULL;
