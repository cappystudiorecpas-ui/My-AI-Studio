import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import {
  getAllProjects,
  getProjectById,
  addProject,
  updateProject,
  deleteProject,
  runProjectPipeline,
  continueAfterScriptApproval,
  createDemoProject,
  appendProjectLog,
} from './server/pipeline';
import { BURMESE_VOICES, generateVoicePreview } from './server/tts';
import { Project, ProjectSettings } from './server/types';
import {
  getGroqApiKey,
  saveGroqApiKey,
  maskApiKey,
  testGroqConnection,
  transcribeChineseAudio,
  ensureTestAudio,
} from './server/groq';
import { getVideoMetadata, renderFinalRecap, extractAudio } from './server/ffmpeg';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const UPLOADS_DIR = path.resolve(__dirname, 'uploads', 'projects');
const PREVIEWS_DIR = path.resolve(__dirname, 'uploads', 'previews');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(PREVIEWS_DIR)) {
  fs.mkdirSync(PREVIEWS_DIR, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const projectId = req.body.projectId || 'proj_' + Date.now().toString(36);
    const projDir = path.join(UPLOADS_DIR, projectId);
    if (!fs.existsSync(projDir)) {
      fs.mkdirSync(projDir, { recursive: true });
    }
    req.body._assignedProjectId = projectId;
    cb(null, projDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg'].includes(ext)) {
      cb(null, 'audio' + ext);
    } else {
      cb(null, 'video.mp4');
    }
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp4', '.mov', '.mkv', '.avi', '.webm', '.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext) || file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('ထောက်ပံ့မထားသော ဖိုင်အမျိုးအစားဖြစ်ပါသည် (ဗီဒီယိုနှင့် အသံဖိုင်များသာ လက်ခံပါသည်)'));
    }
  },
});

// ----------------------------------------------------------------------------
// API Endpoints
// ----------------------------------------------------------------------------

// System Health & Engine Status
app.get('/api/health', (req: Request, res: Response) => {
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;
  const hasGroqKey = !!getGroqApiKey();

  res.json({
    status: 'ok',
    geminiConfigured: hasGeminiKey,
    groqConfigured: hasGroqKey,
    ttsProvider: 'Microsoft Edge Neural TTS (my-MM-NilarNeural & my-MM-ThihaNeural)',
    ttsReady: true,
    ffmpegInstalled: true,
    fontSupport: 'Noto Sans Myanmar / Padauk',
  });
});

// Verify Groq Server Status (without exposing raw key)
app.get('/api/groq/verify', (req: Request, res: Response) => {
  const key = getGroqApiKey();
  res.json({
    isAvailable: !!key,
    maskedKey: key ? maskApiKey(key) : null,
    model: 'whisper-large-v3',
    language: 'zh',
  });
});

// Securely Save Groq API Key on Server
app.post('/api/groq/save-key', (req: Request, res: Response) => {
  const { apiKey } = req.body;
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    return res.status(400).json({ error: 'Groq API Key မပါဝင်ပါ' });
  }
  saveGroqApiKey(apiKey);
  res.json({
    success: true,
    maskedKey: maskApiKey(apiKey),
    message: 'Groq API Key ကို ဆာဗာတွင် လုံခြုံစွာ သိမ်းဆည်းပြီးပါပြီ',
  });
});

// Test Groq Whisper Connection with Real Short Chinese Audio
app.post('/api/groq/test-connection', async (req: Request, res: Response) => {
  try {
    const { groqApiKey } = req.body;
    const result = await testGroqConnection(groqApiKey);
    if (!result.success) {
      return res.status(result.status || 400).json(result);
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      model: 'whisper-large-v3',
      language: 'zh',
      text: '',
      duration: 0,
      segments: [],
      error: err.message || 'Groq Whisper ချိတ်ဆက်မှု မအောင်မြင်ပါ',
    });
  }
});

// Serve real short Chinese sample audio for connection test preview
app.get('/api/groq/sample-audio', async (req: Request, res: Response) => {
  const samplePath = await ensureTestAudio();
  if (fs.existsSync(samplePath)) {
    res.setHeader('Content-Type', 'audio/mpeg');
    fs.createReadStream(samplePath).pipe(res);
  } else {
    res.status(404).send('Sample audio not found');
  }
});

