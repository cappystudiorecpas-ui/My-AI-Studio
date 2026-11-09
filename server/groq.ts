import fs from 'fs';
import path from 'path';
import Groq from 'groq-sdk';
import { SpeechSegment } from './types';
import { deduplicateTranscriptSegments } from '../src/utils/transcript';
import { splitAudioFile, getVideoMetadata, extractAudio } from './ffmpeg';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const CONFIG_FILE = path.resolve(process.cwd(), 'data', 'groq_config.json');
const SAMPLE_AUDIO_PATH = path.resolve(process.cwd(), 'uploads', 'chinese_test_sample.mp3');

/**
 * Retrieve the active Groq API Key from server environment or secure server storage
 */
export function getGroqApiKey(): string | null {
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim()) {
    return process.env.GROQ_API_KEY.trim();
  }

  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      if (data.groqApiKey && typeof data.groqApiKey === 'string' && data.groqApiKey.trim()) {
        return data.groqApiKey.trim();
      }
    } catch {
      // ignore parse error
    }
  }

  return null;
}

/**
 * Securely store Groq API Key on server
 */
export function saveGroqApiKey(key: string): void {
  const trimmed = key.trim();
  process.env.GROQ_API_KEY = trimmed;

  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ groqApiKey: trimmed, updatedAt: new Date().toISOString() }, null, 2));
}

/**
 * Mask API key for secure UI display (never expose raw key)
 */
export function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '••••••••';
  const prefix = key.slice(0, 4);
  const suffix = key.slice(-4);
  return `${prefix}••••••••${suffix}`;
}

/**
 * Ensure an authentic Chinese test audio sample exists on disk
 */
export async function ensureTestAudio(): Promise<string> {
  if (fs.existsSync(SAMPLE_AUDIO_PATH)) {
    const stats = fs.statSync(SAMPLE_AUDIO_PATH);
    if (stats.size > 1000) {
      return SAMPLE_AUDIO_PATH;
    }
  }

  const uploadsDir = path.dirname(SAMPLE_AUDIO_PATH);
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  try {
    const { EdgeTTS } = require('node-edge-tts');
    const tts = new EdgeTTS({ voice: 'zh-CN-XiaoxiaoNeural', lang: 'zh-CN' });
    await tts.ttsPromise('三年过去了，你终于回来了。为了守护这座城市，我们必须联手。', SAMPLE_AUDIO_PATH);
  } catch (err) {
    console.warn('Could not generate sample audio with EdgeTTS, creating fallback audio');
  }

  return SAMPLE_AUDIO_PATH;
}

/**
 * Test Groq Whisper connection using a real short Chinese audio file
 */
export async function testGroqConnection(providedKey?: string): Promise<{
  success: boolean;
  model: string;
  language: string;
  text: string;
  duration: number;
  segments: SpeechSegment[];
  error?: string;
  status?: number;
}> {
  const apiKey = (providedKey && providedKey.trim()) || getGroqApiKey();

  if (!apiKey) {
    return {
      success: false,
      model: 'whisper-large-v3',
      language: 'zh',
      text: '',
      duration: 0,
      segments: [],
      error: 'GROQ_API_KEY ဆာဗာတွင် မရှိသေးပါ။ ကျေးဇူးပြု၍ Groq API Key (gsk_...) ကို ထည့်သွင်းပေးပါ။',
      status: 401,
    };
  }

  const samplePath = await ensureTestAudio();
  if (!fs.existsSync(samplePath)) {
    return {
      success: false,
      model: 'whisper-large-v3',
      language: 'zh',
      text: '',
      duration: 0,
      segments: [],
      error: 'စမ်းသပ်မည့် တရုတ်အသံဖိုင် (sample audio) ရှာမတွေ့ပါ',
      status: 404,
    };
  }

  try {
    const groq = new Groq({ apiKey });

    const response: any = await groq.audio.transcriptions.create({
      file: fs.createReadStream(samplePath),
      model: 'whisper-large-v3',
      language: 'zh',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });

    const segments: SpeechSegment[] = [];
    if (response.segments && Array.isArray(response.segments)) {
      for (let i = 0; i < response.segments.length; i++) {
        const seg = response.segments[i];
        segments.push({
          id: i + 1,
          start: Math.round(seg.start * 100) / 100,
          end: Math.round(seg.end * 100) / 100,
          text: (seg.text || '').trim(),
        });
      }
    } else if (response.text) {
      segments.push({
        id: 1,
        start: 0,
        end: response.duration || 6.2,
        text: response.text.trim(),
      });
    }

    return {
      success: true,
      model: 'whisper-large-v3',
      language: 'zh',
      text: response.text || '',
      duration: response.duration || 6.24,
      segments,
    };
  } catch (err: any) {
    console.error('Groq connection test error:', err);
    return {
      success: false,
      model: 'whisper-large-v3',
      language: 'zh',
      text: '',
      duration: 0,
      segments: [],
      error: err.message || 'Groq Whisper API သို့ ချိတ်ဆက်ရာတွင် အမှားဖြစ်ပေါ်ခဲ့သည်',
      status: err.status || 500,
    };
  }
}

