import { useMemo, useState } from 'react'
import {
	DefaultStylePanel,
	DefaultStylePanelContent,
	GeoShapeGeoStyle,
	TldrawUiButtonIcon,
	TldrawUiButtonLabel,
	TldrawUiMenuContextProvider,
	TldrawUiPopover,
	TldrawUiPopoverContent,
	TldrawUiPopoverTrigger,
	TldrawUiToolbar,
	TldrawUiToolbarButton,
	createShapeId,
	type TLGeoShape,
	type TLShape,
	type TLShapePartial,
	type TLUiStylePanelProps,
	type TLUiTranslationKey,
	useEditor,
	useRelevantStyles,
	useTranslation,
	useValue,
} from 'tldraw'
import { useCustomShapeLibrary } from './custom-shape-library'
import { CustomShapeImportDialog } from './custom-shape-import-dialog'
import { CustomShapeLibraryPreview } from './custom-shape-preview'
import {
	getCustomShapeRegistryEntry,
	type CustomShapeLibraryItem,
} from './custom-shape-registry'
import { geoShapeItems, type GeoShapeMenuValue } from './shape-items'
import { DATABASE_SHAPE_TYPE, type DatabaseShape } from './shapes/DatabaseShape'
import { SVG_SYMBOL_SHAPE_TYPE, type SvgSymbolShape } from './shapes/SvgSymbolShape'

type SharedMenuValue<T extends string> = { type: 'shared'; value: T } | { type: 'mixed' }
type GeoShapeReplacement = TLShapePartial<TLGeoShape>
type CustomShapeReplacement = TLShapePartial<DatabaseShape | SvgSymbolShape>
type CustomCanvasShape = DatabaseShape | SvgSymbolShape

const DEFAULT_GEO_COLOR = 'blue'
const DEFAULT_GEO_FILL = 'none'
const DEFAULT_GEO_SIZE = 'm'

function isDatabaseShape(shape: TLShape): shape is DatabaseShape {
	return shape.type === DATABASE_SHAPE_TYPE
}

function isSvgSymbolShape(shape: TLShape): shape is SvgSymbolShape {
	return shape.type === SVG_SYMBOL_SHAPE_TYPE
}

function isCustomCanvasShape(shape: TLShape): shape is CustomCanvasShape {
	return isDatabaseShape(shape) || isSvgSymbolShape(shape)
}

function isGeoShape(shape: TLShape): shape is TLGeoShape {
	return shape.type === 'geo'
}

function toGeoShape(shape: CustomCanvasShape, geo: TLGeoShape['props']['geo']): GeoShapeReplacement {
	const color = isDatabaseShape(shape) ? shape.props.color : DEFAULT_GEO_COLOR
	const fill = isDatabaseShape(shape) ? shape.props.fill : DEFAULT_GEO_FILL
	const size = isDatabaseShape(shape) ? shape.props.size : DEFAULT_GEO_SIZE

	return {
		id: createShapeId(),
		type: 'geo',
		x: shape.x,
		y: shape.y,
		rotation: shape.rotation,
		parentId: shape.parentId,
		index: shape.index,
		isLocked: shape.isLocked,
		opacity: shape.opacity,
		meta: shape.meta,
		props: {
			w: shape.props.w,
			h: shape.props.h,
			color,
			fill,
			size,
			geo,
		},
	}
}

function createCustomShapeFromLibraryItem(
	shape: TLGeoShape | CustomCanvasShape,
	item: CustomShapeLibraryItem
): CustomShapeReplacement {
	const base = {
		id: createShapeId(),
		x: shape.x,
		y: shape.y,
		rotation: shape.rotation,
		parentId: shape.parentId,
		index: shape.index,
		isLocked: shape.isLocked,
		opacity: shape.opacity,
		meta: shape.meta,
	}

	if (item.type === DATABASE_SHAPE_TYPE) {
		const color =
			isGeoShape(shape) || isDatabaseShape(shape) ? shape.props.color : item.defaultProps.color
		const fill =
			isGeoShape(shape) || isDatabaseShape(shape) ? shape.props.fill : item.defaultProps.fill
		const size =
			isGeoShape(shape) || isDatabaseShape(shape) ? shape.props.size : item.defaultProps.size

		return {
			...base,
			type: DATABASE_SHAPE_TYPE,
			props: {
				w: shape.props.w,
				h: shape.props.h,
				color,
				fill,
				size,
				libraryItemId: item.id,
			},
		}
	}

	return {
		...base,
		type: SVG_SYMBOL_SHAPE_TYPE,
		props: {
			w: shape.props.w,
			h: shape.props.h,
			libraryItemId: item.id,
		},
	}
}

