import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './pages/App'
import './styles/globals.css'
import { registerSW } from 'virtual:pwa-register'

window.addEventListener('load', () => {
  registerSW({ immediate: true })
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)