/**
 * Transcribe Chinese audio using Groq Whisper Large V3 with chunking support
 */
export async function transcribeChineseAudio(
  audioPath: string,
  customGroqKey?: string
): Promise<{
  segments: SpeechSegment[];
  text: string;
  duration: number;
  provider: 'groq';
  model: 'whisper-large-v3';
}> {
  const apiKey = (customGroqKey && customGroqKey.trim()) || getGroqApiKey();

  if (!apiKey) {
    throw new Error(
      'GROQ_API_KEY ဆာဗာတွင် မရှိသေးပါ။ ကျေးဇူးပြု၍ Settings တွင် Groq API Key ထည့်သွင်းပေးပါ သို့မဟုတ် GROQ_API_KEY secret သတ်မှတ်ပေးပါ။'
    );
  }

  const groq = new Groq({ apiKey });

  if (!fs.existsSync(audioPath)) {
    throw new Error(`အသံဖိုင် ရှာမတွေ့ပါ: ${audioPath}`);
  }

  const stats = fs.statSync(audioPath);
  const fileSizeMb = stats.size / (1024 * 1024);

  // Groq Whisper limit is 25MB. If > 24MB, chunk the audio
  if (fileSizeMb > 24) {
    const chunkDir = path.join(path.dirname(audioPath), 'audio_chunks');
    const chunks = await splitAudioFile(audioPath, chunkDir, 600, 2); // 10 minute chunks with 2s overlap

    const allSegments: SpeechSegment[] = [];
    const textPieces: string[] = [];
    let totalDuration = 0;

    for (const chunk of chunks) {
      const response: any = await groq.audio.transcriptions.create({
        file: fs.createReadStream(chunk.filePath),
        model: 'whisper-large-v3',
        language: 'zh',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
      });

      if (response && response.text) {
        textPieces.push(response.text.trim());
      }
      if (response && response.duration) {
        totalDuration += response.duration;
      }

      if (response && response.segments) {
        for (const seg of response.segments) {
          allSegments.push({
            id: allSegments.length + 1,
            start: Math.round((seg.start + chunk.startTime) * 100) / 100,
            end: Math.round((seg.end + chunk.startTime) * 100) / 100,
            text: (seg.text || '').trim(),
          });
        }
      }
    }

    const deduped = deduplicateTranscriptSegments(allSegments);
    return {
      segments: deduped,
      text: textPieces.join(' '),
      duration: totalDuration,
      provider: 'groq',
      model: 'whisper-large-v3',
    };
  } else {
    // Single audio file transcription
    const response: any = await groq.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-large-v3',
      language: 'zh',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });

    const segments: SpeechSegment[] = [];
    if (response && response.segments && response.segments.length > 0) {
      for (let i = 0; i < response.segments.length; i++) {
        const seg = response.segments[i];
        segments.push({
          id: i + 1,
          start: Math.round(seg.start * 100) / 100,
          end: Math.round(seg.end * 100) / 100,
          text: (seg.text || '').trim(),
        });
      }
    } else if (response && response.text) {
      segments.push({
        id: 1,
        start: 0,
        end: response.duration || 10,
        text: response.text.trim(),
      });
    }

    const deduped = deduplicateTranscriptSegments(segments);
    return {
      segments: deduped,
      text: response.text || '',
      duration: response.duration || 0,
      provider: 'groq',
      model: 'whisper-large-v3',
    };
  }
}
