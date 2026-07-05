import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/poppins/400.css'
import '@fontsource/poppins/500.css'
import '@fontsource/poppins/600.css'
import '@fontsource/poppins/700.css'
import './index.css'
import App from './App.tsx'

// Report error JS client ke backend (best-effort, tanpa auth interceptor).
const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
function reportClientError(message: string, stack?: string) {
  try {
    fetch(`${API}/errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, path: location.pathname, stack }),
      keepalive: true,
    }).catch(() => {})
  } catch { /* diamkan */ }
}
window.addEventListener('error', (e) => reportClientError(e.message, e.error?.stack))
window.addEventListener('unhandledrejection', (e) => reportClientError('Unhandled promise: ' + (e.reason?.message || e.reason), e.reason?.stack))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