// Secure Server-Side Chinese Speech Transcription Endpoint
app.post('/api/transcribe-chinese', upload.single('media'), async (req: Request, res: Response) => {
  try {
    let audioPath = '';
    const customKey = req.body.groqApiKey;

    if (req.file) {
      const filePath = req.file.path;
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (['.mp4', '.mov', '.mkv', '.avi', '.webm'].includes(ext) || req.file.mimetype.startsWith('video/')) {
        const extractedPath = path.join(path.dirname(filePath), 'extracted_audio.mp3');
        await extractAudio(filePath, extractedPath);
        audioPath = extractedPath;
      } else {
        audioPath = filePath;
      }
    } else if (req.body.projectId) {
      const proj = getProjectById(req.body.projectId);
      if (!proj) return res.status(404).json({ error: 'စီမံကိန်း ရှာမတွေ့ပါ' });
      const projDir = path.join(UPLOADS_DIR, proj.id);
      audioPath = path.join(projDir, 'audio.mp3');
      if (!fs.existsSync(audioPath)) {
        const videoPath = path.join(projDir, 'video.mp4');
        if (fs.existsSync(videoPath)) {
          await extractAudio(videoPath, audioPath);
        } else {
          return res.status(404).json({ error: 'အသံဖိုင် သို့မဟုတ် ဗီဒီယိုဖိုင် ရှာမတွေ့ပါ' });
        }
      }
    } else {
      return res.status(400).json({ error: 'စကားပြောမှတ်သားရန် မီဒီယာဖိုင် သို့မဟုတ် projectId ထည့်သွင်းပေးပါ' });
    }

    const result = await transcribeChineseAudio(audioPath, customKey);
    res.json({
      success: true,
      model: 'whisper-large-v3',
      language: 'zh',
      text: result.text,
      duration: result.duration,
      segments: result.segments,
      provider: result.provider,
    });
  } catch (err: any) {
    console.error('Transcription error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'တရုတ်စကားပြော မှတ်သားခြင်း မအောင်မြင်ပါ',
    });
  }
});

