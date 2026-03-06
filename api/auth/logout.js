const { clearTokenCookie } = require('../_googleClient')

module.exports = function handler(req, res) {
  res.setHeader('Set-Cookie', clearTokenCookie())
  return res.status(200).json({ ok: true })
}
