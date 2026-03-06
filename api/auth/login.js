const { createOAuthClient, getAuthUrl } = require('../_googleClient')

module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const client = createOAuthClient()
  const url = getAuthUrl(client)
  res.redirect(302, url)
}
