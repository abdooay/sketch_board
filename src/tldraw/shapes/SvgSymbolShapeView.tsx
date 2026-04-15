import { SVGContainer } from 'tldraw'
import { useCustomShapeLibrary } from '../custom-shape-library'
import type { SvgSymbolShape } from './SvgSymbolShape'

export function SvgSymbolShapeView({ shape }: { shape: SvgSymbolShape }) {
	const { getItem } = useCustomShapeLibrary()
	const libraryItem = getItem(shape.props.libraryItemId)
	const width = Number.isFinite(shape.props.w) ? Math.max(shape.props.w, 1) : 1
	const height = Number.isFinite(shape.props.h) ? Math.max(shape.props.h, 1) : 1

	if (!libraryItem || libraryItem.type !== 'svg-symbol') {
		return (
			<SVGContainer style={{ overflow: 'visible' }}>
				<svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
					<rect
						x="0.5"
						y="0.5"
						width={Math.max(width - 1, 1)}
						height={Math.max(height - 1, 1)}
						rx="10"
						stroke="currentColor"
						strokeOpacity="0.6"
						strokeDasharray="6 6"
					/>
					<path
						d={`M ${width * 0.2} ${height * 0.75} L ${width * 0.42} ${height * 0.45} L ${width * 0.58} ${height * 0.6} L ${width * 0.8} ${height * 0.28}`}
						stroke="currentColor"
						strokeOpacity="0.6"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</SVGContainer>
		)
	}

	return (
		<SVGContainer style={{ overflow: 'visible' }}>
			<svg
				width={width}
				height={height}
				viewBox={libraryItem.source.viewBox}
				preserveAspectRatio="xMidYMid meet"
				dangerouslySetInnerHTML={{ __html: libraryItem.source.markup }}
			/>
		</SVGContainer>
	)
}
