import React, { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { AuthModal } from './components/AuthModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { syncPendingLocalBooks } from './lib/bookSync';

import { HomeDashboard } from './pages/HomeDashboard';
import { Reader } from './pages/Reader';
import { Vocabulary } from './pages/Vocabulary';
import { Quiz } from './pages/Quiz';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';

type AppTab =
  | 'home'
  | 'reader'
  | 'vocab'
  | 'quiz'
  | 'analytics'
  | 'settings';

interface NavigationParams {
  bookId?: string;
}

function parseHash(): { tab: AppTab; bookId?: string } {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return { tab: 'home' };
  const [route, queryString] = hash.split('?');
  const params = new URLSearchParams(queryString || '');
  const validTabs: AppTab[] = ['home', 'reader', 'vocab', 'quiz', 'analytics', 'settings'];
  const tab = validTabs.includes(route as AppTab) ? (route as AppTab) : 'home';
  const bookId = params.get('bookId') || undefined;
  return { tab, bookId };
}

export const AppContent: React.FC = () => {
  const { user, loading } = useAuth();

  const [activeTab, setActiveTab] = useState<AppTab>(() => parseHash().tab);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(() => parseHash().bookId || null);

  useEffect(() => {
    const handleHashChange = () => {
      const { tab, bookId } = parseHash();
      setActiveTab(tab);
      if (bookId) {
        setSelectedBookId(bookId);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (user) {
      void syncPendingLocalBooks();
    }
  }, [user]);

  const navigate = (
    tab: AppTab,
    params?: NavigationParams
  ) => {
    if (params?.bookId) {
      setSelectedBookId(params.bookId);
      window.location.hash = `#${tab}?bookId=${params.bookId}`;
    } else {
      window.location.hash = `#${tab}`;
    }
    setActiveTab(tab);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center mb-4 animate-pulse">
          <BookOpen size={24} />
        </div>
        <div className="text-xs font-mono text-zinc-500 uppercase tracking-widest animate-pulse">
          Loading Bunmyaku 文脈…
        </div>

      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <AuthModal />
      </div>
    );
  }

  return (
    <Layout
      activeTab={
        activeTab === 'reader'
          ? 'home'
          : activeTab
      }
      setActiveTab={(tab) =>
        navigate(tab as AppTab)
      }
    >
      {activeTab === 'home' && (
        <HomeDashboard
          onNavigate={navigate}
        />
      )}

      {activeTab === 'reader' &&
        selectedBookId && (
          <Reader
            bookId={selectedBookId}
            onNavigate={(tab) => navigate(tab)}
          />
        )}

      {activeTab === 'vocab' && (
        <Vocabulary />
      )}

      {activeTab === 'quiz' && (
        <Quiz />
      )}

      {activeTab === 'analytics' && (
        <Analytics />
      )}

      {activeTab === 'settings' && (
        <Settings />
      )}
    </Layout>
  );
};

export const App: React.FC = () => (
  <ErrorBoundary>
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  </ErrorBoundary>
);

export default App;