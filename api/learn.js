const { google } = require('googleapis')
const { createOAuthClient, getTokensFromCookie, buildTokenCookie, CALENDAR_ID } = require('./_googleClient')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const tokens = getTokensFromCookie(req.headers.cookie)
  if (!tokens) {
    return res.status(401).json({ error: 'Not connected to Google Calendar', authRequired: true })
  }

  const { originalEvents } = req.body
  if (!Array.isArray(originalEvents) || originalEvents.length === 0) {
    return res.status(400).json({ error: 'originalEvents must be a non-empty array' })
  }

  const client = createOAuthClient()
  client.setCredentials(tokens)

  client.on('tokens', (newTokens) => {
    const merged = { ...tokens, ...newTokens }
    res.setHeader('Set-Cookie', buildTokenCookie(merged))
  })

  const calendar = google.calendar({ version: 'v3', auth: client })

  // Determine date range from original events
  const dates = originalEvents.map((e) => e.date).filter(Boolean).sort()
  const minDate = dates[0]
  const maxDate = dates[dates.length - 1]

  try {
    const calRes = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: new Date(`${minDate}T00:00:00`).toISOString(),
      timeMax: new Date(`${maxDate}T23:59:59`).toISOString(),
      singleEvents: true,
      maxResults: 500,
    })

    const calendarEvents = (calRes.data.items || []).map((e) => ({
      title: e.summary || '',
      date: (e.start?.date || e.start?.dateTime || '').slice(0, 10),
      time: e.start?.dateTime ? e.start.dateTime.slice(11, 16) : null,
      location: e.location || null,
      member: extractMember(e.description),
    }))

    const corrections = diffEvents(originalEvents, calendarEvents)
    return res.status(200).json({ corrections, calendarEvents })
  } catch (err) {
    console.error('Learn error:', err)
    return res.status(500).json({ error: err.message || 'Failed to fetch calendar events' })
  }
}

function extractMember(description) {
  if (!description) return null
  const match = description.match(/Person:\s*(Lauren|Leo|Benton|Jason|Family)/i)
  return match ? match[1] : null
}

function diffEvents(original, calendar) {
  const corrections = []

  // Build lookup of calendar events by normalized title
  const calByKey = new Map()
  for (const ce of calendar) {
    const key = ce.title.toLowerCase().trim()
    if (!calByKey.has(key)) calByKey.set(key, [])
    calByKey.get(key).push(ce)
  }

  // Build lookup of original events by normalized title
  const origByKey = new Map()
  for (const oe of original) {
    const key = oe.title.toLowerCase().trim()
    if (!origByKey.has(key)) origByKey.set(key, [])
    origByKey.get(key).push(oe)
  }

  // Check each original event against calendar
  for (const oe of original) {
    const key = oe.title.toLowerCase().trim()
    const matches = calByKey.get(key) || []

    if (matches.length === 0) {
      // Event was deleted from calendar
      corrections.push({
        type: 'deleted',
        original: oe,
        corrected: null,
        description: `"${oe.title}" on ${oe.date} was removed from the calendar`,
      })
      continue
    }

    // Find best matching calendar event (closest date)
    const best = matches.reduce((closest, ce) => {
      const d1 = Math.abs(new Date(ce.date) - new Date(oe.date))
      const d2 = Math.abs(new Date(closest.date) - new Date(oe.date))
      return d1 < d2 ? ce : closest
    })

    const changes = []
    if (best.date !== oe.date) {
      changes.push(`date: ${oe.date} → ${best.date}`)
    }
    if (oe.time && best.time && best.time !== oe.time) {
      changes.push(`time: ${oe.time} → ${best.time}`)
    }
    if (oe.member && best.member && best.member !== oe.member) {
      changes.push(`member: ${oe.member} → ${best.member}`)
    }

    if (changes.length > 0) {
      corrections.push({
        type: 'modified',
        original: oe,
        corrected: best,
        description: `"${oe.title}": ${changes.join(', ')}`,
      })
    }
  }

  // Check for events in calendar that weren't in the original parse
  for (const ce of calendar) {
    const key = ce.title.toLowerCase().trim()
    const origMatches = origByKey.get(key) || []
    if (origMatches.length === 0) {
      // Could be a manually added event or renamed — only flag if it looks FridgeCal-related
      if (ce.member) {
        corrections.push({
          type: 'added',
          original: null,
          corrected: ce,
          description: `"${ce.title}" on ${ce.date} was added manually (not in original parse)`,
        })
      }
    }
  }

  return corrections
}
