import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import util from 'util';
import { NarrationSegment } from './types';
import { SubtitleCue, generateSrtContent, breakBurmeseLines } from '../src/utils/subtitle';
import { getVideoMetadata } from './ffmpeg';
import { createRequire } from 'module';
import { buildAtempoFilter, parseSpeedMultiplier } from '../src/utils/speed';

const execFileAsync = util.promisify(execFile);
const require = createRequire(import.meta.url);
const { EdgeTTS } = require('node-edge-tts');
export { EdgeTTS };

export interface TtsVoiceOption {
  id: string;
  name: string;
  gender: 'female' | 'male';
  sampleText: string;
}

export const BURMESE_VOICES: TtsVoiceOption[] = [
  {
    id: 'my-MM-NilarNeural',
    name: 'နီလာ (မိန်းကလေးအသံ - Nilar Neural)',
    gender: 'female',
    sampleText: 'မင်္ဂလာပါ၊ My AI Studio မှ ကြိုဆိုပါတယ်။ တရုတ်ရုပ်ရှင်ဇာတ်ကား ရှင်းပြချက်ကို စတင်နားဆင်ပါတော့မယ်။',
  },
  {
    id: 'my-MM-ThihaNeural',
    name: 'သီဟ (ယောက်ျားလေးအသံ - Thiha Neural)',
    gender: 'male',
    sampleText: 'မင်္ဂလာပါ၊ My AI Studio မှ ကြိုဆိုပါတယ်။ တရုတ်ရုပ်ရှင်ဇာတ်ကား ရှင်းပြချက်ကို စတင်နားဆင်ပါတော့မယ်။',
  },
];

/**
 * Synthesize a single Burmese speech audio segment with exponential backoff retries,
 * 429 rate limit handling, voice fallback, and duration-matched safety synthesis.
 */
