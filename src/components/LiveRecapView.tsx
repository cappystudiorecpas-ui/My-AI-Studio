import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Radio, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Languages, 
  Subtitles, 
  Sliders, 
  RefreshCw, 
  Film, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Layers,
  ChevronDown,
  Activity,
  Headphones,
  Maximize2,
  Gauge,
  Mic,
} from 'lucide-react';
import { Project } from '../../server/types';
import { LiveSubtitleItem, deduplicateLiveSubtitles, getActiveSubtitle } from '../utils/liveSync';
import { SPEAKING_SPEED_OPTIONS, DEFAULT_SPEED_ID, getSpeedOption } from '../utils/speed';

interface LiveRecapViewProps {
  projects: Project[];
  onUploadNew: () => void;
}

interface StatusIndicators {
  listening: boolean;
  speechRecog: boolean;
  ocr: boolean;
  translating: boolean;
  voiceGen: boolean;
  playing: boolean;
}

export const LiveRecapView: React.FC<LiveRecapViewProps> = ({ projects, onUploadNew }) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Live session state
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [connectionLatency, setConnectionLatency] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Indicators
  const [indicators, setIndicators] = useState<StatusIndicators>({
    listening: false,
    speechRecog: false,
    ocr: false,
    translating: false,
    voiceGen: false,
    playing: false,
  });

  // Audio controls
  const [originalVolume, setOriginalVolume] = useState<number>(0.2);
  const [narrationVolume, setNarrationVolume] = useState<number>(1.0);
  const [isOriginalMuted, setIsOriginalMuted] = useState(false);
  const [narrationOnly, setNarrationOnly] = useState(false);

  // Settings
  const [voiceId, setVoiceId] = useState('my-MM-NilarNeural');
  const [speakingRate, setSpeakingRate] = useState<string>(() => {
    try {
      return localStorage.getItem('MYAI_SPEAKING_RATE') || DEFAULT_SPEED_ID;
    } catch {
      return DEFAULT_SPEED_ID;
    }
  });

  const handleSetSpeakingRate = (rateId: string) => {
    setSpeakingRate(rateId);
    try {
      localStorage.setItem('MYAI_SPEAKING_RATE', rateId);
    } catch {}
  };
  const [showChineseSubtitles, setShowChineseSubtitles] = useState(true);
  const [subtitleFontSize, setSubtitleFontSize] = useState<'sm' | 'base' | 'lg'>('base');

  // Live feed stream items
  const [liveSubtitles, setLiveSubtitles] = useState<LiveSubtitleItem[]>([]);
  const [activeSubtitle, setActiveSubtitleState] = useState<LiveSubtitleItem | null>(null);

  // Video and audio references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const narrationAudioRef = useRef<HTMLAudioElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioQueueRef = useRef<Array<{ url: string; duration: number }>>([]);
  const isPlayingAudioRef = useRef<boolean>(false);
  const videoTimeRef = useRef<number>(0);

  // Update selected project when prop changes or selection changes
  useEffect(() => {
    if (selectedProjectId) {
      const found = projects.find((p) => p.id === selectedProjectId);
      setSelectedProject(found || null);
    } else if (projects.length > 0) {
      setSelectedProjectId(projects[0].id);
      setSelectedProject(projects[0]);
    }
  }, [selectedProjectId, projects]);

  // Sync volume to video element
  useEffect(() => {
    if (videoRef.current) {
      if (isOriginalMuted || narrationOnly) {
        videoRef.current.volume = 0;
      } else {
        videoRef.current.volume = originalVolume;
      }
    }
  }, [originalVolume, isOriginalMuted, narrationOnly]);

  // Sync narration audio volume
  useEffect(() => {
    if (narrationAudioRef.current) {
      narrationAudioRef.current.volume = narrationVolume;
    }
  }, [narrationVolume]);

  // WebSocket Connection Management
  const connectWebSocket = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/live`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    const pingStart = Date.now();

    ws.onopen = () => {
      setWsConnected(true);
      setConnectionLatency(Date.now() - pingStart);
      setErrorMessage(null);

      // Initialize session
      ws.send(
        JSON.stringify({
          type: 'init',
          projectId: selectedProjectId,
          voiceId,
          speakingRate,
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'status_update') {
          if (msg.indicators) {
            setIndicators((prev) => ({ ...prev, ...msg.indicators }));
          }
        } else if (msg.type === 'transcript_chunk') {
          // New live speech segment
          const newItem: LiveSubtitleItem = {
            id: 'sub_' + Date.now(),
            chineseText: msg.chineseText,
            burmeseText: msg.burmeseText,
            startTime: msg.time,
            endTime: msg.time + 3.5,
            type: 'speech',
          };

          setLiveSubtitles((prev) => {
            if (deduplicateLiveSubtitles(prev, newItem)) {
              return [...prev, newItem];
            }
            return prev;
          });
        } else if (msg.type === 'live_audio_chunk') {
          // Play live Burmese narration audio
          if (msg.audioBase64) {
            const audioBlob = b64toBlob(msg.audioBase64, 'audio/mp3');
            const audioUrl = URL.createObjectURL(audioBlob);

            audioQueueRef.current.push({
              url: audioUrl,
              duration: msg.duration || 3.0,
            });

            playNextInAudioQueue();
          }

          // Subtitle update
          const newItem: LiveSubtitleItem = {
            id: 'sub_' + Date.now(),
            chineseText: msg.chineseText || '',
            burmeseText: msg.burmeseText,
            startTime: msg.startTime || videoTimeRef.current,
            endTime: msg.endTime || videoTimeRef.current + (msg.duration || 3.0),
            type: 'recap',
          };

          setLiveSubtitles((prev) => {
            if (deduplicateLiveSubtitles(prev, newItem)) {
              return [...prev, newItem];
            }
            return prev;
          });
        } else if (msg.type === 'error') {
          setErrorMessage(msg.message || 'Live စနစ် ချိတ်ဆက်မှု အမှား');
        }
      } catch (err) {
        console.error('WS message error:', err);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      setIsLiveActive(false);
    };

    ws.onerror = () => {
      setWsConnected(false);
      setErrorMessage('Live WebSocket ချိတ်ဆက်မှု မအောင်မြင်ပါ');
    };
  };

  // Helper to convert base64 to Blob
  const b64toBlob = (b64Data: string, contentType = '', sliceSize = 512) => {
    const byteCharacters = atob(b64Data);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
  };

  // Play next audio segment from queue
  const playNextInAudioQueue = () => {
    if (isPlayingAudioRef.current || audioQueueRef.current.length === 0) return;

    const next = audioQueueRef.current.shift();
    if (!next) return;

    isPlayingAudioRef.current = true;
    setIndicators((prev) => ({ ...prev, playing: true }));

    if (narrationAudioRef.current) {
      narrationAudioRef.current.src = next.url;
      narrationAudioRef.current
        .play()
        .catch((err) => console.warn('Narration playback error:', err));

      narrationAudioRef.current.onended = () => {
        isPlayingAudioRef.current = false;
        setIndicators((prev) => ({ ...prev, playing: false }));
        playNextInAudioQueue();
      };
    }
  };

  // Start Live Mode
  const handleStartLive = () => {
    if (!selectedProjectId) {
      setErrorMessage('ကျေးဇူးပြု၍ ဗီဒီယို ပရောဂျက်တစ်ခု ရွေးချယ်ပါ');
      return;
    }

    setIsLiveActive(true);
    setErrorMessage(null);
    connectWebSocket();

    if (videoRef.current) {
      videoRef.current.play().catch(console.warn);
    }
  };

  // Stop Live Mode
  const handleStopLive = () => {
    setIsLiveActive(false);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
    }
    setIndicators({
      listening: false,
      speechRecog: false,
      ocr: false,
      translating: false,
      voiceGen: false,
      playing: false,
    });
  };

  // Timeupdate handler on video to sync live processing and update subtitles
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    videoTimeRef.current = time;

    // Update active on-screen subtitle
    const currentSub = getActiveSubtitle(liveSubtitles, time, 4.0);
    setActiveSubtitleState(currentSub);

    // Send playback tick to server if Live is active
    if (isLiveActive && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'sync_time',
          time,
          projectId: selectedProjectId,
        })
      );
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      <audio ref={narrationAudioRef} className="hidden" />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-900/40 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-xs font-semibold mb-2">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>MODE 2: REAL-TIME LIVE RECAP & TRANSLATION</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            တိုက်ရိုက် Live ဘာသာပြန် & ဇာတ်လမ်းပြန်ပြော စနစ်
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            တရုတ်ဗီဒီယိုကို ကြည့်ရှုနေစဉ် တစ်ချိန်တည်းမှာပင် တရုတ်စကားပြောများကို နားထောင်ပြီး မြန်မာအသံထွက်နှင့် မြန်မာစာတန်းများကို တိုက်ရိုက် ထုတ်လွှင့်ပေးပါသည်။
          </p>
        </div>

        {/* Video Selector Dropdown */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                handleStopLive();
              }}
              className="appearance-none bg-slate-900 border border-slate-700 hover:border-purple-500 px-4 py-2 pr-9 rounded-xl text-xs font-semibold text-white focus:outline-none cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({Math.round(p.duration)}s)
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            onClick={onUploadNew}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 text-xs font-semibold border border-purple-500/30 transition cursor-pointer whitespace-nowrap"
          >
            ဗီဒီယို အသစ်တင်မည်
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
          <div className="flex-1">
            <p className="font-semibold">ချိတ်ဆက်မှု သတိပေးချက်</p>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Main Grid: Video Player + Live Indicator Console */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Video Player & Subtitle Overlay */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative aspect-video rounded-2xl bg-black overflow-hidden border border-purple-900/40 shadow-2xl group">
            {selectedProjectId ? (
              <video
                ref={videoRef}
                src={`/api/files/${selectedProjectId}/video.mp4`}
                onTimeUpdate={handleTimeUpdate}
                controls
                playsInline
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                <Film className="w-12 h-12" />
                <p className="text-sm">ကျေးဇူးပြု၍ ဗီဒီယိုတစ်ခု ရွေးချယ်ပါ</p>
              </div>
            )}

            {/* LIVE SUBTITLE OVERLAY */}
            {activeSubtitle && (
              <div className="absolute bottom-14 left-4 right-4 pointer-events-none text-center transition-all animate-fadeIn">
                <div className="inline-block max-w-xl mx-auto px-4 py-2 rounded-xl bg-black/85 backdrop-blur-md border border-purple-500/40 shadow-2xl">
                  {showChineseSubtitles && activeSubtitle.chineseText && (
                    <p className="text-xs text-slate-300 font-sans tracking-wide mb-1 font-medium">
                      {activeSubtitle.chineseText}
                    </p>
                  )}
                  <p
                    className={`font-bold text-white font-['Noto_Sans_Myanmar','Padauk',sans-serif] leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] ${
                      subtitleFontSize === 'sm'
                        ? 'text-xs sm:text-sm'
                        : subtitleFontSize === 'lg'
                        ? 'text-base sm:text-xl text-purple-200'
                        : 'text-sm sm:text-base text-purple-100'
                    }`}
                  >
                    {activeSubtitle.burmeseText}
                  </p>
                </div>
              </div>
            )}

            {/* Live Indicator Pill on top-right of player */}
            <div className="absolute top-3 right-3 flex items-center gap-2 pointer-events-none">
              <div
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md border ${
                  isLiveActive
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                    : 'bg-slate-900/80 text-slate-400 border-slate-700/60'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${isLiveActive ? 'bg-rose-500' : 'bg-slate-500'}`}
                />
                <span>{isLiveActive ? 'LIVE TRANSLATING' : 'LIVE READY'}</span>
              </div>
            </div>
          </div>

          {/* Primary Live Control Bar */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {!isLiveActive ? (
                <button
                  onClick={handleStartLive}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-purple-600/30 transition cursor-pointer"
                >
                  <Radio className="w-4 h-4 text-cyan-300 animate-pulse" />
                  <span>တိုက်ရိုက် Live စတင်မည် (Start Live)</span>
                </button>
              ) : (
                <button
                  onClick={handleStopLive}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-rose-600/30 transition cursor-pointer"
                >
                  <Pause className="w-4 h-4" />
                  <span>Live ရပ်တန့်မည် (Stop Live)</span>
                </button>
              )}

              <div className="text-xs text-slate-400">
                {wsConnected ? (
                  <span className="text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>WebSocket ချိတ်ဆက်ပြီး ({connectionLatency}ms)</span>
                  </span>
                ) : (
                  <span className="text-slate-500">Live အသင့်ရှိသည်</span>
                )}
              </div>
            </div>

            {/* Quick Narration Mode Toggles */}
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setNarrationOnly(!narrationOnly)}
                className={`px-3 py-1.5 rounded-lg border font-medium transition cursor-pointer ${
                  narrationOnly
                    ? 'bg-purple-600/20 border-purple-500 text-purple-200'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                မြန်မာအသံသီးသန့် (Narration Only)
              </button>

              <button
                onClick={() => setIsOriginalMuted(!isOriginalMuted)}
                className={`p-2 rounded-lg border transition cursor-pointer ${
                  isOriginalMuted
                    ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
                title="မူရင်းတရုတ်အသံ ပိတ်/ဖွင့်"
              >
                {isOriginalMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Status Indicators & Audio Volume Mixer */}
        <div className="space-y-4">
          {/* 6 Real-Time Live Status Indicators Panel */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" />
              <span>တိုက်ရိုက် လုပ်ငန်းစဉ် အခြေအနေ (Live Pipeline)</span>
            </h2>

            <div className="space-y-2 text-xs">
              {/* 1. Listening to Chinese audio */}
              <div
                className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                  indicators.listening
                    ? 'bg-indigo-950/40 border-indigo-500 text-indigo-200 shadow-sm'
                    : 'bg-slate-950/40 border-slate-800/80 text-slate-400'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Headphones className="w-4 h-4 text-indigo-400" />
                  <span>၁။ တရုတ်အသံ နားထောင်နေသည်</span>
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    indicators.listening ? 'bg-indigo-400 animate-ping' : 'bg-slate-700'
                  }`}
                />
              </div>

              {/* 2. Recognizing Chinese speech */}
              <div
                className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                  indicators.speechRecog
                    ? 'bg-purple-950/40 border-purple-500 text-purple-200 shadow-sm'
                    : 'bg-slate-950/40 border-slate-800/80 text-slate-400'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-purple-400" />
                  <span>၂။ တရုတ်စကားပြော မှတ်သားနေသည်</span>
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    indicators.speechRecog ? 'bg-purple-400 animate-pulse' : 'bg-slate-700'
                  }`}
                />
              </div>

              {/* 3. Reading Chinese Subtitles (OCR) */}
              <div
                className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                  indicators.ocr
                    ? 'bg-cyan-950/40 border-cyan-500 text-cyan-200 shadow-sm'
                    : 'bg-slate-950/40 border-slate-800/80 text-slate-400'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Subtitles className="w-4 h-4 text-cyan-400" />
                  <span>၃။ တရုတ်စာတန်း ဖတ်ရှုနေသည် (OCR)</span>
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    indicators.ocr ? 'bg-cyan-400 animate-pulse' : 'bg-slate-700'
                  }`}
                />
              </div>

              {/* 4. Translating into Burmese */}
              <div
                className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                  indicators.translating
                    ? 'bg-amber-950/40 border-amber-500 text-amber-200 shadow-sm'
                    : 'bg-slate-950/40 border-slate-800/80 text-slate-400'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Languages className="w-4 h-4 text-amber-400" />
                  <span>၄။ မြန်မာဘာသာသို့ ပြန်ဆိုနေသည်</span>
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    indicators.translating ? 'bg-amber-400 animate-ping' : 'bg-slate-700'
                  }`}
                />
              </div>

              {/* 5. Generating Burmese Voice */}
              <div
                className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                  indicators.voiceGen
                    ? 'bg-teal-950/40 border-teal-500 text-teal-200 shadow-sm'
                    : 'bg-slate-950/40 border-slate-800/80 text-slate-400'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-teal-400" />
                  <span>၅။ မြန်မာ AI အသံ ထွက်ဆိုနေသည်</span>
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    indicators.voiceGen ? 'bg-teal-400 animate-pulse' : 'bg-slate-700'
                  }`}
                />
              </div>

              {/* 6. Playing Burmese Narration */}
              <div
                className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                  indicators.playing
                    ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200 shadow-sm'
                    : 'bg-slate-950/40 border-slate-800/80 text-slate-400'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  <span>၆။ မြန်မာဇာတ်ကြောင်းပြော ဖွင့်နေသည်</span>
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    indicators.playing ? 'bg-emerald-400 animate-pulse' : 'bg-slate-700'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Real-Time Audio Mixer */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-purple-400" />
              <span>အသံချိန်ညှိမှု ကွန်ဆိုးလ် (Audio Mixer)</span>
            </h2>

            {/* Original Chinese Audio Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">မူရင်း တရုတ်အသံ:</span>
                <span className="font-bold text-slate-300">
                  {isOriginalMuted || narrationOnly ? '0% (ပိတ်ထား)' : `${Math.round(originalVolume * 100)}%`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                disabled={isOriginalMuted || narrationOnly}
                value={isOriginalMuted || narrationOnly ? 0 : originalVolume}
                onChange={(e) => setOriginalVolume(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            {/* Burmese Narration Volume Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-purple-300">မြန်မာ AI ဇာတ်ကြောင်းပြော အသံ:</span>
                <span className="font-bold text-purple-400">{Math.round(narrationVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={narrationVolume}
                onChange={(e) => setNarrationVolume(parseFloat(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>

            {/* Burmese Voice Selection */}
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <span className="text-xs font-semibold text-slate-400">အသံ ရွေးချယ်မှု</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setVoiceId('my-MM-NilarNeural')}
                  className={`p-2 rounded-lg border transition cursor-pointer text-center ${
                    voiceId === 'my-MM-NilarNeural'
                      ? 'bg-purple-600/20 border-purple-500 text-purple-200 font-bold'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400'
                  }`}
                >
                  နီလာ (မိန်းကလေး)
                </button>
                <button
                  type="button"
                  onClick={() => setVoiceId('my-MM-ThihaNeural')}
                  className={`p-2 rounded-lg border transition cursor-pointer text-center ${
                    voiceId === 'my-MM-ThihaNeural'
                      ? 'bg-purple-600/20 border-purple-500 text-purple-200 font-bold'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400'
                  }`}
                >
                  သီဟ (ယောက်ျားလေး)
                </button>
              </div>
            </div>

            {/* Live Speaking Speed */}
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-400 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-purple-400" />
                  <span>အသံအမြန်နှုန်း (Speed)</span>
                </span>
                <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold text-[10px]">
                  {speakingRate}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                {SPEAKING_SPEED_OPTIONS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSetSpeakingRate(s.id)}
                    className={`py-1.5 px-2 rounded-lg border text-center transition cursor-pointer text-[11px] ${
                      speakingRate === s.id
                        ? 'bg-purple-600/30 border-purple-500 text-purple-200 font-bold'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {s.id}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Stream Dual Feed (Chinese spoken text & Burmese translation stream) */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Languages className="w-4 h-4 text-purple-400" />
              <span>တိုက်ရိုက် စကားပြော & ဇာတ်ကြောင်းပြန်ပြချက် မှတ်တမ်း (Live Dual Feed)</span>
            </h2>
            <p className="text-xs text-slate-400">
              တရုတ်စကားပြောများကို မှတ်သားပြီး တစ်ပြိုင်နက်တည်း ထွက်ပေါ်လာသော မြန်မာဇာတ်ကြောင်းပြော စာသားများ
            </p>
          </div>

          <span className="text-xs text-purple-300 font-semibold">
            စုစုပေါင်း: {liveSubtitles.length} ခု
          </span>
        </div>

        {liveSubtitles.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            တိုက်ရိုက်စတင်ရန် "တိုက်ရိုက် Live စတင်မည်" ခလုတ်ကို နှိပ်ပါ
          </div>
        ) : (
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {liveSubtitles.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-purple-500/40 transition"
              >
                <div className="space-y-1 flex-1">
                  {item.chineseText && (
                    <p className="text-slate-400 font-sans flex items-center gap-1.5">
                      <span className="text-[10px] text-indigo-400 font-mono font-bold">CN:</span>
                      <span>{item.chineseText}</span>
                    </p>
                  )}
                  <p className="text-purple-200 font-semibold flex items-center gap-1.5 leading-relaxed">
                    <span className="text-[10px] text-purple-400 font-mono font-bold">MM:</span>
                    <span>{item.burmeseText}</span>
                  </p>
                </div>

                <span className="text-[10px] text-slate-500 font-mono sm:self-center self-start">
                  [{Math.floor(item.startTime / 60)}:{String(Math.floor(item.startTime % 60)).padStart(2, '0')}]
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
