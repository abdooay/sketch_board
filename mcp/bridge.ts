import { randomUUID } from 'node:crypto'
import WebSocket, { WebSocketServer } from 'ws'
import type {
	CanvasCommand,
	CanvasResponse,
	CanvasSessionSummary,
	CustomShapeInput,
	CustomShapeType,
	ExportFormat,
	JsonObject,
	TldrawShapeInput,
	TldrawShapeUpdate,
} from '../src/tldraw/automation/protocol.ts'
import {
	isCanvasCommand,
	isCanvasResponse,
	isRegisterCanvasMessage,
} from '../src/tldraw/automation/protocol.ts'

interface SessionRecord {
	session: CanvasSessionSummary
	socket: WebSocket
}

interface PendingRequest {
	resolve: (response: CanvasResponse) => void
	reject: (error: Error) => void
	timeout: ReturnType<typeof setTimeout>
	sessionId: string
}

interface BridgeListSessionsRequest {
	type: 'bridge_list_sessions'
	requestId: string
}

interface BridgeListSessionsResponse {
	type: 'bridge_list_sessions_response'
	requestId: string
	sessions: CanvasSessionSummary[]
}

interface BridgeProxyCommandRequest {
	type: 'bridge_proxy_command'
	requestId: string
	command: CanvasCommand
}

interface BridgeProxyCommandResponse {
	type: 'bridge_proxy_command_response'
	requestId: string
	response: CanvasResponse
}

type BridgeControlRequest = BridgeListSessionsRequest | BridgeProxyCommandRequest
type BridgeControlResponse = BridgeListSessionsResponse | BridgeProxyCommandResponse

interface BridgeControlPending {
	resolve: (response: BridgeControlResponse) => void
	reject: (error: Error) => void
	timeout: ReturnType<typeof setTimeout>
}

type BridgeCommand = CanvasCommand extends infer T
	? T extends { requestId: string }
		? Omit<T, 'requestId'>
		: never
	: never

export class SketchBoardBridge {
	private readonly pending = new Map<string, PendingRequest>()
	private readonly sessions = new Map<string, SessionRecord>()
	private readonly controlPending = new Map<string, BridgeControlPending>()
	private wss: WebSocketServer | null = null
	private remoteSocket: WebSocket | null = null
	private readonly ready: Promise<void>

	constructor(port: number) {
		this.ready = this.initialize(port)
	}

	async listSessions() {
		await this.ready
		if (this.remoteSocket) {
			return this.fetchRemoteSessions()
		}

		return [...this.sessions.values()]
			.map((record) => record.session)
			.sort((left, right) => left.connectedAt.localeCompare(right.connectedAt))
	}

	async createShape(sessionId: string, shape: TldrawShapeInput) {
		const response = await this.send({
			type: 'create_shape',
			sessionId,
			shape,
		})
		return { id: response.id ?? '' }
	}

	async createCustomShape(sessionId: string, shape: CustomShapeInput) {
		const response = await this.send({
			type: 'create_custom_shape',
			sessionId,
			shape,
		})
		return { id: response.id ?? '' }
	}

	async updateShape(sessionId: string, id: string, updates: TldrawShapeUpdate) {
		await this.send({
			type: 'update_shape',
			sessionId,
			id,
			updates,
		})
	}

	async deleteShapes(sessionId: string, ids: string[]) {
		await this.send({
			type: 'delete_shapes',
			sessionId,
			ids,
		})
	}

	async connectShapes(sessionId: string, from: string, to: string, label?: string, props?: JsonObject) {
		const response = await this.send({
			type: 'connect_shapes',
			sessionId,
			from,
			to,
			label,
			props,
		})
		return { id: response.id ?? '' }
	}

	async groupShapes(sessionId: string, ids: string[]) {
		const response = await this.send({
			type: 'group_shapes',
			sessionId,
			ids,
		})
		return { id: response.id ?? '' }
	}

	async ungroupShapes(sessionId: string, ids: string[]) {
		await this.send({
			type: 'ungroup_shapes',
			sessionId,
			ids,
		})
	}

	async getSnapshot(sessionId: string) {
		const response = await this.send({
			type: 'get_snapshot',
			sessionId,
		})
		return { shapes: response.shapes ?? [], bounds: response.bounds }
	}

	async clearCanvas(sessionId: string) {
		await this.send({
			type: 'clear_canvas',
			sessionId,
		})
	}

	async zoomToFit(sessionId: string) {
		await this.send({
			type: 'zoom_to_fit',
			sessionId,
		})
	}

