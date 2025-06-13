-- Add prompt tracking to fine_tuning_jobs table
-- This will store the prompt content that was used to generate sections

ALTER TABLE fine_tuning_jobs 
ADD COLUMN IF NOT EXISTS prompt_used TEXT;

-- Add an index for prompt queries
CREATE INDEX IF NOT EXISTS idx_fine_tuning_jobs_prompt_used ON fine_tuning_jobs(prompt_used);

-- Add a comment to document the field
COMMENT ON COLUMN fine_tuning_jobs.prompt_used IS 'The prompt content that was used to generate sections for this job'; 