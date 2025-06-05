-- Enhanced Fine-Tuning Schema
-- Improved version with better structure, validation, and performance

-- Fine-tuning jobs table with status tracking
ALTER TABLE public.fine_tuning_jobs 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS name TEXT CHECK (length(name) > 0),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS theme TEXT CHECK (length(theme) > 0),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'completed', 'failed', 'cancelled')),
  ADD COLUMN IF NOT EXISTS model_name TEXT DEFAULT 'gpt-4o-mini',
  ADD COLUMN IF NOT EXISTS training_config JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS total_sections INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_sections INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_training_examples INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fine_tuned_model_id TEXT,
  ADD COLUMN IF NOT EXISTS training_file_id TEXT,
  ADD COLUMN IF NOT EXISTS validation_file_id TEXT,
  ADD COLUMN IF NOT EXISTS job_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS job_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Make user_id NOT NULL if it isn't already
ALTER TABLE public.fine_tuning_jobs 
  ALTER COLUMN user_id SET NOT NULL;

-- Outline sections with better validation
ALTER TABLE public.fine_tuning_outline_sections 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS writing_instructions TEXT CHECK (length(writing_instructions) > 0),
  ADD COLUMN IF NOT EXISTS tone TEXT,
  ADD COLUMN IF NOT EXISTS style_preferences TEXT,
  ADD COLUMN IF NOT EXISTS section_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS training_examples_count INTEGER DEFAULT 0;

-- Make title NOT NULL and add check constraint if it isn't already
ALTER TABLE public.fine_tuning_outline_sections 
  ALTER COLUMN title SET NOT NULL;

-- Add check constraint for title if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'fine_tuning_outline_sections_title_check'
  ) THEN
    ALTER TABLE public.fine_tuning_outline_sections 
      ADD CONSTRAINT fine_tuning_outline_sections_title_check CHECK (length(title) > 0);
  END IF;
END $$;

-- Training texts with better structure
ALTER TABLE public.fine_tuning_texts 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS input_text TEXT CHECK (length(input_text) > 0),
  ADD COLUMN IF NOT EXISTS generated_script TEXT CHECK (length(generated_script) > 0),
  ADD COLUMN IF NOT EXISTS text_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quality_score DECIMAL(3,2) CHECK (quality_score >= 0 AND quality_score <= 10),
  ADD COLUMN IF NOT EXISTS is_validated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS validation_notes TEXT;

-- Rename 'text' column to 'input_text' if it exists and input_text doesn't
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fine_tuning_texts' AND column_name = 'text'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fine_tuning_texts' AND column_name = 'input_text'
  ) THEN
    ALTER TABLE public.fine_tuning_texts RENAME COLUMN text TO input_text;
  END IF;
END $$;

-- Rename 'order_number' column to 'text_order' if it exists and text_order doesn't
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fine_tuning_texts' AND column_name = 'order_number'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fine_tuning_texts' AND column_name = 'text_order'
  ) THEN
    ALTER TABLE public.fine_tuning_texts RENAME COLUMN order_number TO text_order;
  END IF;
END $$;

-- Add computed columns for training format and metrics
DO $$ 
BEGIN
  -- Add training_prompt computed column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fine_tuning_texts' AND column_name = 'training_prompt'
  ) THEN
    ALTER TABLE public.fine_tuning_texts 
      ADD COLUMN training_prompt TEXT GENERATED ALWAYS AS (
        format('System: %s\n\nUser: %s\n\nAssistant: %s', 
               'You are a professional script writer.',
               COALESCE(input_text, ''),
               COALESCE(generated_script, '')
        )
      ) STORED;
  END IF;

  -- Add character_count computed column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fine_tuning_texts' AND column_name = 'character_count'
  ) THEN
    ALTER TABLE public.fine_tuning_texts 
      ADD COLUMN character_count INTEGER GENERATED ALWAYS AS (length(COALESCE(generated_script, ''))) STORED;
  END IF;

  -- Add word_count computed column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fine_tuning_texts' AND column_name = 'word_count'
  ) THEN
    ALTER TABLE public.fine_tuning_texts 
      ADD COLUMN word_count INTEGER GENERATED ALWAYS AS (
        array_length(string_to_array(COALESCE(generated_script, ''), ' '), 1)
      ) STORED;
  END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_fine_tuning_jobs_user_id ON fine_tuning_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_fine_tuning_jobs_status ON fine_tuning_jobs(status);
