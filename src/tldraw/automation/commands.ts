import {
	createShapeId,
	Editor,
	serializeTldrawJson,
	toRichText,
} from 'tldraw'
import type { TLShape, TLShapeId } from 'tldraw'
import { getIndices } from '@tldraw/utils'
import {
	DEFAULT_DATABASE_LIBRARY_ITEM_ID,
	type CustomShapeLibraryItem,
} from '../custom-shape-registry'
import {
	getRuntimeActiveCustomShapeLibraryItemForType,
	getRuntimeCustomShapeLibraryItems,
} from '../custom-shape-library-state'
import type {
	CanvasCommand,
	CanvasResponse,
	CustomShapeInput,
	CustomShapeLibraryItemSummary,
	JsonObject,
	ShapeSnapshot,
	TldrawShapeInput,
	TldrawShapeUpdate,
} from './protocol'

type ShapePatch = Partial<TLShape> & {
	props?: Record<string, unknown>
	meta?: Record<string, unknown>
}

const TL_COLOR_ALIASES: Record<string, string> = Object.freeze({
	'gray': 'grey',
	'light-gray': 'grey',
	'light-grey': 'grey',
	'purple': 'violet',
	'light-purple': 'light-violet',
})

export async function handleCanvasCommand(editor: Editor, cmd: CanvasCommand): Promise<CanvasResponse> {
	const base = {
		type: 'response' as const,
		requestId: cmd.requestId,
		sessionId: cmd.sessionId,
	}

	try {
		switch (cmd.type) {
			case 'create_shape': {
				const id = await createShapeFromInput(editor, cmd.shape)
				return { ...base, ok: true, id }
			}

			case 'create_custom_shape': {
				const id = createCustomShape(editor, cmd.shape)
				return { ...base, ok: true, id }
			}

			case 'update_shape': {
				const shape = editor.getShape(cmd.id as TLShapeId)
				if (!shape) {
					return errorResponse(base, 'Shape not found')
				}

				const patch = buildShapePatch(editor, cmd.updates, cmd.updates.type ?? shape.type, shape)
				editor.updateShape({
					id: shape.id,
					type: shape.type,
					...patch,
				})

				return { ...base, ok: true, id: shape.id }
			}

			case 'delete_shapes': {
				editor.deleteShapes(cmd.ids as TLShapeId[])
				return { ...base, ok: true, ids: cmd.ids }
			}

			case 'connect_shapes': {
				const result = connectShapes(editor, cmd.from, cmd.to, cmd.label, cmd.props)
				return result.ok
					? { ...base, ok: true, id: result.id }
					: errorResponse(base, result.error)
			}

			case 'group_shapes': {
				editor.setCurrentTool('select')
				const groupId = createShapeId()
				editor.groupShapes(cmd.ids as TLShapeId[], { groupId, select: false })
				return { ...base, ok: true, id: groupId }
			}

			case 'ungroup_shapes': {
				editor.setCurrentTool('select')
				editor.ungroupShapes(cmd.ids as TLShapeId[], { select: false })
				return { ...base, ok: true, ids: cmd.ids }
			}

			case 'get_snapshot': {
				const bounds = editor.getCurrentPageBounds()
				return {
					...base,
					ok: true,
					shapes: editor.getCurrentPageShapes().map(toShapeSnapshot),
					bounds: bounds
						? {
								x: bounds.x,
								y: bounds.y,
								width: bounds.width,
								height: bounds.height,
						  }
						: undefined,
				}
			}

			case 'clear_canvas': {
				editor.deleteShapes([...editor.getCurrentPageShapeIds()])
				return { ...base, ok: true }
			}

			case 'zoom_to_fit': {
				editor.zoomToFit({ animation: { duration: 200 } })
				return { ...base, ok: true }
			}

			case 'export_canvas': {
				const ids = cmd.ids?.length ? (cmd.ids as TLShapeId[]) : []
				if (cmd.format === 'json') {
					const data = ids.length
						? JSON.stringify(ids.map((id) => editor.getShape(id)).filter(Boolean), null, 2)
						: await serializeTldrawJson(editor)
					return { ...base, ok: true, data, format: 'json' }
				}

				if (cmd.format === 'svg') {
					const svg = await editor.getSvgString(ids, {
						background: cmd.background,
						scale: cmd.scale,
					})
					if (!svg) return errorResponse(base, 'Failed to export SVG')
					return { ...base, ok: true, data: svg.svg, format: 'svg' }
				}

				const image = await editor.toImage(ids, {
					format: 'png',
					background: cmd.background,
					scale: cmd.scale,
				})
				if (!image) return errorResponse(base, 'Failed to export PNG')
				return {
					...base,
					ok: true,
					data: await blobToDataUrl(image.blob),
					format: 'png',
				}
			}

			case 'list_custom_shape_library_items': {
				const items = getCustomShapeLibraryItemSummaries(cmd.shapeType)
				return { ...base, ok: true, items }
			}
		}
	} catch (error) {
		return errorResponse(base, error instanceof Error ? error.message : String(error))
	}
}

