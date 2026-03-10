import { useState, useEffect } from 'react'
import CameraCapture from './components/CameraCapture'
import EventReview from './components/EventReview'
import './App.css'

export default function App() {
  const [view, setView] = useState('capture') // 'capture' | 'review'
  const [parsedEvents, setParsedEvents] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [calendarConnected, setCalendarConnected] = useState(null) // null = unknown

  // Check auth status on mount and handle OAuth redirect params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const auth = params.get('auth')

    if (auth === 'success') {
      setCalendarConnected(true)
      window.history.replaceState({}, '', '/')
    } else if (auth === 'error') {
      const reason = params.get('reason') || 'Unknown error'
      setError(`Google Calendar connection failed: ${reason}`)
      window.history.replaceState({}, '', '/')
    }

    fetch('/api/auth/status')
      .then((r) => r.json())
      .then(({ connected }) => setCalendarConnected(connected))
      .catch(() => setCalendarConnected(false))
  }, [])

  async function handleImageCapture(imageDataUrl) {
    setIsLoading(true)
    setError(null)
    try {
      const events = await parseWhiteboardImage(imageDataUrl)
      setParsedEvents(events)
      setView('review')
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  function handleBack() {
    setView('capture')
    setParsedEvents([])
    setError(null)
  }

  async function handleDisconnect() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setCalendarConnected(false)
  }

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-logo">🧲</span>
        <h1>FridgeCal</h1>
        {calendarConnected && (
          <button className="btn-disconnect" onClick={handleDisconnect} title="Disconnect Google Calendar">
            ✓ Google
          </button>
        )}
      </header>

      {calendarConnected === false && (
        <div className="auth-banner">
          <span>Connect Google Calendar to sync events</span>
          <button className="btn-connect" onClick={() => window.location.assign("/api/auth/login")}>Connect</button>
        </div>
      )}

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner" />
          <p>Reading your calendar...</p>
        </div>
      )}

      {view === 'capture' && (
        <CameraCapture onCapture={handleImageCapture} disabled={isLoading} />
      )}

      {view === 'review' && (
        <EventReview
          events={parsedEvents}
          onBack={handleBack}
          calendarConnected={calendarConnected}
        />
      )}
    </div>
  )
}

async function resizeImage(dataUrl, maxDimension = 1600) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.src = dataUrl
  })
}

async function parseWhiteboardImage(imageDataUrl) {
  const resized = await resizeImage(imageDataUrl)

  let corrections = []
  try {
    const stored = localStorage.getItem('fridgecal_last_sync')
    if (stored) corrections = JSON.parse(stored).corrections || []
  } catch {}

  const res = await fetch('/api/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: resized, corrections }),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: `Server error (${res.status})` }))
    throw new Error(error || 'Failed to parse image')
  }
  return res.json()
}
