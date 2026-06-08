import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import LoginScreen from './components/LoginScreen.jsx'
import './index.css'

function Root() {
  const [isAuthed, setIsAuthed] = useState(() => sessionStorage.getItem('pm_auth') === '1')

  if (!isAuthed) {
    return <LoginScreen onLogin={() => { sessionStorage.setItem('pm_auth', '1'); setIsAuthed(true) }} />
  }
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
