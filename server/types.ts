export interface SpeechSegment {
  id: number | string;
  start: number;
  end: number;
  text: string;
}

export interface OcrDetection {
  timestamp: number;
  chineseText: string;
  confidence?: number;
}

export interface CharacterItem {
  name: string;
  role: string;
  description: string;
}

export interface NarrationSegment {
  id: number;
  text: string;
  estimatedDuration?: number;
}

export interface ProjectRecapScript {
  title: string;
  genre: string;
  charactersSummary: CharacterItem[];
  synopsis: string;
  narrationSegments: NarrationSegment[];
  approved?: boolean;
}

export interface ProjectSettings {
  recapLength: 'short' | 'medium' | 'long';
  ttsVoice: 'my-MM-NilarNeural' | 'my-MM-ThihaNeural';
  speakingRate: string; // e.g. '+0%', '-10%', '+10%'
  originalAudioVolume: number; // 0 = Mute, 0.15 = Background, 1.0 = Original
  burnSubtitles: boolean;
  fontSize: number;
}

export interface LogEntry {
  timestamp: string;
  step: number;
  message: string;
  type: 'info' | 'warn' | 'error' | 'success';
}

export interface Project {
  id: string;
  title: string;
  originalFilename: string;
  fileSize: number;
  duration: number;
  videoWidth: number;
  videoHeight: number;
  createdAt: string;
  updatedAt: string;
  status: 'uploaded' | 'processing' | 'waiting_approval' | 'completed' | 'failed';
  currentStep: number; // 1 to 13
  progress: number;    // 0 to 100
  currentStepTitle: string;
  error?: string | null;
  settings: ProjectSettings;
  transcription?: {
    segments: SpeechSegment[];
    language: string;
    provider: 'groq' | 'gemini' | 'sample';
  };
  ocr?: {
    detections: OcrDetection[];
    frameCount: number;
  };
  recapScript?: ProjectRecapScript;
  narration?: {
    audioPath?: string;
    durationSeconds?: number;
    voiceUsed?: string;
  };
  subtitles?: {
    srtPath?: string;
    cuesCount?: number;
  };
  export?: {
    videoPath?: string;
    srtPath?: string;
    scriptPath?: string;
    renderedAt?: string;
  };
  logs: LogEntry[];
}