CREATE INDEX IF NOT EXISTS idx_fine_tuning_jobs_created_at ON fine_tuning_jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_outline_sections_job_id ON fine_tuning_outline_sections(job_id);
CREATE INDEX IF NOT EXISTS idx_outline_sections_order ON fine_tuning_outline_sections(job_id, section_order);

CREATE INDEX IF NOT EXISTS idx_texts_section_id ON fine_tuning_texts(outline_section_id);
CREATE INDEX IF NOT EXISTS idx_texts_order ON fine_tuning_texts(outline_section_id, text_order);
CREATE INDEX IF NOT EXISTS idx_texts_validated ON fine_tuning_texts(is_validated);

-- Create or replace function for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'update_fine_tuning_jobs_updated_at'
  ) THEN
    CREATE TRIGGER update_fine_tuning_jobs_updated_at 
      BEFORE UPDATE ON fine_tuning_jobs 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'update_outline_sections_updated_at'
  ) THEN
    CREATE TRIGGER update_outline_sections_updated_at 
      BEFORE UPDATE ON fine_tuning_outline_sections 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'update_texts_updated_at'
  ) THEN
    CREATE TRIGGER update_texts_updated_at 
      BEFORE UPDATE ON fine_tuning_texts 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Enable Row Level Security if not already enabled
ALTER TABLE fine_tuning_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fine_tuning_outline_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE fine_tuning_texts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Users can view their own fine-tuning jobs" ON fine_tuning_jobs;
DROP POLICY IF EXISTS "Users can create their own fine-tuning jobs" ON fine_tuning_jobs;
DROP POLICY IF EXISTS "Users can update their own fine-tuning jobs" ON fine_tuning_jobs;
DROP POLICY IF EXISTS "Users can delete their own fine-tuning jobs" ON fine_tuning_jobs;
DROP POLICY IF EXISTS "Users can access sections from their jobs" ON fine_tuning_outline_sections;
DROP POLICY IF EXISTS "Users can access texts from their sections" ON fine_tuning_texts;

-- Create policies
CREATE POLICY "Users can view their own fine-tuning jobs" 
  ON fine_tuning_jobs FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own fine-tuning jobs" 
  ON fine_tuning_jobs FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own fine-tuning jobs" 
  ON fine_tuning_jobs FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own fine-tuning jobs" 
  ON fine_tuning_jobs FOR DELETE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can access sections from their jobs" 
  ON fine_tuning_outline_sections FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM fine_tuning_jobs 
      WHERE id = job_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can access texts from their sections" 
  ON fine_tuning_texts FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM fine_tuning_outline_sections os
      JOIN fine_tuning_jobs j ON os.job_id = j.id
      WHERE os.id = outline_section_id AND j.user_id = auth.uid()
    )
  );

-- Create or replace view for analytics
CREATE OR REPLACE VIEW fine_tuning_job_stats AS
SELECT 
  j.id,
  j.name,
  j.status,
  j.created_at,
  COUNT(DISTINCT s.id) as section_count,
  COUNT(t.id) as text_count,
  COUNT(CASE WHEN t.is_validated THEN 1 END) as validated_count,
  AVG(t.quality_score) as avg_quality_score,
  SUM(t.character_count) as total_characters,
  SUM(t.word_count) as total_words
FROM fine_tuning_jobs j
LEFT JOIN fine_tuning_outline_sections s ON j.id = s.job_id
LEFT JOIN fine_tuning_texts t ON s.id = t.outline_section_id
GROUP BY j.id, j.name, j.status, j.created_at; 