export function buildShapePatch(
	editor: Editor,
	input: Partial<TldrawShapeInput> | TldrawShapeUpdate,
	shapeType: string,
	existingShape?: TLShape
): ShapePatch {
	const patch: ShapePatch = {}

	if (input.x !== undefined) patch.x = input.x
	if (input.y !== undefined) patch.y = input.y
	if (input.rotation !== undefined) patch.rotation = input.rotation
	if (input.parentId !== undefined) patch.parentId = input.parentId as TLShape['parentId']

	if (input.meta) {
		patch.meta = {
			...toJsonObject(existingShape?.meta ?? {}),
			...toJsonObject(input.meta),
		}
	}

	const props = normalizeShapeProps(editor, input, shapeType)
	if (Object.keys(props).length > 0) {
		patch.props = {
			...toJsonObject(existingShape?.props ?? {}),
			...props,
		}
	}

	return patch
}

export function normalizeShapeProps(
	editor: Editor,
	input: Partial<TldrawShapeInput> | TldrawShapeUpdate,
	shapeType: string
): Record<string, unknown> {
	const allowedPropKeys = getAllowedShapePropKeys(editor, shapeType)
	const props: Record<string, unknown> = sanitizeShapeProps(allowedPropKeys, {
		...toJsonObject(input.props ?? {}),
	})

	if (input.width !== undefined && allowedPropKeys.has('w')) {
		props.w = input.width
		if (allowedPropKeys.has('autoSize') && input.props?.autoSize === undefined) {
			props.autoSize = false
		}
	}

	if (input.height !== undefined && allowedPropKeys.has('h')) props.h = input.height
	if (typeof props.color === 'string' && allowedPropKeys.has('color')) {
		props.color = normalizeTldrawColor(props.color)
	}
	if (input.color !== undefined && allowedPropKeys.has('color')) {
		props.color = normalizeTldrawColor(input.color)
	}
	if (input.fill !== undefined && allowedPropKeys.has('fill')) props.fill = input.fill
	if (input.geo !== undefined && allowedPropKeys.has('geo')) props.geo = input.geo
	if (input.name !== undefined && allowedPropKeys.has('name')) props.name = input.name
	if (input.url !== undefined && allowedPropKeys.has('url')) props.url = input.url

	if (input.text !== undefined) {
		if (allowedPropKeys.has('richText')) {
			props.richText = toRichText(input.text)
		}
		if (allowedPropKeys.has('text')) {
			props.text = input.text
		}
	}

	if (shapeType === 'arrow') {
		normalizeLegacyArrowProps(props)
	}
	if (shapeType === 'line') {
		normalizeLineProps(props)
	}

	return props
}

function getAllowedShapePropKeys(editor: Editor, shapeType: string) {
	const defaultProps = editor.getShapeUtil(shapeType).getDefaultProps() as Record<string, unknown>
	return new Set(Object.keys(defaultProps))
}

function sanitizeShapeProps(allowedPropKeys: Set<string>, props: Record<string, unknown>) {
	return Object.fromEntries(
		Object.entries(props).filter(([key]) => allowedPropKeys.has(key))
	)
}

function normalizeLegacyArrowProps(props: Record<string, unknown>) {
	if ('elbowed' in props) {
		if (props.kind === undefined && typeof props.elbowed === 'boolean') {
			props.kind = props.elbowed ? 'elbow' : 'arc'
		}
		delete props.elbowed
	}
}

function normalizeTldrawColor(value: string) {
	const normalized = value.trim().toLowerCase()
	return TL_COLOR_ALIASES[normalized] ?? normalized
}

