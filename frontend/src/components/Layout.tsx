import React from 'react';
import { BookOpen, Brain, HelpCircle, BarChart3, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ activeTab, setActiveTab, children }) => {
  const { signOut, user } = useAuth();

  const navItems = [
    { id: 'epub', label: 'Consume EPUB', icon: BookOpen },
    { id: 'vocab', label: 'Learn Vocabulary', icon: Brain },
    { id: 'quiz', label: 'Grammar Quiz', icon: HelpCircle },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col justify-between p-4">
        <div>
          <div className="flex items-center gap-3 px-3 py-4 mb-6">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <BookOpen size={24} />
            </div>
            <h1 className="font-bold text-lg tracking-wide text-white">Context Reader</h1>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Footer */}
        <div className="border-t border-slate-700 pt-4 px-2">
          <div className="text-xs text-slate-400 truncate mb-3">
            Signed in as <br />
            <span className="font-mono text-slate-200">{user?.email || 'Demo Mode'}</span>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Viewport */}
      <main className="flex-1 overflow-y-auto p-8 bg-slate-900">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
};