/// <reference types="node" />

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export interface VercelRequest {
	method?: string
	query?: Record<string, string | string[] | undefined>
	body?: unknown
	headers?: Record<string, string | string[] | undefined>
}

export interface VercelResponse {
	status(code: number): VercelResponse
	json(body: unknown): void
	setHeader(name: string, value: string | string[]): void
	end(body?: unknown): void
}

export interface AuthSession {
	sub: string
	email: string
	name: string
	picture?: string
	iat: number
	exp: number
}

export interface PublicAuthUser {
	email: string
	name: string
	picture?: string
}

const SESSION_COOKIE_NAME = 'sketch_board_session'
const OAUTH_STATE_COOKIE_NAME = 'sketch_board_oauth_state'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
const OAUTH_STATE_MAX_AGE_SECONDS = 60 * 10

export function getPublicUser(session: AuthSession): PublicAuthUser {
	return {
		email: session.email,
		name: session.name,
		...(session.picture ? { picture: session.picture } : {}),
	}
}

export function getUserDocumentPathname(session: AuthSession) {
	const userHash = createHash('sha256').update(`google:${session.sub}`).digest('hex')
	return `sketch-board/cloud-documents/google/${userHash}.json`
}

export function createSessionCookie(session: Omit<AuthSession, 'iat' | 'exp'>) {
	const now = Math.floor(Date.now() / 1000)
	return serializeCookie(
		SESSION_COOKIE_NAME,
		signSession({
			...session,
			iat: now,
			exp: now + SESSION_MAX_AGE_SECONDS,
		}),
		{
			httpOnly: true,
			maxAge: SESSION_MAX_AGE_SECONDS,
			path: '/',
			sameSite: 'Lax',
			secure: isSecureCookie(),
		}
	)
}

export function clearSessionCookie() {
	return serializeCookie(SESSION_COOKIE_NAME, '', {
		httpOnly: true,
		maxAge: 0,
		path: '/',
		sameSite: 'Lax',
		secure: isSecureCookie(),
	})
}

export function createOauthStateCookie(state: string) {
	return serializeCookie(OAUTH_STATE_COOKIE_NAME, state, {
		httpOnly: true,
		maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
		path: '/api/auth',
		sameSite: 'Lax',
		secure: isSecureCookie(),
	})
}

export function clearOauthStateCookie() {
	return serializeCookie(OAUTH_STATE_COOKIE_NAME, '', {
		httpOnly: true,
		maxAge: 0,
		path: '/api/auth',
		sameSite: 'Lax',
		secure: isSecureCookie(),
	})
}

export function createOauthState() {
	return base64UrlEncode(randomBytes(32))
}

export function getOauthState(req: VercelRequest) {
	return getCookie(req, OAUTH_STATE_COOKIE_NAME)
}

export function getSessionFromRequest(req: VercelRequest) {
	const signedSession = getCookie(req, SESSION_COOKIE_NAME)
	if (!signedSession) return null
	return verifySession(signedSession)
}

export function getOrigin(req: VercelRequest) {
	const host = getHeader(req, 'host') ?? 'localhost:5173'
	const proto = getHeader(req, 'x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
	return `${proto}://${host}`
}

export function getSingleQueryParam(value: string | string[] | undefined) {
	return Array.isArray(value) ? value[0] : value
}

function signSession(session: AuthSession) {
	const payload = base64UrlEncode(Buffer.from(JSON.stringify(session), 'utf8'))
	const signature = createHmac('sha256', getCookieSecret()).update(payload).digest()
	return `${payload}.${base64UrlEncode(signature)}`
}

function verifySession(value: string) {
	const [payload, signature] = value.split('.')
	if (!payload || !signature) return null

	const expectedSignature = createHmac('sha256', getCookieSecret()).update(payload).digest()
	const actualSignature = base64UrlDecode(signature)
	if (
		actualSignature.length !== expectedSignature.length ||
		!timingSafeEqual(actualSignature, expectedSignature)
	) {
		return null
	}

	try {
		const session = JSON.parse(base64UrlDecode(payload).toString('utf8')) as Partial<AuthSession>
		if (
			typeof session.sub !== 'string' ||
			typeof session.email !== 'string' ||
			typeof session.name !== 'string' ||
			typeof session.iat !== 'number' ||
			typeof session.exp !== 'number' ||
			session.exp <= Math.floor(Date.now() / 1000)
		) {
			return null
		}

		return session as AuthSession
	} catch {
		return null
	}
}

function getCookieSecret() {
	const secret = process.env.AUTH_COOKIE_SECRET?.trim()
	if (!secret) {
		throw new Error('AUTH_COOKIE_SECRET is required for cloud auth.')
	}
	return secret
}

function getCookie(req: VercelRequest, name: string) {
	const cookieHeader = getHeader(req, 'cookie')
	if (!cookieHeader) return null

	for (const part of cookieHeader.split(';')) {
		const [rawName, ...rawValueParts] = part.trim().split('=')
		if (rawName === name) {
			return decodeURIComponent(rawValueParts.join('='))
		}
	}

	return null
}

function getHeader(req: VercelRequest, name: string) {
	const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()]
	return Array.isArray(value) ? value[0] : value
}

function serializeCookie(
	name: string,
	value: string,
	options: {
		httpOnly: boolean
		maxAge: number
		path: string
		sameSite: 'Lax' | 'Strict' | 'None'
		secure: boolean
	}
) {
	const parts = [
		`${name}=${encodeURIComponent(value)}`,
		`Max-Age=${options.maxAge}`,
		`Path=${options.path}`,
		`SameSite=${options.sameSite}`,
	]

	if (options.httpOnly) parts.push('HttpOnly')
	if (options.secure) parts.push('Secure')

	return parts.join('; ')
}

function isSecureCookie() {
	return process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
}

function base64UrlEncode(value: Buffer) {
	return value.toString('base64url')
}

function base64UrlDecode(value: string) {
	return Buffer.from(value, 'base64url')
}
