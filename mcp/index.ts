#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { SketchBoardBridge } from './bridge.js'
import {
	BuiltInShapeType,
	CustomShapeInputSchema,
	CustomShapeType,
	ExportFormat,
	GeoShape,
	GenericShapeInputSchema,
	GenericShapeUpdateSchema,
	JsonObjectSchema,
} from './schema.js'

const DEFAULT_WS_PORT = 4010
const bridge = new SketchBoardBridge(getBridgePort())

const server = new McpServer({
	name: 'sketch-board-mcp',
	version: '0.1.0',
})

const genericShapeArgs = {
	sessionId: z.string().optional().describe('Optional Sketch Board session ID'),
	type: BuiltInShapeType.describe('Built-in tldraw shape type'),
	x: z.number().describe('X coordinate'),
	y: z.number().describe('Y coordinate'),
	rotation: z.number().optional().describe('Rotation in radians'),
	parentId: z.string().optional().describe('Optional parent shape/page ID'),
	props: JsonObjectSchema.optional().describe('Shape-native tldraw props'),
	meta: JsonObjectSchema.optional().describe('Optional metadata object'),
	width: z.number().optional().describe('Convenience alias for props.w'),
	height: z.number().optional().describe('Convenience alias for props.h'),
	text: z.string().optional().describe('Convenience alias for shape text props'),
	geo: GeoShape.optional().describe('Geo subtype for geo shapes'),
	color: z.string().optional().describe('Convenience alias for props.color'),
	fill: z.string().optional().describe('Convenience alias for props.fill'),
	name: z.string().optional().describe('Convenience alias for frame name'),
	url: z.string().url().optional().describe('Convenience alias for props.url'),
}

function textResult(text: string) {
	return { content: [{ type: 'text' as const, text }] }
}

function errorResult(error: unknown) {
	return {
		content: [
			{
				type: 'text' as const,
				text: `Error: ${error instanceof Error ? error.message : String(error)}`,
			},
		],
		isError: true,
	}
}

server.tool(
	'list_sketch_board_sessions',
	'List the open Sketch Board canvas sessions currently connected to the local bridge.',
	{},
	async () => {
		try {
			return textResult(JSON.stringify(await bridge.listSessions(), null, 2))
		} catch (error) {
			return errorResult(error)
		}
	}
)

server.tool(
	'create_tldraw_shape',
	'Create any built-in tldraw shape in the connected Sketch Board canvas.',
	genericShapeArgs,
	async (args) => {
		try {
			const sessionId = await resolveSessionId(args.sessionId)
			const shape = GenericShapeInputSchema.parse(args)
			const result = await bridge.createShape(sessionId, shape)
			return textResult(JSON.stringify({ sessionId, id: result.id }, null, 2))
		} catch (error) {
			return errorResult(error)
		}
	}
)

server.tool(
	'create_custom_shape',
	'Create a Sketch Board custom shape such as database or svg-symbol.',
	{
		sessionId: z.string().optional().describe('Optional Sketch Board session ID'),
		type: CustomShapeType.describe('Custom shape type'),
		x: z.number().describe('X coordinate'),
		y: z.number().describe('Y coordinate'),
		rotation: z.number().optional().describe('Rotation in radians'),
		parentId: z.string().optional().describe('Optional parent shape/page ID'),
		props: JsonObjectSchema.optional().describe('Custom shape props to merge'),
		meta: JsonObjectSchema.optional().describe('Optional metadata object'),
		width: z.number().optional().describe('Convenience alias for props.w'),
		height: z.number().optional().describe('Convenience alias for props.h'),
		libraryItemId: z.string().optional().describe('Optional custom shape library item ID'),
	},
	async (args) => {
		try {
			const sessionId = await resolveSessionId(args.sessionId)
			const shape = CustomShapeInputSchema.parse(args)
			const result = await bridge.createCustomShape(sessionId, shape)
			return textResult(JSON.stringify({ sessionId, id: result.id }, null, 2))
		} catch (error) {
			return errorResult(error)
		}
	}
)

