import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider } from 'antd'
import './index.css'
import App from './App.jsx'

// Suppress antd React 19 compatibility warning
if (typeof window !== 'undefined') {
  window.__ANTD_REACT_COMPAT__ = true;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConfigProvider
      theme={{
        token: {
          // Optional: customize antd theme
        },
      }}
      // Suppress warnings
      warning={{
        strict: false,
      }}
    >
      <App />
    </ConfigProvider>
  </StrictMode>,
)
