-- Create table for storing WellSaid Labs API keys with usage tracking
CREATE TABLE IF NOT EXISTS api_keys_rezu (
    id BIGSERIAL PRIMARY KEY,
    api_key TEXT NOT NULL UNIQUE,
    is_valid BOOLEAN NOT NULL DEFAULT true,
    use_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_api_keys_rezu_valid ON api_keys_rezu(is_valid);
CREATE INDEX IF NOT EXISTS idx_api_keys_rezu_use_count ON api_keys_rezu(use_count);
CREATE INDEX IF NOT EXISTS idx_api_keys_rezu_created_at ON api_keys_rezu(created_at);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at on row updates
CREATE OR REPLACE TRIGGER update_api_keys_rezu_updated_at
    BEFORE UPDATE ON api_keys_rezu
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment to table
COMMENT ON TABLE api_keys_rezu IS 'Stores WellSaid Labs API keys with usage tracking and validation status';
COMMENT ON COLUMN api_keys_rezu.api_key IS 'The WellSaid Labs API key';
COMMENT ON COLUMN api_keys_rezu.is_valid IS 'Whether the API key is currently valid for use';
COMMENT ON COLUMN api_keys_rezu.use_count IS 'Number of times this API key has been used (max 50)';
COMMENT ON COLUMN api_keys_rezu.created_at IS 'When the API key was added to the system';
COMMENT ON COLUMN api_keys_rezu.updated_at IS 'When the API key record was last modified'; 