-- Add compressed_audio_url column to video_records table
-- This column is kept for backward compatibility
-- Note: audio_url now contains compressed audio for better performance and storage efficiency

ALTER TABLE video_records 
ADD COLUMN compressed_audio_url TEXT;

-- Add comment to the new column
COMMENT ON COLUMN video_records.compressed_audio_url IS 'Deprecated: kept for backward compatibility. Main audio_url now contains compressed audio.';
COMMENT ON COLUMN video_records.audio_url IS 'URL of the compressed audio file used for video generation (optimized for performance and storage)'; 