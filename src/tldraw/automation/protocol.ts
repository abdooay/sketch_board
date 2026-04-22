export const builtInShapeTypes = [
	'geo',
	'text',
	'note',
	'arrow',
	'line',
	'draw',
	'highlight',
	'frame',
	'embed',
	'image',
	'video',
	'bookmark',
] as const

export const geoShapeTypes = [
	'cloud',
	'rectangle',
	'ellipse',
	'triangle',
	'diamond',
	'pentagon',
	'hexagon',
	'octagon',
	'star',
	'rhombus',
	'rhombus-2',
	'oval',
	'trapezoid',
	'arrow-right',
	'arrow-left',
	'arrow-up',
	'arrow-down',
	'check-box',
	'x-box',
	'heart',
] as const

export const exportFormats = ['png', 'svg', 'json'] as const
export const customShapeTypes = ['database', 'svg-symbol'] as const

export type BuiltInShapeType = (typeof builtInShapeTypes)[number]
export type GeoShapeType = (typeof geoShapeTypes)[number]
export type ExportFormat = (typeof exportFormats)[number]
export type CustomShapeType = (typeof customShapeTypes)[number]

export type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue }

export type JsonObject = { [key: string]: JsonValue }

export interface CanvasSessionSummary {
	sessionId: string
	pageUrl: string
	roomId: string | null
	projectId: string
	projectName: string
	isCollaborating: boolean
	connectedAt: string
	supportedCustomShapeTypes: CustomShapeType[]
}

export interface ShapeSnapshot {
	id: string
	type: string
	x: number
	y: number
	rotation: number
	parentId: string
	props: JsonObject
	meta: JsonObject
}

export interface CanvasBounds {
	x: number
	y: number
	width: number
	height: number
}

export interface CustomShapeLibraryItemSummary {
	id: string
	type: CustomShapeType
	label: string
	defaultProps: JsonObject
}

export interface TldrawShapeInput {
	type: BuiltInShapeType
	x: number
	y: number
	rotation?: number
	parentId?: string
	meta?: JsonObject
	props?: JsonObject
	width?: number
	height?: number
	text?: string
	geo?: GeoShapeType
	color?: string
	fill?: string
	name?: string
	url?: string
}

export interface TldrawShapeUpdate {
	type?: string
	x?: number
	y?: number
	rotation?: number
	parentId?: string
	meta?: JsonObject
	props?: JsonObject
	width?: number
	height?: number
	text?: string
	geo?: GeoShapeType
	color?: string
	fill?: string
	name?: string
	url?: string
}

export interface CustomShapeInput {
	type: CustomShapeType
	x: number
	y: number
	rotation?: number
	parentId?: string
	meta?: JsonObject
	props?: JsonObject
	width?: number
	height?: number
	libraryItemId?: string
}

export interface RegisterCanvasMessage {
	type: 'register_canvas'
	session: CanvasSessionSummary
}

export interface CreateShapeCommand {
	type: 'create_shape'
	requestId: string
	sessionId: string
	shape: TldrawShapeInput
}

export interface CreateCustomShapeCommand {
	type: 'create_custom_shape'
	requestId: string
	sessionId: string
	shape: CustomShapeInput
}

export interface UpdateShapeCommand {
	type: 'update_shape'
	requestId: string
	sessionId: string
	id: string
	updates: TldrawShapeUpdate
}

export interface DeleteShapesCommand {
	type: 'delete_shapes'
	requestId: string
	sessionId: string
	ids: string[]
}

export interface ConnectShapesCommand {
	type: 'connect_shapes'
	requestId: string
	sessionId: string
	from: string
	to: string
	label?: string
	props?: JsonObject
}

export interface GroupShapesCommand {
	type: 'group_shapes'
	requestId: string
	sessionId: string
	ids: string[]
}

export interface UngroupShapesCommand {
	type: 'ungroup_shapes'
	requestId: string
	sessionId: string
	ids: string[]
}

export interface GetSnapshotCommand {
	type: 'get_snapshot'
	requestId: string
	sessionId: string
}

export interface ClearCanvasCommand {
	type: 'clear_canvas'
	requestId: string
	sessionId: string
}

export interface ZoomToFitCommand {
	type: 'zoom_to_fit'
	requestId: string
	sessionId: string
}

export interface ExportCanvasCommand {
	type: 'export_canvas'
	requestId: string
	sessionId: string
	format: ExportFormat
	ids?: string[]
	background?: boolean
	scale?: number
}

export interface ListCustomShapeLibraryItemsCommand {
	type: 'list_custom_shape_library_items'
	requestId: string
	sessionId: string
	shapeType?: CustomShapeType
}

export type CanvasCommand =
	| CreateShapeCommand
	| CreateCustomShapeCommand
	| UpdateShapeCommand
	| DeleteShapesCommand
	| ConnectShapesCommand
	| GroupShapesCommand
	| UngroupShapesCommand
	| GetSnapshotCommand
	| ClearCanvasCommand
	| ZoomToFitCommand
	| ExportCanvasCommand
	| ListCustomShapeLibraryItemsCommand

export interface CanvasSuccessResponse {
	type: 'response'
	requestId: string
	sessionId: string
	ok: true
	id?: string
	ids?: string[]
	shapes?: ShapeSnapshot[]
	bounds?: CanvasBounds
	data?: string
	format?: ExportFormat
	items?: CustomShapeLibraryItemSummary[]
}

export interface CanvasErrorResponse {
	type: 'response'
	requestId: string
	sessionId: string
	ok: false
	error: string
}

export type CanvasResponse = CanvasSuccessResponse | CanvasErrorResponse

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null
}

export function isRegisterCanvasMessage(value: unknown): value is RegisterCanvasMessage {
	if (!isRecord(value)) return false
	if (value.type !== 'register_canvas') return false
	if (!isRecord(value.session)) return false
	return (
		typeof value.session.sessionId === 'string' &&
		typeof value.session.projectId === 'string' &&
		typeof value.session.projectName === 'string'
	)
}

export function isCanvasCommand(value: unknown): value is CanvasCommand {
	if (!isRecord(value)) return false
	if (typeof value.type !== 'string') return false
	if (typeof value.requestId !== 'string') return false
	if (typeof value.sessionId !== 'string') return false
	return true
}

export function isCanvasResponse(value: unknown): value is CanvasResponse {
	if (!isRecord(value)) return false
	if (value.type !== 'response') return false
	if (typeof value.requestId !== 'string') return false
	if (typeof value.sessionId !== 'string') return false
	if (typeof value.ok !== 'boolean') return false
	return value.ok || typeof value.error === 'string'
}
