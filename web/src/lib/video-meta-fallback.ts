const VIDEO_TITLE_FALLBACK = "Untitled video";
const CHANNEL_NAME_FALLBACK = "Unknown channel";

function hasVisibleText(value: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function getDisplayVideoTitle(title: string | null): string {
  return hasVisibleText(title) ? title : VIDEO_TITLE_FALLBACK;
}

export function getDisplayChannelName(channelName: string | null): string {
  return hasVisibleText(channelName) ? channelName : CHANNEL_NAME_FALLBACK;
}
