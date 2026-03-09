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
- `Bay City` / `BayCityClinic` → Bay City is Benton's basketball **team** (not just a location); any Bay City entry = Benton's basketball
- `BAtCKY` / `BATCKY` → basketball + location code (e.g. ECH = gym/court identifier)
- `Heredity` → Science Olympiad event
- `Remote Sensing` → Science Olympiad event; Jason coaches this one
- `Dynamic Planet` / `DYNAM PLANET` → Science Olympiad event (Benton)
- `SciBowl` → Science Bowl competition or practice (Benton)
- `Sci Oly` / `Science Olympiad` → competitive team event, may involve multiple family members
- `Regionals` / `REGIONALS` → Science Olympiad Regionals, all-day, may span multiple days — assign to Family (whole family attends)

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
- **Notes column** (top of rightmost area): bulleted items with dates are upcoming events — parse them as calendar events
- **To Do column** (bottom of rightmost area): ignore — tasks, not calendar events
- **Vertical cell structure**: each written item within a day column is a separate event
- **Multi-day events**: text (or an arrow) spanning multiple day columns = one all-day event per day covered; applies to travel, trips, competitions, etc.

### Date & Column Rules (critical — most common source of errors)
- **Date numbers are ground truth**: numbers written near the top of each day column (often in black) are the actual calendar dates for that column. Always use them to determine YYYY-MM-DD. If a date number is visible, use it — do not infer dates from column position alone.
- **Column alignment**: each day has a distinct vertical column. An event belongs to the column it is physically written inside. When text is near a column boundary, assign it to the column where the **majority** of the text falls. Do NOT assign one event to two adjacent days unless it clearly spans both columns (arrow, text stretching across the divider).
- **Past dates — never shift forward**: if a column's date number has already passed relative to today, keep it exactly as written. Do NOT advance it to the next week or next month. The board may not have been erased yet. Example: if today is March 9 and a column says "5" (March 5), the date is 2026-03-05, not 2026-03-12.
- **One entry = one event**: each distinct written item produces exactly one event on exactly one date, unless there is a clear visual indicator (arrow, spanning text) that it covers multiple days. Do NOT duplicate an event onto an adjacent day because it sits near a column border.
- **Week boundaries**: the whiteboard typically shows Mon–Fri (or Mon–Sat). Use the date numbers to determine the exact week — do not assume the board always starts on Monday.
- **Times — only when explicitly written**: only include a time if a time is actually written on the board for that entry, or if it is a well-known shorthand with a default time (e.g. OTF = 7:15am, CCT = 4pm). Do not guess or infer times from row position.

## Ownership Assignment

- If a name or known shorthand is present → assign to that person
- First initials count: `B` = Benton, `L` = Leo — overrides default assumptions (e.g. "Bay City L" = Leo's basketball)
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
