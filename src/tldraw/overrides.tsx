import { onDragFromToolbarToCreateShape, type TLPointerEventInfo, type TLUiOverrides } from 'tldraw'
import { databaseIcon } from './database-icon'
import { DATABASE_SHAPE_TYPE } from './shapes/DatabaseShape'

export const uiOverrides: TLUiOverrides = {
	tools: (editor, tools) => {
		delete tools.triangle
		delete tools.diamond
		delete tools.hexagon
		delete tools.oval
		delete tools.rhombus
		delete tools.star
		delete tools.cloud
		delete tools.heart
		delete tools['x-box']
		delete tools['check-box']
		delete tools['arrow-left']
		delete tools['arrow-up']
		delete tools['arrow-down']
		delete tools['arrow-right']
		delete tools.trapezoid
		delete tools.pentagon

		tools[DATABASE_SHAPE_TYPE] = {
			id: DATABASE_SHAPE_TYPE,
			label: 'tool.database',
			icon: databaseIcon,
			kbd: 'q',
			onSelect() {
				editor.setCurrentTool(DATABASE_SHAPE_TYPE)
			},
			onDragStart(_source: string, info: TLPointerEventInfo) {
				onDragFromToolbarToCreateShape(editor, info, {
					createShape: (id) =>
						editor.createShape({
							id,
							type: DATABASE_SHAPE_TYPE,
						}),
				})
			},
		}

		return tools
	},
	translations: {
		en: {
			'tool.database': 'Database',
			'geo-style.database': 'Database',
		},
	},
}
