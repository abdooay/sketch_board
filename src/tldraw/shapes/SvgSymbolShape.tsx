import {
	BaseBoxShapeUtil,
	T,
	type TLBaseShape,
} from 'tldraw'
import {
	createShapePropsMigrationIds,
	createShapePropsMigrationSequence,
} from '@tldraw/tlschema'
import { getRuntimeActiveCustomShapeLibraryItemForType } from '../custom-shape-library-state'
import { SvgSymbolShapeView } from './SvgSymbolShapeView'

export const SVG_SYMBOL_SHAPE_TYPE = 'svg-symbol'

const svgSymbolShapeVersions = createShapePropsMigrationIds(SVG_SYMBOL_SHAPE_TYPE, {
	AddLibraryItemId: 1,
})

const svgSymbolShapeMigrations = createShapePropsMigrationSequence({
	sequence: [
		{
			id: svgSymbolShapeVersions.AddLibraryItemId,
			up: (props) => {
				props.libraryItemId = ''
			},
			down: 'retired',
		},
	],
})

export type SvgSymbolShape = TLBaseShape<
	typeof SVG_SYMBOL_SHAPE_TYPE,
	{
		w: number
		h: number
		libraryItemId: string
	}
>

declare module 'tldraw' {
	interface TLGlobalShapePropsMap {
		[SVG_SYMBOL_SHAPE_TYPE]: SvgSymbolShape['props']
	}
}

export class SvgSymbolShapeUtil extends BaseBoxShapeUtil<SvgSymbolShape> {
	static override type = SVG_SYMBOL_SHAPE_TYPE
	static override migrations = svgSymbolShapeMigrations

	static override props = {
		w: T.number,
		h: T.number,
		libraryItemId: T.string,
	}

	override canEdit() {
		return false
	}

	override canResize() {
		return true
	}

	override getDefaultProps(): SvgSymbolShape['props'] {
		const activeLibraryItem = getRuntimeActiveCustomShapeLibraryItemForType(SVG_SYMBOL_SHAPE_TYPE)

		return {
			w: activeLibraryItem?.defaultProps.w ?? 240,
			h: activeLibraryItem?.defaultProps.h ?? 160,
			libraryItemId: activeLibraryItem?.id ?? '',
		}
	}

	component(shape: SvgSymbolShape) {
		return <SvgSymbolShapeView shape={shape} />
	}

	indicator(shape: SvgSymbolShape) {
		return <rect width={shape.props.w} height={shape.props.h} rx={8} ry={8} />
	}
}
