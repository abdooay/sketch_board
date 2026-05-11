import {
	clearOauthStateCookie,
	createSessionCookie,
	getOauthState,
	getOrigin,
	getSingleQueryParam,
	type VercelRequest,
	type VercelResponse,
} from '../_auth.js'

interface GoogleTokenResponse {
	access_token?: string
	error?: string
}

interface GoogleUserInfoResponse {
	sub?: string
	email?: string
	name?: string
	picture?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	try {
		const code = getSingleQueryParam(req.query?.code)
		const state = getSingleQueryParam(req.query?.state)
		const storedState = getOauthState(req)
		if (!code || !state || !storedState || state !== storedState) {
			res.status(400).json({ error: 'Invalid Google sign-in state.' })
			return
		}

		const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
		const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
		if (!clientId || !clientSecret) {
			res.status(500).json({ error: 'Google OAuth environment variables are required.' })
			return
		}

		const origin = getOrigin(req)
		const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				code,
				client_id: clientId,
				client_secret: clientSecret,
				redirect_uri: `${origin}/api/auth/callback`,
				grant_type: 'authorization_code',
			}),
		})
		const tokenPayload = (await tokenResponse.json()) as GoogleTokenResponse
		if (!tokenResponse.ok || !tokenPayload.access_token) {
			res.status(401).json({ error: tokenPayload.error ?? 'Google sign-in failed.' })
			return
		}

		const userInfoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
			headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
		})
		const userInfo = (await userInfoResponse.json()) as GoogleUserInfoResponse
		if (!userInfoResponse.ok || !userInfo.sub || !userInfo.email) {
			res.status(401).json({ error: 'Could not read Google account profile.' })
			return
		}

		res.setHeader('Set-Cookie', [
			createSessionCookie({
				sub: userInfo.sub,
				email: userInfo.email,
				name: userInfo.name ?? userInfo.email,
				...(userInfo.picture ? { picture: userInfo.picture } : {}),
			}),
			clearOauthStateCookie(),
		])
		res.setHeader('Location', '/')
		res.status(302).end()
	} catch (error) {
		res.status(500).json({
			error: error instanceof Error ? error.message : 'Google sign-in failed.',
		})
	}
}
