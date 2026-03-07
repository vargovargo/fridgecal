import { useState } from 'react'
import './EventReview.css'

const MEMBER_COLORS = {
  Lauren: '#1a73e8',
  Leo: '#34a853',
  Benton: '#fa7b17',
  Jason: '#9334e6',
  Family: '#5f6368',
}

export default function EventReview({ events, onBack, calendarConnected }) {
  const [items, setItems] = useState(
    events.map((e, i) => ({ ...e, id: i, selected: true }))
  )
  const [synced, setSynced] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState(null)

  function toggleItem(id) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    )
  }

  async function handleSync() {
    if (!calendarConnected) {
      window.location.href = '/api/auth/login'
      return
    }

    const toSync = items.filter((i) => i.selected)
    if (!toSync.length) return
    setSyncing(true)
    setSyncError(null)
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: toSync }),
      })
      const data = await res.json()
      if (res.status === 401 && data.authRequired) {
        window.location.href = '/api/auth/login'
        return
      }
      if (!res.ok) {
        throw new Error(data.error || 'Sync failed')
      }
      setSyncResult(data)
      setSynced(true)
    } catch (err) {
      setSyncError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  if (synced) {
    return (
      <div className="review-success">
        <div className="success-icon">✅</div>
        <h2>Synced to Google Calendar</h2>
        <p>
          {syncResult?.synced} event{syncResult?.synced !== 1 ? 's' : ''} added
          {syncResult?.skipped > 0 && `, ${syncResult.skipped} already existed`}
          {syncResult?.failed?.length > 0 && `, ${syncResult.failed.length} failed`}
        </p>
        {syncResult?.failed?.length > 0 && (
          <p style={{ fontSize: '0.8em', color: '#c00' }}>{syncResult.failed[0]}</p>
        )}
        <button className="btn-primary" onClick={onBack}>
          Scan another calendar
        </button>
      </div>
    )
  }

  const selectedCount = items.filter((i) => i.selected).length

  return (
    <div className="event-review">
      <div className="review-header">
        <button className="btn-back" onClick={onBack}>← Back</button>
        <h2>Review Events</h2>
        <span className="review-count">{selectedCount}/{items.length} selected</span>
      </div>

      {items.length === 0 ? (
        <div className="no-events">
          <p>No events found. Try a clearer photo.</p>
        </div>
      ) : (
        <ul className="event-list">
          {items.map((item) => (
            <li
              key={item.id}
              className={`event-item ${item.selected ? 'selected' : 'deselected'}`}
              onClick={() => toggleItem(item.id)}
            >
              <div
                className="event-color-bar"
                style={{ background: MEMBER_COLORS[item.member] || MEMBER_COLORS.Family }}
              />
              <div className="event-details">
                <div className="event-title">{item.title}</div>
                <div className="event-meta">
                  <span className="event-date">{item.date}</span>
                  {item.time && <span className="event-time">{item.time}</span>}
                  <span
                    className="event-member"
                    style={{ color: MEMBER_COLORS[item.member] || MEMBER_COLORS.Family }}
                  >
                    {item.member || 'Family'}
                  </span>
                </div>
                {item.location && <div className="event-notes">📍 {item.location}</div>}
                {item.notes && <div className="event-notes">{item.notes}</div>}
              </div>
              <div className="event-checkbox">
                {item.selected ? '☑' : '☐'}
              </div>
            </li>
          ))}
        </ul>
      )}

      {syncError && (
        <div className="sync-error">{syncError}</div>
      )}

      <div className="review-footer">
        {!calendarConnected && (
          <p className="connect-hint">You'll be asked to connect Google Calendar first</p>
        )}
        <button
          className="btn-primary"
          onClick={handleSync}
          disabled={syncing || selectedCount === 0}
        >
          {syncing ? 'Syncing...' : calendarConnected ? 'Sync to Google Calendar' : 'Connect & Sync'}
        </button>
      </div>
    </div>
  )
}
