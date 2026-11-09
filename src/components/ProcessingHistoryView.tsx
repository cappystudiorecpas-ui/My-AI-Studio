import React from 'react';
import { History, Clock, CheckCircle2, AlertCircle, Film, ArrowRight, Terminal } from 'lucide-react';
import { Project } from '../../server/types';

interface ProcessingHistoryViewProps {
  projects: Project[];
  onSelectProject: (projectId: string) => void;
}

export const ProcessingHistoryView: React.FC<ProcessingHistoryViewProps> = ({
  projects,
  onSelectProject,
}) => {
  // Aggregate all logs with project references and sort newest first
  const allLogs: Array<{
    projectId: string;
    projectTitle: string;
    timestamp: string;
    step: number;
    message: string;
    type: 'info' | 'warn' | 'error' | 'success';
  }> = [];

  for (const p of projects) {
    for (const log of p.logs || []) {
      allLogs.push({
        projectId: p.id,
        projectTitle: p.title,
        timestamp: log.timestamp,
        step: log.step,
        message: log.message,
        type: log.type,
      });
    }
  }

  allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <History className="w-6 h-6 text-purple-400" />
          <span>လုပ်ငန်းစဉ် မှတ်တမ်းများ (Processing History)</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          ဗီဒီယိုခွဲခြမ်းစိတ်ဖြာခြင်း၊ Whisper စကားပြောမှတ်သားခြင်း၊ Gemini ဇာတ်ညွှန်းရေးသားခြင်းနှင့် FFmpeg ဗီဒီယိုတည်းဖြတ်မှု မှတ်တမ်းအားလုံး
        </p>
      </div>

      {allLogs.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 space-y-3">
          <Terminal className="w-12 h-12 text-slate-600 mx-auto" />
          <p className="text-slate-300 font-medium text-sm">လုပ်ငန်းမှတ်တမ်း မရှိသေးပါ</p>
          <p className="text-xs text-slate-500">ဗီဒီယိုအသစ်တင်ပါက စနစ်၏ လုပ်ငန်းဆောင်ရွက်မှု မှတ်တမ်းများကို ဤနေရာတွင် တွေ့မြင်ရပါမည်</p>
        </div>
      ) : (
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-3">
            <span>မှတ်တမ်း စုစုပေါင်း: {allLogs.length} ခု</span>
            <span>အချိန်အလိုက် အသစ်ဆုံးမှ အဟောင်းသို့</span>
          </div>

          <div className="space-y-3">
            {allLogs.map((log, index) => {
              const isError = log.type === 'error';
              const isSuccess = log.type === 'success';
              const isWarn = log.type === 'warn';

              return (
                <div
                  key={index}
                  onClick={() => onSelectProject(log.projectId)}
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-all hover:scale-[1.005] ${
                    isError
                      ? 'bg-rose-950/20 border-rose-800/40 hover:bg-rose-950/30'
                      : isSuccess
                      ? 'bg-emerald-950/20 border-emerald-800/40 hover:bg-emerald-950/30'
                      : isWarn
                      ? 'bg-amber-950/20 border-amber-800/40 hover:bg-amber-950/30'
                      : 'bg-slate-950/40 border-slate-800 hover:bg-slate-950/60'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5">
                      {isError ? (
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                      ) : isSuccess ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Clock className="w-4 h-4 text-purple-400" />
                      )}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white hover:text-purple-300 transition">
                          {log.projectTitle}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-purple-300 font-mono font-semibold">
                          Step {log.step}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 font-sans leading-relaxed">
                        {log.message}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:flex-shrink-0 self-end sm:self-center">
                    <span className="text-[11px] text-slate-500 font-mono">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-500 hover:text-purple-400 transition" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
