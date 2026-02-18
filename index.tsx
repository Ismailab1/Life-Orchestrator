
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { LandingPage } from './components/LandingPage';
import { LegalView } from './components/LegalView';

const Root: React.FC = () => {
  const [view, setView] = useState<'landing' | 'app-demo' | 'app-live' | 'privacy' | 'terms'>('landing');

  if (view === 'landing') {
    return (
        <LandingPage 
            onStartDemo={() => setView('app-demo')} 
            onStartLive={() => setView('app-live')} 
            onViewPrivacy={() => setView('privacy')}
            onViewTerms={() => setView('terms')}
        />
    );
  }

  if (view === 'privacy' || view === 'terms') {
    return <LegalView type={view} onBack={() => setView('landing')} />;
  }

  return (
    <App 
        key={view} // Force re-mount when switching modes
        mode={view === 'app-demo' ? 'demo' : 'live'} 
        onBack={() => setView('landing')} 
    />
  );
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