	async exportCanvas(
		sessionId: string,
		format: ExportFormat,
		ids?: string[],
		background?: boolean,
		scale?: number
	) {
		const response = await this.send({
			type: 'export_canvas',
			sessionId,
			format,
			ids,
			background,
			scale,
		})
		return { data: response.data ?? '', format: response.format ?? format }
	}

	async listCustomShapeLibraryItems(sessionId: string, shapeType?: CustomShapeType) {
		const response = await this.send({
			type: 'list_custom_shape_library_items',
			sessionId,
			shapeType,
		})
		return response.items ?? []
	}

	close() {
		for (const pending of this.pending.values()) {
			clearTimeout(pending.timeout)
			pending.reject(new Error('Sketch Board bridge closed'))
		}
		this.pending.clear()

		for (const pending of this.controlPending.values()) {
			clearTimeout(pending.timeout)
			pending.reject(new Error('Sketch Board bridge closed'))
		}
		this.controlPending.clear()

		this.sessions.clear()
		this.remoteSocket?.close()
		this.wss?.close()
	}

	private async send(
		command: BridgeCommand
	): Promise<CanvasResponse & { ok: true }> {
		await this.ready
		if (this.remoteSocket) {
			return this.sendRemote(command)
		}

		return this.sendLocal(command)
	}

	private async initialize(port: number) {
		if (await this.canListenOnPort(port)) {
			this.wss = new WebSocketServer({ port })
			this.wss.on('connection', (socket) => this.handleConnection(socket))
			return
		}

		await this.connectToRemoteBridge(port)
	}

	private canListenOnPort(port: number) {
		return new Promise<boolean>((resolve) => {
			const probe = new WebSocketServer({ port })
			probe.once('listening', () => {
				probe.close(() => resolve(true))
			})
			probe.once('error', (error) => {
				const code = (error as NodeJS.ErrnoException).code
				if (code === 'EADDRINUSE') {
					resolve(false)
					return
				}
				resolve(false)
			})
		})
	}

	private connectToRemoteBridge(port: number) {
		return new Promise<void>((resolve, reject) => {
			const socket = new WebSocket(`ws://127.0.0.1:${port}`)
			const cleanup = () => {
				socket.removeAllListeners('open')
				socket.removeAllListeners('error')
			}

			socket.once('open', () => {
				cleanup()
				this.remoteSocket = socket
				socket.on('message', (raw) => this.handleRemoteMessage(raw.toString()))
				socket.on('close', () => this.handleRemoteClose())
				resolve()
			})

			socket.once('error', (error) => {
				cleanup()
				reject(error instanceof Error ? error : new Error(String(error)))
			})
		})
	}

