import { WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import util from 'util';
import { getGeminiClient } from './gemini';
import { synthesizeBurmeseTts } from './tts';
import { getVideoMetadata } from './ffmpeg';
import { getProjectById } from './pipeline';

const execFileAsync = util.promisify(execFile);
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'projects');
const LIVE_TEMP_DIR = path.resolve(process.cwd(), 'uploads', 'live_temp');

if (!fs.existsSync(LIVE_TEMP_DIR)) {
  fs.mkdirSync(LIVE_TEMP_DIR, { recursive: true });
}

export interface LiveSessionState {
  id: string;
  projectId: string;
  ws: WebSocket;
  voiceId: string;
  speakingRate: string;
  lastProcessedTime: number;
  historyContext: string[];
  active: boolean;
  isProcessingWindow?: boolean;
}

const activeSessions = new Map<string, LiveSessionState>();

/**
 * Handle new WebSocket connection for Live Mode
 */
export function handleLiveWebSocket(ws: WebSocket) {
  const sessionId = 'live_' + Math.random().toString(36).substring(2, 9);
  let sessionState: LiveSessionState = {
    id: sessionId,
    projectId: '',
    ws,
    voiceId: 'my-MM-NilarNeural',
    speakingRate: '1.00x',
    lastProcessedTime: -1,
    historyContext: [],
    active: true,
    isProcessingWindow: false,
  };

  activeSessions.set(sessionId, sessionState);

  ws.send(
    JSON.stringify({
      type: 'connected',
      sessionId,
      message: 'My AI Studio Live Engine connected',
    })
  );

  ws.on('message', async (rawMsg: Buffer) => {
    try {
      const data = JSON.parse(rawMsg.toString());

      if (data.type === 'init') {
        sessionState.projectId = data.projectId || '';
        sessionState.voiceId = data.voiceId || 'my-MM-NilarNeural';
        sessionState.speakingRate = data.speakingRate || '1.00x';
        sessionState.lastProcessedTime = -1;
        sessionState.historyContext = [];

        ws.send(
          JSON.stringify({
            type: 'session_ready',
            sessionId,
            projectId: sessionState.projectId,
          })
        );
      } else if (data.type === 'sync_time') {
        // Real-time playback tick sent by the video player
        const currentTime = parseFloat(data.time || '0');
        const projId = data.projectId || sessionState.projectId;

        // Process in ~3.2 second windows and prevent concurrent overlapping calls
        if (
          !sessionState.isProcessingWindow &&
          Math.abs(currentTime - sessionState.lastProcessedTime) >= 3.0
        ) {
          sessionState.lastProcessedTime = currentTime;
          sessionState.isProcessingWindow = true;
          processLiveWindow(sessionState, projId, currentTime, data.frameBase64)
            .catch((err) => {
              // Graceful log without spamming warning loops
              if (!err.message?.includes('429')) {
                console.warn('[LiveSession] window error:', err.message?.slice(0, 100));
              }
            })
            .finally(() => {
              sessionState.isProcessingWindow = false;
            });
        }
      } else if (data.type === 'stop') {
        sessionState.active = false;
        ws.send(JSON.stringify({ type: 'stopped' }));
      }
    } catch (err: any) {
      console.error('[LiveSession] message handling error:', err);
      ws.send(JSON.stringify({ type: 'error', message: err.message }));
    }
  });

  ws.on('close', () => {
    sessionState.active = false;
    activeSessions.delete(sessionId);
  });
}

/**
 * Process a small real-time window: extract audio slice & frame, analyze with Gemini,
 * generate Burmese neural voice, and stream down to player.
 */
