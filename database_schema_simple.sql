-- Simple Fine-Tuning Schema (No Status, Plain SQL)

-- Create tables if they don't exist
CREATE TABLE IF NOT EXISTS public.fine_tuning_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL CHECK (length(name) > 0),
  description TEXT,
  theme TEXT NOT NULL CHECK (length(theme) > 0),
  model_name TEXT DEFAULT 'gpt-4o-mini',
  total_sections INTEGER DEFAULT 0,
  completed_sections INTEGER DEFAULT 0,
  total_training_examples INTEGER DEFAULT 0,
  training_config JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.fine_tuning_outline_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  job_id UUID NOT NULL REFERENCES public.fine_tuning_jobs(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) > 0),
  writing_instructions TEXT NOT NULL CHECK (length(writing_instructions) > 0),
  target_audience TEXT,
  tone TEXT,
  style_preferences TEXT,
  section_order INTEGER NOT NULL DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  training_examples_count INTEGER DEFAULT 0,
  -- Section Rating Fields
  quality_score DECIMAL(3,2) CHECK (quality_score >= 0 AND quality_score <= 10),
  rating_notes TEXT
);

CREATE TABLE IF NOT EXISTS public.fine_tuning_texts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  outline_section_id UUID NOT NULL REFERENCES public.fine_tuning_outline_sections(id) ON DELETE CASCADE,
  input_text TEXT NOT NULL CHECK (length(input_text) > 0),
  generated_script TEXT NOT NULL CHECK (length(generated_script) > 0),
  text_order INTEGER NOT NULL DEFAULT 0,
  quality_score DECIMAL(3,2) CHECK (quality_score >= 0 AND quality_score <= 10),
  is_validated BOOLEAN DEFAULT false,
  validation_notes TEXT,
  character_count INTEGER GENERATED ALWAYS AS (length(generated_script)) STORED,
  word_count INTEGER GENERATED ALWAYS AS (
    array_length(string_to_array(generated_script, ' '), 1)
  ) STORED
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_fine_tuning_jobs_user_id ON public.fine_tuning_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_fine_tuning_jobs_created_at ON public.fine_tuning_jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_outline_sections_job_id ON public.fine_tuning_outline_sections(job_id);
CREATE INDEX IF NOT EXISTS idx_outline_sections_order ON public.fine_tuning_outline_sections(job_id, section_order);

CREATE INDEX IF NOT EXISTS idx_texts_section_id ON public.fine_tuning_texts(outline_section_id);
CREATE INDEX IF NOT EXISTS idx_texts_order ON public.fine_tuning_texts(outline_section_id, text_order);
CREATE INDEX IF NOT EXISTS idx_texts_validated ON public.fine_tuning_texts(is_validated);

-- Create or replace function for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_fine_tuning_jobs_updated_at ON public.fine_tuning_jobs;
DROP TRIGGER IF EXISTS update_outline_sections_updated_at ON public.fine_tuning_outline_sections;
DROP TRIGGER IF EXISTS update_texts_updated_at ON public.fine_tuning_texts;

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_fine_tuning_jobs_updated_at 
  BEFORE UPDATE ON public.fine_tuning_jobs 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_outline_sections_updated_at 
  BEFORE UPDATE ON public.fine_tuning_outline_sections 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_texts_updated_at 
  BEFORE UPDATE ON public.fine_tuning_texts 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.fine_tuning_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fine_tuning_outline_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fine_tuning_texts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own fine-tuning jobs" ON public.fine_tuning_jobs;
DROP POLICY IF EXISTS "Users can create their own fine-tuning jobs" ON public.fine_tuning_jobs;
DROP POLICY IF EXISTS "Users can update their own fine-tuning jobs" ON public.fine_tuning_jobs;
DROP POLICY IF EXISTS "Users can delete their own fine-tuning jobs" ON public.fine_tuning_jobs;
DROP POLICY IF EXISTS "Users can access sections from their jobs" ON public.fine_tuning_outline_sections;
DROP POLICY IF EXISTS "Users can access texts from their sections" ON public.fine_tuning_texts;

-- Create RLS policies
CREATE POLICY "Users can view their own fine-tuning jobs" 
  ON public.fine_tuning_jobs FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own fine-tuning jobs" 
  ON public.fine_tuning_jobs FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own fine-tuning jobs" 
  ON public.fine_tuning_jobs FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own fine-tuning jobs" 
  ON public.fine_tuning_jobs FOR DELETE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can access sections from their jobs" 
  ON public.fine_tuning_outline_sections FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.fine_tuning_jobs 
      WHERE id = job_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can access texts from their sections" 
  ON public.fine_tuning_texts FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.fine_tuning_outline_sections os
      JOIN public.fine_tuning_jobs j ON os.job_id = j.id
      WHERE os.id = outline_section_id AND j.user_id = auth.uid()
    )
  );

-- Create a view for job statistics
CREATE OR REPLACE VIEW public.fine_tuning_job_stats AS
SELECT 
  j.id,
  j.name,
  j.created_at,
  COUNT(DISTINCT s.id) as section_count,
  COUNT(t.id) as text_count,
  COUNT(CASE WHEN t.is_validated THEN 1 END) as validated_count,
  AVG(t.quality_score) as avg_quality_score,
  SUM(t.character_count) as total_characters,
  SUM(t.word_count) as total_words
FROM public.fine_tuning_jobs j
LEFT JOIN public.fine_tuning_outline_sections s ON j.id = s.job_id
LEFT JOIN public.fine_tuning_texts t ON s.id = t.outline_section_id
GROUP BY j.id, j.name, j.created_at; 