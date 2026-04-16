import {
	createShapeId,
	Editor,
	serializeTldrawJson,
	toRichText,
} from 'tldraw'
import type { TLShape, TLShapeId } from 'tldraw'
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

				const patch = buildShapePatch(cmd.updates, cmd.updates.type ?? shape.type, shape)
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

	const props = normalizeShapeProps(input, shapeType)
	if (Object.keys(props).length > 0) {
		patch.props = {
			...toJsonObject(existingShape?.props ?? {}),
			...props,
		}
	}

	return patch
}

export function normalizeShapeProps(
	input: Partial<TldrawShapeInput> | TldrawShapeUpdate,
	shapeType: string
): Record<string, unknown> {
	const props: Record<string, unknown> = {
		...toJsonObject(input.props ?? {}),
	}

	if (input.width !== undefined) {
		props.w = input.width
		if (shapeType === 'text' && input.props?.autoSize === undefined) {
			props.autoSize = false
		}
	}

	if (input.height !== undefined) props.h = input.height
	if (input.color !== undefined) props.color = input.color
	if (input.fill !== undefined) props.fill = input.fill
	if (input.geo !== undefined && shapeType === 'geo') props.geo = input.geo
	if (input.name !== undefined && shapeType === 'frame') props.name = input.name
	if (input.url !== undefined) props.url = input.url

	if (input.text !== undefined) {
		if (supportsRichTextAlias(shapeType)) {
			props.richText = toRichText(input.text)
		}
		if (supportsPlainTextAlias(shapeType)) {
			props.text = input.text
		}
	}

	if (shapeType === 'arrow') {
		normalizeLegacyArrowProps(props)
	}

	return props
}

function supportsRichTextAlias(shapeType: string) {
	return shapeType === 'geo' || shapeType === 'text' || shapeType === 'note'
}

function supportsPlainTextAlias(shapeType: string) {
	return shapeType === 'arrow'
}

function normalizeLegacyArrowProps(props: Record<string, unknown>) {
	if ('elbowed' in props) {
		if (props.kind === undefined && typeof props.elbowed === 'boolean') {
			props.kind = props.elbowed ? 'elbow' : 'arc'
		}
		delete props.elbowed
	}
}

async function createShapeFromInput(editor: Editor, input: TldrawShapeInput) {
	const id = createShapeId()
	const patch = buildShapePatch(input, input.type)

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
	const props = {
		...getDefaultCustomShapeProps(input.type, libraryItem),
		...toJsonObject(input.props ?? {}),
	}

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
