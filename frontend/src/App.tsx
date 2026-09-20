import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { AuthModal } from './components/AuthModal';
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

export const AppContent: React.FC = () => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] =
    useState<AppTab>('home');

  const [selectedBookId, setSelectedBookId] =
    useState<string | null>(null);

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
    }

    setActiveTab(tab);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
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
  <AuthProvider>
    <AppContent />
  </AuthProvider>
);

export default App;