server.tool(
	'update_shape',
	'Update any existing shape in the connected Sketch Board canvas.',
	{
		sessionId: z.string().optional().describe('Optional Sketch Board session ID'),
		id: z.string().describe('Shape ID'),
		type: z.string().optional().describe('Optional shape type hint'),
		x: z.number().optional().describe('New X coordinate'),
		y: z.number().optional().describe('New Y coordinate'),
		rotation: z.number().optional().describe('New rotation in radians'),
		parentId: z.string().optional().describe('Optional new parent shape/page ID'),
		props: JsonObjectSchema.optional().describe('Shape-native props to merge'),
		meta: JsonObjectSchema.optional().describe('Metadata fields to merge'),
		width: z.number().optional().describe('New width'),
		height: z.number().optional().describe('New height'),
		text: z.string().optional().describe('New text content'),
		geo: GeoShape.optional().describe('New geo subtype'),
		color: z.string().optional().describe('New color'),
		fill: z.string().optional().describe('New fill style'),
		name: z.string().optional().describe('New frame name'),
		url: z.string().url().optional().describe('New URL'),
	},
	async (args) => {
		try {
			const sessionId = await resolveSessionId(args.sessionId)
			const { id, ...updates } = z
				.object({
					sessionId: z.string().optional(),
					id: z.string(),
					type: z.string().optional(),
					x: z.number().optional(),
					y: z.number().optional(),
					rotation: z.number().optional(),
					parentId: z.string().optional(),
					props: JsonObjectSchema.optional(),
					meta: JsonObjectSchema.optional(),
					width: z.number().optional(),
					height: z.number().optional(),
					text: z.string().optional(),
					geo: GeoShape.optional(),
					color: z.string().optional(),
					fill: z.string().optional(),
					name: z.string().optional(),
					url: z.string().url().optional(),
				})
				.parse(args)
			const parsedUpdates = GenericShapeUpdateSchema.parse(updates)
			await bridge.updateShape(sessionId, id, parsedUpdates)
			return textResult(JSON.stringify({ sessionId, id }, null, 2))
		} catch (error) {
			return errorResult(error)
		}
	}
)

server.tool(
	'delete_shapes',
	'Delete one or more shapes from the connected Sketch Board canvas.',
	{
		sessionId: z.string().optional().describe('Optional Sketch Board session ID'),
		ids: z.array(z.string()).describe('Shape IDs to delete'),
	},
	async (args) => {
		try {
			const sessionId = await resolveSessionId(args.sessionId)
			await bridge.deleteShapes(sessionId, args.ids)
			return textResult(JSON.stringify({ sessionId, ids: args.ids }, null, 2))
		} catch (error) {
			return errorResult(error)
		}
	}
)

server.tool(
	'connect_shapes',
	'Connect two shapes with an arrow in the connected Sketch Board canvas.',
	{
		sessionId: z.string().optional().describe('Optional Sketch Board session ID'),
		from: z.string().describe('Source shape ID'),
		to: z.string().describe('Target shape ID'),
		label: z.string().optional().describe('Arrow label'),
		props: JsonObjectSchema.optional().describe('Optional native arrow props to merge'),
	},
	async (args) => {
		try {
			const sessionId = await resolveSessionId(args.sessionId)
			const result = await bridge.connectShapes(sessionId, args.from, args.to, args.label, args.props)
			return textResult(JSON.stringify({ sessionId, id: result.id }, null, 2))
		} catch (error) {
			return errorResult(error)
		}
	}
)

server.tool(
	'group_shapes',
	'Group multiple shapes together in the connected Sketch Board canvas.',
	{
		sessionId: z.string().optional().describe('Optional Sketch Board session ID'),
		ids: z.array(z.string()).describe('Shape IDs to group'),
	},
	async (args) => {
		try {
			const sessionId = await resolveSessionId(args.sessionId)
			const result = await bridge.groupShapes(sessionId, args.ids)
			return textResult(JSON.stringify({ sessionId, id: result.id }, null, 2))
		} catch (error) {
			return errorResult(error)
		}
	}
)

