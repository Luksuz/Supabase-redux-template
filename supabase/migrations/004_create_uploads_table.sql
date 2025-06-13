-- Create fine_tuning_uploads table for tracking OpenAI file uploads
CREATE TABLE IF NOT EXISTS fine_tuning_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID NOT NULL,
    openai_file_id TEXT NOT NULL UNIQUE,
    filename TEXT NOT NULL,
    purpose TEXT NOT NULL DEFAULT 'fine-tune',
    bytes INTEGER,
    type TEXT, -- 'sections' or 'scripts'
    training_examples_count INTEGER,
    openai_response JSONB,
    status TEXT DEFAULT 'uploaded'
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_fine_tuning_uploads_user_id ON fine_tuning_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_fine_tuning_uploads_openai_file_id ON fine_tuning_uploads(openai_file_id);
CREATE INDEX IF NOT EXISTS idx_fine_tuning_uploads_type ON fine_tuning_uploads(type);
CREATE INDEX IF NOT EXISTS idx_fine_tuning_uploads_created_at ON fine_tuning_uploads(created_at);

-- Add updated_at trigger
CREATE TRIGGER update_fine_tuning_uploads_updated_at 
  BEFORE UPDATE ON fine_tuning_uploads 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE fine_tuning_uploads ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own uploads" 
  ON fine_tuning_uploads FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own uploads" 
  ON fine_tuning_uploads FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own uploads" 
  ON fine_tuning_uploads FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own uploads" 
  ON fine_tuning_uploads FOR DELETE 
  USING (auth.uid() = user_id); 