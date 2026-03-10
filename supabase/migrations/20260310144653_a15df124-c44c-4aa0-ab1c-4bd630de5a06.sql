
-- Drop partial indexes and create proper unique constraints
DROP INDEX IF EXISTS drug_brands_brand_name_unique_idx;
DROP INDEX IF EXISTS drug_brands_rxnorm_id_idx;
DROP INDEX IF EXISTS drug_master_rxnorm_id_idx;

-- Add proper unique constraint on drug_brands.brand_name
ALTER TABLE public.drug_brands ADD CONSTRAINT drug_brands_brand_name_unique UNIQUE (brand_name);
