const { getTokensFromCookie } = require('../_googleClient')

module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const tokens = getTokensFromCookie(req.headers.cookie)
  return res.status(200).json({ connected: !!tokens })
}
