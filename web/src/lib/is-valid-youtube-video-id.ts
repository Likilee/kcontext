const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function isValidYouTubeVideoId(videoId: string | null | undefined): videoId is string {
  if (!videoId) {
    return false;
  }

  return YOUTUBE_VIDEO_ID_PATTERN.test(videoId);
}
