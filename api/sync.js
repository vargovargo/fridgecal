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

  const { events } = req.body
  if (!Array.isArray(events) || events.length === 0) {
    return res.status(400).json({ error: 'events must be a non-empty array' })
  }

  const client = createOAuthClient()
  client.setCredentials(tokens)

  client.on('tokens', (newTokens) => {
    const merged = { ...tokens, ...newTokens }
    res.setHeader('Set-Cookie', buildTokenCookie(merged))
  })

  const calendar = google.calendar({ version: 'v3', auth: client })

  // Fetch existing events in the date range to detect duplicates
  const dates = events.map((e) => e.date).filter(Boolean).sort()
  const { exactKeys, byDate } = await getExistingEvents(calendar, dates[0], dates[dates.length - 1])

  const results = await Promise.allSettled(
    events.map((event) => {
      // Layer 1: exact title+date match
      const exactKey = `${event.title}|${event.date}`.toLowerCase()
      if (exactKeys.has(exactKey)) return Promise.resolve('skipped')

      // Layer 2+3: normalized + member-aware fuzzy match
      const normTitle = normalizeTitle(event.title)
      const existing = byDate[event.date] || []
      const isDupe = existing.some((ex) => {
        // Different known members → not a duplicate
        if (ex.member && event.member && ex.member.toLowerCase() !== event.member.toLowerCase()) return false
        return titlesLikelyMatch(normTitle, ex.normalizedTitle)
      })
      if (isDupe) return Promise.resolve('skipped')

      return createCalendarEvent(calendar, event)
    })
  )

  const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value !== 'skipped').length
  const skipped = results.filter((r) => r.status === 'fulfilled' && r.value === 'skipped').length
  const failed = results
    .filter((r) => r.status === 'rejected')
    .map((r) => {
      const reason = r.reason
      const msg = reason?.message || reason?.errors?.[0]?.message || JSON.stringify(reason) || 'Unknown error'
      console.error('Sync event failed:', msg, reason?.status, reason?.code)
      return msg
    })

  return res.status(200).json({ synced: succeeded, skipped, failed })
}

function toGoogleDateTime(date, time, durationMinutes) {
  if (time) {
    const [hours, minutes] = time.split(':').map(Number)
    const endTotalMins = hours * 60 + minutes + (durationMinutes || 60)
    const endTime = `${String(Math.floor(endTotalMins / 60) % 24).padStart(2, '0')}:${String(endTotalMins % 60).padStart(2, '0')}`
    return {
      start: { dateTime: `${date}T${time}:00`, timeZone: 'America/Los_Angeles' },
      end: { dateTime: `${date}T${endTime}:00`, timeZone: 'America/Los_Angeles' },
    }
  }
  return { start: { date }, end: { date } }
}

function normalizeTitle(title) {
  return (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractMember(description) {
  const match = (description || '').match(/^Person:\s*(.+)/m)
  return match ? match[1].trim() : null
}

function titlesLikelyMatch(a, b) {
  if (a === b) return true
  // Check if they share a common prefix of 8+ characters
  const minLen = Math.min(a.length, b.length)
  let shared = 0
  while (shared < minLen && a[shared] === b[shared]) shared++
  if (shared >= 8) return true
  // Check word-level: if first 2+ words match
  const wordsA = a.split(' ')
  const wordsB = b.split(' ')
  const minWords = Math.min(wordsA.length, wordsB.length)
  let matchingWords = 0
  for (let i = 0; i < minWords; i++) {
    if (wordsA[i] === wordsB[i]) matchingWords++
    else break
  }
  if (matchingWords >= 2) return true
  return false
}

async function getExistingEvents(calendar, minDate, maxDate) {
  try {
    const res = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: new Date(`${minDate}T00:00:00`).toISOString(),
      timeMax: new Date(`${maxDate}T23:59:59`).toISOString(),
      singleEvents: true,
      maxResults: 500,
    })
    const exactKeys = new Set()
    const byDate = {}
    for (const e of res.data.items || []) {
      const date = (e.start?.date || e.start?.dateTime || '').slice(0, 10)
      const title = e.summary || ''
      exactKeys.add(`${title}|${date}`.toLowerCase())
      const norm = normalizeTitle(title)
      const member = extractMember(e.description)
      if (!byDate[date]) byDate[date] = []
      byDate[date].push({ normalizedTitle: norm, member })
    }
    return { exactKeys, byDate }
  } catch {
    return { exactKeys: new Set(), byDate: {} } // if lookup fails, proceed without duplicate check
  }
}

async function createCalendarEvent(calendar, event) {
  const { title, date, time, duration, location, notes, member } = event
  const { start, end } = toGoogleDateTime(date, time, duration)

  const description = [member ? `Person: ${member}` : null, notes || null]
    .filter(Boolean)
    .join('\n')

  await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: {
      summary: title,
      location: location || undefined,
      description: description || undefined,
      start,
      end,
    },
  })
}
