import type {
	TLDefaultColorStyle,
	TLDefaultFillStyle,
	TLDefaultSizeStyle,
} from 'tldraw'
import { databaseIcon } from './database-icon'
import { DATABASE_SHAPE_TYPE } from './shapes/DatabaseShape'

export const DEFAULT_DATABASE_LIBRARY_ITEM_ID = 'database-default'

export type CustomShapeType = typeof DATABASE_SHAPE_TYPE

export interface DatabaseLibraryDefaults {
	w: number
	h: number
	color: TLDefaultColorStyle
	fill: TLDefaultFillStyle
	size: TLDefaultSizeStyle
}

export interface CustomShapeImportDescriptor {
	id: string
	type: CustomShapeType
	label: string
	defaultProps?: Partial<DatabaseLibraryDefaults>
	version: 1
}

export interface CustomShapeLibraryItem {
	id: string
	type: CustomShapeType
	label: string
	defaultProps: DatabaseLibraryDefaults
	version: 1
}

interface CustomShapeRegistryEntry {
	type: CustomShapeType
	toolId: string
	icon: string | typeof databaseIcon
	defaultLabel: string
	defaultProps: DatabaseLibraryDefaults
	normalizeDefaults(defaultProps?: Partial<DatabaseLibraryDefaults>): DatabaseLibraryDefaults
}

const databaseDefaults: DatabaseLibraryDefaults = {
	w: 240,
	h: 160,
	color: 'blue',
	fill: 'semi',
	size: 'm',
}

const registry: Record<CustomShapeType, CustomShapeRegistryEntry> = {
	[DATABASE_SHAPE_TYPE]: {
		type: DATABASE_SHAPE_TYPE,
		toolId: DATABASE_SHAPE_TYPE,
		icon: databaseIcon,
		defaultLabel: 'Database',
		defaultProps: databaseDefaults,
		normalizeDefaults(defaultProps) {
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
}

export function isSupportedCustomShapeType(value: unknown): value is CustomShapeType {
	return typeof value === 'string' && value in registry
}

export function getCustomShapeRegistryEntry(type: CustomShapeType) {
	return registry[type]
}

export function getDefaultCustomShapeLibraryItems(): CustomShapeLibraryItem[] {
	const entry = getCustomShapeRegistryEntry(DATABASE_SHAPE_TYPE)

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

export function normalizeImportedCustomShapeDescriptor(
	value: unknown
): CustomShapeLibraryItem | null {
	if (!value || typeof value !== 'object') return null

	const descriptor = value as Partial<CustomShapeImportDescriptor>
	if (descriptor.version !== 1) return null
	if (typeof descriptor.id !== 'string' || descriptor.id.trim().length === 0) return null
	if (typeof descriptor.label !== 'string' || descriptor.label.trim().length === 0) return null
	if (!isSupportedCustomShapeType(descriptor.type)) return null

	const entry = getCustomShapeRegistryEntry(descriptor.type)

	return {
		id: descriptor.id.trim(),
		type: descriptor.type,
		label: descriptor.label.trim(),
		defaultProps: entry.normalizeDefaults(descriptor.defaultProps),
		version: 1,
	}
}

export function normalizeStoredCustomShapeLibraryItems(value: unknown): CustomShapeLibraryItem[] {
	if (!Array.isArray(value)) return []

	return value
		.map((item) => normalizeImportedCustomShapeDescriptor(item))
		.filter((item): item is CustomShapeLibraryItem => item !== null)
}