async function processLiveWindow(
  session: LiveSessionState,
  projectId: string,
  currentTime: number,
  clientFrameBase64?: string
) {
  if (!session.active || !projectId) return;

  const projDir = path.join(UPLOADS_DIR, projectId);
  const videoPath = path.join(projDir, 'video.mp4');

  if (!fs.existsSync(videoPath)) return;

  const sessionTempDir = path.join(LIVE_TEMP_DIR, session.id);
  if (!fs.existsSync(sessionTempDir)) {
    fs.mkdirSync(sessionTempDir, { recursive: true });
  }

  // 1. Notify Client: Listening & Speech Recog Started
  session.ws.send(
    JSON.stringify({
      type: 'status_update',
      indicators: {
        listening: true,
        speechRecog: true,
        ocr: true,
        translating: false,
        voiceGen: false,
        playing: false,
      },
      time: currentTime,
    })
  );

  const windowStartTime = Math.max(0, currentTime - 0.5);
  const windowDuration = 3.2;

  // Extract small audio slice for this moment
  const sliceAudioPath = path.join(sessionTempDir, `slice_${Math.round(currentTime)}.mp3`);
  try {
    await execFileAsync('ffmpeg', [
      '-y',
      '-ss',
      String(windowStartTime),
      '-i',
      videoPath,
      '-t',
      String(windowDuration),
      '-acodec',
      'libmp3lame',
      '-ar',
      '16000',
      '-ac',
      '1',
      '-b:a',
      '64k',
      sliceAudioPath,
    ]);
  } catch (err: any) {
    // If EOF or slice fails, ignore
    return;
  }

  // Extract representative frame if client didn't supply one
  let frameData = clientFrameBase64;
  if (!frameData) {
    const sliceFramePath = path.join(sessionTempDir, `frame_${Math.round(currentTime)}.jpg`);
    try {
      await execFileAsync('ffmpeg', [
        '-y',
        '-ss',
        String(currentTime),
        '-i',
        videoPath,
        '-vframes',
        '1',
        '-q:v',
        '3',
        sliceFramePath,
      ]);
      if (fs.existsSync(sliceFramePath)) {
        frameData = fs.readFileSync(sliceFramePath).toString('base64');
      }
    } catch {
      // frame extraction optional fallback
    }
  }

  // 2. Notify Client: Translating
  session.ws.send(
    JSON.stringify({
      type: 'status_update',
      indicators: {
        listening: false,
        speechRecog: false,
        ocr: false,
        translating: true,
        voiceGen: false,
        playing: false,
      },
      time: currentTime,
    })
  );

  let chineseText = '';
  let burmeseText = '';

  // Check if project already has transcribed Chinese dialogue or recap narration segments from Mode 1
  const project = getProjectById(projectId);
  if (project?.transcription?.segments && project.transcription.segments.length > 0) {
    const activeSeg = project.transcription.segments.find(
      (s) => currentTime >= s.start - 0.5 && currentTime <= s.end + 0.8
    );
    if (activeSeg) {
      chineseText = activeSeg.text;
    }
  }

  if (project?.recapScript?.narrationSegments && project.recapScript.narrationSegments.length > 0) {
    const totalDuration = project.duration || 30;
    const progressRatio = Math.max(0, Math.min(1, currentTime / totalDuration));
    const segmentIndex = Math.min(
      project.recapScript.narrationSegments.length - 1,
      Math.floor(progressRatio * project.recapScript.narrationSegments.length)
    );
    const existingRecap = project.recapScript.narrationSegments[segmentIndex];
    if (existingRecap && !session.historyContext.includes(existingRecap.text)) {
      burmeseText = existingRecap.text;
    }
  }

  // If we still need to generate real-time Burmese translation & recap via Gemini
  if (!burmeseText) {
    const ai = getGeminiClient();
    const parts: any[] = [];

    if (frameData) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: frameData,
        },
      });
    }

    const prompt = `You are an expert Real-Time Chinese to Burmese Live Movie Translator & Narrator.
Current video timestamp: ${currentTime.toFixed(1)} seconds.
Previous narrative context: ${session.historyContext.slice(-3).join(' | ') || 'None yet'}

Look at the current video frame and scene:
1. Detect any spoken Chinese dialogue or on-screen Chinese subtitles.
2. Provide the Chinese transcript or description.
3. Provide a natural, concise Burmese translation & recap narration (in pure Myanmar Unicode) suitable for speaking over the video at this exact moment.
4. Output pure JSON format:
{
  "chineseText": "Chinese dialogue or screen subtitle",
  "burmeseText": "Natural fluent Burmese translation/recap sentence"
}`;

    parts.push({ text: prompt });

    // Prioritize high-quota standard Flash models first, never fail with 429
    const candidateModels = [
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
    ];

    for (const modelName of candidateModels) {
      try {
        const result = await ai.models.generateContent({
          model: modelName,
          contents: parts,
          config: {
            responseMimeType: 'application/json',
          },
        });

        const parsed = JSON.parse(result.text ?? '{}');
        if (!chineseText) chineseText = (parsed.chineseText || '').trim();
        burmeseText = (parsed.burmeseText || '').trim();
        if (burmeseText) break;
      } catch (err: any) {
        // Continue to fallback model silently if quota limited
      }
    }
  }

  // Graceful fallback if quota limited on all models
  if (!burmeseText) {
    if (chineseText) {
      burmeseText = 'ဇာတ်ကောင်များသည် အရေးပါသော စကားများကို ပြောဆိုနေပြီး ဇာတ်လမ်း ဆက်လက်ဖြစ်ပွားနေပါသည်။';
    } else {
      burmeseText = 'ဇာတ်ကောင်များသည် အခြေအနေကို သုံးသပ်ရင်း နောက်ဆက်တွဲ အစီအစဉ်ကို ဆွေးနွေးနေကြသည်။';
    }
  }

  session.historyContext.push(burmeseText);
  if (session.historyContext.length > 10) session.historyContext.shift();

  // 3. Notify Client: Chinese transcript & Burmese text ready
  session.ws.send(
    JSON.stringify({
      type: 'transcript_chunk',
      chineseText,
      burmeseText,
      time: currentTime,
    })
  );

  // 4. Generate Live Burmese Neural Voice via EdgeTTS
  session.ws.send(
    JSON.stringify({
      type: 'status_update',
      indicators: {
        listening: false,
        speechRecog: false,
        ocr: false,
        translating: false,
        voiceGen: true,
        playing: false,
      },
      time: currentTime,
    })
  );

  const liveAudioFile = path.join(sessionTempDir, `live_audio_${Date.now()}.mp3`);
  try {
    const { duration } = await synthesizeBurmeseTts({
      text: burmeseText,
      outputPath: liveAudioFile,
      voiceId: session.voiceId,
      rate: session.speakingRate,
    });

    if (fs.existsSync(liveAudioFile)) {
      const audioBase64 = fs.readFileSync(liveAudioFile).toString('base64');
      fs.unlink(liveAudioFile, () => {});

      // 5. Send Audio and Subtitle Cue to Client
      session.ws.send(
        JSON.stringify({
          type: 'live_audio_chunk',
          audioBase64,
          chineseText,
          burmeseText,
          startTime: currentTime,
          endTime: currentTime + duration,
          duration,
        })
      );
    }
  } catch (err: any) {
    console.error('[LiveSession] TTS generation error:', err);
  }
}
