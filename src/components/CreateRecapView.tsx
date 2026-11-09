import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileVideo, 
  X, 
  Sparkles, 
  Volume2, 
  Play, 
  Sliders, 
  Check, 
  AlertCircle,
  HelpCircle,
  Gauge,
  Zap,
} from 'lucide-react';
import { ProjectSettings } from '../../server/types';
import { SPEAKING_SPEED_OPTIONS, DEFAULT_SPEED_ID, getSpeedOption } from '../utils/speed';

interface CreateRecapViewProps {
  onUploadSuccess: (project: any) => void;
  onStartDemo: () => void;
  loadingDemo?: boolean;
}

export const CreateRecapView: React.FC<CreateRecapViewProps> = ({
  onUploadSuccess,
  onStartDemo,
  loadingDemo = false,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Settings
  const [recapLength, setRecapLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [ttsVoice, setTtsVoice] = useState<'my-MM-NilarNeural' | 'my-MM-ThihaNeural'>('my-MM-NilarNeural');
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
  const [originalAudioVolume, setOriginalAudioVolume] = useState<number>(0.15);
  const [burnSubtitles, setBurnSubtitles] = useState(true);

  // Preview voice state
  const [previewingVoice, setPreviewingVoice] = useState(false);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleValidateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleValidateAndSetFile = (selectedFile: File) => {
    setErrorMessage(null);
    const validExtensions = ['.mp4', '.mov', '.mkv', '.avi', '.webm'];
    const fileName = selectedFile.name.toLowerCase();
    const isValid = validExtensions.some((ext) => fileName.endsWith(ext)) || selectedFile.type.startsWith('video/');

    if (!isValid) {
      setErrorMessage('ထောက်ပံ့မထားသော ဖိုင်အမျိုးအစားဖြစ်ပါသည် (MP4, MOV, MKV, AVI, WebM သာ လက်ခံပါသည်)');
      return;
    }

    if (selectedFile.size > 1024 * 1024 * 1024) {
      setErrorMessage('ဖိုင်အရွယ်အစား 1GB ထက် မကျော်လွန်ရပါ');
      return;
    }

    setFile(selectedFile);
    if (!title) {
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handlePlayVoicePreview = async (voiceId: string, rateOverride?: string) => {
    try {
      setPreviewingVoice(true);
      const targetRate = rateOverride || speakingRate;
      const res = await fetch('/api/voices/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId, rate: targetRate }),
      });
      if (!res.ok) throw new Error('အသံစမ်းသပ်မှု မအောင်မြင်ပါ');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioPreviewRef.current) {
        audioPreviewRef.current.src = url;
        audioPreviewRef.current.play();
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setPreviewingVoice(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMessage('ကျေးဇူးပြု၍ တရုတ်ဗီဒီယိုဖိုင်တစ်ခု ရွေးချယ်ပါ');
      return;
    }

    setUploading(true);
    setUploadProgress(10);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('video', file);
    formData.append('title', title || file.name.replace(/\.[^/.]+$/, ''));
    formData.append('recapLength', recapLength);
    formData.append('ttsVoice', ttsVoice);
    formData.append('speakingRate', speakingRate);
    formData.append('originalAudioVolume', String(originalAudioVolume));
    formData.append('burnSubtitles', String(burnSubtitles));

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/projects/upload');

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          const percent = Math.round((evt.loaded / evt.total) * 90);
          setUploadProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const project = JSON.parse(xhr.responseText);
          setUploadProgress(100);
          onUploadSuccess(project);
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            setErrorMessage(err.error || 'ဗီဒီယို အပ်လုဒ်တင်ခြင်း မအောင်မြင်ပါ');
          } catch {
            setErrorMessage('ဗီဒီယို အပ်လုဒ်တင်ခြင်း မအောင်မြင်ပါ');
          }
          setUploading(false);
        }
      };

      xhr.onerror = () => {
        setErrorMessage('ဆာဗာသို့ ချိတ်ဆက်မှု မအောင်မြင်ပါ');
        setUploading(false);
      };

      xhr.send(formData);
    } catch (err: any) {
      setErrorMessage(err.message || 'ဗီဒီယို အပ်လုဒ်တင်စဉ် အမှားအယွင်း ဖြစ်ပေါ်ခဲ့သည်');
      setUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      <audio ref={audioPreviewRef} className="hidden" />

      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <span>တရုတ်ဗီဒီယိုမှ မြန်မာဇာတ်လမ်းပြန်ပြော ဖန်တီးမည်</span>
          <Sparkles className="w-6 h-6 text-purple-400" />
        </h1>
        <p className="text-sm text-slate-400">
          တရုတ်ရုပ်ရှင် သို့မဟုတ် ဇာတ်လမ်းတို ဗီဒီယိုကို တင်သွင်းပါ။ AI မှ အသံနှင့် စာတန်းများကို နားလည်ပြီး ဆွဲဆောင်မှုရှိသော မြန်မာဇာတ်လမ်းပြန်ပြော ဗီဒီယို ထုတ်လုပ်ပေးပါမည်။
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
          <div className="flex-1">
            <p className="font-semibold">သတိပေးချက်</p>
            <p>{errorMessage}</p>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* File Upload Dropzone */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-200">
            ၁။ တရုတ်ဗီဒီယိုဖိုင် တင်သွင်းရန် <span className="text-rose-400">*</span>
          </label>

          {!file ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-purple-400 bg-purple-950/20 scale-[0.99]'
                  : 'border-slate-700/80 hover:border-purple-500/60 bg-slate-900/40 hover:bg-slate-900/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/x-matroska,video/avi,video/webm,.mp4,.mov,.mkv,.avi,.webm"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleValidateAndSetFile(e.target.files[0]);
                  }
                }}
              />

              <div className="max-w-md mx-auto space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-purple-600/10 border border-purple-500/30 flex items-center justify-center mx-auto text-purple-400">
                  <Upload className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <p className="text-base font-semibold text-white">
                    ဗီဒီယိုဖိုင်ကို ဤနေရာတွင် ဆွဲထည့်ပါ (သို့မဟုတ်) နှိပ်၍ ရွေးချယ်ပါ
                  </p>
                  <p className="text-xs text-slate-400">
                    MP4, MOV, MKV, AVI, WebM ဖိုင်များကို လက်ခံပါသည် (အများဆုံး 1GB)
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-center gap-3">
                  <span className="text-xs text-slate-500">သို့မဟုတ် ဖိုင်မရှိသေးပါက</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartDemo();
                    }}
                    disabled={loadingDemo}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 transition cursor-pointer"
                  >
                    <Play className="w-3 h-3 text-purple-400" />
                    <span>နမူနာ စမ်းသပ်ဗီဒီယို အသုံးပြုမည်</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-slate-900 border border-purple-800/40 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 flex-shrink-0">
                  <FileVideo className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate text-sm sm:text-base">{file.name}</p>
                  <p className="text-xs text-slate-400">
                    အရွယ်အစား: {(file.size / (1024 * 1024)).toFixed(2)} MB • အမျိုးအစား: {file.type || 'video'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                >
                  အသစ်လဲမည်
                </button>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                  aria-label="Remove"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Project Title */}
        <div className="space-y-2">
          <label htmlFor="title" className="block text-sm font-medium text-slate-200">
            ၂။ ပရောဂျက် ခေါင်းစဉ် (Project Title)
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ဥပမာ - မင်းဆက်တစ်ခု၏ လျှို့ဝှက်ချက် ရုပ်ရှင်ဇာတ်လမ်းပြန်ပြော"
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-purple-500 focus:outline-none text-white text-sm"
          />
        </div>

        {/* Recap Customization Settings */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-6">
          <h2 className="text-base font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Sliders className="w-4 h-4 text-purple-400" />
            <span>၃။ ဇာတ်လမ်းပြန်ပြောပြချက်နှင့် အသံ ဆက်တင်များ ရွေးချယ်ရန်</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Recap Length */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                ပြန်ပြောပြချက် အရှည်ရွေးချယ်မှု (Recap Length)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'short', label: 'တိုတိုတုတ်တုတ်', sub: '~၁-၂ မိနစ်' },
                  { id: 'medium', label: 'အလယ်အလတ်', sub: '~၃-၄ မိနစ်' },
                  { id: 'long', label: 'အသေးစိတ်', sub: '~၅-၇ မိနစ်' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setRecapLength(opt.id as any)}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      recapLength === opt.id
                        ? 'bg-purple-600/20 border-purple-500 text-purple-200'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <p className="text-xs font-semibold">{opt.label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{opt.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Burmese TTS Voice */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  မြန်မာ AI သဘာဝအသံ (Burmese Voice)
                </label>
                <button
                  type="button"
                  onClick={() => handlePlayVoicePreview(ttsVoice)}
                  disabled={previewingVoice}
                  className="inline-flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 font-medium cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{previewingVoice ? 'အသံဖွင့်နေသည်...' : 'အသံစမ်းနားထောင်မည်'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'my-MM-NilarNeural', label: 'နီလာ (မိန်းကလေးအသံ)', desc: 'နူးညံ့ငြင်သာသော စကားပြော' },
                  { id: 'my-MM-ThihaNeural', label: 'သီဟ (ယောက်ျားလေးအသံ)', desc: 'တည်ငြိမ်ပြတ်သားသော စကားပြော' },
                ].map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setTtsVoice(v.id as any)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      ttsVoice === v.id
                        ? 'bg-purple-600/20 border-purple-500 text-purple-200'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <p className="text-xs font-semibold text-white">{v.label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{v.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Speaking Rate - 9 Options from 0.75x up to 3.00x Turbo */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-purple-400" />
                  <label className="text-xs font-semibold text-slate-300">
                    အသံထွက်ဆိုနှုန်း (Speaking Speed)
                  </label>
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[11px] font-bold border border-purple-500/40">
                    {speakingRate}
                  </span>
                </div>

                {/* Preview Speed button */}
                <button
                  type="button"
                  onClick={() => handlePlayVoicePreview(ttsVoice, speakingRate)}
                  disabled={previewingVoice}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50 text-purple-200 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                  title="ရွေးချယ်ထားသော အမြန်နှုန်းဖြင့် အသံကို စမ်းသပ်နားထောင်မည်"
                >
                  <Volume2 className="w-3.5 h-3.5 text-purple-400" />
                  <span>
                    {previewingVoice ? 'အသံထုတ်လုပ်နေသည်...' : `အမြန်နှုန်း (${speakingRate}) စမ်းသပ်နားထောင်မည်`}
                  </span>
                </button>
              </div>

              {/* Active speed description & pitch notice */}
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-purple-300">
                    {getSpeedOption(speakingRate).label}
                  </span>
                  <span className="text-slate-500 hidden sm:inline">•</span>
                  <span className="text-slate-400 hidden sm:inline">
                    {getSpeedOption(speakingRate).description}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-400 font-medium shrink-0 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>FFmpeg atempo pitch ထိန်းညှိထားသည်</span>
                </span>
              </div>

              {/* 9 Speed Cards Grid */}
              <div className="grid grid-cols-3 gap-2">
                {SPEAKING_SPEED_OPTIONS.map((s) => {
                  const isSelected = speakingRate === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSetSpeakingRate(s.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                        isSelected
                          ? 'bg-gradient-to-br from-purple-600/30 to-indigo-600/20 border-purple-400 text-white shadow-lg shadow-purple-950/50 ring-1 ring-purple-400'
                          : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-xs font-extrabold ${isSelected ? 'text-purple-200' : 'text-slate-200'}`}>
                          {s.id}
                        </span>
                        {s.badge && (
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                              isSelected
                                ? 'bg-purple-500 text-white'
                                : s.speed >= 2.5
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : s.speed >= 1.5
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {s.badge}
                          </span>
                        )}
                      </div>
                      <p className={`text-[10px] mt-0.5 truncate ${isSelected ? 'text-purple-300 font-semibold' : 'text-slate-500'}`}>
                        {s.burmeseName}
                      </p>
                      <p className="text-[9px] text-slate-500 hidden sm:block truncate">
                        {s.englishName}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Original Audio Mix */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                မူရင်းတရုတ်အသံ ချိန်ညှိမှု (Original Audio Mix)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val: 0, label: 'အသံပိတ်မည် (Mute)', desc: 'မြန်မာအသံသီးသန့်' },
                  { val: 0.15, label: 'နောက်ခံအသံ (15%)', desc: 'အသံတိုးတိုးထားမည်' },
                  { val: 1.0, label: 'မူရင်းအတိုင်း (100%)', desc: 'အသံပြည့်ထားမည်' },
                ].map((m) => (
                  <button
                    key={m.val}
                    type="button"
                    onClick={() => setOriginalAudioVolume(m.val)}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      originalAudioVolume === m.val
                        ? 'bg-purple-600/20 border-purple-500 text-purple-200'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400'
                    }`}
                  >
                    <p className="text-xs font-semibold">{m.label}</p>
                    <p className="text-[10px] text-slate-500">{m.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Subtitle Burn-In Toggle */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-slate-200">
                ဗီဒီယိုထဲသို့ မြန်မာစာတန်းများ တိုက်ရိုက်ထိုးမည် (Burn-in Subtitles)
              </p>
              <p className="text-xs text-slate-400">
                Noto Sans Myanmar ဖောင့်ဖြင့် အနားသတ်လိုင်းပါသော ကြည်လင်ပြတ်သားသည့် မြန်မာစာတန်းများကို ဗီဒီယိုတွင် ထည့်သွင်းပေးမည်။
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={burnSubtitles}
                onChange={(e) => setBurnSubtitles(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>
        </div>

        {/* Upload Progress Bar */}
        {uploading && (
          <div className="p-5 rounded-2xl bg-purple-950/30 border border-purple-800/50 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-purple-300 font-medium">ဗီဒီယိုဖိုင်ကို ဆာဗာသို့ တင်သွင်းနေပါသည်...</span>
              <span className="text-purple-400 font-bold">{uploadProgress}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-xs text-slate-400">
              တင်သွင်းပြီးပါက အသံခွဲထုတ်ခြင်း၊ စကားပြောမှတ်သားခြင်းနှင့် ဇာတ်လမ်းခွဲခြမ်းစိတ်ဖြာခြင်းတို့ကို အလိုအလျောက် စတင်ပါမည်။
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4">
          <button
            type="submit"
            disabled={!file || uploading}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-purple-600/30 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-5 h-5" />
            <span>{uploading ? 'ဖိုင်တင်နေပါသည်...' : 'ဇာတ်လမ်းပြန်ပြော ဗီဒီယို စတင်ဖန်တီးမည်'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
