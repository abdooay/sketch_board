import { randomUUID } from 'node:crypto'
import { WebSocketServer, type WebSocket } from 'ws'
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

type BridgeCommand = CanvasCommand extends infer T
	? T extends { requestId: string }
		? Omit<T, 'requestId'>
		: never
	: never

export class SketchBoardBridge {
	private readonly pending = new Map<string, PendingRequest>()
	private readonly sessions = new Map<string, SessionRecord>()
	private readonly wss: WebSocketServer

	constructor(port: number) {
		this.wss = new WebSocketServer({ port })
		this.wss.on('connection', (socket) => this.handleConnection(socket))
	}

	listSessions() {
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
		this.sessions.clear()
		this.wss.close()
	}

	private async send(
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
}
