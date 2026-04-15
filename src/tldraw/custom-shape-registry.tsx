import type {
	TLDefaultColorStyle,
	TLDefaultFillStyle,
	TLDefaultSizeStyle,
} from 'tldraw'
import { databaseIcon } from './database-icon'
import {
	normalizeImportedSvgSource,
	type SanitizedSvgSource,
} from './svg-import'
import { svgSymbolIcon } from './svg-symbol-icon'
import { DATABASE_SHAPE_TYPE } from './shapes/DatabaseShape'
import { SVG_SYMBOL_SHAPE_TYPE } from './shapes/SvgSymbolShape'

export const DEFAULT_DATABASE_LIBRARY_ITEM_ID = 'database-default'

export type CustomShapeType = typeof DATABASE_SHAPE_TYPE | typeof SVG_SYMBOL_SHAPE_TYPE

export interface DatabaseLibraryDefaults {
	w: number
	h: number
	color: TLDefaultColorStyle
	fill: TLDefaultFillStyle
	size: TLDefaultSizeStyle
}

export interface SvgSymbolLibraryDefaults {
	w: number
	h: number
}

export interface SvgSymbolLibrarySource {
	kind: 'svg'
	viewBox: string
	markup: string
}

export interface DatabaseImportDescriptor {
	id: string
	type: typeof DATABASE_SHAPE_TYPE
	label: string
	defaultProps?: Partial<DatabaseLibraryDefaults>
	version: 1
}

export interface SvgSymbolImportDescriptor {
	id: string
	type: typeof SVG_SYMBOL_SHAPE_TYPE
	label: string
	defaultProps?: Partial<SvgSymbolLibraryDefaults>
	source: SvgSymbolLibrarySource
	version: 1
}

export type CustomShapeImportDescriptor =
	| DatabaseImportDescriptor
	| SvgSymbolImportDescriptor

export interface DatabaseLibraryItem {
	id: string
	type: typeof DATABASE_SHAPE_TYPE
	label: string
	defaultProps: DatabaseLibraryDefaults
	version: 1
}

export interface SvgSymbolLibraryItem {
	id: string
	type: typeof SVG_SYMBOL_SHAPE_TYPE
	label: string
	defaultProps: SvgSymbolLibraryDefaults
	source: SvgSymbolLibrarySource
	version: 1
}

export type CustomShapeLibraryItem = DatabaseLibraryItem | SvgSymbolLibraryItem

interface CustomShapeRegistryEntry<TType extends CustomShapeType> {
	type: TType
	toolId: string
	icon: string | typeof databaseIcon | typeof svgSymbolIcon
	defaultLabel: string
	defaultProps: TType extends typeof DATABASE_SHAPE_TYPE
		? DatabaseLibraryDefaults
		: SvgSymbolLibraryDefaults
	normalizeDefaults(
		defaultProps?: Partial<TType extends typeof DATABASE_SHAPE_TYPE ? DatabaseLibraryDefaults : SvgSymbolLibraryDefaults>
	): TType extends typeof DATABASE_SHAPE_TYPE ? DatabaseLibraryDefaults : SvgSymbolLibraryDefaults
}

const databaseDefaults: DatabaseLibraryDefaults = {
	w: 240,
	h: 160,
	color: 'blue',
	fill: 'semi',
	size: 'm',
}

const svgSymbolDefaults: SvgSymbolLibraryDefaults = {
	w: 240,
	h: 160,
}

