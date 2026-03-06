import { clearTokenCookie } from '../_googleClient.js'

export default function handler(req, res) {
  res.setHeader('Set-Cookie', clearTokenCookie())
  return res.status(200).json({ ok: true })
}
