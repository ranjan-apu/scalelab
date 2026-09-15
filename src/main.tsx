import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/inter';
import './index.css';
import App from './App';
import { AuthProvider } from './auth/AuthContext';

const host = document.getElementById('root');
if (!host) throw new Error('Root element #root not found');

createRoot(host).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