const registry = {
	[DATABASE_SHAPE_TYPE]: {
		type: DATABASE_SHAPE_TYPE,
		toolId: DATABASE_SHAPE_TYPE,
		icon: databaseIcon,
		defaultLabel: 'Database',
		defaultProps: databaseDefaults,
		normalizeDefaults(defaultProps?: Partial<DatabaseLibraryDefaults>) {
			return {
				w:
					typeof defaultProps?.w === 'number' && Number.isFinite(defaultProps.w)
						? Math.max(defaultProps.w, 1)
						: databaseDefaults.w,
				h:
					typeof defaultProps?.h === 'number' && Number.isFinite(defaultProps.h)
						? Math.max(defaultProps.h, 1)
						: databaseDefaults.h,
				color: defaultProps?.color ?? databaseDefaults.color,
				fill: defaultProps?.fill ?? databaseDefaults.fill,
				size: defaultProps?.size ?? databaseDefaults.size,
			}
		},
	},
	[SVG_SYMBOL_SHAPE_TYPE]: {
		type: SVG_SYMBOL_SHAPE_TYPE,
		toolId: SVG_SYMBOL_SHAPE_TYPE,
		icon: svgSymbolIcon,
		defaultLabel: 'SVG Symbol',
		defaultProps: svgSymbolDefaults,
		normalizeDefaults(defaultProps?: Partial<SvgSymbolLibraryDefaults>) {
			return {
				w:
					typeof defaultProps?.w === 'number' && Number.isFinite(defaultProps.w)
						? Math.max(defaultProps.w, 1)
						: svgSymbolDefaults.w,
				h:
					typeof defaultProps?.h === 'number' && Number.isFinite(defaultProps.h)
						? Math.max(defaultProps.h, 1)
						: svgSymbolDefaults.h,
			}
		},
	},
} satisfies Record<CustomShapeType, CustomShapeRegistryEntry<CustomShapeType>>

export function isSupportedCustomShapeType(value: unknown): value is CustomShapeType {
	return typeof value === 'string' && value in registry
}

export function isSvgSymbolLibraryItem(item: CustomShapeLibraryItem): item is SvgSymbolLibraryItem {
	return item.type === SVG_SYMBOL_SHAPE_TYPE
}

export function getCustomShapeRegistryEntry<TType extends CustomShapeType>(type: TType) {
	return registry[type] as CustomShapeRegistryEntry<TType>
}

export function getDefaultCustomShapeLibraryItems(): CustomShapeLibraryItem[] {
	const entry = registry[DATABASE_SHAPE_TYPE]

	return [
		{
			id: DEFAULT_DATABASE_LIBRARY_ITEM_ID,
			type: entry.type,
			label: entry.defaultLabel,
			defaultProps: entry.defaultProps,
			version: 1,
		},
	]
}

function toSvgLibrarySource(source: SanitizedSvgSource): SvgSymbolLibrarySource {
	return {
		kind: 'svg',
		viewBox: source.viewBox,
		markup: source.markup,
	}
}

export function normalizeImportedCustomShapeDescriptor(
	value: unknown
): CustomShapeLibraryItem | null {
	if (!value || typeof value !== 'object') return null

	const descriptor = value as Partial<CustomShapeImportDescriptor>
	if (descriptor.version !== 1) return null
	if (typeof descriptor.id !== 'string' || descriptor.id.trim().length === 0) return null
	if (typeof descriptor.label !== 'string' || descriptor.label.trim().length === 0) return null
	if (!isSupportedCustomShapeType(descriptor.type)) return null

	if (descriptor.type === DATABASE_SHAPE_TYPE) {
		const entry = registry[DATABASE_SHAPE_TYPE]

		return {
			id: descriptor.id.trim(),
			type: descriptor.type,
			label: descriptor.label.trim(),
			defaultProps: entry.normalizeDefaults(descriptor.defaultProps),
			version: 1,
		}
	}

	const entry = registry[SVG_SYMBOL_SHAPE_TYPE]
	const svgSource = normalizeImportedSvgSource((descriptor as SvgSymbolImportDescriptor).source)
	if (!svgSource) return null

	return {
		id: descriptor.id.trim(),
		type: descriptor.type,
		label: descriptor.label.trim(),
		defaultProps: entry.normalizeDefaults({
			w: descriptor.defaultProps?.w ?? svgSource.width,
			h: descriptor.defaultProps?.h ?? svgSource.height,
		}),
		source: toSvgLibrarySource(svgSource),
		version: 1,
	}
}

export function normalizeStoredCustomShapeLibraryItems(value: unknown): CustomShapeLibraryItem[] {
	if (!Array.isArray(value)) return []

	return value
		.map((item) => normalizeImportedCustomShapeDescriptor(item))
		.filter((item): item is CustomShapeLibraryItem => item !== null)
}
