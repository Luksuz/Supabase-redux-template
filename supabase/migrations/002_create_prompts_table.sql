-- Create fine_tuning_prompts table for storing user-created script generation prompts
CREATE TABLE IF NOT EXISTS fine_tuning_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    prompt TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on title for faster searches
CREATE INDEX IF NOT EXISTS idx_fine_tuning_prompts_title ON fine_tuning_prompts(title);

-- Create an index on created_at for ordering
CREATE INDEX IF NOT EXISTS idx_fine_tuning_prompts_created_at ON fine_tuning_prompts(created_at);

-- Add RLS (Row Level Security) policies if needed
ALTER TABLE fine_tuning_prompts ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (you may want to add user-specific policies later)
CREATE POLICY "Allow all operations on fine_tuning_prompts" ON fine_tuning_prompts
    FOR ALL USING (true) WITH CHECK (true); 