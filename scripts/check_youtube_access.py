"""Run in the deployed worker environment to validate transcript access from its egress IP."""
import sys
from youtube_transcript_api import YouTubeTranscriptApi

if __name__ == "__main__":
    transcript = YouTubeTranscriptApi().fetch(sys.argv[1])
    print(f"Fetched {len(transcript)} transcript segments")
