import React from 'react';
import { 
  FolderKanban, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  PlusCircle, 
  Play, 
  ArrowRight, 
  Sparkles,
  Layers,
  Mic,
  Subtitles,
  FileVideo,
  Radio,
  Download
} from 'lucide-react';
import { Project } from '../../server/types';

interface DashboardViewProps {
  projects: Project[];
  summary: {
    total: number;
    completed: number;
    processing: number;
    failed: number;
  };
  onNavigateToCreate: () => void;
  onNavigateToLive: () => void;
  onSelectProject: (projectId: string) => void;
  onCreateDemo: () => void;
  loadingDemo?: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  projects,
  summary,
  onNavigateToCreate,
  onNavigateToLive,
  onSelectProject,
  onCreateDemo,
  loadingDemo = false,
}) => {
  const recentProjects = projects.slice(0, 4);

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-slate-900 border border-purple-800/30 p-6 sm:p-8">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs sm:text-sm">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>တရုတ်ရုပ်ရှင်များမှ မြန်မာဇာတ်လမ်းပြန်ပြော ဗီဒီယိုအဖြစ် ပြောင်းလဲပေးသည့် Dual-Mode AI စတူဒီယို</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-snug">
            တရုတ်ဗီဒီယိုများကို <span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">မြန်မာပြန်ပြောပြချက် & Live ဘာသာပြန်</span> အဖြစ် ဖန်တီးပါ
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            တရုတ်စကားပြောများကို Whisper ဖြင့် နားထောင်ပြီး Gemini AI ဖြင့် ဇာတ်လမ်းကို နားလည်အောင် ခွဲခြမ်းစိတ်ဖြာကာ သဘာဝကျသော မြန်မာအသံထွက်နှင့် အချိန်ကိုက် မြန်မာစာတန်းများ ထည့်သွင်းပေးပါသည်။ အလိုအလျောက် ဗီဒီယိုထုတ်လုပ်သည့် Mode 1 နှင့် တိုက်ရိုက် ကြည့်ရှုရင်း ဘာသာပြန်ပေးသည့် Mode 2 နှစ်မျိုးစလုံး အသုံးပြုနိုင်ပါသည်။
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={onNavigateToCreate}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium shadow-lg shadow-purple-600/25 transition-all cursor-pointer"
            >
              <PlusCircle className="w-5 h-5" />
              <span>Mode 1: Upload & Auto Recap</span>
            </button>

            <button
              onClick={onNavigateToLive}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium shadow-lg shadow-cyan-600/25 transition-all cursor-pointer"
            >
              <Radio className="w-5 h-5 animate-pulse" />
              <span>Mode 2: Real-Time Live Mode</span>
            </button>

            <button
              onClick={onCreateDemo}
              disabled={loadingDemo}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 text-purple-300 border border-purple-500/30 font-medium transition-all cursor-pointer disabled:opacity-50"
            >
              <Play className="w-4 h-4 text-purple-400" />
              <span>{loadingDemo ? 'နမူနာ ဖန်တီးနေပါသည်...' : 'နမူနာ စမ်းသပ်မည်'}</span>
            </button>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute right-0 top-0 -mt-10 -mr-10 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* DUAL MODE SELECTOR CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* MODE 1 CARD */}
        <div 
          onClick={onNavigateToCreate}
          className="p-6 rounded-2xl bg-gradient-to-br from-purple-950/40 via-slate-900 to-slate-900 border border-purple-800/40 hover:border-purple-500 transition-all cursor-pointer group shadow-lg"
        >
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
              <PlusCircle className="w-6 h-6" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
              MODE 1
            </span>
          </div>
          <h3 className="text-xl font-bold text-white mt-4 group-hover:text-purple-300 transition-colors">
            Upload & Auto Recap (အလိုအလျောက် Recap)
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
            တရုတ်ဗီဒီယိုဖိုင် အပြည့်အစုံကို တင်သွင်းပါ။ Whisper ဖြင့် စကားပြောမှတ်သားပြီး Gemini OCR ဖြင့် စာတန်းများဖတ်ကာ သဘာဝကျသော မြန်မာဇာတ်လမ်းပြန်ပြော ဇာတ်ညွှန်း၊ မြန်မာ AI အသံနှင့် စာတန်းများထိုးထားသည့် MP4 အပြီးသတ် ဗီဒီယိုကို အလိုအလျောက် ထုတ်လုပ်ပေးပါသည်။
          </p>
          <div className="mt-4 flex items-center text-xs font-bold text-purple-400 group-hover:translate-x-1 transition-transform">
            <span>စတင်ဖန်တီးရန် နှိပ်ပါ →</span>
          </div>
        </div>

        {/* MODE 2 CARD */}
        <div 
          onClick={onNavigateToLive}
          className="p-6 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-slate-900 to-slate-900 border border-cyan-800/40 hover:border-cyan-500 transition-all cursor-pointer group shadow-lg"
        >
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse">
              MODE 2 (LIVE)
            </span>
          </div>
          <h3 className="text-xl font-bold text-white mt-4 group-hover:text-cyan-300 transition-colors">
            Real-Time Live Mode (တိုက်ရိုက် Live ဘာသာပြန် & Recap)
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
            ဗီဒီယိုကို Player တွင် ကြည့်ရှုနေစဉ် အချိန်နှင့်တစ်ပြေးညီ (Real-time) တရုတ်စကားပြောများကို နားထောင်ပြီး မြန်မာဘာသာသို့ တိုက်ရိုက်ပြန်ဆိုကာ မြန်မာ AI သဘာဝအသံနှင့် စာတန်းများကို ဗီဒီယိုပေါ်တွင် ချက်ချင်း ထုတ်လွှင့်ပေးပါသည်။
          </p>
          <div className="mt-4 flex items-center text-xs font-bold text-cyan-400 group-hover:translate-x-1 transition-transform">
            <span>Live စနစ် ဖွင့်ရန် နှိပ်ပါ →</span>
          </div>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">ပရောဂျက် စုစုပေါင်း</p>
            <p className="text-2xl sm:text-3xl font-bold text-white mt-1">{summary.total}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <FolderKanban className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">ပြီးစီးခဲ့သော ဗီဒီယိုများ</p>
            <p className="text-2xl sm:text-3xl font-bold text-emerald-400 mt-1">{summary.completed}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">လုပ်ဆောင်နေဆဲ / စောင့်ဆိုင်း</p>
            <p className="text-2xl sm:text-3xl font-bold text-amber-400 mt-1">{summary.processing}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">မအောင်မြင်သော အလုပ်များ</p>
            <p className="text-2xl sm:text-3xl font-bold text-rose-400 mt-1">{summary.failed}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 4-Step Visual Workflow Banner */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-purple-900/30">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5 text-purple-400" />
          <span>My AI Studio ၏ အဆင့်ဆင့် ဆောင်ရွက်ပုံ အကျဉ်းချုပ်</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/60">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-sm mb-3">
              ၁
            </div>
            <h3 className="font-semibold text-white text-sm mb-1">ဗီဒီယို တင်သွင်းခြင်း & ခွဲထုတ်ခြင်း</h3>
            <p className="text-xs text-slate-400">
              တရုတ်ဗီဒီယိုဖိုင်မှ စကားပြောအသံနှင့် ဗီဒီယိုဖရိမ်များကို FFmpeg ဖြင့် သီးသန့် ခွဲထုတ်သည်။
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/60">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-sm mb-3">
              ၂
            </div>
            <h3 className="font-semibold text-white text-sm mb-1">Whisper & Gemini OCR</h3>
            <p className="text-xs text-slate-400">
              တရုတ်စကားပြောများကို Whisper ဖြင့် မှတ်သားပြီး မျက်နှာပြင် စာတန်းများကို Gemini Vision ဖြင့် ဖတ်ရှုသည်။
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/60">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-sm mb-3">
              ၃
            </div>
            <h3 className="font-semibold text-white text-sm mb-1">Gemini AI ဇာတ်လမ်းနားလည်ခြင်း</h3>
            <p className="text-xs text-slate-400">
              ဇာတ်လမ်း အစ၊ အလယ်၊ အဆုံးကို နားလည်ကာ သဘာဝကျသော မြန်မာဇာတ်ကြောင်းပြန်ပြချက် ရေးသားသည်။
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/60">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-sm mb-3">
              ၄
            </div>
            <h3 className="font-semibold text-white text-sm mb-1">မြန်မာ AI အသံ & စာတန်း ဗီဒီယိုထုတ်လုပ်ခြင်း</h3>
            <p className="text-xs text-slate-400">
              နီလာ/သီဟ သဘာဝအသံဖြင့် ဖတ်ကြားပြီး အချိန်ကိုက် မြန်မာစာတန်းထိုးကာ အပြီးသတ် MP4 ထုတ်ပေးသည်။
            </p>
          </div>
        </div>
      </div>

      {/* Recent Projects Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-indigo-400" />
            <span>လတ်တလော ဆောင်ရွက်ထားသော ပရောဂျက်များ</span>
          </h2>
        </div>

        {recentProjects.length === 0 ? (
          <div className="p-10 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-center space-y-3">
            <FileVideo className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-slate-300 font-medium">ပရောဂျက် မရှိသေးပါ</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              တရုတ်ရုပ်ရှင် ဇာတ်လမ်းပြန်ပြော ဗီဒီယို ဖန်တီးရန် ဗီဒီယို အသစ်တင်ပါ သို့မဟုတ် နမူနာဗီဒီယိုဖြင့် စမ်းသပ်ကြည့်ပါ။
            </p>
            <button
              onClick={onNavigateToCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>စတင်ဖန်တီးမည်</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentProjects.map((proj) => {
              const isCompleted = proj.status === 'completed';
              const isWaiting = proj.status === 'waiting_approval';
              const isProcessing = proj.status === 'processing';

              return (
                <div
                  key={proj.id}
                  onClick={() => onSelectProject(proj.id)}
                  className="p-5 rounded-xl bg-slate-900/70 hover:bg-slate-900 border border-slate-800 hover:border-purple-500/50 transition-all cursor-pointer group space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="font-semibold text-white group-hover:text-purple-300 transition-colors line-clamp-1">
                        {proj.title}
                      </h3>
                      <p className="text-xs text-slate-400 flex items-center gap-2">
                        <span>ဖိုင်အမည်: {proj.originalFilename}</span>
                        <span>•</span>
                        <span>{Math.round(proj.duration)} စက္ကန့်</span>
                      </p>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                        isCompleted
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          : isWaiting
                          ? 'bg-purple-500/10 text-purple-300 border-purple-500/30 animate-pulse'
                          : isProcessing
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                      }`}
                    >
                      {isCompleted
                        ? 'ပြီးစီးပါပြီ'
                        : isWaiting
                        ? 'ဇာတ်ညွှန်း အတည်ပြုရန်'
                        : isProcessing
                        ? 'လုပ်ဆောင်နေဆဲ'
                        : 'ချွတ်ယွင်းချက်'}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span className="line-clamp-1">{proj.currentStepTitle || 'လုပ်ဆောင်နေပါသည်...'}</span>
                      <span>{proj.progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          isCompleted
                            ? 'bg-emerald-500'
                            : proj.status === 'failed'
                            ? 'bg-rose-500'
                            : 'bg-gradient-to-r from-purple-500 to-cyan-400'
                        }`}
                        style={{ width: `${proj.progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-slate-500">
                      {new Date(proj.createdAt).toLocaleDateString()}
                    </span>

                    <span className="text-purple-400 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1 font-medium">
                      <span>အသေးစိတ် ကြည့်မည်</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
