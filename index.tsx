/**
 * DESIGN DECISION: Application Entry Point with Mode Router
 * 
 * This root component implements a view-based state machine:
 * - 'landing': Marketing page with demo/live mode selection
 * - 'app-demo': Tutorial mode with immutable sample data
 * - 'app-live': Production mode with persistent user data
 * - 'privacy'/'terms': Legal compliance views
 * 
 * Why separate demo and live modes?
 * 1. Users can explore functionality risk-free without cluttering their real data
 * 2. Demo mode provides instant value (no signup friction)
 * 3. Live mode has separate localStorage keys to prevent demo contamination
 * 4. Demos can be reset without affecting user data
 * 
 * The key prop forces App remounting when switching modes, ensuring clean state.
 * This prevents demo data from bleeding into live mode or vice versa.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import App from './App';
import './index.css';
import { LandingPage } from './components/LandingPage';
import { LegalView } from './components/LegalView';

const Root: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/home" element={<LandingPage />} />
        <Route path="/chat" element={<AppWrapper mode="live" />} />
        <Route path="/demo" element={<AppWrapper mode="demo" />} />
        <Route path="/app" element={<AppWrapper mode="live" />} />
        <Route path="/privacy" element={<LegalView type="privacy" />} />
        <Route path="/terms" element={<LegalView type="terms" />} />
      </Routes>
    </BrowserRouter>
  );
};

// Wrapper component to handle navigation and key prop for App re-mounting
const AppWrapper: React.FC<{ mode: 'demo' | 'live' }> = ({ mode }) => {
  const navigate = useNavigate();
  return (
    <App 
      key={mode} // Force re-mount when switching modes (CRITICAL for data isolation)
      mode={mode}
      onBack={() => navigate('/')}
    />
  );
};

/**
 * Root element mounting with strict mode
 * DESIGN DECISION: React StrictMode enabled for development safety
 * 
 * StrictMode helps identify:
 * - Unsafe lifecycle methods
 * - Legacy string ref usage
 * - Unexpected side effects during rendering
 * 
 * It does cause double-rendering in development (intentional), which can help
 * catch bugs that only appear when components re-render.
 */
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
