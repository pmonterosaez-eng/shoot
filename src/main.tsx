import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if (window.location.protocol !== 'chrome-extension:') {
  registerSW({ immediate: true });
}

createRoot(document.getElementById('root')!).render(<App />);