export async function synthesizeBurmeseTts(params: {
  text: string;
  outputPath: string;
  voiceId?: string;
  rate?: string;
  segmentIndex?: number;
}): Promise<{ outputPath: string; duration: number; isFallback?: boolean }> {
  const {
    text,
    outputPath,
    voiceId = 'my-MM-NilarNeural',
    rate = '1.00x',
    segmentIndex = 1,
  } = params;

  const speedMultiplier = parseSpeedMultiplier(rate);
  const needsAtempo = Math.abs(speedMultiplier - 1.0) >= 0.01;

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 1. If valid audio already exists on disk from a previous run or retry, reuse it
  if (fs.existsSync(outputPath)) {
    try {
      const stats = fs.statSync(outputPath);
      if (stats.size > 800) {
        const meta = await getVideoMetadata(outputPath);
        if (meta.duration > 0.2) {
          return { outputPath, duration: meta.duration };
        }
      }
      // Remove 0-byte or corrupted file
      fs.unlinkSync(outputPath);
    } catch {
      try { fs.unlinkSync(outputPath); } catch {}
    }
  }

  const cleanText = text.trim();
  if (!cleanText) {
    const silenceDuration = Math.max(0.2, 0.5 / speedMultiplier);
    // Generate brief silence for empty segment
    await execFileAsync('ffmpeg', [
      '-y',
      '-f', 'lavfi',
      '-i', 'anullsrc=r=24000:cl=mono',
      '-t', String(silenceDuration),
      '-acodec', 'libmp3lame',
      '-b:a', '64k',
      outputPath,
    ]);
    return { outputPath, duration: silenceDuration };
  }

  const candidateVoices = [
    voiceId,
    voiceId === 'my-MM-NilarNeural' ? 'my-MM-ThihaNeural' : 'my-MM-NilarNeural',
  ];

  const MAX_RETRIES = 4;
  let lastError: any = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    // Alternate voice on attempt 3 & 4 if rate limit or socket issue occurs
    const currentVoice = attempt >= 3 ? candidateVoices[1] : candidateVoices[0];
    const rawOutputPath = needsAtempo ? `${outputPath}.raw_${Date.now()}.mp3` : outputPath;

    try {
      // Fresh EdgeTTS instance per attempt to reset WebSocket connection
      // Always generate base speech cleanly with +0% from EdgeTTS, then adjust with FFmpeg atempo
      const tts = new EdgeTTS({
        voice: currentVoice,
        lang: 'my-MM',
        rate: '+0%',
      });

      await tts.ttsPromise(cleanText, rawOutputPath);

      if (fs.existsSync(rawOutputPath)) {
        const stats = fs.statSync(rawOutputPath);
        if (stats.size > 800) {
          if (needsAtempo) {
            const atempoFilter = buildAtempoFilter(speedMultiplier);
            await execFileAsync('ffmpeg', [
              '-y',
              '-i', rawOutputPath,
              '-filter:a', atempoFilter,
              '-acodec', 'libmp3lame',
              '-b:a', '192k',
              outputPath,
            ]);
            try { fs.unlinkSync(rawOutputPath); } catch {}
          }

          if (fs.existsSync(outputPath)) {
            const outStats = fs.statSync(outputPath);
            if (outStats.size > 500) {
              const meta = await getVideoMetadata(outputPath);
              const duration = meta.duration > 0 ? meta.duration : (3.5 / speedMultiplier);
              return { outputPath, duration };
            }
          }
        }
      }
      throw new Error('Generated audio file was empty or corrupted');
    } catch (err: any) {
      lastError = err;
      const is429 = err.message?.includes('429');
      console.warn(
        `[BurmeseTTS] Segment ${segmentIndex} attempt ${attempt}/${MAX_RETRIES} (${currentVoice}) error: ${err.message}`
      );

      // Clean up failed files
      if (needsAtempo && fs.existsSync(rawOutputPath)) {
        try { fs.unlinkSync(rawOutputPath); } catch {}
      }
      if (fs.existsSync(outputPath)) {
        try { fs.unlinkSync(outputPath); } catch {}
      }

      if (attempt < MAX_RETRIES) {
        // Progressive backoff: 429 needs longer cool-off (2.5s, 5.0s, 7.5s)
        const backoffMs = is429 ? attempt * 2500 : attempt * 1200;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  // Graceful duration-matched fallback if Edge TTS rate limit persists across all retries
  console.warn(
    `[BurmeseTTS] All EdgeTTS attempts failed for segment ${segmentIndex} (${lastError?.message}). Using duration-matched safety synthesis.`
  );

  // Estimate reading duration based on Burmese syllable length (~11 chars/sec, bounded 3s to 12s), scaled by speed
  const baseDuration = Math.max(3.0, Math.min(12.0, Math.round((cleanText.length / 11) * 10) / 10));
  const estimatedDuration = Math.max(1.0, Math.round((baseDuration / speedMultiplier) * 10) / 10);

  await execFileAsync('ffmpeg', [
    '-y',
    '-f', 'lavfi',
    '-i', 'anullsrc=r=24000:cl=mono',
    '-t', String(estimatedDuration),
    '-acodec', 'libmp3lame',
    '-b:a', '64k',
    outputPath,
  ]);

  return { outputPath, duration: estimatedDuration, isFallback: true };
}

/**
 * Generate a quick voice sample for preview with speed adjustment
 */
export async function generateVoicePreview(
  voiceId: string,
  rate = '1.00x',
  outputPath: string,
  sampleText?: string
): Promise<string> {
  const voice = BURMESE_VOICES.find((v) => v.id === voiceId) || BURMESE_VOICES[0];
  await synthesizeBurmeseTts({
    text: sampleText || voice.sampleText,
    outputPath,
    voiceId: voice.id,
    rate,
    segmentIndex: 1,
  });
  return outputPath;
}

/**
 * Generate complete Burmese narration audio from script segments,
 * concatenate audio, and produce synchronized Burmese SRT subtitles.
 */
export async function generateBurmeseNarration(params: {
  segments: NarrationSegment[];
  voiceId: string;
  rate?: string;
  outputDir: string;
}): Promise<{
  audioPath: string;
  srtPath: string;
  totalDuration: number;
  cues: SubtitleCue[];
}> {
  const { segments, voiceId, rate = '1.00x', outputDir } = params;
  const speedMultiplier = parseSpeedMultiplier(rate);
  const speedSuffix = Math.round(speedMultiplier * 100);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const segmentAudioDir = path.join(outputDir, 'narration_segments');
  if (!fs.existsSync(segmentAudioDir)) {
    fs.mkdirSync(segmentAudioDir, { recursive: true });
  }

  const generatedAudioFiles: string[] = [];
  const subtitleCues: SubtitleCue[] = [];
  let currentTime = 0.5; // Start with a brief 0.5s pause

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segAudioFile = path.join(segmentAudioDir, `seg_${String(i + 1).padStart(3, '0')}_${speedSuffix}.mp3`);

    const cleanText = seg.text.trim();
    if (!cleanText) continue;

    // Pacing delay between segments (1.2s delay to respect Microsoft Edge TTS WebSocket rate limits)
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }

    const { duration: segmentDuration } = await synthesizeBurmeseTts({
      text: cleanText,
      outputPath: segAudioFile,
      voiceId,
      rate,
      segmentIndex: i + 1,
    });

    generatedAudioFiles.push(segAudioFile);

    const startTime = currentTime;
    const endTime = currentTime + segmentDuration;

    // Break long sentences for clear subtitles
    const brokenText = breakBurmeseLines(cleanText, 45);

    subtitleCues.push({
      id: subtitleCues.length + 1,
      startTime,
      endTime,
      text: brokenText,
    });

    // Natural pause between narrative paragraphs scaled proportionally to speech speed
    const pauseDuration = Math.max(0.12, Math.min(0.35, 0.35 / speedMultiplier));
    currentTime = endTime + pauseDuration;
  }

  // Concatenate all audio segments into a single narration.mp3 using FFmpeg concat
  const finalAudioPath = path.join(outputDir, 'narration.mp3');
  const concatListPath = path.join(segmentAudioDir, 'concat_list.txt');

  const fileEntries = generatedAudioFiles
    .map((f) => `file '${path.resolve(f).replace(/\\/g, '/').replace(/'/g, "'\\''")}'`)
    .join('\n');
  fs.writeFileSync(concatListPath, fileEntries, 'utf8');

  await execFileAsync('ffmpeg', [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatListPath,
    '-acodec', 'libmp3lame',
    '-b:a', '192k',
    finalAudioPath,
  ]);

  // Generate SRT Subtitle file
  const srtContent = generateSrtContent(subtitleCues);
  const srtPath = path.join(outputDir, 'subtitles.srt');
  fs.writeFileSync(srtPath, srtContent, 'utf8');

  return {
    audioPath: finalAudioPath,
    srtPath,
    totalDuration: currentTime,
    cues: subtitleCues,
  };
}
