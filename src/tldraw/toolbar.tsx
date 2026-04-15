import { useMemo, useState } from 'react'
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
	TldrawUiPopover,
	TldrawUiPopoverContent,
	TldrawUiPopoverTrigger,
	TldrawUiToolbarButton,
	type TLUiTranslationKey,
	useEditor,
	useTranslation,
	useValue,
} from 'tldraw'
import { useCustomShapeLibrary } from './custom-shape-library'
import { CustomShapeImportDialog } from './custom-shape-import-dialog'
import { CustomShapeLibraryPreview } from './custom-shape-preview'
import { databaseIcon } from './database-icon'
import { getCustomShapeRegistryEntry } from './custom-shape-registry'
import { geoShapeItems, type GeoShapeMenuValue } from './shape-items'
import { DATABASE_SHAPE_TYPE } from './shapes/DatabaseShape'
import { SVG_SYMBOL_SHAPE_TYPE } from './shapes/SvgSymbolShape'

function ShapesToolbarItem() {
	const editor = useEditor()
	const msg = useTranslation()
	const [isOpen, setIsOpen] = useState(false)

	const activeShape = useValue<GeoShapeMenuValue | null>(
		'active toolbar geo shape',
		() => {
			if (editor.getCurrentToolId() !== 'geo') return null
			return editor.getStyleForNextShape(GeoShapeGeoStyle)
		},
		[editor]
	)

	const currentItem = useMemo(() => {
		if (!activeShape) return geoShapeItems[0]
		return geoShapeItems.find((item) => item.value === activeShape) ?? geoShapeItems[0]
	}, [activeShape])

	const title = activeShape
		? `${msg('style-panel.geo')} - ${msg(`geo-style.${activeShape}` as TLUiTranslationKey)}`
		: msg('style-panel.geo')

	const selectShapeTool = (value: GeoShapeMenuValue) => {
		editor.run(() => {
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
				<div className="custom-shape-grid" role="menu" aria-label={msg('style-panel.geo')}>
					{geoShapeItems.map((item) => {
						const itemTitle = `${msg('style-panel.geo')} - ${msg(
							`geo-style.${item.value}` as TLUiTranslationKey
						)}`

						return (
							<button
								key={item.value}
								type="button"
								role="menuitemradio"
								aria-checked={activeShape === item.value}
								className="custom-shape-grid__button"
								title={itemTitle}
								data-testid={`tools.shapes.${item.value}`}
								data-active={activeShape === item.value}
								onClick={() => selectShapeTool(item.value)}
							>
								<TldrawUiButtonIcon icon={item.icon} />
							</button>
						)
					})}
				</div>
			</TldrawUiPopoverContent>
		</TldrawUiPopover>
	)
}

function CustomShapesToolbarItem() {
	const editor = useEditor()
	const {
		items,
		activeItem,
		activeItemId,
		setActiveItem,
		renameItem,
		deleteItem,
	} = useCustomShapeLibrary()
	const [isOpen, setIsOpen] = useState(false)
	const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)

	const currentItem = activeItem ?? items[0] ?? null
	const currentIcon = currentItem
		? getCustomShapeRegistryEntry(currentItem.type).icon
		: databaseIcon

	const selectLibraryItem = (id: string) => {
		const item = items.find((entry) => entry.id === id)
		if (!item) return

		setActiveItem(id)
		editor.setCurrentTool(getCustomShapeRegistryEntry(item.type).toolId)
		setIsOpen(false)
	}

	const handleRename = () => {
		if (!currentItem) return
		const nextLabel = window.prompt('Rename custom shape', currentItem.label)
		if (!nextLabel) return
		renameItem(currentItem.id, nextLabel)
	}

	const handleDelete = () => {
		if (!currentItem) return
		if (items.length <= 1) {
			window.alert('Import another custom shape before deleting the last one.')
			return
		}
		if (!window.confirm(`Delete "${currentItem.label}" from the custom shape library?`)) return
		deleteItem(currentItem.id)
	}

	return (
		<>
			<TldrawUiPopover id="toolbar-custom-shapes" open={isOpen} onOpenChange={setIsOpen}>
				<TldrawUiPopoverTrigger>
					<TldrawUiToolbarButton
						type="tool"
						title={currentItem ? `Custom shapes - ${currentItem.label}` : 'Custom shapes'}
						data-testid="tools.custom-shapes"
						data-value="custom-shapes"
						isActive={
							editor.getCurrentToolId() === DATABASE_SHAPE_TYPE ||
							editor.getCurrentToolId() === SVG_SYMBOL_SHAPE_TYPE
						}
					>
						<TldrawUiButtonIcon icon={currentIcon} />
					</TldrawUiToolbarButton>
				</TldrawUiPopoverTrigger>
				<TldrawUiPopoverContent side="top" align="center">
					<div className="custom-shape-library-menu">
						<div className="custom-shape-library-list" role="list" aria-label="Custom shape library">
							{items.map((item) => {
								return (
									<button
										key={item.id}
										type="button"
										role="listitem"
										className="custom-shape-library-item"
										data-active={activeItemId === item.id}
										onClick={() => selectLibraryItem(item.id)}
									>
										<span className="custom-shape-library-item__icon">
											<CustomShapeLibraryPreview item={item} />
										</span>
										<span className="custom-shape-library-item__label">{item.label}</span>
									</button>
								)
							})}
						</div>
						<div className="custom-shape-library-actions">
							<button
								type="button"
								className="custom-shape-library-action"
								onClick={() => {
									setIsOpen(false)
									setIsImportDialogOpen(true)
								}}
							>
								Import SVG
							</button>
							<button type="button" className="custom-shape-library-action" onClick={handleRename}>
								Rename
							</button>
							<button type="button" className="custom-shape-library-action" onClick={handleDelete}>
								Delete
							</button>
						</div>
					</div>
				</TldrawUiPopoverContent>
			</TldrawUiPopover>
			<CustomShapeImportDialog
				open={isImportDialogOpen}
				onClose={() => setIsImportDialogOpen(false)}
			/>
		</>
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

			<ShapesToolbarItem />
			<CustomShapesToolbarItem />
			<NoteToolbarItem />
			<AssetToolbarItem />
			<LineToolbarItem />
			<HighlightToolbarItem />
			<LaserToolbarItem />
			<FrameToolbarItem />
		</DefaultToolbar>
	)
}
