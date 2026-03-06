import { createOAuthClient, buildTokenCookie } from '../_googleClient.js'

export default async function handler(req, res) {
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

    res.setHeader('Set-Cookie', buildTokenCookie(tokens))
    res.redirect(302, '/?auth=success')
  } catch (err) {
    console.error('OAuth callback error:', err)
    res.redirect(302, `/?auth=error&reason=${encodeURIComponent(err.message)}`)
  }
}
