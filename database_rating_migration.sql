-- Migration: Add Section Rating System
-- Run this to add rating functionality to existing databases

-- Add rating columns to fine_tuning_outline_sections table
DO $$
BEGIN
    -- Add section rating columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'fine_tuning_outline_sections' 
                   AND column_name = 'quality_score') THEN
        ALTER TABLE public.fine_tuning_outline_sections 
        ADD COLUMN quality_score DECIMAL(3,2) CHECK (quality_score >= 0 AND quality_score <= 10);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'fine_tuning_outline_sections' 
                   AND column_name = 'rating_notes') THEN
        ALTER TABLE public.fine_tuning_outline_sections 
        ADD COLUMN rating_notes TEXT;
    END IF;
END $$;

-- Create indexes for rating queries
CREATE INDEX IF NOT EXISTS idx_sections_quality_score ON public.fine_tuning_outline_sections(quality_score);

-- Update the statistics view to include section ratings
CREATE OR REPLACE VIEW public.fine_tuning_job_stats AS
SELECT 
  j.id,
  j.name,
  j.created_at,
  COUNT(DISTINCT s.id) as section_count,
  COUNT(t.id) as text_count,
  COUNT(CASE WHEN t.is_validated THEN 1 END) as validated_texts_count,
  COUNT(CASE WHEN s.section_is_validated THEN 1 END) as validated_sections_count,
  AVG(t.quality_score) as avg_text_quality_score,
  AVG(s.section_quality_score) as avg_section_quality_score,
  SUM(t.character_count) as total_characters,
  SUM(t.word_count) as total_words
FROM public.fine_tuning_jobs j
LEFT JOIN public.fine_tuning_outline_sections s ON j.id = s.job_id
LEFT JOIN public.fine_tuning_texts t ON s.id = t.outline_section_id
GROUP BY j.id, j.name, j.created_at;

-- Optional: Create a detailed ratings view
CREATE OR REPLACE VIEW public.detailed_ratings AS
SELECT 
  j.id as job_id,
  j.name as job_name,
  s.id as section_id,
  s.title as section_title,
  s.section_quality_score,
  s.section_is_validated as section_validated,
  s.section_rating_notes,
  t.id as text_id,
  t.quality_score as text_quality_score,
  t.is_validated as text_validated,
  t.validation_notes as text_notes,
  t.character_count,
  t.word_count
FROM public.fine_tuning_jobs j
LEFT JOIN public.fine_tuning_outline_sections s ON j.id = s.job_id
LEFT JOIN public.fine_tuning_texts t ON s.id = t.outline_section_id
ORDER BY j.created_at DESC, s.section_order, t.text_order; 