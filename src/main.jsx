import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts.css'
import './styles.css'
import './showcase-overrides.css'
import './tools-section.css'
import './experiments-section.css'
import './collaborate-section.css'
import './base-band.css'
import './cursor.css'
import './project-page.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode><App /></StrictMode>,
)