function normalizeLineProps(props: Record<string, unknown>) {
	const rawPoints = props.points
	if (!rawPoints) return

	if (Array.isArray(rawPoints)) {
		props.points = normalizeLinePointsArray(rawPoints)
		return
	}

	if (typeof rawPoints === 'object') {
		props.points = normalizeLinePointsRecord(rawPoints as Record<string, unknown>)
	}
}

function normalizeLinePointsArray(rawPoints: unknown[]) {
	const points = rawPoints
		.map((point) => normalizeLoosePoint(point))
		.filter((point): point is { x: number; y: number } => point !== null)

	const indices = getIndices(points.length)

	return Object.fromEntries(
		points.map((point, index) => {
			const id = indices[index]
			return [
				id,
				{
					id,
					index: id,
					x: point.x,
					y: point.y,
				},
			]
		})
	)
}

function normalizeLinePointsRecord(rawPoints: Record<string, unknown>) {
	const entries = Object.entries(rawPoints).map(([key, value]) => {
		const point = normalizeLoosePoint(value)
		if (!point) return null

		const existing = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
		const id =
			typeof existing.id === 'string' && existing.id.trim().length > 0 ? existing.id : key
		const index =
			typeof existing.index === 'string' && existing.index.trim().length > 0
				? existing.index
				: id

		return [
			id,
			{
				id,
				index,
				x: point.x,
				y: point.y,
			},
		] as const
	})

	return Object.fromEntries(entries.filter((entry): entry is NonNullable<typeof entry> => entry !== null))
}

function normalizeLoosePoint(value: unknown) {
	if (!value || typeof value !== 'object') return null

	const point = value as Record<string, unknown>
	const x = typeof point.x === 'number' && Number.isFinite(point.x) ? point.x : null
	const y = typeof point.y === 'number' && Number.isFinite(point.y) ? point.y : null

	if (x === null || y === null) return null
	return { x, y }
}

async function createShapeFromInput(editor: Editor, input: TldrawShapeInput) {
	const id = createShapeId()
	const patch = buildShapePatch(editor, input, input.type)

	editor.createShape({
		id,
		type: input.type,
		x: input.x,
		y: input.y,
		rotation: input.rotation,
		parentId: input.parentId as TLShape['parentId'],
		meta: input.meta as TLShape['meta'] | undefined,
		props: patch.props,
	})

	await hydrateBookmarkAssetIfNeeded(editor, id, input.type, patch.props)

	return id
}

function createCustomShape(editor: Editor, input: CustomShapeInput) {
	const id = createShapeId()
	const libraryItem = getRequestedLibraryItem(input)
	const props = sanitizeShapeProps(getAllowedShapePropKeys(editor, input.type), {
		...getDefaultCustomShapeProps(input.type, libraryItem),
		...toJsonObject(input.props ?? {}),
	})

	if (input.width !== undefined) props.w = input.width
	if (input.height !== undefined) props.h = input.height
	if (libraryItem?.id) props.libraryItemId = libraryItem.id

	editor.createShape({
		id,
		type: input.type,
		x: input.x,
		y: input.y,
		rotation: input.rotation,
		parentId: input.parentId as TLShape['parentId'],
		meta: input.meta as TLShape['meta'] | undefined,
		props,
	})

	return id
}

function getRequestedLibraryItem(input: CustomShapeInput) {
	if (input.libraryItemId) {
		const libraryItem = getRuntimeCustomShapeLibraryItems().find(
			(item) => item.id === input.libraryItemId
		)
		if (!libraryItem) {
			throw new Error(`Custom shape library item '${input.libraryItemId}' was not found`)
		}
		if (libraryItem.type !== input.type) {
			throw new Error(
				`Custom shape library item '${input.libraryItemId}' is '${libraryItem.type}', expected '${input.type}'`
			)
		}
		return libraryItem
	}

	return getRuntimeActiveCustomShapeLibraryItemForType(input.type)
}

function getDefaultCustomShapeProps(type: CustomShapeInput['type'], item: CustomShapeLibraryItem | null) {
	if (type === 'database') {
		const databaseItem = item?.type === 'database' ? item : null
		return {
			w: databaseItem?.defaultProps.w ?? 240,
			h: databaseItem?.defaultProps.h ?? 160,
			color: databaseItem?.defaultProps.color ?? 'blue',
			fill: databaseItem?.defaultProps.fill ?? 'semi',
			size: databaseItem?.defaultProps.size ?? 'm',
			libraryItemId: databaseItem?.id ?? DEFAULT_DATABASE_LIBRARY_ITEM_ID,
		}
	}

	const svgItem = item?.type === 'svg-symbol' ? item : null
	return {
		w: svgItem?.defaultProps.w ?? 240,
		h: svgItem?.defaultProps.h ?? 160,
		libraryItemId: svgItem?.id ?? '',
	}
}

