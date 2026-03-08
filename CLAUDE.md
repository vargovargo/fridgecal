# FridgeCal — Family Shorthand Reference

This file is injected as system context into every Claude API parse call. Update it as the family's shorthand evolves.

## Family Members

### Lauren
- `Rich` at the top of a day → working from her office, approximately 9am–4pm
- `OTF` → Orange Theory Fitness class, Solano Ave; weekdays 7:15–8:30am

### Leo
- `CCT` → California Climbing Team practice at Bridges Rock Gym, El Cerrito; weekdays typically 4–6pm
- `Michael` → recurring weekly or biweekly appointment, typically 3:30–4:30pm

### Benton
- Primarily basketball; locations and times vary — parse whatever is written, no fixed defaults
- `Bay City` / `BayCityClinic` → basketball practice (location: Bay City)
- `BAtCKY` / `BATCKY` → basketball + location code (e.g. ECH = gym/court identifier)
- `Heredity` → Science Olympiad event
- `Remote Sensing` → Science Olympiad event; Jason coaches this one
- `SciBowl` → Science Bowl competition or practice (Benton and/or Leo)
- `Sci Oly` / `Science Olympiad` → competitive team event, may involve multiple family members

### Jason
- No shorthands defined yet
- Events are typically coaching/transport rather than personal commitments
- Coaches `Remote Sensing` (Science Olympiad)

### Family / General
- All synced events go to the dedicated FridgeCal Google Calendar by default
- Calendar ID: `cd7ea915000af330d4e4354d5fac9c44956fb8406e93745a21fd6348f34dc927@group.calendar.google.com`
- When a family member isn't clearly indicated, assign to Family

## Parsing Rules

- **Color coding**: ignore — not applied consistently on the whiteboard
- **Row position**: ignore for time — parse time from written text only
- **Notes / To Do column**: ignore — rightmost area is informal, not calendar events
- **Vertical cell structure**: each written item within a day column is a separate event
- **Date numbers**: numbers near the top of each day column (often written in black) are the actual calendar dates for that column — use them to determine YYYY-MM-DD
- **Past dates**: if a column's date has already passed, keep it as-is — do not advance it to the next week. The board may not have been erased/updated yet.

## Ownership Assignment

- If a name or known shorthand is present → assign to that person
- If ambiguous → assign to Family calendar

## Annotated Examples

```
"OTF" on a weekday → Lauren, Orange Theory Fitness, 7:15-8:30am, Solano Ave
"Rich" at top of day → Lauren, at office, 9am-4pm
"CCT" on weekday → Leo, climbing practice, 4-6pm, Bridges Rock Gym El Cerrito
"Michael" → Leo, appointment, 3:30-4:30pm
"Bay City" → Benton, basketball practice, Bay City location
"Heredity" → Benton, Science Olympiad - Heredity event
"Remote Sensing" → Benton+Jason, Science Olympiad - Jason is coach
```

---

## App Architecture Notes

- **Stack**: React + Vite PWA → Vercel serverless functions → Claude vision API + Google Calendar API
- **API routes**: `POST /api/parse` (image → events), `POST /api/sync` (events → Google Calendar)
- **Phase 1**: Camera capture + Claude parse + event review UI (complete)
- **Phase 2**: Google OAuth + Calendar API sync
- **Phase 3**: Enrich this CLAUDE.md with real examples from parsed photos
- **Phase 4**: Daily schedule text sharing
- **Phase 5**: Free time detection
