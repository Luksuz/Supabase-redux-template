-- Migration to standardize research cards schema for better flexibility
-- This migration makes fields more optional and supports additional research types

-- 1. Add new research types to the constraint
ALTER TABLE public.research_cards 
DROP CONSTRAINT IF EXISTS research_cards_type_check;

ALTER TABLE public.research_cards 
ADD CONSTRAINT research_cards_type_check CHECK (
  (type)::text = ANY (
    ARRAY[
      'google'::character varying,
      'youtube'::character varying,
      'firecrawl'::character varying,
      'custom'::character varying,
      'perplexity'::character varying,
      'research'::character varying
    ]::text[]
  )
);

-- 2. Make query field optional by allowing empty strings (it's already nullable)
-- No change needed as query is already text (not varchar with length constraint)

-- 3. Make title field optional by increasing length and allowing it to be generated
ALTER TABLE public.research_cards 
ALTER COLUMN title TYPE character varying(1000);

-- 4. Add new optional fields for enhanced research data
ALTER TABLE public.research_cards 
ADD COLUMN IF NOT EXISTS url text NULL;

ALTER TABLE public.research_cards 
ADD COLUMN IF NOT EXISTS scraped_content text NULL;

ALTER TABLE public.research_cards 
ADD COLUMN IF NOT EXISTS research_method character varying(50) NULL DEFAULT 'unknown'::character varying;

ALTER TABLE public.research_cards 
ADD COLUMN IF NOT EXISTS confidence_score numeric(3,2) NULL;

ALTER TABLE public.research_cards 
ADD COLUMN IF NOT EXISTS word_count integer NULL;

-- 5. Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_research_cards_url ON public.research_cards USING btree (url);
CREATE INDEX IF NOT EXISTS idx_research_cards_research_method ON public.research_cards USING btree (research_method);
CREATE INDEX IF NOT EXISTS idx_research_cards_confidence_score ON public.research_cards USING btree (confidence_score);

-- 6. Update the updated_at trigger function to handle new fields
CREATE OR REPLACE FUNCTION update_research_cards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Add comment to explain the standardized format
COMMENT ON TABLE public.research_cards IS 'Standardized research cards supporting multiple research types and flexible content formats. Content field should contain structured data with originalData and standardized fields.';

COMMENT ON COLUMN public.research_cards.content IS 'JSONB containing: originalData (full source data), plus standardized fields like researchSummary, insights, keyFindings, recommendations, webResults, sources, videosSummary, timestamp, usingMock';

COMMENT ON COLUMN public.research_cards.type IS 'Research type: google (Perplexity), youtube (video analysis), firecrawl (scraped content), custom (user-created), perplexity (direct API), research (general)';

COMMENT ON COLUMN public.research_cards.research_method IS 'Method used: perplexity_api, gemini_analysis, firecrawl_scraping, manual_entry, etc.';

COMMENT ON COLUMN public.research_cards.url IS 'Source URL for scraped content or research source';

COMMENT ON COLUMN public.research_cards.scraped_content IS 'Full text content that was scraped (for firecrawl type)';

COMMENT ON COLUMN public.research_cards.confidence_score IS 'AI confidence score (0.00 to 1.00) for research quality';

COMMENT ON COLUMN public.research_cards.word_count IS 'Word count of the research content for analytics'; 