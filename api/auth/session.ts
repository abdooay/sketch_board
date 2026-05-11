import {
	getPublicUser,
	getSessionFromRequest,
	type VercelRequest,
	type VercelResponse,
} from '../_auth.js'

export default function handler(req: VercelRequest, res: VercelResponse) {
	res.setHeader('Cache-Control', 'no-store')

	const session = getSessionFromRequest(req)
	res.status(200).json({
		user: session ? getPublicUser(session) : null,
	})
}
