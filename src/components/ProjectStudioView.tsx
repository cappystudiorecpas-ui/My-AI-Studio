import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Download, 
  FileText, 
  Subtitles, 
  Film, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Sparkles, 
  Volume2, 
  Edit3, 
  Save, 
  ArrowLeft,
  ChevronRight,
  Terminal,
  Languages,
  Users,
  Eye,
  Sliders,
  Gauge,
} from 'lucide-react';
import { Project, ProjectRecapScript, NarrationSegment } from '../../server/types';
import { SPEAKING_SPEED_OPTIONS, DEFAULT_SPEED_ID, getSpeedOption } from '../utils/speed';

interface ProjectStudioViewProps {
  projectId: string;
  onBack: () => void;
  groqApiKey?: string;
}

export const ProjectStudioView: React.FC<ProjectStudioViewProps> = ({
  projectId,
  onBack,
  groqApiKey,
}) => {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tabs for studio details
  const [activeTab, setActiveTab] = useState<'video' | 'script' | 'subtitles' | 'chinese' | 'logs'>('video');

  // Step 9 Script Editing state
  const [editableScript, setEditableScript] = useState<ProjectRecapScript | null>(null);
  const [isEditingScript, setIsEditingScript] = useState(false);
  const [savingScript, setSavingScript] = useState(false);
  const [approving, setApproving] = useState(false);

  // Re-render and Voice Speed state
  const [reRendering, setReRendering] = useState(false);
  const [audioMixVolume, setAudioMixVolume] = useState<number>(0.15);
  const [speakingRate, setSpeakingRate] = useState<string>('1.00x');
  const [ttsVoice, setTtsVoice] = useState<'my-MM-NilarNeural' | 'my-MM-ThihaNeural'>('my-MM-NilarNeural');
  const [previewingSpeed, setPreviewingSpeed] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch project details
  const fetchProject = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error('ပရောဂျက် ရှာမတွေ့ပါ');
      const data: Project = await res.json();
      setProject(data);
      if (data.recapScript && !editableScript) {
        setEditableScript(JSON.parse(JSON.stringify(data.recapScript)));
      }
      if (data.settings) {
        setAudioMixVolume(data.settings.originalAudioVolume ?? 0.15);
        setSpeakingRate(data.settings.speakingRate || '1.00x');
        setTtsVoice(data.settings.ttsVoice || 'my-MM-NilarNeural');
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || 'ဒေတာ ရယူခြင်း မအောင်မြင်ပါ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  // Auto-polling when project is in progress
  useEffect(() => {
    if (!project) return;
    const shouldPoll = project.status === 'processing' || project.status === 'uploaded';
    if (!shouldPoll) return;

    const interval = setInterval(() => {
      fetchProject();
    }, 2500);

    return () => clearInterval(interval);
  }, [project?.status, project?.currentStep]);

  // Handle Save Edited Script
  const handleSaveScript = async () => {
    if (!editableScript) return;
    try {
      setSavingScript(true);
      const res = await fetch(`/api/projects/${projectId}/script`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: editableScript }),
      });
      if (!res.ok) throw new Error('ဇာတ်ညွှန်း သိမ်းဆည်းခြင်း မအောင်မြင်ပါ');
      const updated = await res.json();
      setProject(updated);
      setIsEditingScript(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingScript(false);
    }
  };

  // Preview selected speed with Burmese voice
  const handlePreviewSpeed = async (rateToTest?: string) => {
    try {
      setPreviewingSpeed(true);
      const res = await fetch('/api/voices/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceId: ttsVoice,
          rate: rateToTest || speakingRate,
        }),
      });
      if (!res.ok) throw new Error('အသံစမ်းသပ်မှု မအောင်မြင်ပါ');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (previewAudioRef.current) {
        previewAudioRef.current.src = url;
        previewAudioRef.current.play();
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setPreviewingSpeed(false);
    }
  };

  // Handle Approve Script & Proceed (Step 10-13)
  const handleApproveAndProceed = async () => {
    try {
      setApproving(true);
      // First save if edited
      if (editableScript) {
        await fetch(`/api/projects/${projectId}/script`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ script: editableScript }),
        });
      }

      const res = await fetch(`/api/projects/${projectId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            speakingRate,
            ttsVoice,
            originalAudioVolume: audioMixVolume,
          },
        }),
      });

      if (!res.ok) throw new Error('အတည်ပြုခြင်း မအောင်မြင်ပါ');
      await fetchProject();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setApproving(false);
    }
  };

  // Handle Retry
  const handleRetry = async () => {
    try {
      setLoading(true);
      await fetch(`/api/projects/${projectId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groqApiKey }),
      });
      await fetchProject();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Re-render final video with new settings (adjust speed or mix)
  const handleReRender = async () => {
    try {
      setReRendering(true);
      const res = await fetch(`/api/projects/${projectId}/re-render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            speakingRate,
            ttsVoice,
            originalAudioVolume: audioMixVolume,
          },
        }),
      });
      if (!res.ok) throw new Error('ဗီဒီယို ပြန်လည်တည်းဖြတ်ခြင်း မအောင်မြင်ပါ');
      await fetchProject();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setReRendering(false);
    }
  };

  if (loading && !project) {
    return (
      <div className="py-24 text-center space-y-4">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-slate-300 text-sm">ပရောဂျက် ဒေတာများကို ရယူနေပါသည်...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4 max-w-lg mx-auto">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-white">ပရောဂျက် ဖွင့်၍မရပါ</h2>
        <p className="text-sm text-slate-400">{error || 'ပရောဂျက် မရှိတော့ပါ'}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium transition cursor-pointer"
        >
          နောက်သို့ ပြန်သွားမည်
        </button>
      </div>
    );
  }

  const isCompleted = project.status === 'completed';
  const isWaitingApproval = project.status === 'waiting_approval';
  const isFailed = project.status === 'failed';
  const isProcessing = project.status === 'processing';

  // 13 Workflow Steps list
  const stepsList = [
    { num: 1, title: 'ဗီဒီယို တင်သွင်းခြင်း' },
    { num: 2, title: 'ဗီဒီယို စစ်ဆေးခြင်း' },
    { num: 3, title: 'အသံလမ်းကြောင်း ခွဲထုတ်ခြင်း' },
    { num: 4, title: 'တရုတ်စကားပြော မှတ်သားခြင်း (Whisper)' },
    { num: 5, title: 'ဖရိမ်များ ထုတ်ယူခြင်း (Frames)' },
    { num: 6, title: 'တရုတ်စာတန်း ဖတ်ရှုခြင်း (OCR)' },
    { num: 7, title: 'ဇာတ်လမ်း နားလည်ခြင်း' },
    { num: 8, title: 'မြန်မာဇာတ်ညွှန်း ရေးသားခြင်း (Gemini)' },
    { num: 9, title: 'ဇာတ်ညွှန်း စစ်ဆေးအတည်ပြုခြင်း' },
    { num: 10, title: 'မြန်မာ AI သဘာဝအသံ ဖန်တီးခြင်း (TTS)' },
    { num: 11, title: 'အချိန်ကိုက် မြန်မာစာတန်းထိုးခြင်း (SRT)' },
    { num: 12, title: 'ဗီဒီယို ပေါင်းစပ်တည်းဖြတ်ခြင်း (FFmpeg)' },
    { num: 13, title: 'အပြီးသတ် MP4 ထုတ်လုပ်ပြီးစီးခြင်း' },
  ];

  return (
    <div className="space-y-6 pb-20">
      <audio ref={previewAudioRef} className="hidden" />

      {/* Top Bar Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/60 transition cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-white truncate max-w-md sm:max-w-xl">
                {project.title}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  isCompleted
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    : isWaitingApproval
                    ? 'bg-purple-500/10 text-purple-300 border-purple-500/30 animate-pulse'
                    : isProcessing
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                }`}
              >
                {isCompleted
                  ? 'အပြီးသတ် ထုတ်လုပ်ပြီး'
                  : isWaitingApproval
                  ? 'အဆင့် ၉ - ဇာတ်ညွှန်း အတည်ပြုရန်'
                  : isProcessing
                  ? `လုပ်ဆောင်နေဆဲ (${project.progress}%)`
                  : 'ချွတ်ယွင်းချက်'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              မူရင်းဖိုင်: {project.originalFilename} • ကြာချိန်: {Math.round(project.duration)} စက္ကန့် • အသံ: {project.settings.ttsVoice === 'my-MM-NilarNeural' ? 'နီလာ (မ)' : 'သီဟ (ကျား)'} • အမြန်နှုန်း: {project.settings.speakingRate || '1.00x'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isFailed && (
            <button
              onClick={handleRetry}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>လုပ်ငန်း ပြန်လည်စတင်မည်</span>
            </button>
          )}

          {isCompleted && (
            <a
              href={`/api/files/${project.id}/final_recap.mp4?download=1`}
              download={`${project.title}_burmese_recap.mp4`}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>MP4 ဗီဒီယို ဒေါင်းလုဒ်</span>
            </a>
          )}
        </div>
      </div>

      {/* 13-Step Horizontal Stepper Monitor */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-purple-900/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-0.5">
            <span className="text-xs text-purple-400 font-semibold uppercase tracking-wider">
              လုပ်ငန်း အဆင့်ဆင့် စောင့်ကြည့်ချက် ({project.currentStep}/13)
            </span>
            <p className="text-sm font-bold text-white flex items-center gap-2">
              <span>{project.currentStepTitle || 'လုပ်ဆောင်နေပါသည်...'}</span>
              {isProcessing && <span className="inline-block w-2 h-2 rounded-full bg-purple-400 animate-ping" />}
            </p>
          </div>
          <span className="text-lg font-extrabold text-purple-300">{project.progress}%</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              isCompleted
                ? 'bg-emerald-500'
                : isFailed
                ? 'bg-rose-500'
                : 'bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400'
            }`}
            style={{ width: `${project.progress}%` }}
          />
        </div>

        {/* Stepper items (compact on mobile, horizontal on desktop) */}
        <div className="overflow-x-auto pb-2 pt-1 scrollbar-thin">
          <div className="flex items-center gap-2 min-w-max">
            {stepsList.map((step) => {
              const isPast = project.currentStep > step.num || isCompleted;
              const isCurrent = project.currentStep === step.num && !isCompleted;

              return (
                <div
                  key={step.num}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    isPast
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : isCurrent
                      ? 'bg-purple-600/20 border-purple-500 text-purple-200 ring-1 ring-purple-400/50'
                      : 'bg-slate-950/40 border-slate-800/80 text-slate-500'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isPast
                        ? 'bg-emerald-500 text-slate-950'
                        : isCurrent
                        ? 'bg-purple-500 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isPast ? '✓' : step.num}
                  </span>
                  <span className="whitespace-nowrap">{step.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* STEP 9: SCRIPT REVIEW & APPROVAL CALLOUT (When waiting for approval) */}
      {isWaitingApproval && (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-950/70 via-indigo-950/60 to-slate-900 border-2 border-purple-500/70 shadow-xl shadow-purple-900/30 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>အဆင့် ၉ - ဇာတ်ညွှန်းနှင့် အသံအမြန်နှုန်း အတည်ပြုချက် လိုအပ်ပါသည်</span>
              </div>
              <h2 className="text-lg font-bold text-white">
                မြန်မာ ဇာတ်ကြောင်းပြော ဇာတ်ညွှန်းနှင့် စကားပြောနှုန်းကို အတည်ပြုပေးပါ
              </h2>
              <p className="text-xs text-slate-300">
                AI ရေးသားထားသော စာသားများကို အောက်ပါ Script တက်ဘ်တွင် တည်းဖြတ်နိုင်ပါသည်။ လိုအပ်သော အသံနှင့် အမြန်နှုန်းကို စမ်းသပ်နားထောင်ပြီး အတည်ပြုပါက MP4 ဗီဒီယိုကို ဆက်လက်ထုတ်လုပ်ပေးပါမည်။
              </p>
            </div>

            <button
              onClick={handleApproveAndProceed}
              disabled={approving}
              className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-purple-600/30 transition cursor-pointer disabled:opacity-50 shrink-0"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>{approving ? 'လုပ်ဆောင်နေပါသည်...' : 'အတည်ပြုပြီး အသံ/ဗီဒီယို ဖန်တီးမည်'}</span>
            </button>
          </div>

          {/* Voice & Speed Configuration Box before proceeding */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-white">
                  ဇာတ်ကြောင်းပြော အသံအမြန်နှုန်း (Speaking Speed)
                </span>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[11px] font-bold border border-purple-500/40">
                  {speakingRate}
                </span>
              </div>

              {/* Preview Speed button */}
              <button
                type="button"
                onClick={() => handlePreviewSpeed(speakingRate)}
                disabled={previewingSpeed}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-200 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              >
                <Volume2 className="w-3.5 h-3.5 text-purple-400" />
                <span>
                  {previewingSpeed ? 'အသံထုတ်လုပ်နေသည်...' : `အမြန်နှုန်း (${speakingRate}) စမ်းသပ်နားထောင်မည်`}
                </span>
              </button>
            </div>

            {/* 9 Speed Buttons */}
            <div className="grid grid-cols-3 sm:grid-cols-9 gap-1.5">
              {SPEAKING_SPEED_OPTIONS.map((s) => {
                const isSelected = speakingRate === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSpeakingRate(s.id)}
                    className={`p-2 rounded-lg border text-center transition cursor-pointer ${
                      isSelected
                        ? 'bg-purple-600/30 border-purple-400 text-white shadow ring-1 ring-purple-400'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <p className={`text-xs font-bold ${isSelected ? 'text-purple-200' : 'text-slate-300'}`}>{s.id}</p>
                    <p className={`text-[10px] truncate ${isSelected ? 'text-purple-300 font-semibold' : 'text-slate-500'}`}>{s.burmeseName}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('video')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'video'
              ? 'border-purple-500 text-purple-300 bg-purple-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Film className="w-4 h-4" />
          <span>{isCompleted ? 'အပြီးသတ် ဗီဒီယို (Final Video)' : 'မူရင်း ဗီဒီယို (Source Video)'}</span>
        </button>

        <button
          onClick={() => setActiveTab('script')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'script'
              ? 'border-purple-500 text-purple-300 bg-purple-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>မြန်မာ ဇာတ်ကြောင်းပြော စာသား (Script)</span>
        </button>

        <button
          onClick={() => setActiveTab('subtitles')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'subtitles'
              ? 'border-purple-500 text-purple-300 bg-purple-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Subtitles className="w-4 h-4" />
          <span>အချိန်ကိုက် စာတန်းများ (SRT)</span>
        </button>

        <button
          onClick={() => setActiveTab('chinese')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'chinese'
              ? 'border-purple-500 text-purple-300 bg-purple-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Languages className="w-4 h-4" />
          <span>မူရင်း တရုတ်စကားပြော & OCR</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'logs'
              ? 'border-purple-500 text-purple-300 bg-purple-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>လုပ်ငန်းမှတ်တမ်း ({project.logs.length})</span>
        </button>
      </div>

      {/* Tab 1: Video Player & Controls */}
      {activeTab === 'video' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="relative aspect-video rounded-2xl bg-black overflow-hidden border border-slate-800 shadow-2xl">
              <video
                ref={videoRef}
                src={
                  isCompleted
                    ? `/api/files/${project.id}/final_recap.mp4`
                    : `/api/files/${project.id}/video.mp4`
                }
                controls
                playsInline
                className="w-full h-full object-contain"
              />
            </div>

            {/* Video Controls & Download shortcuts */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-white">
                  {isCompleted
                    ? 'အပြီးသတ် မြန်မာဇာတ်လမ်းပြန်ပြော ဗီဒီယို (Final Rendered MP4)'
                    : 'တင်သွင်းထားသော မူရင်းဗီဒီယို (Original Video)'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {isCompleted
                    ? 'မြန်မာအသံထွက်နှင့် မြန်မာစာတန်းများကို Noto Sans Myanmar ဖောင့်ဖြင့် ထည့်သွင်းထားပါသည်'
                    : 'လုပ်ငန်းစဉ်များ ဆောင်ရွက်ပြီးပါက ဤနေရာတွင် အပြီးသတ် ဗီဒီယိုကို ကြည့်ရှုနိုင်ပါမည်'}
                </p>
              </div>

              {isCompleted && (
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/files/${project.id}/final_recap.mp4?download=1`}
                    download={`${project.title}_recap.mp4`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>MP4 ဒေါင်းလုဒ်</span>
                  </a>
                  <a
                    href={`/api/files/${project.id}/subtitles.srt?download=1`}
                    download={`${project.title}_subtitles.srt`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                  >
                    <Subtitles className="w-3.5 h-3.5" />
                    <span>SRT စာတန်း</span>
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Side Panel: Settings Adjustment & Downloads */}
          <div className="space-y-4">
            {/* Quick Export Downloads Box */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Download className="w-4 h-4 text-purple-400" />
                <span>ရလဒ်ဖိုင်များ ဒေါင်းလုဒ်ယူရန်</span>
              </h3>

              <div className="space-y-2">
                <a
                  href={isCompleted ? `/api/files/${project.id}/final_recap.mp4?download=1` : '#'}
                  onClick={(e) => !isCompleted && e.preventDefault()}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-medium transition ${
                    isCompleted
                      ? 'bg-purple-600/10 border-purple-500/40 text-purple-200 hover:bg-purple-600/20 cursor-pointer'
                      : 'bg-slate-950/40 border-slate-800/80 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Film className="w-4 h-4" />
                    <span>အပြီးသတ် MP4 ဗီဒီယို</span>
                  </span>
                  <span>{isCompleted ? 'ရယူမည်' : 'မပြီးသေးပါ'}</span>
                </a>

                <a
                  href={project.subtitles?.srtPath ? `/api/files/${project.id}/subtitles.srt?download=1` : '#'}
                  onClick={(e) => !project.subtitles?.srtPath && e.preventDefault()}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-medium transition ${
                    project.subtitles?.srtPath
                      ? 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-800 cursor-pointer'
                      : 'bg-slate-950/40 border-slate-800/80 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Subtitles className="w-4 h-4" />
                    <span>မြန်မာ SRT စာတန်းဖိုင်</span>
                  </span>
                  <span>{project.subtitles?.srtPath ? 'ရယူမည်' : 'မပြီးသေးပါ'}</span>
                </a>

                <a
                  href={project.recapScript ? `/api/files/${project.id}/recap_script.txt?download=1` : '#'}
                  onClick={(e) => !project.recapScript && e.preventDefault()}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-medium transition ${
                    project.recapScript
                      ? 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-800 cursor-pointer'
                      : 'bg-slate-950/40 border-slate-800/80 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    <span>မြန်မာ ဇာတ်ကြောင်းပြော စာသား (.txt)</span>
                  </span>
                  <span>{project.recapScript ? 'ရယူမည်' : 'မပြီးသေးပါ'}</span>
                </a>
              </div>
            </div>

            {/* Audio Speed & Mix Re-render Box */}
            {isCompleted && (
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-purple-400" />
                    <span>အသံအမြန်နှုန်းနှင့် မူရင်းအသံ ပြန်လည်ချိန်ညှိရန်</span>
                  </h3>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-500/40">
                    {speakingRate}
                  </span>
                </div>

                {/* Speaking Speed Controls */}
                <div className="space-y-2 pt-1 border-t border-slate-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5 text-purple-400" />
                      <span>ဇာတ်ကြောင်းပြော အမြန်နှုန်း (Speed)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handlePreviewSpeed(speakingRate)}
                      disabled={previewingSpeed}
                      className="inline-flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 font-semibold cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>{previewingSpeed ? 'ဖွင့်နေသည်...' : 'စမ်းသပ်နားထောင်မည်'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-3 gap-1.5">
                    {SPEAKING_SPEED_OPTIONS.map((s) => {
                      const isSelected = speakingRate === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSpeakingRate(s.id)}
                          className={`p-2 rounded-lg border text-left transition cursor-pointer text-xs ${
                            isSelected
                              ? 'bg-purple-600/30 border-purple-400 text-white shadow ring-1 ring-purple-400'
                              : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white">{s.id}</span>
                            {s.badge && (
                              <span className="text-[9px] px-1 rounded bg-slate-800 text-slate-400">{s.badge}</span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">{s.burmeseName}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Independent Original Audio Mix Slider */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>မူရင်းတရုတ်အသံ ကျယ်နှုန်း (Original Mix):</span>
                    <span className="font-bold text-purple-400">{Math.round(audioMixVolume * 100)}%</span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={audioMixVolume}
                    onChange={(e) => setAudioMixVolume(parseFloat(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer"
                  />

                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>အသံပိတ် (0%)</span>
                    <span>နောက်ခံတိုးတိုး (15%)</span>
                    <span>မူရင်းအတိုင်း (100%)</span>
                  </div>
                </div>

                <button
                  onClick={handleReRender}
                  disabled={reRendering}
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  {reRendering ? 'ဗီဒီယို ပြန်လည်ပေါင်းစပ်နေသည်...' : 'ဗီဒီယို အသစ်ပြန်လည် ပေါင်းစပ်မည်'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Burmese Recap Script Viewer & Editor */}
      {activeTab === 'script' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-400" />
                <span>မြန်မာ ဇာတ်လမ်းပြန်ပြော ဇာတ်ညွှန်း</span>
              </h2>
              <p className="text-xs text-slate-400">
                တရုတ်စကားပြောနှင့် စာတန်းများကို သုံးသပ်ပြီး Gemini AI မှ ရေးသားထားသော မြန်မာဇာတ်ကြောင်းပြော စာသား
              </p>
            </div>

            <div className="flex items-center gap-2">
              {!isEditingScript ? (
                <button
                  onClick={() => setIsEditingScript(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 text-xs font-semibold border border-purple-500/30 transition cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>စာသား တည်းဖြတ်မည်</span>
                </button>
              ) : (
                <button
                  onClick={handleSaveScript}
                  disabled={savingScript}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingScript ? 'သိမ်းဆည်းနေပါသည်...' : 'ပြင်ဆင်မှု သိမ်းဆည်းမည်'}</span>
                </button>
              )}
            </div>
          </div>

          {!editableScript ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              ဇာတ်ညွှန်း ရေးသားနေဆဲ ဖြစ်ပါသည် (Step 8 မရောက်သေးပါ)...
            </div>
          ) : (
            <div className="space-y-6 max-w-4xl">
              {/* Title & Genre */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                <span className="text-[11px] text-purple-400 font-semibold uppercase">ဇာတ်ကား ခေါင်းစဉ် & အမျိုးအစား</span>
                {isEditingScript ? (
                  <input
                    type="text"
                    value={editableScript.title}
                    onChange={(e) => setEditableScript({ ...editableScript, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-base font-bold"
                  />
                ) : (
                  <h3 className="text-xl font-bold text-white">{editableScript.title}</h3>
                )}
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  အမျိုးအစား: {editableScript.genre}
                </span>
              </div>

              {/* Characters Summary */}
              {editableScript.charactersSummary && editableScript.charactersSummary.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-400" />
                    <span>အဓိက ဇာတ်ကောင်များနှင့် ဆက်နွယ်မှုများ</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {editableScript.charactersSummary.map((char, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                        <p className="font-bold text-sm text-purple-300">
                          {char.name} <span className="text-xs text-slate-400 font-normal">({char.role})</span>
                        </p>
                        <p className="text-xs text-slate-300 leading-relaxed">{char.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Story Synopsis */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-200">ဇာတ်လမ်း အကျဉ်းချုပ်</h4>
                {isEditingScript ? (
                  <textarea
                    rows={4}
                    value={editableScript.synopsis}
                    onChange={(e) => setEditableScript({ ...editableScript, synopsis: e.target.value })}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-200 leading-relaxed"
                  />
                ) : (
                  <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/40 p-4 rounded-xl border border-slate-800/60">
                    {editableScript.synopsis}
                  </p>
                )}
              </div>

              {/* Narration Paragraphs */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-200 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-purple-400" />
                    <span>ဇာတ်ကြောင်းပြော အသံထွက် စာသားများ (Narration Segments)</span>
                  </span>
                  <span className="text-xs text-slate-400 font-normal">
                    {editableScript.narrationSegments.length} အပိုင်း
                  </span>
                </h4>

                <div className="space-y-3">
                  {editableScript.narrationSegments.map((seg, idx) => (
                    <div
                      key={seg.id || idx}
                      className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-purple-400">အပိုင်း {idx + 1}</span>
                      </div>

                      {isEditingScript ? (
                        <textarea
                          rows={3}
                          value={seg.text}
                          onChange={(e) => {
                            const newSegments = [...editableScript.narrationSegments];
                            newSegments[idx].text = e.target.value;
                            setEditableScript({ ...editableScript, narrationSegments: newSegments });
                          }}
                          className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-200 leading-relaxed"
                        />
                      ) : (
                        <p className="text-sm text-slate-200 leading-relaxed">{seg.text}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: SRT Subtitles */}
      {activeTab === 'subtitles' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Subtitles className="w-5 h-5 text-purple-400" />
                <span>အချိန်ကိုက် မြန်မာစာတန်းများ (SRT)</span>
              </h2>
              <p className="text-xs text-slate-400">
                မြန်မာအသံထွက် အချိန်ကိုက်နှင့်အညီ တည်ဆောက်ထားသော မြန်မာယူနီကုဒ် စာတန်းများ
              </p>
            </div>

            {project.subtitles?.srtPath && (
              <a
                href={`/api/files/${project.id}/subtitles.srt?download=1`}
                download={`${project.title}_subtitles.srt`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>SRT ဒေါင်းလုဒ်</span>
              </a>
            )}
          </div>

          {!project.subtitles?.srtPath ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              စာတန်းများ ထုတ်လုပ်နေဆဲ ဖြစ်ပါသည် (Step 11 မရောက်သေးပါ)...
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-950 font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto max-h-96">
              <iframe
                src={`/api/files/${project.id}/subtitles.srt`}
                title="SRT Viewer"
                className="w-full h-80 bg-transparent text-slate-200 border-0"
              />
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Chinese Speech Transcript & OCR */}
      {activeTab === 'chinese' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Languages className="w-5 h-5 text-indigo-400" />
              <span>မူရင်း တရုတ်စကားပြော နှင့် မျက်နှာပြင် စာတန်းများ</span>
            </h2>
            <p className="text-xs text-slate-400">
              Groq Whisper မှ မှတ်သားခဲ့သော စကားပြောများနှင့် Gemini Vision မှ ဖတ်ရှုခဲ့သော စာတန်းများ
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Whisper Chinese Transcript */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-purple-300 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span>တရုတ်စကားပြော မှတ်တမ်း</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Groq Whisper Large V3 (zh)
                  </span>
                </span>
                <span className="text-xs text-slate-400 font-normal">
                  {project.transcription?.segments?.length || 0} ကြောင်း
                </span>
              </h3>

              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {(project.transcription?.segments || []).map((seg) => (
                  <div key={seg.id} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-1">
                    <span className="text-[10px] text-purple-400 font-mono">
                      [{seg.start.toFixed(1)}s - {seg.end.toFixed(1)}s]
                    </span>
                    <p className="text-slate-200 font-sans">{seg.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* OCR Subtitles & Screen Text */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-cyan-300 flex items-center justify-between">
                <span>မျက်နှာပြင် စာတန်း & စာသား (OCR)</span>
                <span className="text-xs text-slate-400 font-normal">
                  {project.ocr?.detections?.length || 0} ခု
                </span>
              </h3>

              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {(project.ocr?.detections || []).map((ocr, i) => (
                  <div key={i} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-1">
                    <span className="text-[10px] text-cyan-400 font-mono">
                      [{ocr.timestamp.toFixed(1)}s]
                    </span>
                    <p className="text-slate-200 font-sans">{ocr.chineseText}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Detailed Processing Logs */}
      {activeTab === 'logs' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-purple-400" />
              <span>စနစ် လုပ်ငန်းမှတ်တမ်းများ (Processing History Logs)</span>
            </h2>
            <span className="text-xs text-slate-400 font-mono">{project.logs.length} entries</span>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto font-mono text-xs">
            {project.logs.map((log, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-xl border flex items-start gap-3 ${
                  log.type === 'error'
                    ? 'bg-rose-950/30 border-rose-800/40 text-rose-300'
                    : log.type === 'warn'
                    ? 'bg-amber-950/30 border-amber-800/40 text-amber-300'
                    : log.type === 'success'
                    ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300'
                    : 'bg-slate-950/40 border-slate-800 text-slate-300'
                }`}
              >
                <span className="text-slate-500 flex-shrink-0 text-[10px]">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-purple-300 font-bold flex-shrink-0">
                  Step {log.step}
                </span>
                <span className="flex-1 font-sans">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
