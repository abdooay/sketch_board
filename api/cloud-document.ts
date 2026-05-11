import { get, put } from '@vercel/blob'
import {
	getPublicUser,
	getSessionFromRequest,
	getUserDocumentPathname,
	type VercelRequest,
	type VercelResponse,
} from './_auth.js'

const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024

function getBodyObject(body: unknown): Record<string, unknown> {
	if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
		return body as Record<string, unknown>
	}

	if (typeof body === 'string') {
		try {
			const parsed = JSON.parse(body) as unknown
			if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
				return parsed as Record<string, unknown>
			}
		} catch {
			return {}
		}
	}

	return {}
}

async function readStreamText(stream: ReadableStream<Uint8Array>) {
	const reader = stream.getReader()
	const decoder = new TextDecoder()
	let text = ''

	for (;;) {
		const { done, value } = await reader.read()
		if (done) break
		text += decoder.decode(value, { stream: true })
	}

	return text + decoder.decode()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	res.setHeader('Cache-Control', 'no-store')

	try {
		const session = getSessionFromRequest(req)
		if (!session) {
			res.status(401).json({ error: 'Sign in with Google to use cloud save.' })
			return
		}

		const pathname = getUserDocumentPathname(session)

		if (req.method === 'GET') {
			const blob = await get(pathname, {
				access: 'private',
				useCache: false,
			})

			if (!blob || blob.statusCode !== 200) {
				res.status(200).json({ document: null, user: getPublicUser(session) })
				return
			}

			const documentText = await readStreamText(blob.stream)
			res.status(200).json({ document: JSON.parse(documentText), user: getPublicUser(session) })
			return
		}

		if (req.method === 'PUT') {
			const body = getBodyObject(req.body)
			const document = body.document
			const documentText = JSON.stringify(document)
			if (new TextEncoder().encode(documentText).length > MAX_DOCUMENT_BYTES) {
				res.status(413).json({ error: 'Cloud document is too large.' })
				return
			}

			await put(pathname, documentText, {
				access: 'private',
				addRandomSuffix: false,
				allowOverwrite: true,
				contentType: 'application/json',
			})

			res.status(200).json({ ok: true, user: getPublicUser(session) })
			return
		}

		res.status(405).json({ error: 'Method not allowed.' })
	} catch (error) {
		res.status(500).json({
			error: error instanceof Error ? error.message : 'Cloud save failed.',
		})
	}
}