app.get('/api/test-gemini', async (req: Request, res: Response) => {
  try {
    const { getGeminiClient } = await import('./server/gemini');
    const ai = getGeminiClient();
    const candidateModels = [
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-3-flash',
      'gemini-2.5-flash',
      'gemini-1.5-flash',
    ];
    const results: any[] = [];
    let successfulModel = null;
    let responseText = null;

    for (const model of candidateModels) {
      try {
        const result = await ai.models.generateContent({
          model,
          contents: 'Reply with JSON: {"status": "ok", "message": "hello"}',
        });
        successfulModel = model;
        responseText = result.text;
        break;
      } catch (e: any) {
        results.push({ model, error: e.message });
      }
    }

    if (successfulModel) {
      res.json({ success: true, model: successfulModel, text: responseText, attempted: results });
    } else {
      res.status(500).json({ success: false, errors: results });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Available Burmese Voices
app.get('/api/voices', (req: Request, res: Response) => {
  res.json(BURMESE_VOICES);
});

// Preview Voice & Speaking Speed
app.post('/api/voices/preview', async (req: Request, res: Response) => {
  try {
    const { voiceId = 'my-MM-NilarNeural', rate = '1.00x', sampleText } = req.body;
    const safeRate = String(rate).replace(/[^a-zA-Z0-9._-]/g, '_');
    const textHash = sampleText ? `_${Buffer.from(sampleText).toString('hex').slice(0, 8)}` : '';
    const previewFile = path.join(PREVIEWS_DIR, `preview_${voiceId}_${safeRate}${textHash}.mp3`);

    if (!fs.existsSync(previewFile)) {
      await generateVoicePreview(voiceId, rate, previewFile, sampleText);
    }

    res.sendFile(previewFile);
  } catch (err: any) {
    console.error('Preview error:', err);
    res.status(500).json({ error: err.message || 'အသံစမ်းသပ်မှု မအောင်မြင်ပါ' });
  }
});

// Get Projects List & Summary
app.get('/api/projects', (req: Request, res: Response) => {
  const projects = getAllProjects();
  const summary = {
    total: projects.length,
    completed: projects.filter((p) => p.status === 'completed').length,
    processing: projects.filter((p) => p.status === 'processing' || p.status === 'waiting_approval').length,
    failed: projects.filter((p) => p.status === 'failed').length,
  };
  res.json({ projects, summary });
});

// Create Project via File Upload
app.post('/api/projects/upload', upload.single('video'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'ဗီဒီယိုဖိုင် မပါဝင်ပါ (Please select a video file)' });
    }

    const projectId = req.body._assignedProjectId || 'proj_' + Date.now().toString(36);
    const videoPath = req.file.path;

    const meta = await getVideoMetadata(videoPath);

    const defaultSettings: ProjectSettings = {
      recapLength: (req.body.recapLength as any) || 'medium',
      ttsVoice: (req.body.ttsVoice as any) || 'my-MM-NilarNeural',
      speakingRate: req.body.speakingRate || '1.00x',
      originalAudioVolume: parseFloat(req.body.originalAudioVolume ?? '0.15'),
      burnSubtitles: req.body.burnSubtitles !== 'false',
      fontSize: parseInt(req.body.fontSize ?? '18', 10),
    };

    const newProject: Project = {
      id: projectId,
      title: req.body.title || req.file.originalname.replace(/\.[^/.]+$/, ''),
      originalFilename: req.file.originalname,
      fileSize: req.file.size,
      duration: meta.duration,
      videoWidth: meta.width,
      videoHeight: meta.height,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'uploaded',
      currentStep: 1,
      progress: 5,
      currentStepTitle: 'ဗီဒီယို အပ်လုဒ်တင်ပြီးပါပြီ',
      settings: defaultSettings,
      logs: [
        {
          timestamp: new Date().toISOString(),
          step: 1,
          message: `ဗီဒီယိုဖိုင် "${req.file.originalname}" (${(req.file.size / 1024 / 1024).toFixed(
            1
          )} MB) ကို အောင်မြင်စွာ တင်ပြီးပါပြီ`,
          type: 'success',
        },
      ],
    };

    addProject(newProject);

    // Automatically trigger processing in background
    const customGroqKey = req.body.groqApiKey;
    runProjectPipeline(projectId, 2, customGroqKey).catch((err) =>
      console.error('Background pipeline error:', err)
    );

    res.json(newProject);
  } catch (err: any) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'ဗီဒီယို အပ်လုဒ်တင်ခြင်း မအောင်မြင်ပါ' });
  }
});

// Create Demo Sample Project
app.post('/api/projects/demo', async (req: Request, res: Response) => {
  try {
    const demoProject = await createDemoProject();
    // Run pipeline in background
    runProjectPipeline(demoProject.id, 2).catch((err) =>
      console.error('Demo background pipeline error:', err)
    );
    res.json(demoProject);
  } catch (err: any) {
    console.error('Demo creation error:', err);
    res.status(500).json({ error: err.message || 'နမူနာ ဖန်တီးခြင်း မအောင်မြင်ပါ' });
  }
});

// Get Project Details
app.get('/api/projects/:id', (req: Request, res: Response) => {
  const project = getProjectById(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'စီမံကိန်း ရှာမတွေ့ပါ (Project not found)' });
  }
  res.json(project);
});

// Delete Project
app.delete('/api/projects/:id', (req: Request, res: Response) => {
  const success = deleteProject(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'ဖျက်ရန် စီမံကိန်း ရှာမတွေ့ပါ' });
  }
  res.json({ success: true, message: 'စီမံကိန်းကို အောင်မြင်စွာ ဖျက်ပြီးပါပြီ' });
});