server.tool(
	'ungroup_shapes',
	'Ungroup one or more group shapes in the connected Sketch Board canvas.',
	{
		sessionId: z.string().optional().describe('Optional Sketch Board session ID'),
		ids: z.array(z.string()).describe('Group IDs to ungroup'),
	},
	async (args) => {
		try {
			const sessionId = await resolveSessionId(args.sessionId)
			await bridge.ungroupShapes(sessionId, args.ids)
			return textResult(JSON.stringify({ sessionId, ids: args.ids }, null, 2))
		} catch (error) {
			return errorResult(error)
		}
	}
)

server.tool(
	'get_snapshot',
	'Get the current Sketch Board canvas state with shape props and page bounds.',
	{
		sessionId: z.string().optional().describe('Optional Sketch Board session ID'),
	},
	async (args) => {
		try {
			const sessionId = await resolveSessionId(args.sessionId)
			const snapshot = await bridge.getSnapshot(sessionId)
			return textResult(JSON.stringify({ sessionId, ...snapshot }, null, 2))
		} catch (error) {
			return errorResult(error)
		}
	}
)

server.tool(
	'list_custom_shape_library_items',
	'List the custom shape library items available in the connected Sketch Board canvas.',
	{
		sessionId: z.string().optional().describe('Optional Sketch Board session ID'),
		shapeType: CustomShapeType.optional().describe('Optional custom shape type filter'),
	},
	async (args) => {
		try {
			const sessionId = await resolveSessionId(args.sessionId)
			const items = await bridge.listCustomShapeLibraryItems(sessionId, args.shapeType)
			return textResult(JSON.stringify({ sessionId, items }, null, 2))
		} catch (error) {
			return errorResult(error)
		}
	}
)

server.tool(
	'zoom_to_fit',
	'Zoom the connected Sketch Board canvas to fit all current shapes.',
	{
		sessionId: z.string().optional().describe('Optional Sketch Board session ID'),
	},
	async (args) => {
		try {
			const sessionId = await resolveSessionId(args.sessionId)
			await bridge.zoomToFit(sessionId)
			return textResult(JSON.stringify({ sessionId, ok: true }, null, 2))
		} catch (error) {
			return errorResult(error)
		}
	}
)

server.tool(
	'clear_canvas',
	'Delete all shapes on the current page of the connected Sketch Board canvas.',
	{
		sessionId: z.string().optional().describe('Optional Sketch Board session ID'),
	},
	async (args) => {
		try {
			const sessionId = await resolveSessionId(args.sessionId)
			await bridge.clearCanvas(sessionId)
			return textResult(JSON.stringify({ sessionId, ok: true }, null, 2))
		} catch (error) {
			return errorResult(error)
		}
	}
)

server.tool(
	'export_canvas',
	'Export the current Sketch Board canvas as SVG, PNG data URL, or JSON.',
	{
		sessionId: z.string().optional().describe('Optional Sketch Board session ID'),
		format: ExportFormat.describe('Export format'),
		ids: z.array(z.string()).optional().describe('Optional shape IDs to export'),
		background: z.boolean().optional().describe('Include background where supported'),
		scale: z.number().optional().describe('Optional export scale multiplier'),
	},
	async (args) => {
		try {
			const sessionId = await resolveSessionId(args.sessionId)
			const result = await bridge.exportCanvas(
				sessionId,
				args.format,
				args.ids,
				args.background,
				args.scale
			)
			return textResult(JSON.stringify({ sessionId, ...result }, null, 2))
		} catch (error) {
			return errorResult(error)
		}
	}
)

const transport = new StdioServerTransport()
await server.connect(transport)

function getBridgePort() {
	const raw = process.env.SKETCH_BOARD_AGENT_WS_PORT?.trim()
	if (!raw) return DEFAULT_WS_PORT

	const parsed = Number.parseInt(raw, 10)
	return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_WS_PORT
}

async function resolveSessionId(explicitSessionId?: string) {
	if (explicitSessionId) return explicitSessionId

	const sessions = await bridge.listSessions()
	if (sessions.length === 0) {
		throw new Error(
			'No Sketch Board sessions are connected. Open the app locally and ensure the automation bridge is running.'
		)
	}

	if (sessions.length > 1) {
		throw new Error(
			`Multiple Sketch Board sessions are connected. Choose one explicitly with sessionId: ${sessions
				.map((session) => session.sessionId)
				.join(', ')}`
		)
	}

	return sessions[0].sessionId
}
