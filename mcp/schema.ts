import { z } from 'zod'
import {
	builtInShapeTypes,
	customShapeTypes,
	exportFormats,
	geoShapeTypes,
	type JsonObject,
	type JsonValue,
} from '../src/tldraw/automation/protocol.ts'

const JsonLiteral = z.union([z.string(), z.number(), z.boolean(), z.null()])

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
	z.union([JsonLiteral, z.array(JsonValueSchema), z.record(JsonValueSchema)])
)

export const JsonObjectSchema: z.ZodType<JsonObject> = z.record(JsonValueSchema)
export const BuiltInShapeType = z.enum(builtInShapeTypes)
export const CustomShapeType = z.enum(customShapeTypes)
export const GeoShape = z.enum(geoShapeTypes)
export const ExportFormat = z.enum(exportFormats)

export const GenericShapeInputSchema = z.object({
	type: BuiltInShapeType,
	x: z.number(),
	y: z.number(),
	rotation: z.number().optional(),
	parentId: z.string().optional(),
	meta: JsonObjectSchema.optional(),
	props: JsonObjectSchema.optional(),
	width: z.number().optional(),
	height: z.number().optional(),
	text: z.string().optional(),
	geo: GeoShape.optional(),
	color: z.string().optional(),
	fill: z.string().optional(),
	name: z.string().optional(),
	url: z.string().url().optional(),
})

export const GenericShapeUpdateSchema = z.object({
	type: z.string().optional(),
	x: z.number().optional(),
	y: z.number().optional(),
	rotation: z.number().optional(),
	parentId: z.string().optional(),
	meta: JsonObjectSchema.optional(),
	props: JsonObjectSchema.optional(),
	width: z.number().optional(),
	height: z.number().optional(),
	text: z.string().optional(),
	geo: GeoShape.optional(),
	color: z.string().optional(),
	fill: z.string().optional(),
	name: z.string().optional(),
	url: z.string().url().optional(),
})

export const CustomShapeInputSchema = z.object({
	type: CustomShapeType,
	x: z.number(),
	y: z.number(),
	rotation: z.number().optional(),
	parentId: z.string().optional(),
	meta: JsonObjectSchema.optional(),
	props: JsonObjectSchema.optional(),
	width: z.number().optional(),
	height: z.number().optional(),
	libraryItemId: z.string().optional(),
})
