import {
	ArrowToolbarItem,
	AssetToolbarItem,
	DefaultToolbar,
	DrawToolbarItem,
	EraserToolbarItem,
	FrameToolbarItem,
	GeoShapeGeoStyle,
	HandToolbarItem,
	HighlightToolbarItem,
	LaserToolbarItem,
	LineToolbarItem,
	NoteToolbarItem,
	SelectToolbarItem,
	TextToolbarItem,
	TldrawUiButtonIcon,
	TldrawUiMenuContextProvider,
	TldrawUiPopover,
	TldrawUiPopoverContent,
	TldrawUiPopoverTrigger,
	TldrawUiToolbar,
	TldrawUiToolbarButton,
	type TLUiTranslationKey,
	useEditor,
	useTranslation,
	useValue,
} from 'tldraw'
import { useMemo, useState } from 'react'
import { DATABASE_SHAPE_TYPE } from './shapes/DatabaseShape'
import { shapeItems, type ShapeMenuValue } from './shape-items'

function ShapesToolbarItem() {
	const editor = useEditor()
	const msg = useTranslation()
	const [isOpen, setIsOpen] = useState(false)

	const activeShape = useValue<ShapeMenuValue | null>(
		'active toolbar shape',
		() => {
			const currentTool = editor.getCurrentToolId()
			if (currentTool === DATABASE_SHAPE_TYPE) return DATABASE_SHAPE_TYPE
			if (currentTool === 'geo') return editor.getStyleForNextShape(GeoShapeGeoStyle)
			return null
		},
		[editor]
	)

	const currentItem = useMemo(() => {
		if (!activeShape) return shapeItems[0]
		return shapeItems.find((item) => item.value === activeShape) ?? shapeItems[0]
	}, [activeShape])

	const title = activeShape
		? `${msg('style-panel.geo')} - ${msg(`geo-style.${activeShape}` as TLUiTranslationKey)}`
		: msg('style-panel.geo')

	const selectShapeTool = (value: ShapeMenuValue) => {
		editor.run(() => {
			if (value === DATABASE_SHAPE_TYPE) {
				editor.setCurrentTool(DATABASE_SHAPE_TYPE)
				return
			}

			editor.setStyleForNextShapes(GeoShapeGeoStyle, value)
			editor.setCurrentTool('geo')
		})

		setIsOpen(false)
	}

	return (
		<TldrawUiPopover id="toolbar-shapes" open={isOpen} onOpenChange={setIsOpen}>
			<TldrawUiPopoverTrigger>
				<TldrawUiToolbarButton
					type="tool"
					title={title}
					data-testid="tools.shapes"
					data-value="shapes"
					isActive={activeShape !== null}
				>
					<TldrawUiButtonIcon icon={currentItem.icon} />
				</TldrawUiToolbarButton>
			</TldrawUiPopoverTrigger>
			<TldrawUiPopoverContent side="top" align="center">
				<TldrawUiToolbar orientation="grid" label={msg('style-panel.geo')}>
					<TldrawUiMenuContextProvider type="icons" sourceId="toolbar">
						{shapeItems.map((item) => {
							const itemTitle = `${msg('style-panel.geo')} - ${msg(
								`geo-style.${item.value}` as TLUiTranslationKey
							)}`

							return (
								<TldrawUiToolbarButton
									key={item.value}
									type="icon"
									title={itemTitle}
									data-testid={`tools.shapes.${item.value}`}
									isActive={activeShape === item.value}
									onClick={() => selectShapeTool(item.value)}
								>
									<TldrawUiButtonIcon icon={item.icon} />
								</TldrawUiToolbarButton>
							)
						})}
					</TldrawUiMenuContextProvider>
				</TldrawUiToolbar>
			</TldrawUiPopoverContent>
		</TldrawUiPopover>
	)
}

export function CustomToolbar() {
	return (
		<DefaultToolbar>
			<SelectToolbarItem />
			<HandToolbarItem />
			<DrawToolbarItem />
			<EraserToolbarItem />
			<ArrowToolbarItem />
			<TextToolbarItem />
			<NoteToolbarItem />
			<AssetToolbarItem />

			<ShapesToolbarItem />
			<LineToolbarItem />
			<HighlightToolbarItem />
			<LaserToolbarItem />
			<FrameToolbarItem />
		</DefaultToolbar>
	)
}