// Start/Resume Pipeline
app.post('/api/projects/:id/start', (req: Request, res: Response) => {
  const project = getProjectById(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'စီမံကိန်း ရှာမတွေ့ပါ' });
  }

  const { groqApiKey } = req.body;
  runProjectPipeline(project.id, project.currentStep, groqApiKey).catch((err) =>
    console.error('Pipeline error:', err)
  );

  res.json({ message: 'လုပ်ငန်းစတင် ဆောင်ရွက်နေပါသည်', project });
});

// Retry Failed Project Step
app.post('/api/projects/:id/retry', (req: Request, res: Response) => {
  const project = getProjectById(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'စီမံကိန်း ရှာမတွေ့ပါ' });
  }

  // If script was already approved and failed during TTS / video rendering (step 10-13)
  if (project.currentStep >= 10 && project.recapScript?.approved) {
    continueAfterScriptApproval(project.id).catch((err) =>
      console.error('Post-approval retry error:', err)
    );
  } else {
    const stepToRetry = Math.max(2, project.currentStep);
    runProjectPipeline(project.id, stepToRetry, req.body.groqApiKey).catch((err) =>
      console.error('Pipeline retry error:', err)
    );
  }

  res.json({ message: 'လုပ်ငန်းကို ပြန်လည် စတင်နေပါသည်', project });
});

// Update Burmese Recap Script (Step 9 user editing)
app.put('/api/projects/:id/script', (req: Request, res: Response) => {
  const project = getProjectById(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'စီမံကိန်း ရှာမတွေ့ပါ' });
  }

  const { script } = req.body;
  if (!script) {
    return res.status(400).json({ error: 'ပြင်ဆင်ထားသော ဇာတ်ညွှန်း မပါဝင်ပါ' });
  }

  const updated = updateProject(project.id, {
    recapScript: script,
  });

  appendProjectLog(project.id, 9, 'အသုံးပြုသူမှ ဇာတ်ကြောင်းပြော စာသားကို တည်းဖြတ်ပြင်ဆင်ခဲ့သည်', 'info');
  res.json(updated);
});

// Approve Script & Trigger Step 10-13 (TTS, Subtitles, Render)
app.post('/api/projects/:id/approve', async (req: Request, res: Response) => {
  const project = getProjectById(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'စီမံကိန်း ရှာမတွေ့ပါ' });
  }

  // Optional updated settings
  if (req.body.settings) {
    project.settings = { ...project.settings, ...req.body.settings };
  }

  if (project.recapScript) {
    project.recapScript.approved = true;
  }

  updateProject(project.id, {
    recapScript: project.recapScript,
    settings: project.settings,
  });

  appendProjectLog(project.id, 9, 'ဇာတ်ကြောင်းပြောစာသားကို အတည်ပြုပြီး အသံထွက်ဖန်တီးမှု စတင်ပါသည်', 'success');

  // Trigger Steps 10-13 in background
  continueAfterScriptApproval(project.id).catch((err) =>
    console.error('Post approval error:', err)
  );

  res.json({ message: 'အတည်ပြုပြီးပါပြီ။ အသံနှင့် ဗီဒီယို ဖန်တီးနေပါသည်', project });
});

