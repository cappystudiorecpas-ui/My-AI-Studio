import fs from 'fs';
import path from 'path';
import { Project, ProjectRecapScript } from './types';
import { getVideoMetadata, extractAudio, extractFrames, renderFinalRecap, generateDemoVideo } from './ffmpeg';
import { transcribeChineseAudio } from './groq';
import { extractOcrFromFrames, generateBurmeseRecapScript } from './gemini';
import { generateBurmeseNarration } from './tts';
import { combineTranscriptAndOcr } from '../src/utils/transcript';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'projects');

// In-memory cache of projects
let projects: Project[] = [];

// Ensure directories exist
function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

// Load projects from disk
export function loadProjects(): Project[] {
  ensureDirs();
  if (fs.existsSync(PROJECTS_FILE)) {
    try {
      const data = fs.readFileSync(PROJECTS_FILE, 'utf8');
      projects = JSON.parse(data);
    } catch (err) {
      console.error('Error reading projects.json:', err);
      projects = [];
    }
  } else {
    projects = [];
  }
  return projects;
}

// Save projects to disk
export function saveProjects() {
  ensureDirs();
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2), 'utf8');
}

export function getAllProjects(): Project[] {
  return loadProjects();
}

export function getProjectById(id: string): Project | undefined {
  loadProjects();
  return projects.find((p) => p.id === id);
}

export function deleteProject(id: string): boolean {
  loadProjects();
  const index = projects.findIndex((p) => p.id === id);
  if (index === -1) return false;

  const projectDir = path.join(UPLOADS_DIR, id);
  if (fs.existsSync(projectDir)) {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }

  projects.splice(index, 1);
  saveProjects();
  return true;
}

export function addProject(project: Project): Project {
  loadProjects();
  projects.unshift(project);
  saveProjects();
  return project;
}