	private async sendLocal(
		command: BridgeCommand
	): Promise<CanvasResponse & { ok: true }> {
		const session = this.sessions.get(command.sessionId)
		if (!session) {
			throw new Error(
				`No Sketch Board session '${command.sessionId}' is connected. Open the app and ensure the local bridge is enabled.`
			)
		}

		const requestId = randomUUID()
		const message = { ...command, requestId } satisfies CanvasCommand

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.pending.delete(requestId)
				reject(
					new Error(
						`Timed out waiting for Sketch Board session '${command.sessionId}' to handle '${command.type}'`
					)
				)
			}, 10000)

			this.pending.set(requestId, {
				resolve: (response) => {
					if (!response.ok) {
						reject(new Error(response.error))
						return
					}
					resolve(response)
				},
				reject,
				timeout,
				sessionId: command.sessionId,
			})

			session.socket.send(JSON.stringify(message), (error) => {
				if (!error) return

				const pending = this.pending.get(requestId)
				if (!pending) return

				clearTimeout(pending.timeout)
				this.pending.delete(requestId)
				reject(error instanceof Error ? error : new Error(String(error)))
			})
		})
	}

	private async sendRemote(
		command: BridgeCommand
	): Promise<CanvasResponse & { ok: true }> {
		const socket = this.remoteSocket
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			throw new Error('Sketch Board bridge is not connected')
		}

		const response = await this.sendControlRequest({
			type: 'bridge_proxy_command',
			requestId: randomUUID(),
			command: { ...command, requestId: randomUUID() },
		})

		if (response.type !== 'bridge_proxy_command_response') {
			throw new Error('Unexpected Sketch Board bridge response')
		}

		if (!response.response.ok) {
			throw new Error(response.response.error)
		}

		return response.response
	}

	private async fetchRemoteSessions() {
		const response = await this.sendControlRequest({
			type: 'bridge_list_sessions',
			requestId: randomUUID(),
		})

		if (response.type !== 'bridge_list_sessions_response') {
			throw new Error('Unexpected Sketch Board bridge response')
		}

		return response.sessions.sort((left, right) => left.connectedAt.localeCompare(right.connectedAt))
	}

	private sendControlRequest(request: BridgeControlRequest) {
		const socket = this.remoteSocket
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			return Promise.reject(new Error('Sketch Board bridge is not connected'))
		}

		return new Promise<BridgeControlResponse>((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.controlPending.delete(request.requestId)
				reject(new Error(`Timed out waiting for Sketch Board bridge to handle '${request.type}'`))
			}, 10000)

			this.controlPending.set(request.requestId, {
				resolve,
				reject,
				timeout,
			})

			socket.send(JSON.stringify(request), (error) => {
				if (!error) return

				const pending = this.controlPending.get(request.requestId)
				if (!pending) return

				clearTimeout(pending.timeout)
				this.controlPending.delete(request.requestId)
				reject(error instanceof Error ? error : new Error(String(error)))
			})
		})
	}

	private handleConnection(socket: WebSocket) {
		socket.on('message', (raw) => {
			try {
				const message = JSON.parse(raw.toString()) as unknown
				if (isRegisterCanvasMessage(message)) {
					this.sessions.set(message.session.sessionId, {
						session: message.session,
						socket,
					})
					return
				}

				if (isBridgeControlRequest(message)) {
					void this.handleBridgeControlRequest(socket, message)
					return
				}

				if (!isCanvasResponse(message)) return
				const pending = this.pending.get(message.requestId)
				if (!pending) return
				if (pending.sessionId !== message.sessionId) return

				clearTimeout(pending.timeout)
				this.pending.delete(message.requestId)
				pending.resolve(message)
			} catch {
				// Ignore malformed websocket traffic from the browser.
			}
		})

		socket.on('close', () => {
			const disconnectedSessions = [...this.sessions.values()]
				.filter((record) => record.socket === socket)
				.map((record) => record.session.sessionId)

			for (const sessionId of disconnectedSessions) {
				this.sessions.delete(sessionId)
			}

			for (const [requestId, pending] of this.pending.entries()) {
				if (!disconnectedSessions.includes(pending.sessionId)) continue
				clearTimeout(pending.timeout)
				this.pending.delete(requestId)
				pending.reject(new Error(`Sketch Board session '${pending.sessionId}' disconnected`))
			}
		})
	}

	private async handleBridgeControlRequest(socket: WebSocket, message: BridgeControlRequest) {
		if (message.type === 'bridge_list_sessions') {
			socket.send(
				JSON.stringify({
					type: 'bridge_list_sessions_response',
					requestId: message.requestId,
					sessions: await this.listSessions(),
				} satisfies BridgeListSessionsResponse)
			)
			return
		}

		try {
			const response = await this.sendLocal(message.command)
			socket.send(
				JSON.stringify({
					type: 'bridge_proxy_command_response',
					requestId: message.requestId,
					response,
				} satisfies BridgeProxyCommandResponse)
			)
		} catch (error) {
			socket.send(
				JSON.stringify({
					type: 'bridge_proxy_command_response',
					requestId: message.requestId,
					response: {
						type: 'response',
						requestId: message.command.requestId,
						sessionId: message.command.sessionId,
						ok: false,
						error: error instanceof Error ? error.message : String(error),
					},
				} satisfies BridgeProxyCommandResponse)
			)
		}
	}

	private handleRemoteMessage(raw: string) {
		try {
			const message = JSON.parse(raw) as unknown
			if (!isBridgeControlResponse(message)) return

			const pending = this.controlPending.get(message.requestId)
			if (!pending) return

			clearTimeout(pending.timeout)
			this.controlPending.delete(message.requestId)
			pending.resolve(message)
		} catch {
			// Ignore malformed websocket traffic from the bridge.
		}
	}

	private handleRemoteClose() {
		this.remoteSocket = null
		for (const pending of this.controlPending.values()) {
			clearTimeout(pending.timeout)
			pending.reject(new Error('Sketch Board bridge connection closed'))
		}
		this.controlPending.clear()
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null
}

function isBridgeControlRequest(value: unknown): value is BridgeControlRequest {
	if (!isRecord(value)) return false
	if (typeof value.type !== 'string') return false
	if (typeof value.requestId !== 'string') return false

	if (value.type === 'bridge_list_sessions') {
		return true
	}

	if (value.type === 'bridge_proxy_command') {
		return isCanvasCommand(value.command)
	}

	return false
}

function isBridgeControlResponse(value: unknown): value is BridgeControlResponse {
	if (!isRecord(value)) return false
	if (typeof value.type !== 'string') return false
	if (typeof value.requestId !== 'string') return false

	if (value.type === 'bridge_list_sessions_response') {
		return Array.isArray(value.sessions)
	}

	if (value.type === 'bridge_proxy_command_response') {
		return isCanvasResponse(value.response)
	}

	return false
}
