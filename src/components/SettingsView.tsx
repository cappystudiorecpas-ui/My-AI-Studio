import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings as SettingsIcon, 
  Key, 
  Volume2, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Play, 
  Pause,
  Save, 
  RefreshCw,
  Info,
  Layers,
  Cpu,
  Mic,
  Clock,
  ShieldCheck,
  FileAudio,
  Gauge,
} from 'lucide-react';
import { SpeechSegment } from '../../server/types';
import { SPEAKING_SPEED_OPTIONS, DEFAULT_SPEED_ID, getSpeedOption } from '../utils/speed';

interface SettingsViewProps {
  groqApiKey: string;
  onSaveGroqApiKey: (key: string) => void;
}

interface GroqStatus {
  isAvailable: boolean;
  maskedKey: string | null;
  model: string;
  language: string;
}

interface GroqTestResult {
  success: boolean;
  model: string;
  language: string;
  text: string;
  duration: number;
  segments: SpeechSegment[];
  error?: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  groqApiKey,
  onSaveGroqApiKey,
}) => {
  const [localKey, setLocalKey] = useState(groqApiKey);
  const [savingKey, setSavingKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Groq Server Verification State
  const [groqStatus, setGroqStatus] = useState<GroqStatus | null>(null);
  const [verifyingStatus, setVerifyingStatus] = useState(false);

  // Real Groq Connection Test state
  const [isTestingGroq, setIsTestingGroq] = useState(false);
  const [groqTestResult, setGroqTestResult] = useState<GroqTestResult | null>(null);
  const [groqTestError, setGroqTestError] = useState<string | null>(null);

  // Test Chinese Sample Audio Playback
  const [isPlayingSample, setIsPlayingSample] = useState(false);
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);

  // Voice Test state
  const [testVoice, setTestVoice] = useState('my-MM-NilarNeural');
  const [testRate, setTestRate] = useState<string>(() => {
    try {
      return localStorage.getItem('MYAI_SPEAKING_RATE') || DEFAULT_SPEED_ID;
    } catch {
      return DEFAULT_SPEED_ID;
    }
  });

  const handleSetTestRate = (rateId: string) => {
    setTestRate(rateId);
    try {
      localStorage.setItem('MYAI_SPEAKING_RATE', rateId);
    } catch {}
  };
  const [testText, setTestText] = useState('မင်္ဂလာပါ၊ My AI Studio တရုတ်ရုပ်ရှင် ဇာတ်လမ်းပြန်ပြော စနစ်မှ ကြိုဆိုပါတယ်။');
  const [testingAudio, setTestingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Health data
  const [health, setHealth] = useState<any>(null);

  // Verify Groq Status on server
  const fetchGroqStatus = async () => {
    try {
      setVerifyingStatus(true);
      const res = await fetch('/api/groq/verify');
      if (res.ok) {
        const data = await res.json();
        setGroqStatus(data);
      }
    } catch (err) {
      console.error('Groq status check failed:', err);
    } finally {
      setVerifyingStatus(false);
    }
  };

  useEffect(() => {
    fetchGroqStatus();
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setHealth(data))
      .catch((err) => console.error(err));
  }, []);

  // Save Key to Server
  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localKey.trim()) return;

    try {
      setSavingKey(true);
      const res = await fetch('/api/groq/save-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: localKey.trim() }),
      });

      if (res.ok) {
        onSaveGroqApiKey(localKey.trim());
        setSavedSuccess(true);
        await fetchGroqStatus();
        setTimeout(() => setSavedSuccess(false), 3500);
      } else {
        const data = await res.json();
        alert(data.error || 'Groq API Key သိမ်းဆည်းခြင်း မအောင်မြင်ပါ');
      }
    } catch (err: any) {
      alert(err.message || 'ဆာဗာသို့ ချိတ်ဆက်၍ မရပါ');
    } finally {
      setSavingKey(false);
    }
  };

  // Run Real Groq Connection Test with Short Chinese Audio
  const handleTestGroqConnection = async () => {
    try {
      setIsTestingGroq(true);
      setGroqTestError(null);
      setGroqTestResult(null);

      const res = await fetch('/api/groq/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groqApiKey: localKey.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setGroqTestError(data.error || 'Groq Whisper API စစ်ဆေးမှု မအောင်မြင်ပါ');
      } else {
        setGroqTestResult(data);
        await fetchGroqStatus();
      }
    } catch (err: any) {
      setGroqTestError(err.message || 'ကွန်ရက် ချိတ်ဆက်မှု အမှားဖြစ်ပေါ်ခဲ့သည်');
    } finally {
      setIsTestingGroq(false);
    }
  };

  // Toggle playing test Chinese audio sample
  const handleTogglePlaySample = () => {
    if (!sampleAudioRef.current) return;
    if (isPlayingSample) {
      sampleAudioRef.current.pause();
      setIsPlayingSample(false);
    } else {
      sampleAudioRef.current.play().then(() => {
        setIsPlayingSample(true);
      }).catch(console.warn);
    }
  };

  const handlePlayTestAudio = async () => {
    try {
      setTestingAudio(true);
      const res = await fetch('/api/voices/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceId: testVoice,
          rate: testRate,
          sampleText: testText,
        }),
      });

      if (!res.ok) throw new Error('အသံထုတ်လုပ်မှု မအောင်မြင်ပါ');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setTestingAudio(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16 font-['Noto_Sans_Myanmar','Padauk',sans-serif]">
      <audio ref={audioRef} className="hidden" />
      <audio 
        ref={sampleAudioRef} 
        src="/api/groq/sample-audio" 
        onEnded={() => setIsPlayingSample(false)}
        className="hidden" 
      />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-purple-400" />
          <span>စနစ် ဆက်တင်များနှင့် AI အင်ဂျင်များ (Settings)</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Groq Whisper Large V3၊ Google Gemini API နှင့် မြန်မာ AI အသံထွက် စနစ်များအား ချိတ်ဆက် စစ်ဆေးခြင်း
        </p>
      </div>

      {/* Engine Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Gemini Engine */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Story AI & OCR</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <h3 className="font-bold text-white text-base">Google Gemini API</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Gemini 3.8 Flash ဖြင့် တရုတ်ဇာတ်လမ်းကို နားလည်ပြီး မျက်နှာပြင် စာတန်းများကို OCR ဖြင့် ဖတ်ရှုကာ မြန်မာဇာတ်ညွှန်း ရေးသားပေးသည်။
          </p>
          <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2 text-xs text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>GEMINI_API_KEY ချိတ်ဆက်ထားပြီး</span>
          </div>
        </div>

        {/* Groq Whisper Engine */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Speech to Text</span>
            <span className={`w-2.5 h-2.5 rounded-full ${groqStatus?.isAvailable ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          </div>
          <h3 className="font-bold text-white text-base">Groq Whisper Large V3</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            တရုတ်စကားပြောများကို whisper-large-v3 ဖြင့် နားထောင်ပြီး အချိန်ကိုက် Timestamps များနှင့်တကွ တိကျစွာ မှတ်သားပေးသည်။
          </p>
          <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2 text-xs">
            {groqStatus?.isAvailable ? (
              <span className="text-emerald-400 flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>GROQ_API_KEY ချိတ်ဆက်ပြီး ({groqStatus.maskedKey})</span>
              </span>
            ) : (
              <span className="text-amber-400 flex items-center gap-1.5 font-semibold">
                <AlertCircle className="w-4 h-4" />
                <span>GROQ_API_KEY ဆာဗာတွင် မရှိသေးပါ</span>
              </span>
            )}
          </div>
        </div>

        {/* Burmese Neural TTS */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Burmese Voice</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <h3 className="font-bold text-white text-base">Burmese Neural TTS</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            မြန်မာသဘာဝစကားပြောအသံ (နီလာ & သီဟ) ဖြင့် ရုပ်ရှင်ပြန်ပြောပြချက် အသံဖိုင်ကို စက္ကန့်ပိုင်းအတွင်း ဖန်တီးပေးသည်။
          </p>
          <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2 text-xs text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>အသင့် အသုံးပြုနိုင်သည်</span>
          </div>
        </div>
      </div>

      {/* GROQ WHISPER INTEGRATION & VERIFICATION PANEL */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-950/30 via-slate-900 to-slate-900 border border-indigo-900/50 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-950 pb-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Mic className="w-5 h-5 text-indigo-400" />
              <span>Groq Whisper Large V3 စနစ် ချိတ်ဆက်စစ်ဆေးခြင်း</span>
            </h2>
            <p className="text-xs text-slate-400">
              တရုတ်စကားပြောများကို တိကျမြန်ဆန်စွာ စာသားပြောင်းရန် တရားဝင် Groq JavaScript SDK ဖြင့် ချိတ်ဆက်ထားပါသည်။
            </p>
          </div>

          <button
            onClick={fetchGroqStatus}
            disabled={verifyingStatus}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition cursor-pointer self-start sm:self-auto disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${verifyingStatus ? 'animate-spin' : ''}`} />
            <span>အခြေအနေ ပြန်စစ်မည်</span>
          </button>
        </div>

        {/* Server Secret Status Banner */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              groqStatus?.isAvailable 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
            }`}>
              <ShieldCheck className="w-5 h-5" />
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-200">
                ဆာဗာ GROQ_API_KEY လုံခြုံရေး အခြေအနေ
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {groqStatus?.isAvailable ? (
                  <span className="text-emerald-400 font-mono">
                    ချိတ်ဆက်ထားသည်: {groqStatus.maskedKey} (Whisper Model: {groqStatus.model})
                  </span>
                ) : (
                  <span className="text-amber-400">
                    GROQ_API_KEY ကို ဆာဗာတွင် မတွေ့ရှိရသေးပါ (အောက်တွင် သော့ထည့်သွင်းပေးပါ)
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTogglePlaySample}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 text-xs font-medium border border-purple-500/30 transition cursor-pointer"
            >
              {isPlayingSample ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlayingSample ? 'တရုတ်အသံ ရပ်မည်' : 'စမ်းသပ်အသံ နားထောင်မည် (6.2s)'}</span>
            </button>
          </div>
        </div>

        {/* API Key Input Form */}
        <form onSubmit={handleSaveKey} className="space-y-3">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
            <Key className="w-4 h-4 text-indigo-400" />
            <span>Groq API Key (gsk_...)</span>
          </label>

          <div className="flex flex-col sm:flex-row items-center gap-2">
            <input
              type="password"
              value={localKey}
              onChange={(e) => setLocalKey(e.target.value)}
              placeholder="gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="flex-1 w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:outline-none text-white text-xs font-mono"
            />
            <button
              type="submit"
              disabled={savingKey || !localKey.trim()}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{savingKey ? 'သိမ်းဆည်းနေပါသည်...' : 'ဆာဗာတွင် သိမ်းဆည်းမည်'}</span>
            </button>
          </div>

          {savedSuccess && (
            <p className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              <span>Groq API Key ကို ဆာဗာတွင် လုံခြုံစွာ သိမ်းဆည်းပြီးပါပြီ</span>
            </p>
          )}
        </form>

        {/* Real Test Connection Action */}
        <div className="pt-2 border-t border-slate-800/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                အစစ်အမှန် တရုတ်အသံဖိုင်ဖြင့် စမ်းသပ်စစ်ဆေးခြင်း (Live Test with Real Audio)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                ဆာဗာရှိ တရုတ်အသံဖိုင်ကို Groq Whisper Large V3 (`language: zh`, `verbose_json`) သို့ ပေးပို့ပြီး တိုက်ရိုက် စာသားပြောင်းစစ်ဆေးမည်
              </p>
            </div>

            <button
              onClick={handleTestGroqConnection}
              disabled={isTestingGroq}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 ${isTestingGroq ? 'animate-spin' : ''}`} />
              <span>{isTestingGroq ? 'Groq Whisper စမ်းသပ်နေပါသည်...' : 'Groq API ချိတ်ဆက်မှု စမ်းသပ်မည်'}</span>
            </button>
          </div>

          {/* REAL LOADING STATE */}
          {isTestingGroq && (
            <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/40 space-y-2 animate-pulse">
              <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Groq Whisper Large V3 သို့ တရုတ်အသံဖိုင် ပို့ဆောင်၍ စကားပြော မှတ်သားနေပါသည်...</span>
              </div>
              <p className="text-[11px] text-slate-400">
                တောင်းဆိုမှုပုံစံ: Model: whisper-large-v3 • Language: zh • Response Format: verbose_json • Granularity: segment
              </p>
            </div>
          )}

          {/* REAL ERROR STATE WITH RETRY */}
          {groqTestError && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 text-xs">
                  <p className="font-bold text-rose-300">Groq Whisper ချိတ်ဆက်မှု အမှားဖြစ်ပေါ်ခဲ့သည်</p>
                  <p className="text-rose-200 mt-1 font-mono">{groqTestError}</p>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={handleTestGroqConnection}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>ပြန်လည်စမ်းသပ်မည် (Retry)</span>
                </button>
              </div>
            </div>
          )}

          {/* REAL ACTUAL TRANSCRIPTION RESULT */}
          {groqTestResult && groqTestResult.success && (
            <div className="p-5 rounded-xl bg-slate-950 border border-emerald-500/40 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="font-bold text-emerald-300 text-xs sm:text-sm">
                    Groq Whisper Large V3 အောင်မြင်စွာ စာသားပြောင်းပြီးပါပြီ (Actual Transcription)
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                    Model: {groqTestResult.model}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                    Lang: {groqTestResult.language}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                    Duration: {groqTestResult.duration.toFixed(2)}s
                  </span>
                </div>
              </div>

              {/* Full Chinese Transcription Text */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  မှတ်သားရရှိသော တရုတ်စာသား အပြည့်အစုံ (Transcribed Chinese Text):
                </label>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs sm:text-sm text-white font-sans leading-relaxed">
                  {groqTestResult.text}
                </div>
              </div>

              {/* Segment Timestamps Breakdown */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>အပိုင်းလိုက် အချိန်မှတ်တမ်းများ (Segment Timestamps):</span>
                </label>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {groqTestResult.segments.map((seg) => (
                    <div
                      key={seg.id}
                      className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <span className="text-slate-200 font-sans">{seg.text}</span>
                      <span className="text-indigo-400 font-mono text-[11px] font-semibold whitespace-nowrap ml-3">
                        [{seg.start.toFixed(2)}s - {seg.end.toFixed(2)}s]
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Burmese Neural Voice Playground */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-purple-400" />
            <span>မြန်မာ AI သဘာဝအသံ စမ်းသပ်စစ်ဆေးရန် (Burmese Voice Playground)</span>
          </h2>
          <p className="text-xs text-slate-400">
            မြန်မာစကားပြော အသံအရည်အသွေးကို ဤနေရာတွင် တိုက်ရိုက် စမ်းသပ်နားထောင်နိုင်ပါသည်။
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">အသံ ရွေးချယ်မှု</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'my-MM-NilarNeural', name: 'နီလာ (မိန်းကလေးအသံ)' },
                { id: 'my-MM-ThihaNeural', name: 'သီဟ (ယောက်ျားလေးအသံ)' },
              ].map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setTestVoice(v.id)}
                  className={`p-3 rounded-xl border text-left text-xs transition cursor-pointer ${
                    testVoice === v.id
                      ? 'bg-purple-600/20 border-purple-500 text-purple-200 font-bold'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400'
                  }`}
                >
                  {v.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-purple-400" />
                <span>အသံအမြန်နှုန်း (Speaking Speed)</span>
              </label>
              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[11px] font-bold border border-purple-500/40">
                {testRate}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span className="font-semibold text-purple-300">
                {getSpeedOption(testRate).label}
              </span>
              <span className="text-[10px] text-emerald-400">
                {getSpeedOption(testRate).description}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {SPEAKING_SPEED_OPTIONS.map((s) => {
                const isSelected = testRate === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSetTestRate(s.id)}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer relative ${
                      isSelected
                        ? 'bg-purple-600/30 border-purple-400 text-white shadow-lg ring-1 ring-purple-400'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-extrabold ${isSelected ? 'text-purple-200' : 'text-slate-200'}`}>
                        {s.id}
                      </span>
                      {s.badge && (
                        <span className={`text-[9px] px-1 py-0.2 rounded font-semibold ${isSelected ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                          {s.badge}
                        </span>
                      )}
                    </div>
                    <p className={`text-[10px] mt-0.5 truncate ${isSelected ? 'text-purple-300 font-semibold' : 'text-slate-500'}`}>
                      {s.burmeseName}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300">စမ်းသပ်မည့် မြန်မာစာသား</label>
          <textarea
            rows={3}
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:border-purple-500 focus:outline-none leading-relaxed"
          />
        </div>

        <button
          onClick={handlePlayTestAudio}
          disabled={testingAudio}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-purple-600/20 cursor-pointer disabled:opacity-50"
        >
          <Play className="w-4 h-4" />
          <span>{testingAudio ? 'အသံထုတ်လုပ်နေသည်...' : 'အသံ စမ်းသပ်နားထောင်မည်'}</span>
        </button>
      </div>

      {/* Font & Rendering System Info */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 text-xs text-slate-400 leading-relaxed">
        <h3 className="font-bold text-white text-sm flex items-center gap-2">
          <Cpu className="w-4 h-4 text-purple-400" />
          <span>မြန်မာယူနီကုဒ် ဖောင့်နှင့် FFmpeg စာတန်းထိုးစနစ်</span>
        </h3>
        <p>
          ဆာဗာတွင် Noto Sans Myanmar ဖောင့်ကို ထည့်သွင်းထားပြီး FFmpeg ၏ HarfBuzz-ng / FriBidi complex text shaping စနစ်ဖြင့် စာတန်းများကို ဗီဒီယိုပေါ်တွင် အက္ခရာဆင့်များနှင့် သရများ အမှားအယွင်းမရှိ ကြည်လင်ပြတ်သားစွာ ရေးထိုးပေးပါသည်။
        </p>
      </div>
    </div>
  );
};