async function hydrateBookmarkAssetIfNeeded(
	editor: Editor,
	shapeId: TLShapeId,
	shapeType: string,
	props?: Record<string, unknown>
) {
	if (shapeType !== 'bookmark') return
	if (!props || props.assetId) return
	if (typeof props.url !== 'string' || props.url.length === 0) return

	try {
		const asset = await editor.getAssetForExternalContent({ type: 'url', url: props.url })
		if (!asset) return
		editor.createAssets([asset])
		editor.updateShape({
			id: shapeId,
			type: 'bookmark',
			props: { assetId: asset.id },
		})
	} catch {
		// Leave the bookmark shape in place even if metadata lookup fails.
	}
}

function connectShapes(
	editor: Editor,
	fromId: string,
	toId: string,
	label?: string,
	props?: JsonObject
): { ok: true; id: string } | { ok: false; error: string } {
	const fromShape = editor.getShape(fromId as TLShapeId)
	const toShape = editor.getShape(toId as TLShapeId)
	if (!fromShape || !toShape) return { ok: false, error: 'Shape not found' }

	const fromBounds = editor.getShapePageBounds(fromShape.id)
	const toBounds = editor.getShapePageBounds(toShape.id)
	if (!fromBounds || !toBounds) return { ok: false, error: 'Could not get shape bounds' }

	const arrowId = createShapeId()
	const mergedProps: Record<string, unknown> = {
		...toJsonObject(props ?? {}),
		start: { x: 0, y: 0 },
		end: {
			x: toBounds.center.x - fromBounds.center.x,
			y: toBounds.center.y - fromBounds.center.y,
		},
	}

	if (label) {
		mergedProps.text = label
	}

	editor.createShape({
		id: arrowId,
		type: 'arrow',
		x: Math.min(fromBounds.center.x, toBounds.center.x),
		y: Math.min(fromBounds.center.y, toBounds.center.y),
		props: mergedProps,
	})

	editor.createBindings([
		{
			fromId: arrowId,
			toId: fromShape.id,
			type: 'arrow',
			props: {
				terminal: 'start',
				normalizedAnchor: { x: 0.5, y: 0.5 },
				isExact: false,
				isPrecise: false,
			},
		},
		{
			fromId: arrowId,
			toId: toShape.id,
			type: 'arrow',
			props: {
				terminal: 'end',
				normalizedAnchor: { x: 0.5, y: 0.5 },
				isExact: false,
				isPrecise: false,
			},
		},
	])

	return { ok: true, id: arrowId }
}

function getCustomShapeLibraryItemSummaries(shapeType?: CustomShapeInput['type']) {
	return getRuntimeCustomShapeLibraryItems()
		.filter((item) => !shapeType || item.type === shapeType)
		.map(toCustomShapeLibraryItemSummary)
}

function toCustomShapeLibraryItemSummary(item: CustomShapeLibraryItem): CustomShapeLibraryItemSummary {
	return {
		id: item.id,
		type: item.type,
		label: item.label,
		defaultProps: toJsonObject(item.defaultProps),
	}
}

function toShapeSnapshot(shape: TLShape): ShapeSnapshot {
	return {
		id: shape.id,
		type: shape.type,
		x: shape.x,
		y: shape.y,
		rotation: shape.rotation,
		parentId: shape.parentId,
		props: toJsonObject(shape.props),
		meta: toJsonObject(shape.meta),
	}
}

function toJsonObject(value: unknown): JsonObject {
	if (!value || typeof value !== 'object') return {}
	return JSON.parse(JSON.stringify(value)) as JsonObject
}

function errorResponse(
	base: Pick<CanvasResponse, 'requestId' | 'sessionId' | 'type'>,
	error: string
): CanvasResponse {
	return { ...base, ok: false, error }
}

function blobToDataUrl(blob: Blob) {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader()
		reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'))
		reader.onloadend = () => resolve(String(reader.result))
		reader.readAsDataURL(blob)
	})
}
