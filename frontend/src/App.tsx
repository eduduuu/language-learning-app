import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { AuthModal } from './components/AuthModal';
import { HomeDashboard } from './pages/HomeDashboard'; // <-- 1. Import the new dashboard
import { Vocabulary } from './pages/Vocabulary';
import { Quiz } from './pages/Quiz';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';

export const AppContent: React.FC = () => {
  const { user } = useAuth();
  
  // 2. Change the default tab to 'home' to match your Layout sidebar ID
  const [activeTab, setActiveTab] = useState<string>('home');

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <AuthModal />
      </div>
    );
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      
      {/* 3. Render HomeDashboard and pass setActiveTab into its onNavigate prop */}
      {activeTab === 'home' && (
        <HomeDashboard 
          onNavigate={(tab) => setActiveTab(tab)} 
        />
      )}
      
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