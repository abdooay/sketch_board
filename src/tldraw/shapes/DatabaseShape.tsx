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
import { DatabaseShapeView } from './DatabaseShapeView'

export const DATABASE_SHAPE_TYPE = 'database'

export type DatabaseShape = TLBaseShape<
	typeof DATABASE_SHAPE_TYPE,
	{
		w: number
		h: number
		color: TLDefaultColorStyle
		fill: TLDefaultFillStyle
		size: TLDefaultSizeStyle
	}
>

declare module 'tldraw' {
	interface TLGlobalShapePropsMap {
		[DATABASE_SHAPE_TYPE]: DatabaseShape['props']
	}
}

export class DatabaseShapeUtil extends BaseBoxShapeUtil<DatabaseShape> {
	static override type = DATABASE_SHAPE_TYPE

	static override props = {
		w: T.number,
		h: T.number,
		color: DefaultColorStyle,
		fill: DefaultFillStyle,
		size: DefaultSizeStyle,
	}

	override canEdit() {
		return false
	}

	override canResize() {
		return true
	}

	override getDefaultProps(): DatabaseShape['props'] {
		return {
			w: 240,
			h: 160,
			color: 'blue',
			fill: 'semi',
			size: 'm',
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
