import React, { useState, useEffect } from 'react';
import { Navbar, NavTab } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { CreateRecapView } from './components/CreateRecapView';
import { ProjectsListView } from './components/ProjectsListView';
import { ProcessingHistoryView } from './components/ProcessingHistoryView';
import { SettingsView } from './components/SettingsView';
import { ProjectStudioView } from './components/ProjectStudioView';
import { LiveRecapView } from './components/LiveRecapView';
import { Project } from '../server/types';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    completed: 0,
    processing: 0,
    failed: 0,
  });
  const [loadingDemo, setLoadingDemo] = useState(false);

  // Groq API Key stored in localStorage for user convenience
  const [groqApiKey, setGroqApiKey] = useState<string>(() => {
    return localStorage.getItem('MYAI_GROQ_KEY') || '';
  });

  const handleSaveGroqApiKey = (key: string) => {
    setGroqApiKey(key);
    localStorage.setItem('MYAI_GROQ_KEY', key);
  };

  // Fetch all projects
  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
        if (data.summary) {
          setSummary(data.summary);
        }
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    }
  };

  useEffect(() => {
    fetchProjects();
    const timer = setInterval(fetchProjects, 5000);
    return () => clearInterval(timer);
  }, []);

  // Open a project in Studio View
  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
  };

  // Close Studio View and return to list or dashboard
  const handleBackFromStudio = () => {
    setSelectedProjectId(null);
    fetchProjects();
  };

  // Create demo project
  const handleCreateDemo = async () => {
    try {
      setLoadingDemo(true);
      const res = await fetch('/api/projects/demo', {
        method: 'POST',
      });
      if (!res.ok) throw new Error('နမူနာ ဖန်တီးခြင်း မအောင်မြင်ပါ');
      const demoProj = await res.json();
      await fetchProjects();
      setSelectedProjectId(demoProj.id);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoadingDemo(false);
    }
  };

  // Delete project
  const handleDeleteProject = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        if (selectedProjectId === projectId) {
          setSelectedProjectId(null);
        }
        await fetchProjects();
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // When upload completes from CreateRecapView
  const handleUploadSuccess = (newProject: Project) => {
    fetchProjects();
    setSelectedProjectId(newProject.id);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Noto_Sans_Myanmar','Padauk',sans-serif]">
      {/* Top Navbar */}
      <Navbar
        activeTab={selectedProjectId ? 'projects' : activeTab}
        onTabChange={(tab) => {
          setSelectedProjectId(null);
          setActiveTab(tab);
        }}
        systemReady={true}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        {selectedProjectId ? (
          <ProjectStudioView
            projectId={selectedProjectId}
            onBack={handleBackFromStudio}
            groqApiKey={groqApiKey}
          />
        ) : activeTab === 'dashboard' ? (
          <DashboardView
            projects={projects}
            summary={summary}
            onNavigateToCreate={() => setActiveTab('create')}
            onNavigateToLive={() => setActiveTab('live')}
            onSelectProject={handleSelectProject}
            onCreateDemo={handleCreateDemo}
            loadingDemo={loadingDemo}
          />
        ) : activeTab === 'live' ? (
          <LiveRecapView
            projects={projects}
            onUploadNew={() => setActiveTab('create')}
          />
        ) : activeTab === 'create' ? (
          <CreateRecapView
            onUploadSuccess={handleUploadSuccess}
            onStartDemo={handleCreateDemo}
            loadingDemo={loadingDemo}
          />
        ) : activeTab === 'projects' ? (
          <ProjectsListView
            projects={projects}
            onSelectProject={handleSelectProject}
            onDeleteProject={handleDeleteProject}
            onNavigateToCreate={() => setActiveTab('create')}
          />
        ) : activeTab === 'history' ? (
          <ProcessingHistoryView
            projects={projects}
            onSelectProject={handleSelectProject}
          />
        ) : activeTab === 'settings' ? (
          <SettingsView
            groqApiKey={groqApiKey}
            onSaveGroqApiKey={handleSaveGroqApiKey}
          />
        ) : null}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} My AI Studio — AI Chinese to Burmese Movie Recap Studio</p>
          <p className="text-slate-600">Powered by Whisper Large V3, Google Gemini & Burmese Neural TTS</p>
        </div>
      </footer>
    </div>
  );
}
