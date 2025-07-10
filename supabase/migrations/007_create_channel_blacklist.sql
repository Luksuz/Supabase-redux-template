-- Create YouTube channel blacklist table
CREATE TABLE IF NOT EXISTS youtube_channel_blacklist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Channel identification (multiple ways to identify a channel)
    channel_id TEXT, -- YouTube channel ID (UC...)
    channel_url TEXT, -- Full YouTube channel URL
    channel_handle TEXT, -- @handle format
    channel_name TEXT NOT NULL, -- Display name (required for UI)
    
    -- Optional metadata
    reason TEXT, -- Why this channel was blacklisted
    notes TEXT, -- Additional notes
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Ensure at least one identifier is provided
    CONSTRAINT channel_identifier_check CHECK (
        channel_id IS NOT NULL OR 
        channel_url IS NOT NULL OR 
        channel_handle IS NOT NULL
    ),
    
    -- Prevent duplicate entries for same user and channel
    UNIQUE(user_id, channel_id),
    UNIQUE(user_id, channel_url),
    UNIQUE(user_id, channel_handle)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_channel_blacklist_user_id ON youtube_channel_blacklist(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_blacklist_channel_id ON youtube_channel_blacklist(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_blacklist_channel_url ON youtube_channel_blacklist(channel_url);
CREATE INDEX IF NOT EXISTS idx_channel_blacklist_channel_handle ON youtube_channel_blacklist(channel_handle);
CREATE INDEX IF NOT EXISTS idx_channel_blacklist_channel_name ON youtube_channel_blacklist(channel_name);
CREATE INDEX IF NOT EXISTS idx_channel_blacklist_created_at ON youtube_channel_blacklist(created_at);

-- Enable Row Level Security
ALTER TABLE youtube_channel_blacklist ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own blacklisted channels" ON youtube_channel_blacklist
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own blacklisted channels" ON youtube_channel_blacklist
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own blacklisted channels" ON youtube_channel_blacklist
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own blacklisted channels" ON youtube_channel_blacklist
    FOR DELETE USING (auth.uid() = user_id);

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_youtube_channel_blacklist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for auto-updating updated_at
CREATE TRIGGER update_youtube_channel_blacklist_updated_at
    BEFORE UPDATE ON youtube_channel_blacklist
    FOR EACH ROW
    EXECUTE FUNCTION update_youtube_channel_blacklist_updated_at();

-- Grant necessary permissions
GRANT ALL ON youtube_channel_blacklist TO authenticated;
GRANT ALL ON youtube_channel_blacklist TO service_role; 