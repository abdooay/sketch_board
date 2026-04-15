import { SVGContainer, STROKE_SIZES, useDefaultColorTheme } from 'tldraw'
import type { DatabaseShape } from './DatabaseShape'

export function DatabaseShapeView({ shape }: { shape: DatabaseShape }) {
	const theme = useDefaultColorTheme()
	const color = shape.props.color in theme ? shape.props.color : 'blue'
	const size = shape.props.size in STROKE_SIZES ? shape.props.size : 'm'
	const width = Number.isFinite(shape.props.w) ? Math.max(shape.props.w, 1) : 1
	const height = Number.isFinite(shape.props.h) ? Math.max(shape.props.h, 1) : 1
	const palette = theme[color]
	const strokeWidth = STROKE_SIZES[size]
	const capHeight = Math.max(24, Math.min(height * 0.24, 42))
	const rx = width / 2
	const ry = capHeight / 2
	const topY = ry
	const bottomY = height - ry
	const guideOffsets = [0.36, 0.64]

	const fillColor =
		shape.props.fill === 'none'
			? 'transparent'
			: shape.props.fill === 'solid'
				? palette.solid
				: palette.semi

	return (
		<SVGContainer style={{ overflow: 'visible' }}>
			<svg
				width={width}
				height={height}
				viewBox={`0 0 ${width} ${height}`}
				fill="none"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<ellipse cx={rx} cy={topY} rx={rx - strokeWidth / 2} ry={ry} fill={fillColor} />
				<path
					d={[
						`M ${strokeWidth / 2} ${topY}`,
						`L ${strokeWidth / 2} ${bottomY}`,
						`A ${rx - strokeWidth / 2} ${ry} 0 0 0 ${width - strokeWidth / 2} ${bottomY}`,
						`L ${width - strokeWidth / 2} ${topY}`,
						'Z',
					].join(' ')}
					fill={fillColor}
				/>

				<ellipse
					cx={rx}
					cy={topY}
					rx={rx - strokeWidth / 2}
					ry={ry}
					stroke={palette.solid}
					strokeWidth={strokeWidth}
				/>
				<path
					d={`M ${strokeWidth / 2} ${topY} L ${strokeWidth / 2} ${bottomY}`}
					stroke={palette.solid}
					strokeWidth={strokeWidth}
				/>
				<path
					d={`M ${width - strokeWidth / 2} ${topY} L ${width - strokeWidth / 2} ${bottomY}`}
					stroke={palette.solid}
					strokeWidth={strokeWidth}
				/>
				<path
					d={`M ${strokeWidth / 2} ${bottomY} A ${rx - strokeWidth / 2} ${ry} 0 0 0 ${width - strokeWidth / 2} ${bottomY}`}
					stroke={palette.solid}
					strokeWidth={strokeWidth}
				/>

				{guideOffsets.map((offset) => {
					const y = topY + (bottomY - topY) * offset

						return (
							<path
								key={offset}
								d={`M ${strokeWidth * 1.5} ${y} A ${width / 2 - strokeWidth * 1.5} ${ry} 0 0 0 ${width - strokeWidth * 1.5} ${y}`}
								stroke={palette.solid}
								strokeOpacity={0.35}
								strokeWidth={strokeWidth}
						/>
					)
				})}
			</svg>
		</SVGContainer>
	)
}
