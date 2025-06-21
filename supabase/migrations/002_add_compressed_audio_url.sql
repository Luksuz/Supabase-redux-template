-- Add compressed_audio_url column to video_records table
-- This column will store the compressed audio URL used for subtitle generation
-- while the original audio_url column will be used for Shotstack video generation

ALTER TABLE video_records 
ADD COLUMN compressed_audio_url TEXT;

-- Add comment to the new column
COMMENT ON COLUMN video_records.compressed_audio_url IS 'URL of the compressed audio file used for subtitle generation';
COMMENT ON COLUMN video_records.audio_url IS 'URL of the original audio file used for Shotstack video generation'; 