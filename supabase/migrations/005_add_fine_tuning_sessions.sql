-- Add file_id to fine_tuning_jobs table
ALTER TABLE fine_tuning_jobs ADD COLUMN IF NOT EXISTS file_id TEXT;

-- Create fine_tuning_sessions table for tracking OpenAI fine-tuning jobs
CREATE TABLE IF NOT EXISTS fine_tuning_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID NOT NULL,
    job_id UUID REFERENCES fine_tuning_jobs(id) ON DELETE CASCADE,
    upload_id UUID REFERENCES fine_tuning_uploads(id) ON DELETE SET NULL,
    openai_job_id TEXT NOT NULL UNIQUE,
    openai_file_id TEXT NOT NULL,
    model TEXT NOT NULL,
    status TEXT DEFAULT 'queued',
    openai_created_at TIMESTAMP WITH TIME ZONE,
    openai_finished_at TIMESTAMP WITH TIME ZONE,
    fine_tuned_model TEXT,
    trained_tokens INTEGER,
    hyperparameters JSONB,
    error_details JSONB,
    result_files TEXT[],
    openai_response JSONB,
    last_polled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_fine_tuning_sessions_user_id ON fine_tuning_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_fine_tuning_sessions_job_id ON fine_tuning_sessions(job_id);
CREATE INDEX IF NOT EXISTS idx_fine_tuning_sessions_openai_job_id ON fine_tuning_sessions(openai_job_id);
CREATE INDEX IF NOT EXISTS idx_fine_tuning_sessions_status ON fine_tuning_sessions(status);
CREATE INDEX IF NOT EXISTS idx_fine_tuning_sessions_last_polled_at ON fine_tuning_sessions(last_polled_at);

-- Add updated_at trigger
CREATE TRIGGER update_fine_tuning_sessions_updated_at 
  BEFORE UPDATE ON fine_tuning_sessions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE fine_tuning_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own sessions" 
  ON fine_tuning_sessions FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sessions" 
  ON fine_tuning_sessions FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" 
  ON fine_tuning_sessions FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions" 
  ON fine_tuning_sessions FOR DELETE 
  USING (auth.uid() = user_id); 