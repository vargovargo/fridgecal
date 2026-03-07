const { createOAuthClient, buildTokenCookie } = require('../_googleClient')

module.exports = async function handler(req, res) {
  const { code, error } = req.query

  if (error) {
    return res.redirect(302, `/?auth=error&reason=${encodeURIComponent(error)}`)
  }
  if (!code) {
    return res.redirect(302, '/?auth=error&reason=missing_code')
  }

  try {
    const client = createOAuthClient()
    const { tokens } = await client.getToken(code)
    res.writeHead(302, {
      'Set-Cookie': buildTokenCookie(tokens),
      'Location': '/?auth=success',
    })
    res.end()
  } catch (err) {
    console.error('OAuth callback error:', err)
    res.writeHead(302, { 'Location': `/?auth=error&reason=${encodeURIComponent(err.message)}` })
    res.end()
  }
}
