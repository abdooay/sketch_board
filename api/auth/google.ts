import {
	createOauthState,
	createOauthStateCookie,
	getOrigin,
	type VercelRequest,
	type VercelResponse,
} from '../_auth.js'

export default function handler(req: VercelRequest, res: VercelResponse) {
	const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
	if (!clientId) {
		res.status(500).json({ error: 'GOOGLE_CLIENT_ID is required for Google sign-in.' })
		return
	}

	const origin = getOrigin(req)
	const state = createOauthState()
	const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
	authUrl.searchParams.set('client_id', clientId)
	authUrl.searchParams.set('redirect_uri', `${origin}/api/auth/callback`)
	authUrl.searchParams.set('response_type', 'code')
	authUrl.searchParams.set('scope', 'openid email profile')
	authUrl.searchParams.set('state', state)
	authUrl.searchParams.set('prompt', 'select_account')

	res.setHeader('Set-Cookie', createOauthStateCookie(state))
	res.setHeader('Location', authUrl.toString())
	res.status(302).end()
}