// Re-render Final Video (Adjust Audio Mix, Speaking Speed, or Subtitle styles)
app.post('/api/projects/:id/re-render', async (req: Request, res: Response) => {
  const project = getProjectById(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'စီမံကိန်း ရှာမတွေ့ပါ' });
  }

  const projectDir = path.join(UPLOADS_DIR, project.id);
  const videoPath = path.join(projectDir, 'video.mp4');
  let narrationAudioPath = path.join(projectDir, 'narration.mp3');
  let srtPath = path.join(projectDir, 'subtitles.srt');
  const outputPath = path.join(projectDir, 'final_recap.mp4');

  const oldRate = project.settings.speakingRate;
  const oldVoice = project.settings.ttsVoice;

  if (req.body.settings) {
    project.settings = { ...project.settings, ...req.body.settings };
    updateProject(project.id, { settings: project.settings });
  }

  try {
    const rateChanged = req.body.settings?.speakingRate && req.body.settings.speakingRate !== oldRate;
    const voiceChanged = req.body.settings?.ttsVoice && req.body.settings.ttsVoice !== oldVoice;

    if ((rateChanged || voiceChanged || req.body.regenerateNarration) && project.recapScript) {
      updateProject(project.id, {
        status: 'processing',
        currentStep: 10,
        progress: 85,
        currentStepTitle: `အသံအမြန်နှုန်း (${project.settings.speakingRate}) ဖြင့် မြန်မာအသံနှင့် စာတန်းများကို အသစ်ဖန်တီးနေပါသည်...`,
      });

      const { generateBurmeseNarration } = await import('./server/tts');
      const { audioPath, srtPath: newSrt, totalDuration, cues } = await generateBurmeseNarration({
        segments: project.recapScript.narrationSegments,
        voiceId: project.settings.ttsVoice,
        rate: project.settings.speakingRate,
        outputDir: projectDir,
      });

      narrationAudioPath = audioPath;
      srtPath = newSrt;

      updateProject(project.id, {
        narration: {
          audioPath,
          durationSeconds: totalDuration,
          voiceUsed: project.settings.ttsVoice,
        },
        subtitles: {
          srtPath: newSrt,
          cuesCount: cues.length,
        },
      });
    }

    updateProject(project.id, {
      status: 'processing',
      currentStep: 12,
      progress: 92,
      currentStepTitle: 'ဗီဒီယိုကို အသစ်ပြန်လည် ပေါင်းစပ်တည်းဖြတ်နေပါသည်...',
    });

    await renderFinalRecap({
      videoPath,
      narrationAudioPath,
      srtPath,
      outputPath,
      originalAudioVolume: project.settings.originalAudioVolume,
      burnSubtitles: project.settings.burnSubtitles,
    });

    updateProject(project.id, {
      status: 'completed',
      error: null,
      currentStep: 13,
      progress: 100,
      currentStepTitle: 'ပြီးစီးပါပြီ! အသစ်ပြန်လည် တည်းဖြတ်ပြီးပါပြီ',
      export: {
        videoPath: outputPath,
        srtPath,
        scriptPath: path.join(projectDir, 'recap_script.txt'),
        renderedAt: new Date().toISOString(),
      },
    });

    res.json({ success: true, project: getProjectById(project.id) });
  } catch (err: any) {
    console.error('Re-render error:', err);
    res.status(500).json({ error: err.message || 'ဗီဒီယို ပြန်လည်တည်းဖြတ်ခြင်း မအောင်မြင်ပါ' });
  }
});

// File Streaming & Downloads (Video, Audio, SRT, Script) with HTTP Range support
app.get('/api/files/:projectId/:filename', (req: Request, res: Response) => {
  const { projectId, filename } = req.params;
  // Security check: prevent directory traversal
  const safeFilename = path.basename(filename);
  const filePath = path.join(UPLOADS_DIR, projectId, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('ဖိုင် ရှာမတွေ့ပါ (File not found)');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (safeFilename.endsWith('.mp4') && range) {
    // Range request for smooth HTML5 video streaming
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    // Normal file download or inline stream
    let contentType = 'application/octet-stream';
    if (safeFilename.endsWith('.mp4')) contentType = 'video/mp4';
    else if (safeFilename.endsWith('.mp3')) contentType = 'audio/mpeg';
    else if (safeFilename.endsWith('.srt')) contentType = 'text/plain; charset=utf-8';
    else if (safeFilename.endsWith('.txt')) contentType = 'text/plain; charset=utf-8';

    const download = req.query.download === '1';
    if (download) {
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    }

    res.setHeader('Content-Type', contentType);
    fs.createReadStream(filePath).pipe(res);
  }
});

// ----------------------------------------------------------------------------
// Vite Middleware / Static Serving & WebSocket Server
// ----------------------------------------------------------------------------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const { createServer: createHttpServer } = await import('http');
  const { WebSocketServer } = await import('ws');
  const { handleLiveWebSocket } = await import('./server/liveSession');

  const server = createHttpServer(app);
  const wss = new WebSocketServer({ server, path: '/api/live' });

  wss.on('connection', (ws) => {
    handleLiveWebSocket(ws);
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[My AI Studio] Full-Stack Dual Mode Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
});
