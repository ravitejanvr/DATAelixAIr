
-- Add verification tracking
ALTER TABLE public.insights_articles ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;

-- Mark articles with confirmed-working URLs as verified
UPDATE public.insights_articles SET is_verified = true WHERE url IN (
  'https://www.nature.com/articles/s41746-026-02539-z',
  'https://www.nature.com/articles/s41746-026-02612-7',
  'https://jamanetwork.com/journals/jama/fullarticle/2846620',
  'https://jamanetwork.com/journals/jamainternalmedicine/fullarticle/2827391',
  'https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2828103',
  'https://www.thelancet.com/journals/lansea/article/PIIS2772-3682(25)00094-1'
);

-- Deactivate articles with unverifiable URLs (redirect to login / don't resolve)
UPDATE public.insights_articles SET is_active = false WHERE url IN (
  'https://www.nature.com/articles/s41746-026-01445',
  'https://www.nature.com/articles/s41591-026-04018',
  'https://www.nature.com/articles/s41591-025-03412',
  'https://www.nature.com/articles/s41746-025-01398',
  'https://www.thelancet.com/journals/landig/article/PIIS2589-7500(25)00187-3'
);
