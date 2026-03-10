import { useState, useEffect } from 'react'
import './EventReview.css'

const MEMBERS = ['Lauren', 'Leo', 'Benton', 'Jason', 'Family']

const MEMBER_COLORS = {
  Lauren: '#1a73e8',
  Leo: '#34a853',
  Benton: '#fa7b17',
  Jason: '#9334e6',
  Family: '#5f6368',
}

function addMinutes(time, mins) {
  if (!time || !mins) return ''
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function minutesBetween(start, end) {
  if (!start || !end) return null
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const diff = eh * 60 + em - (sh * 60 + sm)
  return diff > 0 ? diff : null
}

export default function EventReview({ events, onBack, calendarConnected }) {
  const [items, setItems] = useState(
    events.map((e, i) => ({
      ...e,
      id: i,
      selected: true,
      endTime: addMinutes(e.time, e.duration),
      _original: { ...e },
    }))
  )
  const [expandedId, setExpandedId] = useState(null)
  const [dupFlags, setDupFlags] = useState(new Set())
  const [synced, setSynced] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState(null)

  useEffect(() => {
    if (!calendarConnected) return
    fetch('/api/duplicates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: events.map((e) => ({ title: e.title, date: e.date })) }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.flags?.length) setDupFlags(new Set(data.flags.map((f) => f.index)))
      })
      .catch(() => {})
  }, [calendarConnected])

  function toggleItem(id) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    )
  }

  function toggleExpand(id, e) {
    e.stopPropagation()
    setExpandedId((prev) => (prev === id ? null : id))
  }

  function updateItem(id, field, value) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    )
  }

  async function handleSync() {
    if (!calendarConnected) {
      window.location.href = '/api/auth/login'
      return
    }

    const selected = items.filter((i) => i.selected)
    if (!selected.length) return
    setSyncing(true)
    setSyncError(null)
    try {
      // Strip UI-only fields; recompute duration from endTime if set
      const toSync = selected.map(({ id, selected: _s, endTime, _original, ...e }) => ({
        ...e,
        duration: minutesBetween(e.time, endTime) ?? e.duration,
      }))

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
      if (!res.ok) throw new Error(data.error || 'Sync failed')

      // Record which fields were user-corrected vs. original parse
      const corrections = selected
        .map((item) => {
          const orig = item._original
          const changed = {}
          for (const field of ['title', 'date', 'time', 'member', 'location']) {
            const was = orig[field] ?? null
            const is = item[field] ?? null
            if (was !== is) changed[field] = { was, is }
          }
          const origEnd = addMinutes(orig.time, orig.duration)
          if (item.endTime && item.endTime !== origEnd) {
            changed.endTime = { was: origEnd || null, is: item.endTime }
          }
          return Object.keys(changed).length > 0
            ? { original: orig, fields: changed }
            : null
        })
        .filter(Boolean)

      localStorage.setItem(
        'fridgecal_last_sync',
        JSON.stringify({ events: toSync, corrections, syncedAt: new Date().toISOString() })
      )

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
          {items.map((item) => {
            const color = MEMBER_COLORS[item.member] || MEMBER_COLORS.Family
            const isExpanded = expandedId === item.id
            return (
              <li
                key={item.id}
                className={`event-item ${item.selected ? 'selected' : 'deselected'} ${isExpanded ? 'expanded' : ''}`}
              >
                <div className="event-row" onClick={() => toggleItem(item.id)}>
                  <div className="event-color-bar" style={{ background: color }} />
                  <div className="event-details">
                    <div className="event-title">{item.title}</div>
                    <div className="event-meta">
                      <span className="event-date">{item.date}</span>
                      {item.time && (
                        <span className="event-time">
                          {item.time}{item.endTime ? `–${item.endTime}` : ''}
                        </span>
                      )}
                      <span className="event-member" style={{ color }}>
                        {item.member || 'Family'}
                      </span>
                      {dupFlags.has(item.id) && (
                        <span className="event-dup-warning">⚠ may exist</span>
                      )}
                    </div>
                    {item.location && <div className="event-notes">📍 {item.location}</div>}
                  </div>
                  <button
                    className="event-edit-btn"
                    onClick={(e) => toggleExpand(item.id, e)}
                    title={isExpanded ? 'Close' : 'Edit'}
                  >
                    {isExpanded ? '✕' : '✏'}
                  </button>
                  <div className="event-checkbox">{item.selected ? '☑' : '☐'}</div>
                </div>

                {isExpanded && (
                  <div className="event-edit-form" onClick={(e) => e.stopPropagation()}>
                    <div className="edit-field">
                      <label>Title</label>
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => updateItem(item.id, 'title', e.target.value)}
                      />
                    </div>
                    <div className="edit-grid">
                      <div className="edit-field">
                        <label>Date</label>
                        <input
                          type="date"
                          value={item.date}
                          onChange={(e) => updateItem(item.id, 'date', e.target.value)}
                        />
                      </div>
                      <div className="edit-field">
                        <label>Person</label>
                        <select
                          value={item.member || 'Family'}
                          onChange={(e) => updateItem(item.id, 'member', e.target.value)}
                        >
                          {MEMBERS.map((m) => <option key={m}>{m}</option>)}
                        </select>
                      </div>
                      <div className="edit-field">
                        <label>Start</label>
                        <input
                          type="time"
                          value={item.time || ''}
                          onChange={(e) => updateItem(item.id, 'time', e.target.value || null)}
                        />
                      </div>
                      <div className="edit-field">
                        <label>End</label>
                        <input
                          type="time"
                          value={item.endTime || ''}
                          onChange={(e) => updateItem(item.id, 'endTime', e.target.value || null)}
                        />
                      </div>
                    </div>
                    <div className="edit-field">
                      <label>Location</label>
                      <input
                        type="text"
                        value={item.location || ''}
                        placeholder="optional"
                        onChange={(e) => updateItem(item.id, 'location', e.target.value || null)}
                      />
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {syncError && <div className="sync-error">{syncError}</div>}

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
