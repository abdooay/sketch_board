import type { CustomShapeLibraryItem } from './custom-shape-registry'
import { databaseIcon } from './database-icon'

export function CustomShapeLibraryPreview({ item }: { item: CustomShapeLibraryItem }) {
	if (item.type === 'database') {
		return <span className="custom-shape-preview custom-shape-preview--database">{databaseIcon}</span>
	}

	return (
		<span className="custom-shape-preview">
			<svg
				viewBox={item.source.viewBox}
				preserveAspectRatio="xMidYMid meet"
				className="custom-shape-preview__svg"
				aria-hidden="true"
				dangerouslySetInnerHTML={{ __html: item.source.markup }}
			/>
		</span>
	)
}
