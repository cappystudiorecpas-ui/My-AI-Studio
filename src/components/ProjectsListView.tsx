import React, { useState } from 'react';
import { 
  FolderKanban, 
  Search, 
  Filter, 
  Trash2, 
  Play, 
  Download, 
  Film, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  PlusCircle
} from 'lucide-react';
import { Project } from '../../server/types';

interface ProjectsListViewProps {
  projects: Project[];
  onSelectProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onNavigateToCreate: () => void;
}

export const ProjectsListView: React.FC<ProjectsListViewProps> = ({
  projects,
  onSelectProject,
  onDeleteProject,
  onNavigateToCreate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'processing' | 'failed'>('all');

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.originalFilename.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'all') return true;
    if (statusFilter === 'completed') return p.status === 'completed';
    if (statusFilter === 'processing') return p.status === 'processing' || p.status === 'waiting_approval';
    if (statusFilter === 'failed') return p.status === 'failed';
    return true;
  });

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-indigo-400" />
            <span>ကျွန်ုပ်၏ ပရောဂျက်များ (My Projects)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            ဖန်တီးထားသော တရုတ်မှ မြန်မာသို့ ဇာတ်လမ်းပြန်ပြော ဗီဒီယို ပရောဂျက်များအားလုံး စီမံခန့်ခွဲရန်
          </p>
        </div>

        <button
          onClick={onNavigateToCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/20 transition cursor-pointer self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>ပရောဂျက် အသစ်ဖန်တီးမည်</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ခေါင်းစဉ် သို့မဟုတ် ဖိုင်အမည်ဖြင့် ရှာဖွေပါ..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-white text-xs focus:border-purple-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'အားလုံး' },
            { id: 'completed', label: 'ပြီးစီးပြီး' },
            { id: 'processing', label: 'လုပ်ဆောင်ဆဲ' },
            { id: 'failed', label: 'ချွတ်ယွင်းချက်' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-purple-600/20 text-purple-200 border border-purple-500/40'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 space-y-3">
          <Film className="w-12 h-12 text-slate-600 mx-auto" />
          <p className="text-slate-300 font-medium text-sm">ပရောဂျက်များ ရှာမတွေ့ပါ</p>
          <p className="text-xs text-slate-500">ရှာဖွေမှု စကားလုံးကို စစ်ဆေးပါ သို့မဟုတ် ဗီဒီယို အသစ်တင်ပါ</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((p) => {
            const isCompleted = p.status === 'completed';
            const isWaiting = p.status === 'waiting_approval';
            const isProcessing = p.status === 'processing';

            return (
              <div
                key={p.id}
                className="p-5 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-purple-500/40 transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        isCompleted
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          : isWaiting
                          ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
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
                        : 'မအောင်မြင်ပါ'}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`"${p.title}" ပရောဂျက်ကို ဖျက်ရန် သေချာပါသလား?`)) {
                          onDeleteProject(p.id);
                        }
                      }}
                      className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                      title="ပရောဂျက် ဖျက်မည်"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <h3
                      onClick={() => onSelectProject(p.id)}
                      className="font-bold text-white group-hover:text-purple-300 transition-colors cursor-pointer line-clamp-1 text-sm sm:text-base"
                    >
                      {p.title}
                    </h3>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {p.originalFilename} • {Math.round(p.duration)}s
                    </p>
                  </div>

                  {/* Step & Progress */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span className="truncate">{p.currentStepTitle || 'လုပ်ဆောင်နေပါသည်...'}</span>
                      <span className="font-semibold text-purple-300">{p.progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isCompleted
                            ? 'bg-emerald-500'
                            : p.status === 'failed'
                            ? 'bg-rose-500'
                            : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                        }`}
                        style={{ width: `${p.progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-500">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {isCompleted && (
                      <a
                        href={`/api/files/${p.id}/final_recap.mp4?download=1`}
                        download={`${p.title}.mp4`}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                        title="MP4 ဒေါင်းလုဒ်"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => onSelectProject(p.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 font-medium transition cursor-pointer"
                    >
                      <span>ဖွင့်မည်</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