function GeoShapePicker() {
	const editor = useEditor()
	const msg = useTranslation()
	const [isOpen, setIsOpen] = useState(false)

	const value = useValue<SharedMenuValue<GeoShapeMenuValue> | null>(
		'geo shape picker value',
		() => {
			if (editor.isIn('select')) {
				const selected = editor.getSelectedShapes()
				if (selected.length > 0) {
					if (selected.some((shape) => !isGeoShape(shape) && !isCustomCanvasShape(shape))) return null

					const geoSelected = selected.filter(isGeoShape)
					if (geoSelected.length !== selected.length) return { type: 'mixed' }

					const unique = new Set(geoSelected.map((shape) => shape.props.geo))
					if (unique.size === 1) {
						return { type: 'shared', value: geoSelected[0].props.geo }
					}

					return { type: 'mixed' }
				}
			}

			const currentTool = editor.getCurrentToolId()
			if (
				currentTool === 'geo' ||
				currentTool === DATABASE_SHAPE_TYPE ||
				currentTool === SVG_SYMBOL_SHAPE_TYPE
			) {
				return {
					type: 'shared',
					value: editor.getStyleForNextShape(GeoShapeGeoStyle),
				}
			}

			return null
		},
		[editor]
	)

	const currentItem = useMemo(() => {
		if (!value || value.type === 'mixed') return null
		return geoShapeItems.find((item) => item.value === value.value) ?? null
	}, [value])

	if (!value) return null

	const title =
		value.type === 'mixed'
			? `${msg('style-panel.geo')} - ${msg('style-panel.mixed')}`
			: `${msg('style-panel.geo')} - ${msg(
					`geo-style.${value.value}` as TLUiTranslationKey
				)}`

	const applyValue = (nextValue: GeoShapeMenuValue) => {
		editor.markHistoryStoppingPoint('geo shape picker item')

		editor.run(() => {
			const selected = editor
				.getSelectedShapes()
				.filter((shape) => isGeoShape(shape) || isCustomCanvasShape(shape))

			if (editor.isIn('select') && selected.length > 0) {
				const geoSelected = selected.filter(isGeoShape)
				const customSelected = selected.filter(isCustomCanvasShape)

				if (geoSelected.length > 0) {
					editor.updateShapes(
						geoSelected.map((shape) => ({
							id: shape.id,
							type: 'geo' as const,
							props: { geo: nextValue },
						}))
					)
				}

				const replacements = customSelected.map((shape) => toGeoShape(shape, nextValue))
				if (replacements.length > 0) {
					editor.deleteShapes(customSelected.map((shape) => shape.id))
					editor.createShapes(replacements)
				}

				editor.setSelectedShapes([
					...geoSelected.map((shape) => shape.id),
					...replacements.map((shape) => shape.id),
				])
			} else {
				editor.setStyleForNextShapes(GeoShapeGeoStyle, nextValue)
				editor.setCurrentTool('geo')
			}

			editor.setStyleForNextShapes(GeoShapeGeoStyle, nextValue)
		})

		setIsOpen(false)
	}

	return (
		<TldrawUiToolbar label={msg('style-panel.geo')}>
			<TldrawUiPopover id="style-panel-geo-shape-picker" open={isOpen} onOpenChange={setIsOpen}>
				<TldrawUiPopoverTrigger>
					<TldrawUiToolbarButton type="menu" data-testid="style.geo" data-direction="left" title={title}>
						<TldrawUiButtonLabel>{msg('style-panel.geo')}</TldrawUiButtonLabel>
						<TldrawUiButtonIcon icon={currentItem?.icon ?? ('mixed' as const)} />
					</TldrawUiToolbarButton>
				</TldrawUiPopoverTrigger>
				<TldrawUiPopoverContent side="left" align="center">
					<div className="custom-shape-grid-toolbar">
						<TldrawUiToolbar label={msg('style-panel.geo')}>
							<TldrawUiMenuContextProvider type="icons" sourceId="style-panel">
								{geoShapeItems.map((item) => {
									const itemTitle = `${msg('style-panel.geo')} - ${msg(
										`geo-style.${item.value}` as TLUiTranslationKey
									)}`
									const isActive = value.type === 'shared' && value.value === item.value

									return (
										<TldrawUiToolbarButton
											key={item.value}
											type="icon"
											data-testid={`style.geo.${item.value}`}
											title={itemTitle}
											isActive={isActive}
											onClick={() => applyValue(item.value)}
										>
											<TldrawUiButtonIcon icon={item.icon} />
										</TldrawUiToolbarButton>
									)
								})}
							</TldrawUiMenuContextProvider>
						</TldrawUiToolbar>
					</div>
				</TldrawUiPopoverContent>
			</TldrawUiPopover>
		</TldrawUiToolbar>
	)
}

