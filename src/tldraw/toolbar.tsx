import { useMemo, useRef, useState, type ChangeEvent } from 'react'
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
	useToasts,
	useTranslation,
	useValue,
} from 'tldraw'
import { useCustomShapeLibrary } from './custom-shape-library'
import { databaseIcon } from './database-icon'
import { getCustomShapeRegistryEntry } from './custom-shape-registry'
import { geoShapeItems, type GeoShapeMenuValue } from './shape-items'
import { DATABASE_SHAPE_TYPE } from './shapes/DatabaseShape'

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
				<TldrawUiToolbar orientation="grid" label={msg('style-panel.geo')}>
					<TldrawUiMenuContextProvider type="icons" sourceId="toolbar">
						{geoShapeItems.map((item) => {
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

function CustomShapesToolbarItem() {
	const editor = useEditor()
	const { addToast } = useToasts()
	const {
		items,
		activeItem,
		activeItemId,
		setActiveItem,
		importItemsFromFiles,
		renameItem,
		deleteItem,
	} = useCustomShapeLibrary()
	const [isOpen, setIsOpen] = useState(false)
	const fileInputRef = useRef<HTMLInputElement | null>(null)

	const currentItem = activeItem ?? items[0] ?? null
	const currentIcon = currentItem
		? getCustomShapeRegistryEntry(currentItem.type).icon
		: databaseIcon

	const handleImportClick = () => {
		fileInputRef.current?.click()
	}

	const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(event.currentTarget.files ?? [])
		event.currentTarget.value = ''
		if (files.length === 0) return

		const result = await importItemsFromFiles(files)

		if (result.added > 0 || result.updated > 0) {
			addToast({
				severity: 'success',
				title: 'Custom shape library updated',
				description: `Added ${result.added}, updated ${result.updated}.`,
			})
		}

		if (result.errors.length > 0) {
			addToast({
				severity: 'warning',
				title: 'Some custom shapes were skipped',
				description: result.errors.join(' '),
			})
		}
	}

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
			addToast({
				severity: 'warning',
				title: 'Keep at least one custom shape',
				description: 'Import another custom shape before deleting the last one.',
			})
			return
		}
		if (!window.confirm(`Delete "${currentItem.label}" from the custom shape library?`)) return
		deleteItem(currentItem.id)
	}

	return (
		<TldrawUiPopover id="toolbar-custom-shapes" open={isOpen} onOpenChange={setIsOpen}>
			<TldrawUiPopoverTrigger>
				<TldrawUiToolbarButton
					type="tool"
					title={currentItem ? `Custom shapes - ${currentItem.label}` : 'Custom shapes'}
					data-testid="tools.custom-shapes"
					data-value="custom-shapes"
					isActive={editor.getCurrentToolId() === DATABASE_SHAPE_TYPE}
				>
					<TldrawUiButtonIcon icon={currentIcon} />
				</TldrawUiToolbarButton>
			</TldrawUiPopoverTrigger>
			<TldrawUiPopoverContent side="top" align="center">
				<div className="custom-shape-library-menu">
					<div className="custom-shape-library-list" role="list" aria-label="Custom shape library">
						{items.map((item) => {
							const icon = getCustomShapeRegistryEntry(item.type).icon

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
										<TldrawUiButtonIcon icon={icon} />
									</span>
									<span className="custom-shape-library-item__label">{item.label}</span>
								</button>
							)
						})}
					</div>
					<div className="custom-shape-library-actions">
						<button type="button" className="custom-shape-library-action" onClick={handleImportClick}>
							Import JSON
						</button>
						<button type="button" className="custom-shape-library-action" onClick={handleRename}>
							Rename
						</button>
						<button type="button" className="custom-shape-library-action" onClick={handleDelete}>
							Delete
						</button>
					</div>
					<input
						ref={fileInputRef}
						type="file"
						accept=".json,application/json"
						multiple
						hidden
						onChange={handleFileChange}
					/>
				</div>
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
			<CustomShapesToolbarItem />
			<LineToolbarItem />
			<HighlightToolbarItem />
			<LaserToolbarItem />
			<FrameToolbarItem />
		</DefaultToolbar>
	)
}
