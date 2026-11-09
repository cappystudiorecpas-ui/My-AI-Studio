/**
 * Subtitle utility functions for Burmese (Myanmar Unicode) SRT generation,
 * parsing, timing calculations, and line breaking.
 */

export interface SubtitleCue {
  id: number;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  text: string;
}

/**
 * Format seconds into SRT timestamp string: HH:MM:SS,mmm
 */
export function formatSrtTimestamp(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const totalMillis = Math.round(seconds * 1000);
  const hours = Math.floor(totalMillis / 3600000);
  const remainderAfterHours = totalMillis % 3600000;
  const minutes = Math.floor(remainderAfterHours / 60000);
  const remainderAfterMinutes = remainderAfterHours % 60000;
  const secs = Math.floor(remainderAfterMinutes / 1000);
  const millis = remainderAfterMinutes % 1000;

  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${pad(millis, 3)}`;
}

/**
 * Parse SRT timestamp HH:MM:SS,mmm or HH:MM:SS.mmm into seconds
 */
export function parseSrtTimestamp(timestamp: string): number {
  const normalized = timestamp.trim().replace(',', '.');
  const parts = normalized.split(':');
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const minutes = parseFloat(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  }
  return 0;
}

/**
 * Generate standard SRT file format string from subtitle cues
 */
export function generateSrtContent(cues: SubtitleCue[]): string {
  return cues
    .map((cue, index) => {
      const cueIndex = index + 1;
      const startStr = formatSrtTimestamp(cue.startTime);
      const endStr = formatSrtTimestamp(cue.endTime);
      const cleanText = cue.text.trim();
      return `${cueIndex}\n${startStr} --> ${endStr}\n${cleanText}\n`;
    })
    .join('\n');
}

/**
 * Parse an SRT string into an array of SubtitleCues
 */
export function parseSrtContent(srtText: string): SubtitleCue[] {
  if (!srtText) return [];
  const normalized = srtText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.trim().split(/\n\s*\n/);
  const cues: SubtitleCue[] = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length >= 2) {
      let timeLineIdx = 1;
      // Handle cases where the index line might be missing
      if (lines[0].includes('-->')) {
        timeLineIdx = 0;
      }
      const timeMatch = lines[timeLineIdx].match(/(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})/);
      if (timeMatch) {
        const startTime = parseSrtTimestamp(timeMatch[1]);
        const endTime = parseSrtTimestamp(timeMatch[2]);
        const text = lines.slice(timeLineIdx + 1).join('\n').trim();
        cues.push({
          id: cues.length + 1,
          startTime,
          endTime,
          text
        });
      }
    }
  }

  return cues;
}

/**
 * Break long Burmese sentences into readable lines for on-screen subtitles.
 * Uses Myanmar punctuation (။, ၊) and spaces for natural breaks without cutting words.
 */
export function breakBurmeseLines(text: string, maxCharsPerLine = 42): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxCharsPerLine) {
    return trimmed;
  }

  // Check if text already has multiple lines
  if (trimmed.includes('\n')) {
    return trimmed;
  }

  // Look for Myanmar clause separators (၊ or ။ or space) near center
  const mid = Math.floor(trimmed.length / 2);
  const separators = ['၊', '။', ' ', '...'];
  let bestBreakIndex = -1;
  let minDistance = Infinity;

  for (const sep of separators) {
    let idx = trimmed.indexOf(sep);
    while (idx !== -1) {
      const dist = Math.abs(idx - mid);
      if (dist < minDistance && idx > 10 && idx < trimmed.length - 10) {
        minDistance = dist;
        bestBreakIndex = idx + (sep === ' ' ? 0 : 1);
      }
      idx = trimmed.indexOf(sep, idx + 1);
    }
  }

  if (bestBreakIndex !== -1) {
    const part1 = trimmed.slice(0, bestBreakIndex).trim();
    const part2 = trimmed.slice(bestBreakIndex).trim();
    return `${part1}\n${part2}`;
  }

  return trimmed;
}
