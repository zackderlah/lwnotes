import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import RootErrorBoundary from './RootErrorBoundary.jsx'
import {
  applyThemeToDocument,
  readStoredTheme,
  syncElectronTitleBarForTheme,
} from './theme.js'
import {
  applyCompactSidebarToDocument,
  readStoredCompactSidebar,
} from './compactSidebar.js'
import './styles/index.css'

const initialTheme = readStoredTheme()
applyThemeToDocument(initialTheme)
syncElectronTitleBarForTheme(initialTheme)
applyCompactSidebarToDocument(readStoredCompactSidebar())

const rootEl = document.getElementById('root')
if (!rootEl) {
  document.body.innerHTML =
    '<p style="font-family:sans-serif;padding:24px">Missing #root in index.html</p>'
} else {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    </React.StrictMode>,
  )
}