function CustomLibraryShapePicker() {
	const editor = useEditor()
	const msg = useTranslation()
	const { items, activeItem, activeItemId, setActiveItem, getItem } = useCustomShapeLibrary()
	const [isOpen, setIsOpen] = useState(false)
	const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)

	const value = useValue<SharedMenuValue<string> | null>(
		'custom library shape picker value',
		() => {
			if (editor.isIn('select')) {
				const selected = editor.getSelectedShapes()
				if (selected.length > 0) {
					if (selected.some((shape) => !isGeoShape(shape) && !isCustomCanvasShape(shape))) return null

					const customSelected = selected.filter(isCustomCanvasShape)
					if (customSelected.length === selected.length) {
						const unique = new Set(customSelected.map((shape) => shape.props.libraryItemId))
						if (unique.size === 1) {
							return { type: 'shared', value: customSelected[0].props.libraryItemId }
						}
						return { type: 'mixed' }
					}

					if (activeItemId) {
						return { type: 'shared', value: activeItemId }
					}
				}
			}

			const currentTool = editor.getCurrentToolId()
			if (
				(currentTool === 'geo' ||
					currentTool === DATABASE_SHAPE_TYPE ||
					currentTool === SVG_SYMBOL_SHAPE_TYPE) &&
				activeItemId
			) {
				return { type: 'shared', value: activeItemId }
			}

			return null
		},
		[editor, activeItemId]
	)

	const currentItem = useMemo(() => {
		if (value?.type === 'shared') {
			return getItem(value.value) ?? activeItem ?? items[0] ?? null
		}
		return activeItem ?? items[0] ?? null
	}, [value, getItem, activeItem, items])

	if (!value || !currentItem) return null

	const title =
		value.type === 'mixed'
			? `Custom shape - ${msg('style-panel.mixed')}`
			: `Custom shape - ${currentItem.label}`

	const applyValue = (libraryItemId: string) => {
		const item = getItem(libraryItemId)
		if (!item) return

		setActiveItem(libraryItemId)
		editor.markHistoryStoppingPoint('custom shape library item')

		editor.run(() => {
			const selected = editor
				.getSelectedShapes()
				.filter((shape) => isGeoShape(shape) || isCustomCanvasShape(shape))

			if (editor.isIn('select') && selected.length > 0) {
				const geoSelected = selected.filter(isGeoShape)
				const customSelected = selected.filter(isCustomCanvasShape)
				const sameTypeSelected = customSelected.filter((shape) => shape.type === item.type)
				const replacingSelected = [
					...geoSelected,
					...customSelected.filter((shape) => shape.type !== item.type),
				]

				if (sameTypeSelected.length > 0) {
					editor.updateShapes(
						sameTypeSelected.map((shape) => ({
							id: shape.id,
							type: item.type,
							props: { libraryItemId: item.id },
						}))
					)
				}

				const replacements = replacingSelected.map((shape) =>
					createCustomShapeFromLibraryItem(shape, item)
				)
				if (replacements.length > 0) {
					editor.deleteShapes(replacingSelected.map((shape) => shape.id))
					editor.createShapes(replacements)
				}

				editor.setSelectedShapes([
					...sameTypeSelected.map((shape) => shape.id),
					...replacements.map((shape) => shape.id),
				])
			} else {
				editor.setCurrentTool(getCustomShapeRegistryEntry(item.type).toolId)
			}
		})

		setIsOpen(false)
	}

	return (
		<>
			<TldrawUiToolbar label="Custom shape">
				<TldrawUiPopover id="style-panel-custom-library-shape-picker" open={isOpen} onOpenChange={setIsOpen}>
					<TldrawUiPopoverTrigger>
						<TldrawUiToolbarButton
							type="menu"
							data-testid="style.custom-library"
							data-direction="left"
							title={title}
						>
							<TldrawUiButtonLabel>Custom</TldrawUiButtonLabel>
							<TldrawUiButtonIcon icon={getCustomShapeRegistryEntry(currentItem.type).icon} />
						</TldrawUiToolbarButton>
					</TldrawUiPopoverTrigger>
					<TldrawUiPopoverContent side="left" align="center">
						<div className="custom-shape-library-menu custom-shape-library-menu--panel">
							<div className="custom-shape-library-list" role="list" aria-label="Custom shape library">
								{items.map((item) => (
									<button
										key={item.id}
										type="button"
										role="listitem"
										className="custom-shape-library-item"
										data-active={value.type === 'shared' && value.value === item.id}
										onClick={() => applyValue(item.id)}
									>
										<span className="custom-shape-library-item__icon">
											<CustomShapeLibraryPreview item={item} />
										</span>
										<span className="custom-shape-library-item__label">{item.label}</span>
									</button>
								))}
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
									Import SVG / JSON
								</button>
							</div>
						</div>
					</TldrawUiPopoverContent>
				</TldrawUiPopover>
			</TldrawUiToolbar>
			<CustomShapeImportDialog
				open={isImportDialogOpen}
				onClose={() => setIsImportDialogOpen(false)}
			/>
		</>
	)
}

function CustomStylePanelContent() {
	const styles = useRelevantStyles()

	if (!styles) return null

	return (
		<>
			<DefaultStylePanelContent styles={styles} />
			<div className="tlui-style-panel__section">
				<GeoShapePicker />
				<CustomLibraryShapePicker />
			</div>
		</>
	)
}

export function CustomStylePanel(props: TLUiStylePanelProps) {
	return (
		<DefaultStylePanel {...props}>
			<CustomStylePanelContent />
		</DefaultStylePanel>
	)
}
