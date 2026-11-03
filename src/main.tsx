import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.tsx'
import { applyToDocument, getSettings } from './app/settings.ts'

// Before the first render, so the page never flashes in the wrong direction.
applyToDocument(getSettings())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
