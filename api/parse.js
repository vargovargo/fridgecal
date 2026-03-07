const { default: Anthropic } = require('@anthropic-ai/sdk')

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const FAMILY_CONTEXT = `
You are parsing a family whiteboard calendar photo for the Vargo family. Extract all events and return structured JSON.

## Family Members
- **Lauren**: working from her Rich office ("Rich" at top of day = ~9am-4pm); "OTF" = Orange Theory Fitness, Solano Ave, weekdays 7:15-8:30am
- **Leo**: "CCT" = California Climbing Team practice at Bridgestone, El Cerrito, weekdays ~4-6pm; "Michael" = recurring appointment ~3:30-4:30pm
- **Benton**: basketball (Bay City, BayCityClinic, BAtCKY/BATCKY = basketball locations); Science Olympiad events (Heredity, Remote Sensing, SciBowl, Sci Oly)
- **Jason**: typically coaching/transport; "Remote Sensing" = Science Olympiad event he coaches
- **Family**: use for anything not clearly assigned to one person

## Parsing Rules
- Ignore color coding on the whiteboard — not applied consistently
- Ignore row position for time — parse time from written text only
- Ignore the rightmost notes/to-do column — not calendar events
- Each written item within a day column is a separate event
- If ownership is ambiguous, assign to Family

## Output Format
Return a JSON array of events. Each event:
{
  "title": "event name",
  "member": "Lauren" | "Leo" | "Benton" | "Jason" | "Family",
  "date": "YYYY-MM-DD",
  "time": "HH:MM" or null,
  "duration": minutes as integer or null,
  "location": "location string" or null,
  "notes": "any extra context" or null
}

If you cannot determine the year from context, assume the current year. Return ONLY the JSON array, no other text.
`

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { image } = req.body
  if (!image || !image.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Invalid image data' })
  }

  const [header, base64Data] = image.split(',')
  const mediaType = header.match(/data:(image\/\w+);/)?.[1] || 'image/jpeg'

  try {
    const today = new Date().toISOString().split('T')[0]
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64Data },
            },
            {
              type: 'text',
              text: FAMILY_CONTEXT + `\n\nToday's date is ${today}. All events on this whiteboard are within the next 2–3 weeks from today. Use this to assign correct year and month to each event.\n\nPlease parse this whiteboard calendar photo and return the events as JSON.`,
            },
          ],
        },
      ],
    })

    const text = message.content[0].text.trim()
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return res.status(422).json({ error: 'Could not extract events from image' })
    }

    const events = JSON.parse(jsonMatch[0])
    return res.status(200).json(events)
  } catch (err) {
    console.error('Parse error:', err)
    return res.status(500).json({ error: err.message || 'Failed to parse image' })
  }
}
