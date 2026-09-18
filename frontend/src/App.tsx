import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { AuthModal } from './components/AuthModal';
import { EpubIngest } from './pages/EpubIngest';
import { Vocabulary } from './pages/Vocabulary';
import { Quiz } from './pages/Quiz';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';

export const AppContent: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('epub');

  // If no user is authenticated, lock access and render the login/signup modal
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <AuthModal />
      </div>
    );
  }

  // Once authenticated, render full application with tabs
  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'epub' && <EpubIngest />}
      {activeTab === 'vocab' && <Vocabulary />}
      {activeTab === 'quiz' && <Quiz />}
      {activeTab === 'analytics' && <Analytics />}
      {activeTab === 'settings' && <Settings />}
    </Layout>
  );
};

export const App: React.FC = () => (
  <AuthProvider>
    <AppContent />
  </AuthProvider>
);

export default App;