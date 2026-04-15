import {
	BaseBoxShapeUtil,
	DefaultColorStyle,
	DefaultFillStyle,
	DefaultSizeStyle,
	T,
	type TLBaseShape,
	type TLDefaultColorStyle,
	type TLDefaultFillStyle,
	type TLDefaultSizeStyle,
} from 'tldraw'
import {
	createShapePropsMigrationIds,
	createShapePropsMigrationSequence,
} from '@tldraw/tlschema'
import { getRuntimeActiveCustomShapeLibraryItem } from '../custom-shape-library-state'
import { DatabaseShapeView } from './DatabaseShapeView'

export const DATABASE_SHAPE_TYPE = 'database'
const DEFAULT_DATABASE_LIBRARY_ITEM_ID = 'database-default'

const databaseShapeVersions = createShapePropsMigrationIds(DATABASE_SHAPE_TYPE, {
	AddLibraryItemId: 1,
})

const databaseShapeMigrations = createShapePropsMigrationSequence({
	sequence: [
		{
			id: databaseShapeVersions.AddLibraryItemId,
			up: (props) => {
				props.libraryItemId = DEFAULT_DATABASE_LIBRARY_ITEM_ID
			},
			down: 'retired',
		},
	],
})

export type DatabaseShape = TLBaseShape<
	typeof DATABASE_SHAPE_TYPE,
	{
		w: number
		h: number
		color: TLDefaultColorStyle
		fill: TLDefaultFillStyle
		size: TLDefaultSizeStyle
		libraryItemId: string
	}
>

declare module 'tldraw' {
	interface TLGlobalShapePropsMap {
		[DATABASE_SHAPE_TYPE]: DatabaseShape['props']
	}
}

export class DatabaseShapeUtil extends BaseBoxShapeUtil<DatabaseShape> {
	static override type = DATABASE_SHAPE_TYPE
	static override migrations = databaseShapeMigrations

	static override props = {
		w: T.number,
		h: T.number,
		color: DefaultColorStyle,
		fill: DefaultFillStyle,
		size: DefaultSizeStyle,
		libraryItemId: T.string,
	}

	override canEdit() {
		return false
	}

	override canResize() {
		return true
	}

	override getDefaultProps(): DatabaseShape['props'] {
		const activeLibraryItem = getRuntimeActiveCustomShapeLibraryItem()

		return {
			w: activeLibraryItem?.defaultProps.w ?? 240,
			h: activeLibraryItem?.defaultProps.h ?? 160,
			color: activeLibraryItem?.defaultProps.color ?? 'blue',
			fill: activeLibraryItem?.defaultProps.fill ?? 'semi',
			size: activeLibraryItem?.defaultProps.size ?? 'm',
			libraryItemId: activeLibraryItem?.id ?? DEFAULT_DATABASE_LIBRARY_ITEM_ID,
		}
	}

	component(shape: DatabaseShape) {
		return <DatabaseShapeView shape={shape} />
	}

	indicator(shape: DatabaseShape) {
		const capHeight = Math.max(24, Math.min(shape.props.h * 0.24, 42))
		const rx = shape.props.w / 2
		const ry = capHeight / 2
		const topY = ry
		const bottomY = shape.props.h - ry

		return (
			<g>
				<ellipse cx={rx} cy={topY} rx={rx} ry={ry} />
				<path d={`M 0 ${topY} L 0 ${bottomY}`} />
				<path d={`M ${shape.props.w} ${topY} L ${shape.props.w} ${bottomY}`} />
				<path d={`M 0 ${bottomY} A ${rx} ${ry} 0 0 0 ${shape.props.w} ${bottomY}`} />
			</g>
		)
	}
}
