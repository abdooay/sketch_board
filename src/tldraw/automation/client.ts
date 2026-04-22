import type { Editor } from 'tldraw'
import { handleCanvasCommand } from './commands'
import {
	type CanvasCommand,
	type CanvasSessionSummary,
	isCanvasCommand,
} from './protocol'
import { customShapeTypes } from './protocol'

const DEFAULT_AGENT_BRIDGE_URL = 'ws://localhost:4010'
const AGENT_SESSION_STORAGE_KEY = 'sketch-board-agent-session-id'
const AGENT_WS_PARAM = 'agent_ws'

export interface CanvasAutomationMetadata {
	roomId: string | null
	isCollaborating: boolean
	pageUrl: string
	projectId: string
	projectName: string
}

export interface CanvasAutomationClient {
	dispose(): void
}

function getAutomationBridgeUrl() {
	if (typeof window !== 'undefined') {
		const params = new URLSearchParams(window.location.search)
		const fromQuery = params.get(AGENT_WS_PARAM)?.trim()
		if (fromQuery) return fromQuery
	}

	const configured = import.meta.env.VITE_TLDRAW_AGENT_WS_URL?.trim()
	if (configured) return configured
	if (import.meta.env.DEV) return DEFAULT_AGENT_BRIDGE_URL
	return null
}

function getSessionId() {
	const stored = window.sessionStorage.getItem(AGENT_SESSION_STORAGE_KEY)
	if (stored) return stored

	const next =
		typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
			? `sketch-board-agent-${crypto.randomUUID()}`
			: `sketch-board-agent-${Math.random().toString(36).slice(2, 10)}`

	window.sessionStorage.setItem(AGENT_SESSION_STORAGE_KEY, next)
	return next
}

export function createCanvasAutomationClient(
	editor: Editor,
	getMetadata: () => CanvasAutomationMetadata
): CanvasAutomationClient | null {
	const url = getAutomationBridgeUrl()
	if (!url || typeof window === 'undefined') return null

	const sessionId = getSessionId()
	let disposed = false
	let ws: WebSocket | null = null
	let reconnectTimeout: number | null = null

	const connect = () => {
		if (disposed) return

		const socket = new WebSocket(url)
		ws = socket

		socket.onopen = () => {
			const metadata = getMetadata()
			const session: CanvasSessionSummary = {
				sessionId,
				pageUrl: metadata.pageUrl,
				roomId: metadata.roomId,
				projectId: metadata.projectId,
				projectName: metadata.projectName,
				isCollaborating: metadata.isCollaborating,
				connectedAt: new Date().toISOString(),
				supportedCustomShapeTypes: [...customShapeTypes],
			}

			socket.send(JSON.stringify({ type: 'register_canvas', session }))
		}

		socket.onmessage = async (event) => {
			try {
				const message = JSON.parse(event.data) as unknown
				if (!isCanvasCommand(message)) return
				if (message.sessionId !== sessionId) return

				const response = await handleCanvasCommand(editor, message)
				if (socket.readyState === WebSocket.OPEN) {
					socket.send(JSON.stringify(response))
				}
			} catch (error) {
				const command = safeParseCommand(event.data)
				if (!command || socket.readyState !== WebSocket.OPEN) return
				socket.send(
					JSON.stringify({
						type: 'response',
						requestId: command.requestId,
						sessionId: command.sessionId,
						ok: false,
						error: error instanceof Error ? error.message : String(error),
					})
				)
			}
		}

		socket.onclose = () => {
			if (disposed) return
			reconnectTimeout = window.setTimeout(connect, 1500)
		}

		socket.onerror = () => {
			socket.close()
		}
	}

	connect()

	return {
		dispose() {
			disposed = true
			if (reconnectTimeout !== null) {
				window.clearTimeout(reconnectTimeout)
			}
			if (ws && ws.readyState !== WebSocket.CLOSED) {
				ws.close()
			}
			ws = null
		},
	}
}

function safeParseCommand(raw: unknown): CanvasCommand | null {
	if (typeof raw !== 'string') return null

	try {
		const parsed = JSON.parse(raw) as unknown
		return isCanvasCommand(parsed) ? parsed : null
	} catch {
		return null
	}
}
