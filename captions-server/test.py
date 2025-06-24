from youtube_transcript_api import YouTubeTranscriptApi

ytt_api = YouTubeTranscriptApi()
fetched_transcript = ytt_api.fetch("YAtpni1rzuM")

# is iterable
for snippet in fetched_transcript:
    print(snippet)

print(fetched_transcript)