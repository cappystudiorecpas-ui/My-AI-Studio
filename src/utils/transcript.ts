/**
 * Utility functions for processing Chinese speech transcript segments,
 * handling audio chunk overlaps, and merging OCR text detections.
 */

export interface SpeechSegment {
  id: number | string;
  start: number;
  end: number;
  text: string;
}

export interface OcrDetection {
  timestamp: number; // in seconds
  chineseText: string;
  confidence?: number;
}

/**
 * Remove duplicate speech segments caused by overlapping chunk processing.
 * If consecutive segments have significant character overlap or identical text within a 2-second window,
 * we keep the cleanest segment or merge timestamps.
 */
export function deduplicateTranscriptSegments(segments: SpeechSegment[]): SpeechSegment[] {
  if (!segments || segments.length === 0) return [];

  // Sort chronologically by start time
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const result: SpeechSegment[] = [];

  for (const seg of sorted) {
    const cleanText = seg.text.trim();
    if (!cleanText) continue;

    if (result.length === 0) {
      result.push({ ...seg, text: cleanText });
      continue;
    }

    const prev = result[result.length - 1];

    // Check if duplicate of previous segment
    const timeOverlap = seg.start < prev.end + 0.8 && seg.start >= prev.start - 0.5;
    const isExactDuplicate = prev.text === cleanText;
    const isSubstring = prev.text.includes(cleanText) || cleanText.includes(prev.text);

    if (timeOverlap && (isExactDuplicate || isSubstring)) {
      // Pick the longer text and extend timestamp
      if (cleanText.length > prev.text.length) {
        prev.text = cleanText;
      }
      prev.end = Math.max(prev.end, seg.end);
    } else {
      result.push({
        ...seg,
        id: result.length + 1,
        text: cleanText
      });
    }
  }

  return result;
}

/**
 * Merge OCR text detections with transcript segments to provide a comprehensive
 * story context combining spoken dialogue and on-screen subtitles/signage.
 */
export function combineTranscriptAndOcr(
  transcript: SpeechSegment[],
  ocrDetections: OcrDetection[]
): { timeline: Array<{ time: number; type: 'dialogue' | 'screen_text'; text: string }>; summaryContext: string } {
  const timeline: Array<{ time: number; type: 'dialogue' | 'screen_text'; text: string }> = [];

  for (const t of transcript) {
    timeline.push({
      time: t.start,
      type: 'dialogue',
      text: t.text
    });
  }

  // Deduplicate OCR detections that are identical within 3 seconds
  const cleanOcr: OcrDetection[] = [];
  for (const ocr of ocrDetections) {
    const text = ocr.chineseText.trim();
    if (!text) continue;
    const isDup = cleanOcr.some(
      (existing) => Math.abs(existing.timestamp - ocr.timestamp) < 3.5 && existing.chineseText === text
    );
    if (!isDup) {
      cleanOcr.push(ocr);
      timeline.push({
        time: ocr.timestamp,
        type: 'screen_text',
        text
      });
    }
  }

  // Sort timeline chronologically
  timeline.sort((a, b) => a.time - b.time);

  // Generate context string for Gemini prompt
  const summaryContext = timeline
    .map((item) => {
      const minutes = Math.floor(item.time / 60);
      const seconds = Math.floor(item.time % 60);
      const timeTag = `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}]`;
      const label = item.type === 'dialogue' ? 'စကားပြော' : 'မျက်နှာပြင်စာတန်း';
      return `${timeTag} (${label}): ${item.text}`;
    })
    .join('\n');

  return { timeline, summaryContext };
}
