import { execFile } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';

const execFileAsync = util.promisify(execFile);

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  format: string;
}

/**
 * Probe video metadata using ffprobe
 */
export async function getVideoMetadata(videoPath: string): Promise<VideoMetadata> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height,duration:format=duration,format_name',
      '-of',
      'json',
      videoPath,
    ]);

    const data = JSON.parse(stdout);
    const stream = data.streams?.[0] || {};
    const format = data.format || {};

    const duration = parseFloat(stream.duration || format.duration || '0');
    const width = parseInt(stream.width || '1280', 10);
    const height = parseInt(stream.height || '720', 10);

    return {
      duration: isNaN(duration) ? 0 : duration,
      width,
      height,
      format: format.format_name || 'mp4',
    };
  } catch (err: any) {
    console.warn('ffprobe error:', err.message);
    return {
      duration: 30,
      width: 1280,
      height: 720,
      format: 'mp4',
    };
  }
}

/**
 * Extract audio from video file to 16kHz mono MP3 for speech recognition
 */
export async function extractAudio(videoPath: string, audioOutputPath: string): Promise<void> {
  const dir = path.dirname(audioOutputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  await execFileAsync('ffmpeg', [
    '-y',
    '-i',
    videoPath,
    '-vn',
    '-acodec',
    'libmp3lame',
    '-ar',
    '16000',
    '-ac',
    '1',
    '-b:a',
    '64k',
    audioOutputPath,
  ]);
}

/**
 * Extract representative keyframes from video for OCR
 */
export async function extractFrames(
  videoPath: string,
  outputDir: string,
  intervalSeconds: number = 5,
  maxFrames: number = 24
): Promise<string[]> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Clear any existing frames
  const existing = fs.readdirSync(outputDir);
  for (const f of existing) {
    fs.unlinkSync(path.join(outputDir, f));
  }

  // Compute fps filter: 1 frame every intervalSeconds
  const fpsValue = `fps=1/${Math.max(1, intervalSeconds)}`;

  await execFileAsync('ffmpeg', [
    '-y',
    '-i',
    videoPath,
    '-vf',
    `${fpsValue},scale=640:-1`,
    '-frames:v',
    String(maxFrames),
    path.join(outputDir, 'frame_%04d.jpg'),
  ]);

  return fs
    .readdirSync(outputDir)
    .filter((f) => f.endsWith('.jpg') || f.endsWith('.png'))
    .sort()
    .map((f) => path.join(outputDir, f));
}

/**
 * Split large audio files into smaller overlapping chunks for API limits
 */
export async function splitAudioFile(
  audioPath: string,
  outputDir: string,
  chunkDurationSec: number = 600,
  overlapSec: number = 2
): Promise<Array<{ filePath: string; startTime: number; duration: number }>> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const { duration } = await getVideoMetadata(audioPath);
  const totalDuration = duration > 0 ? duration : 1800;
  const chunks: Array<{ filePath: string; startTime: number; duration: number }> = [];

  let currentStart = 0;
  let chunkIndex = 0;

  while (currentStart < totalDuration) {
    chunkIndex++;
    const actualDuration = Math.min(chunkDurationSec, totalDuration - currentStart);
    const chunkPath = path.join(outputDir, `chunk_${String(chunkIndex).padStart(3, '0')}.mp3`);

    await execFileAsync('ffmpeg', [
      '-y',
      '-ss',
      String(currentStart),
      '-i',
      audioPath,
      '-t',
      String(actualDuration),
      '-acodec',
      'copy',
      chunkPath,
    ]);

    chunks.push({
      filePath: chunkPath,
      startTime: currentStart,
      duration: actualDuration,
    });

    currentStart += chunkDurationSec - overlapSec;
  }

  return chunks;
}

/**
 * Combine video, Burmese narration audio, and Burmese subtitles with Noto Sans Myanmar font
 */
export async function renderFinalRecap(params: {
  videoPath: string;
  narrationAudioPath: string;
  srtPath?: string;
  outputPath: string;
  originalAudioVolume?: number; // 0 to 1
  burnSubtitles?: boolean;
}): Promise<void> {
  const {
    videoPath,
    narrationAudioPath,
    srtPath,
    outputPath,
    originalAudioVolume = 0.15,
    burnSubtitles = true,
  } = params;

  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const hasSubtitles = burnSubtitles && srtPath && fs.existsSync(srtPath);
  const hasNarration = fs.existsSync(narrationAudioPath);

  const ffmpegArgs: string[] = ['-y', '-i', videoPath];

  if (hasNarration) {
    ffmpegArgs.push('-i', narrationAudioPath);
  }

  // Filter complex for audio and video
  let filterComplex = '';
  let mapVideo = '0:v';
  let mapAudio = '0:a';

  if (hasSubtitles) {
    // Burn subtitles with Myanmar font
    // Escape path for ffmpeg filter: replace backslash and colon
    const escapedSrt = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
    filterComplex += `[0:v]subtitles=${escapedSrt}:force_style='Fontname=Noto Sans Myanmar,Fontsize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,Outline=2,Shadow=1,MarginV=25'[vout];`;
    mapVideo = '[vout]';
  }

  if (hasNarration) {
    if (originalAudioVolume <= 0.01) {
      // Original audio muted, use narration only
      mapAudio = '1:a';
    } else {
      // Duck original audio and mix with narration
      filterComplex += `[0:a]volume=${originalAudioVolume.toFixed(2)}[orig];[orig][1:a]amix=inputs=2:duration=longest:dropout_transition=2[aout]`;
      mapAudio = '[aout]';
    }
  }

  if (filterComplex) {
    ffmpegArgs.push('-filter_complex', filterComplex.replace(/;$/, ''));
  }

  ffmpegArgs.push('-map', mapVideo);
  ffmpegArgs.push('-map', mapAudio);
  ffmpegArgs.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-c:a', 'aac', '-b:a', '192k', '-shortest', outputPath);

  await execFileAsync('ffmpeg', ffmpegArgs);
}

/**
 * Generate a demo sample Chinese video clip for quick testing and onboarding
 */
export async function generateDemoVideo(outputPath: string): Promise<void> {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Generate 8-second demo video with title and synthetic Chinese audio tone
  await execFileAsync('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    'testsrc=duration=8:size=1280x720:rate=24',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:duration=8',
    '-c:v',
    'libx264',
    '-c:a',
    'aac',
    '-shortest',
    outputPath,
  ]);
}
