import { useState, useEffect } from 'react'
import './CorrectionReview.css'

export default function CorrectionReview({ onBack }) {
  const [corrections, setCorrections] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchCorrections()
  }, [])

  async function fetchCorrections() {
    const stored = localStorage.getItem('fridgecal_last_sync')
    if (!stored) {
      setError('No previous sync found. Sync events first, then check corrections.')
      setLoading(false)
      return
    }

    const { events } = JSON.parse(stored)
    try {
      const res = await fetch('/api/learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalEvents: events }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Server error (${res.status})`)
      }
      const data = await res.json()
      setCorrections(data.corrections)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function formatForClaudeMd(corrections) {
    if (!corrections || corrections.length === 0) return ''
    const lines = corrections.map((c) => {
      if (c.type === 'deleted') {
        return `"${c.original.title}" on ${c.original.date} → SHOULD NOT BE PARSED (was incorrectly detected)`
      }
      if (c.type === 'added') {
        return `"${c.corrected.title}" on ${c.corrected.date} → MISSED by parser (${c.corrected.member || 'Family'})`
      }
      // modified
      const parts = []
      if (c.corrected.date !== c.original.date) {
        parts.push(`correct date is ${c.corrected.date}, not ${c.original.date}`)
      }
      if (c.original.time && c.corrected.time && c.corrected.time !== c.original.time) {
        parts.push(`correct time is ${c.corrected.time}, not ${c.original.time}`)
      }
      if (c.original.member && c.corrected.member && c.corrected.member !== c.original.member) {
        parts.push(`correct member is ${c.corrected.member}, not ${c.original.member}`)
      }
      return `"${c.original.title}" → ${parts.join('; ')}`
    })
    return lines.join('\n')
  }

  function handleCopy() {
    const text = formatForClaudeMd(corrections)
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading) {
    return (
      <div className="correction-review">
        <div className="correction-loading">
          <div className="spinner" />
          <p>Comparing with Google Calendar...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="correction-review">
        <div className="correction-header">
          <button className="btn-back" onClick={onBack}>← Back</button>
          <h2>Check Corrections</h2>
        </div>
        <div className="correction-error">{error}</div>
      </div>
    )
  }

  const hasCorrections = corrections && corrections.length > 0

  return (
    <div className="correction-review">
      <div className="correction-header">
        <button className="btn-back" onClick={onBack}>← Back</button>
        <h2>Corrections</h2>
        <span className="correction-count">
          {hasCorrections ? `${corrections.length} found` : 'none'}
        </span>
      </div>

      {!hasCorrections ? (
        <div className="correction-empty">
          <p>No corrections detected — the parse matched Google Calendar.</p>
        </div>
      ) : (
        <>
          <ul className="correction-list">
            {corrections.map((c, i) => (
              <li key={i} className={`correction-item correction-${c.type}`}>
                <div className="correction-badge">{c.type}</div>
                <div className="correction-desc">{c.description}</div>
              </li>
            ))}
          </ul>

          <div className="correction-output">
            <h3>Add to CLAUDE.md examples:</h3>
            <pre className="correction-code">{formatForClaudeMd(corrections)}</pre>
            <button className="btn-primary" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy to clipboard'}
            </button>
          </div>
        </>
      )}

      <div className="correction-footer">
        <button className="btn-secondary" onClick={onBack}>Done</button>
      </div>
    </div>
  )
}
