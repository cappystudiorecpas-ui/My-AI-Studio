/**
 * Utility functions for Mode 2: Real-time Live Recap & Translation
 * Handles subtitle deduplication, timeline alignment, and audio playback queue timing.
 */

export interface LiveSubtitleItem {
  id: string;
  chineseText: string;
  burmeseText: string;
  startTime: number;
  endTime: number;
  type: 'speech' | 'ocr' | 'recap';
}

/**
 * Filter out duplicate or near-duplicate subtitle entries within a time window
 */
export function deduplicateLiveSubtitles(
  existing: LiveSubtitleItem[],
  newItem: LiveSubtitleItem,
  windowSeconds = 2.5
): boolean {
  if (!newItem.burmeseText && !newItem.chineseText) return false;

  const isDuplicate = existing.some((item) => {
    const timeOverlap = Math.abs(item.startTime - newItem.startTime) < windowSeconds;
    const sameBurmese =
      item.burmeseText.trim() === newItem.burmeseText.trim() && item.burmeseText.trim().length > 0;
    const sameChinese =
      item.chineseText.trim() === newItem.chineseText.trim() && item.chineseText.trim().length > 0;
    return timeOverlap && (sameBurmese || sameChinese);
  });

  return !isDuplicate;
}

/**
 * Find the active subtitle that should be displayed on screen for the current video time
 */
export function getActiveSubtitle(
  subtitles: LiveSubtitleItem[],
  currentTime: number,
  holdDurationSeconds = 3.5
): LiveSubtitleItem | null {
  if (!subtitles || subtitles.length === 0) return null;

  // Search from newest to oldest
  for (let i = subtitles.length - 1; i >= 0; i--) {
    const sub = subtitles[i];
    if (currentTime >= sub.startTime && currentTime <= Math.max(sub.endTime, sub.startTime + holdDurationSeconds)) {
      return sub;
    }
  }

  return null;
}

/**
 * Calculate next audio playback start time to prevent audio overlaps or gaps
 */
export function calculateNextAudioStartTime(
  currentPlaybackTime: number,
  lastAudioEndTime: number,
  newChunkDuration: number,
  leadBufferSeconds = 0.05
): { startTime: number; nextEndTime: number } {
  const earliestAllowed = currentPlaybackTime + leadBufferSeconds;
  const startTime = Math.max(earliestAllowed, lastAudioEndTime);
  const nextEndTime = startTime + newChunkDuration;
  return { startTime, nextEndTime };
}
