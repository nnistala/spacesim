import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useNavigationStore } from './stores/navigationStore'
import { useUIStore } from './stores/uiStore'
import { useProximityStore } from './stores/proximityStore'

// Dev-only console hook for tooling/automation (e.g. screenshot capture).
if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).__sim = {
    nav: useNavigationStore,
    ui: useUIStore,
    prox: useProximityStore,
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