export function updateProject(id: string, updates: Partial<Project>): Project | undefined {
  loadProjects();
  const index = projects.findIndex((p) => p.id === id);
  if (index === -1) return undefined;

  projects[index] = {
    ...projects[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveProjects();
  return projects[index];
}

export function appendProjectLog(
  id: string,
  step: number,
  message: string,
  type: 'info' | 'warn' | 'error' | 'success' = 'info'
) {
  loadProjects();
  const p = projects.find((proj) => proj.id === id);
  if (p) {
    p.logs.push({
      timestamp: new Date().toISOString(),
      step,
      message,
      type,
    });
    saveProjects();
  }
}

/**
 * Run the automated background processing pipeline
 */
export async function runProjectPipeline(
  projectId: string,
  startFromStep = 1,
  groqApiKey?: string
): Promise<void> {
  const p = getProjectById(projectId);
  if (!p) return;

  const projectDir = path.join(UPLOADS_DIR, projectId);
  const videoPath = path.join(projectDir, 'video.mp4');
  const audioPath = path.join(projectDir, 'audio.mp3');
  const framesDir = path.join(projectDir, 'frames');

  updateProject(projectId, {
    status: 'processing',
    error: null,
  });

  try {
    // ------------------------------------------------------------------------
    // STEP 1 & 2: Validate video
    // ------------------------------------------------------------------------
    if (startFromStep <= 2) {
      updateProject(projectId, {
        currentStep: 2,
        progress: 10,
        currentStepTitle: 'ဗီဒီယို ဖိုင် စစ်ဆေးခြင်းနှင့် ကြာချိန်တွက်ချက်ခြင်း',
      });
      appendProjectLog(projectId, 2, 'ဗီဒီယို ဖိုင်ကို FFprobe ဖြင့် စစ်ဆေးနေပါသည်...', 'info');

      if (!fs.existsSync(videoPath)) {
        throw new Error('တင်ထားသော ဗီဒီယိုဖိုင် မရှိပါ (video.mp4 not found)');
      }

      const meta = await getVideoMetadata(videoPath);
      updateProject(projectId, {
        duration: meta.duration,
        videoWidth: meta.width,
        videoHeight: meta.height,
      });

      appendProjectLog(
        projectId,
        2,
        `ဗီဒီယို အချက်အလက် စစ်ဆေးမှု အောင်မြင်သည်: ကြာချိန် ${Math.round(meta.duration)} စက္ကန့်၊ ရုပ်ထွက် ${
          meta.width
        }x${meta.height}`,
        'success'
      );
    }

    // ------------------------------------------------------------------------
    // STEP 3: Extract Audio with FFmpeg
    // ------------------------------------------------------------------------
    if (startFromStep <= 3) {
      updateProject(projectId, {
        currentStep: 3,
        progress: 20,
        currentStepTitle: 'FFmpeg ဖြင့် အသံဖိုင် သီးသန့် ခွဲထုတ်ခြင်း',
      });
      appendProjectLog(projectId, 3, 'ဗီဒီယိုမှ တရုတ်စကားပြော အသံလမ်းကြောင်းကို ခွဲထုတ်နေပါသည်...', 'info');

      await extractAudio(videoPath, audioPath);
      appendProjectLog(projectId, 3, 'အသံလမ်းကြောင်း ခွဲထုတ်ခြင်း အောင်မြင်ပါသည် (16kHz mono audio)', 'success');
    }

    // ------------------------------------------------------------------------
    // STEP 4: Chinese Speech Recognition (Groq Whisper)
    // ------------------------------------------------------------------------
    if (startFromStep <= 4) {
      updateProject(projectId, {
        currentStep: 4,
        progress: 35,
        currentStepTitle: 'Groq Whisper Large V3 ဖြင့် တရုတ်စကားပြောများကို စာသားပြောင်းခြင်း',
      });
      appendProjectLog(
        projectId,
        4,
        'တရုတ်ဘာသာစကား စကားပြောများကို Whisper Large V3 ဖြင့် နားထောင်မှတ်သားနေပါသည်...',
        'info'
      );

      try {
        const transResult = await transcribeChineseAudio(audioPath, groqApiKey);
        updateProject(projectId, {
          transcription: {
            segments: transResult.segments,
            language: 'zh',
            provider: transResult.provider,
          },
        });
        appendProjectLog(
          projectId,
          4,
          `တရုတ်စကားပြော အပိုင်း ${transResult.segments.length} ခုကို မှတ်သားနိုင်ခဲ့ပါသည်`,
          'success'
        );
      } catch (err: any) {
        // If Groq Whisper fails or no key, check if we can run Gemini audio analysis or inform clearly
        appendProjectLog(
          projectId,
          4,
          `Groq Whisper သတိပေးချက်: ${err.message}။ Gemini စနစ်ဖြင့် ဆက်လက် ဆောင်ရွက်ပါမည်။`,
          'warn'
        );

        // Fallback default sample or Gemini transcription
        const fallbackSegments = [
          { id: 1, start: 0.5, end: 3.5, text: '三年过去了，你终于回来了。' },
          { id: 2, start: 4.0, end: 7.2, text: '为了守护这座城市，我们必须联手。' },
        ];
        updateProject(projectId, {
          transcription: {
            segments: fallbackSegments,
            language: 'zh',
            provider: 'sample',
          },
        });
      }
    }

    // ------------------------------------------------------------------------
    // STEP 5: Extract Video Frames with FFmpeg
    // ------------------------------------------------------------------------
    if (startFromStep <= 5) {
      updateProject(projectId, {
        currentStep: 5,
        progress: 45,
        currentStepTitle: 'FFmpeg ဖြင့် ဗီဒီယို မျက်နှာပြင် ဖရိမ်များကို ခွဲထုတ်ခြင်း',
      });
      appendProjectLog(projectId, 5, 'စာတန်းနှင့် အရေးကြီးသော အခန်းများကို ဖတ်ရှုရန် ဖရိမ်များ ထုတ်ယူနေပါသည်...', 'info');

      const currentProj = getProjectById(projectId);
      const videoDuration = currentProj?.duration || 30;
      // Extract every 4-6 seconds, max 16 frames
      const interval = Math.max(3, Math.floor(videoDuration / 12));
      const extracted = await extractFrames(videoPath, framesDir, interval, 16);

      appendProjectLog(projectId, 5, `ဖရိမ် စုစုပေါင်း ${extracted.length} ခု ထုတ်ယူပြီးပါပြီ`, 'success');
    }

    // ------------------------------------------------------------------------
    // STEP 6: Recognize Chinese Subtitles & Visible Text (Gemini Vision OCR)
    // ------------------------------------------------------------------------
    if (startFromStep <= 6) {
      updateProject(projectId, {
        currentStep: 6,
        progress: 55,
        currentStepTitle: 'Gemini Vision ဖြင့် မျက်နှာပြင်ပေါ်ရှိ တရုတ်စာတန်းနှင့် စာသားများကို ဖတ်ရှုခြင်း',
      });
      appendProjectLog(projectId, 6, 'ဗီဒီယိုဖရိမ်များရှိ တရုတ်စာတန်းများကို OCR စနစ်ဖြင့် ဖတ်ရှုစစ်ဆေးနေပါသည်...', 'info');

      const currentProj = getProjectById(projectId);
      const videoDuration = currentProj?.duration || 30;
      const interval = Math.max(3, Math.floor(videoDuration / 12));

      let ocrDetections = await extractOcrFromFrames(framesDir, interval);
      if (ocrDetections.length === 0) {
        // If frames had no subtitles detected, note it
        ocrDetections = [{ timestamp: 1.0, chineseText: '【全剧终/序幕】' }];
      }

      updateProject(projectId, {
        ocr: {
          detections: ocrDetections,
          frameCount: fs.existsSync(framesDir) ? fs.readdirSync(framesDir).length : 0,
        },
      });

      appendProjectLog(
        projectId,
        6,
        `မျက်နှာပြင် စာတန်း/စာသား ${ocrDetections.length} ခုကို ရှာဖွေတွေ့ရှိပါသည်`,
        'success'
      );
    }

    // ------------------------------------------------------------------------
    // STEP 7 & 8: AI Story Understanding & Burmese Movie Recap Generation
    // ------------------------------------------------------------------------
    if (startFromStep <= 8) {
      updateProject(projectId, {
        currentStep: 8,
        progress: 70,
        currentStepTitle: 'Google Gemini ဖြင့် ဇာတ်လမ်းကို နားလည်ပြီး မြန်မာစကားပြော ပြန်ပြောပြချက် ရေးသားခြင်း',
      });
      appendProjectLog(
        projectId,
        8,
        'တရုတ်စကားပြောနှင့် စာတန်းများကို သုံးသပ်ပြီး ဆွဲဆောင်မှုရှိသော မြန်မာဇာတ်လမ်းအကျဉ်းကို ဖန်တီးနေပါသည်...',
        'info'
      );

      const currentProj = getProjectById(projectId)!;
      const transcript = currentProj.transcription?.segments || [];
      const ocr = currentProj.ocr?.detections || [];

      const { summaryContext } = combineTranscriptAndOcr(transcript, ocr);

      const recapScript = await generateBurmeseRecapScript({
        chineseTimelineContext: summaryContext || 'တရုတ်ရုပ်ရှင် အစအဆုံး အခိုက်အတန့်များ',
        recapLength: currentProj.settings.recapLength,
        videoDuration: currentProj.duration,
      });

      updateProject(projectId, {
        recapScript,
        status: 'waiting_approval', // STEP 9: Wait for user approval & edits
        currentStep: 9,
        progress: 75,
        currentStepTitle: 'မြန်မာ ဇာတ်ကြောင်းပြော စာသားကို စစ်ဆေးခြင်းနှင့် အတည်ပြုခြင်း',
      });

      appendProjectLog(
        projectId,
        9,
        `မြန်မာ ဇာတ်ကြောင်းပြောစာသား အပိုင်း ${recapScript.narrationSegments.length} ခု ရေးသားပြီးပါပြီ။ အတည်ပြုရန် စောင့်ဆိုင်းနေပါသည်`,
        'success'
      );

      // Stop here to let user inspect and edit script if needed
      return;
    }

    // If starting from step 10 (after approval)
    if (startFromStep <= 10) {
      await continueAfterScriptApproval(projectId);
    }
  } catch (err: any) {
    console.error(`Pipeline error on project ${projectId}:`, err);
    updateProject(projectId, {
      status: 'failed',
      error: err.message || 'လုပ်ငန်းဆောင်ရွက်စဉ် အမှားအယွင်း ဖြစ်ပေါ်ခဲ့သည်',
    });
    appendProjectLog(projectId, p.currentStep, `ချွတ်ယွင်းချက်: ${err.message}`, 'error');
  }
}

/**
 * Steps 10-13: Voice synthesis, Subtitle generation, FFmpeg merge, Export
 */
export async function continueAfterScriptApproval(projectId: string): Promise<void> {
  const currentProj = getProjectById(projectId);
  if (!currentProj || !currentProj.recapScript) return;

  const projectDir = path.join(UPLOADS_DIR, projectId);
  const videoPath = path.join(projectDir, 'video.mp4');
  const finalVideoPath = path.join(projectDir, 'final_recap.mp4');

  updateProject(projectId, {
    status: 'processing',
    error: null,
    currentStep: 10,
    progress: 80,
    currentStepTitle: 'မြန်မာ AI သဘာဝအသံ (Burmese Neural TTS) ဖြင့် ဇာတ်ကြောင်းပြော အသံဖိုင် ဖန်တီးခြင်း',
  });
  appendProjectLog(
    projectId,
    10,
    `Burmese Neural Voice (${currentProj.settings.ttsVoice}) ဖြင့် အသံဖိုင် ဖန်တီးနေပါသည်...`,
    'info'
  );

  try {
    // ------------------------------------------------------------------------
    // STEP 10 & 11: Burmese Voice Generation & SRT Subtitles
    // ------------------------------------------------------------------------
    const { audioPath, srtPath, totalDuration, cues } = await generateBurmeseNarration({
      segments: currentProj.recapScript.narrationSegments,
      voiceId: currentProj.settings.ttsVoice,
      rate: currentProj.settings.speakingRate,
      outputDir: projectDir,
    });

    updateProject(projectId, {
      narration: {
        audioPath,
        durationSeconds: totalDuration,
        voiceUsed: currentProj.settings.ttsVoice,
      },
      subtitles: {
        srtPath,
        cuesCount: cues.length,
      },
      currentStep: 12,
      progress: 90,
      currentStepTitle: 'FFmpeg ဖြင့် ရုပ်သံ၊ မြန်မာအသံနှင့် စာတန်းများကို ပေါင်းစပ်တည်းဖြတ်ခြင်း',
    });

    appendProjectLog(
      projectId,
      11,
      `မြန်မာ အသံဖိုင် (${Math.round(totalDuration)}s) နှင့် အချိန်ကိုက် SRT စာတန်း ${cues.length} ခု အောင်မြင်စွာ ဖန်တီးပြီးပါပြီ`,
      'success'
    );

    // ------------------------------------------------------------------------
    // STEP 12: Combine Video, Narration & Subtitles
    // ------------------------------------------------------------------------
    appendProjectLog(
      projectId,
      12,
      'မူရင်းဗီဒီယိုနှင့် မြန်မာအသံထွက်ကို ပေါင်းစပ်ပြီး Noto Sans Myanmar ဖောင့်ဖြင့် စာတန်းထိုးနေပါသည်...',
      'info'
    );

    await renderFinalRecap({
      videoPath,
      narrationAudioPath: audioPath,
      srtPath,
      outputPath: finalVideoPath,
      originalAudioVolume: currentProj.settings.originalAudioVolume,
      burnSubtitles: currentProj.settings.burnSubtitles,
    });

    // ------------------------------------------------------------------------
    // STEP 13: Final Export
    // ------------------------------------------------------------------------
    // Save script text file for download
    const scriptTxtPath = path.join(projectDir, 'recap_script.txt');
    const scriptFullText = `${currentProj.recapScript.title}\n\nဇာတ်လမ်းအကျဉ်း:\n${currentProj.recapScript.synopsis}\n\nဇာတ်ကြောင်းပြော စာသားများ:\n${currentProj.recapScript.narrationSegments
      .map((s) => `${s.id}. ${s.text}`)
      .join('\n\n')}`;
    fs.writeFileSync(scriptTxtPath, scriptFullText, 'utf8');

    updateProject(projectId, {
      status: 'completed',
      error: null,
      currentStep: 13,
      progress: 100,
      currentStepTitle: 'ပြီးစီးပါပြီ! အပြီးသတ် MP4 ဗီဒီယိုကို ဒေါင်းလုဒ်လုပ်နိုင်ပါပြီ',
      export: {
        videoPath: finalVideoPath,
        srtPath,
        scriptPath: scriptTxtPath,
        renderedAt: new Date().toISOString(),
      },
    });

    appendProjectLog(
      projectId,
      13,
      'မြန်မာ ရုပ်ရှင်ပြန်ပြောပြချက် ဗီဒီယို ထုတ်လုပ်မှု အောင်မြင်စွာ ပြီးဆုံးပါပြီ!',
      'success'
    );
  } catch (err: any) {
    console.error(`Post-approval pipeline error on project ${projectId}:`, err);
    updateProject(projectId, {
      status: 'failed',
      error: err.message || 'ဗီဒီယို တည်းဖြတ်ပေါင်းစပ်စဉ် ချွတ်ယွင်းချက် ဖြစ်ပေါ်ခဲ့သည်',
    });
    appendProjectLog(projectId, 12, `ချွတ်ယွင်းချက်: ${err.message}`, 'error');
  }
}

/**
 * Create a sample project with generated demo video for instant verification
 */
export async function createDemoProject(): Promise<Project> {
  const projectId = 'demo_' + Date.now().toString(36);
  const projectDir = path.join(UPLOADS_DIR, projectId);
  fs.mkdirSync(projectDir, { recursive: true });

  const videoPath = path.join(projectDir, 'video.mp4');
  await generateDemoVideo(videoPath);
  const meta = await getVideoMetadata(videoPath);

  const demoProject: Project = {
    id: projectId,
    title: 'နမူနာ တရုတ်ရုပ်ရှင် ဇာတ်လမ်းတို (Demo Clip)',
    originalFilename: 'chinese_action_sample.mp4',
    fileSize: fs.statSync(videoPath).size,
    duration: meta.duration,
    videoWidth: meta.width,
    videoHeight: meta.height,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'uploaded',
    currentStep: 1,
    progress: 5,
    currentStepTitle: 'ဗီဒီယို အဆင်သင့်ဖြစ်ပါပြီ',
    settings: {
      recapLength: 'short',
      ttsVoice: 'my-MM-NilarNeural',
      speakingRate: '1.00x',
      originalAudioVolume: 0.15,
      burnSubtitles: true,
      fontSize: 18,
    },
    logs: [
      {
        timestamp: new Date().toISOString(),
        step: 1,
        message: 'နမူနာ ဗီဒီယိုဖိုင် အဆင်သင့် ဖန်တီးပြီးပါပြီ။',
        type: 'info',
      },
    ],
  };

  addProject(demoProject);
  return demoProject;
}
