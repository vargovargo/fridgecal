const { google } = require('googleapis')
const { createOAuthClient, getTokensFromCookie, buildTokenCookie, CALENDAR_ID } = require('./_googleClient')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const tokens = getTokensFromCookie(req.headers.cookie)
  if (!tokens) return res.status(401).json({ error: 'Not authenticated' })

  const { events } = req.body
  if (!Array.isArray(events) || events.length === 0) return res.status(400).json({ flags: [] })

  const client = createOAuthClient()
  client.setCredentials(tokens)
  client.on('tokens', (newTokens) => {
    res.setHeader('Set-Cookie', buildTokenCookie({ ...tokens, ...newTokens }))
  })

  const calendar = google.calendar({ version: 'v3', auth: client })

  const dates = events.map((e) => e.date).filter(Boolean).sort()
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

    const existing = (calRes.data.items || []).map((e) => ({
      title: (e.summary || '').toLowerCase().trim(),
      date: (e.start?.date || e.start?.dateTime || '').slice(0, 10),
    }))

    const flags = events
      .map((e, index) => {
        const title = (e.title || '').toLowerCase().trim()
        const match = existing.find(
          (ce) =>
            ce.date === e.date &&
            (ce.title === title || ce.title.includes(title) || title.includes(ce.title))
        )
        return match ? { index, existingTitle: match.title } : null
      })
      .filter(Boolean)

    return res.status(200).json({ flags })
  } catch (err) {
    console.error('Duplicates check error:', err)
    return res.status(500).json({ error: err.message })
  }
}
