import { google } from 'googleapis'
import {
  createOAuthClient,
  getTokensFromCookie,
  buildTokenCookie,
  CALENDAR_ID,
} from './_googleClient.js'

export default async function handler(req, res) {
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

  // Auto-refresh tokens if needed and persist updated tokens
  client.on('tokens', (newTokens) => {
    const merged = { ...tokens, ...newTokens }
    res.setHeader('Set-Cookie', buildTokenCookie(merged))
  })

  const calendar = google.calendar({ version: 'v3', auth: client })

  const results = await Promise.allSettled(
    events.map((event) => createCalendarEvent(calendar, event))
  )

  const succeeded = results.filter((r) => r.status === 'fulfilled').length
  const failed = results
    .filter((r) => r.status === 'rejected')
    .map((r) => r.reason?.message || 'Unknown error')

  return res.status(200).json({ synced: succeeded, failed })
}

function toGoogleDateTime(date, time, durationMinutes) {
  // date: "YYYY-MM-DD", time: "HH:MM" or null, durationMinutes: number or null
  if (time) {
    const start = new Date(`${date}T${time}:00`)
    const end = new Date(start.getTime() + (durationMinutes || 60) * 60 * 1000)
    return {
      start: { dateTime: start.toISOString(), timeZone: 'America/Los_Angeles' },
      end: { dateTime: end.toISOString(), timeZone: 'America/Los_Angeles' },
    }
  }
  // All-day event
  return {
    start: { date },
    end: { date },
  }
}

async function createCalendarEvent(calendar, event) {
  const { title, date, time, duration, location, notes, member } = event
  const { start, end } = toGoogleDateTime(date, time, duration)

  const description = [
    member ? `Person: ${member}` : null,
    notes || null,
  ]
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
