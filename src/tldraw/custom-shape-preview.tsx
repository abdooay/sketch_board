import type { CustomShapeLibraryItem } from './custom-shape-registry'
import { databaseIcon } from './database-icon'
import { useSvgContrastStyle } from './svg-contrast'

export function CustomShapeLibraryPreview({ item }: { item: CustomShapeLibraryItem }) {
	const contrastStyle = useSvgContrastStyle(
		item.type === 'svg-symbol' ? item.source.contrastTone : 'none'
	)

	if (item.type === 'database') {
		return <span className="custom-shape-preview custom-shape-preview--database">{databaseIcon}</span>
	}

	return (
		<span className="custom-shape-preview">
			<svg
				viewBox={item.source.viewBox}
				preserveAspectRatio="xMidYMid meet"
				className="custom-shape-preview__svg"
				style={contrastStyle}
				aria-hidden="true"
				dangerouslySetInnerHTML={{ __html: item.source.markup }}
			/>
		</span>
	)
}
