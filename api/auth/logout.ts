import { clearSessionCookie, type VercelRequest, type VercelResponse } from '../_auth.js'

export default function handler(_req: VercelRequest, res: VercelResponse) {
	res.setHeader('Set-Cookie', clearSessionCookie())
	res.status(200).json({ ok: true })
}
