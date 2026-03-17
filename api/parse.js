const { default: Anthropic } = require('@anthropic-ai/sdk')

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const FAMILY_CONTEXT = `
You are parsing a family whiteboard calendar photo for the Vargo family. Extract all events and return structured JSON.

## Family Members
- **Lauren**: working from her Rich office ("Rich" at top of day = ~9am-4pm); "OTF" = Orange Theory Fitness, Solano Ave, weekdays 7:15-8:30am
- **Leo**: "CCT" = California Climbing Team practice at Bridges Rock Gym, El Cerrito, weekdays ~4-6pm; "Michael" = recurring appointment ~3:30-4:30pm
- **Benton**: plays for **Bay City** basketball team — any "Bay City", "BayCityClinic", "BAtCKY"/"BATCKY" entry is Benton's basketball (Bay City is the team name, not just a location); default location: DeJean Middle School, 3400 Macdonald Ave, Richmond CA 94805 (text after "Bay City" is usually a location — normalize OCR variants like "desean", "descan", "dejean" to "DeJean"); Science Olympiad events (Heredity, Remote Sensing, Dynamic Planet/DYNAM PLANET, SciBowl)
- **Jason**: typically coaching/transport; "Remote Sensing" = Science Olympiad event he coaches
- **Family**: use for anything not clearly assigned to one person; "Regionals"/"REGIONALS" = Science Olympiad Regionals, all-day family event, may span multiple days

## Parsing Rules
- Ignore color coding on the whiteboard — not applied consistently
- Ignore row position for time — parse time from written text only
- The rightmost column is split into two sections: **NOTES** (top, bulleted dated items) and **TO DO** (bottom)
  - **NOTES items**: parse these as calendar events — they are dated reminders of upcoming events (e.g. "3/14 Leo Comp" = event on March 14)
  - **TO DO items**: ignore — these are tasks, not calendar events
- Each written item within a day column is a separate event
- If ownership is ambiguous, assign to Family
- A name or first initial accompanying an event designates the owner: "B" = Benton, "L" = Leo — this overrides any default assumption (e.g. "Bay City L" or "L Bay City" = Leo's basketball, not Benton's)

### Date & Column Rules (critical — follow these precisely)
- **Date numbers are ground truth**: numbers written near the top of each day column (often in black) are the actual dates. Always use them to assign YYYY-MM-DD. If a date number is visible, use it — do not infer dates from column position alone.
- **Column alignment**: each day has a distinct vertical column. An event belongs to the column it is physically written inside. When text is near a column boundary, assign it to the column where the majority of the text falls. Do NOT assign one event to two adjacent days unless it clearly spans both columns (arrow, text stretching across the divider).
- **Past dates — NEVER shift forward**: if a column's date has already passed relative to today, keep it exactly as written. Do NOT advance it to the next week or month. The board may not have been erased yet. Example: if today is March 9 and a column shows "5" (March 5), use 2026-03-05, NOT 2026-03-12.
- **One entry = one event**: each distinct written item produces exactly one event on exactly one date. Do NOT duplicate an event onto an adjacent day because it sits near a column border. Only create multiple days for an event if there is a clear visual indicator (arrow, text physically spanning across column dividers).
- **Week boundaries**: use the written date numbers to determine the week — do not assume the board starts on Monday.
- **Times — only when explicit**: only include a time if it is actually written on the board for that entry, or if the entry is a well-known shorthand with a default time (OTF = 7:15am, CCT = 4pm, Rich = 9am, Michael = 3:30pm). Do not guess times from row position.
- **Multi-day events**: an event written across multiple day columns (with an arrow or text physically spanning columns) = one all-day event per day covered. But a single entry within one column is NOT multi-day.

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
              text: FAMILY_CONTEXT + `\n\nToday's date is ${today}. The whiteboard typically shows the current week and possibly the next 1–2 weeks. Some events may be in the past if the board hasn't been erased — keep those dates as-is. Use today's date to determine the correct year and month, but do NOT shift past dates forward.\n\nPlease parse this whiteboard calendar photo and return the events as JSON.`,
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
