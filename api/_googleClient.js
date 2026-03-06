import { google } from 'googleapis'

export const CALENDAR_ID =
  'cd7ea915000af330d4e4354d5fac9c44956fb8406e93745a21fd6348f34dc927@group.calendar.google.com'

export function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI // e.g. https://your-app.vercel.app/api/auth/callback
  )
}

export function getAuthUrl(client) {
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // ensures we get a refresh_token every time
    scope: ['https://www.googleapis.com/auth/calendar.events'],
  })
}

// Parse tokens from cookie string
export function getTokensFromCookie(cookieHeader) {
  if (!cookieHeader) return null
  const match = cookieHeader.match(/fridgecal_tokens=([^;]+)/)
  if (!match) return null
  try {
    return JSON.parse(decodeURIComponent(match[1]))
  } catch {
    return null
  }
}

// Build Set-Cookie header value
export function buildTokenCookie(tokens) {
  const value = encodeURIComponent(JSON.stringify(tokens))
  const maxAge = 60 * 60 * 24 * 60 // 60 days
  return `fridgecal_tokens=${value}; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}; Path=/`
}

export function clearTokenCookie() {
  return `fridgecal_tokens=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/`
}
