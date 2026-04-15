import { useMemo, useState } from 'react'
import {
	DefaultStylePanel,
	GeoShapeGeoStyle,
	StylePanelArrowKindPicker,
	StylePanelArrowheadPicker,
	StylePanelColorPicker,
	StylePanelDashPicker,
	StylePanelFillPicker,
	StylePanelFontPicker,
	StylePanelLabelAlignPicker,
	StylePanelOpacityPicker,
	StylePanelSection,
	StylePanelSizePicker,
	StylePanelSplinePicker,
	StylePanelTextAlignPicker,
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
	useStylePanelContext,
	useTranslation,
	useValue,
} from 'tldraw'
import { useCustomShapeLibrary } from './custom-shape-library'
import { getCustomShapeRegistryEntry } from './custom-shape-registry'
import { geoShapeItems, type GeoShapeMenuValue } from './shape-items'
import { DATABASE_SHAPE_TYPE, type DatabaseShape } from './shapes/DatabaseShape'

type SharedMenuValue<T extends string> = { type: 'shared'; value: T } | { type: 'mixed' }
type GeoShapeReplacement = TLShapePartial<TLGeoShape>
type DatabaseShapeReplacement = TLShapePartial<DatabaseShape>

function isDatabaseShape(shape: TLShape): shape is DatabaseShape {
	return shape.type === DATABASE_SHAPE_TYPE
}

function isGeoShape(shape: TLShape): shape is TLGeoShape {
	return shape.type === 'geo'
}

function toGeoShape(
	shape: DatabaseShape,
	geo: TLGeoShape['props']['geo']
): GeoShapeReplacement {
	const source = shape.props

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
			w: source.w,
			h: source.h,
			color: source.color,
			fill: source.fill,
			size: source.size,
			geo,
		},
	}
}

function toDatabaseShape(
	shape: TLGeoShape,
	libraryItemId: string
): DatabaseShapeReplacement {
	const source = shape.props

	return {
		id: createShapeId(),
		type: DATABASE_SHAPE_TYPE,
		x: shape.x,
		y: shape.y,
		rotation: shape.rotation,
		parentId: shape.parentId,
		index: shape.index,
		isLocked: shape.isLocked,
		opacity: shape.opacity,
		meta: shape.meta,
		props: {
			w: source.w,
			h: source.h,
			color: source.color,
			fill: source.fill,
			size: source.size,
			libraryItemId,
		},
	}
}

function GeoShapePicker() {
	const editor = useEditor()
	const msg = useTranslation()
	const { onHistoryMark } = useStylePanelContext()
	const [isOpen, setIsOpen] = useState(false)

	const value = useValue<SharedMenuValue<GeoShapeMenuValue> | null>(
		'geo shape picker value',
		() => {
			if (editor.isIn('select')) {
				const selected = editor.getSelectedShapes()
				if (selected.length > 0) {
					if (selected.some((shape) => !isGeoShape(shape) && !isDatabaseShape(shape))) return null

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
			if (currentTool === 'geo' || currentTool === DATABASE_SHAPE_TYPE) {
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
		onHistoryMark('geo shape picker item')

		editor.run(() => {
			const selected = editor
				.getSelectedShapes()
				.filter((shape) => isGeoShape(shape) || isDatabaseShape(shape))

			if (editor.isIn('select') && selected.length > 0) {
				const geoSelected = selected.filter(isGeoShape)
				const databaseSelected = selected.filter(isDatabaseShape)

				if (geoSelected.length > 0) {
					editor.updateShapes(
						geoSelected.map((shape) => ({
							id: shape.id,
							type: 'geo' as const,
							props: { geo: nextValue },
						}))
					)
				}

				const replacements = databaseSelected.map((shape) => toGeoShape(shape, nextValue))
				if (replacements.length > 0) {
					editor.deleteShapes(databaseSelected.map((shape) => shape.id))
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
			<TldrawUiPopover
				id="style-panel-geo-shape-picker"
				open={isOpen}
				onOpenChange={setIsOpen}
				className="tlui-style-panel__dropdown-picker"
			>
				<TldrawUiPopoverTrigger>
					<TldrawUiToolbarButton type="menu" data-testid="style.geo" data-direction="left" title={title}>
						<TldrawUiButtonLabel>{msg('style-panel.geo')}</TldrawUiButtonLabel>
						<TldrawUiButtonIcon icon={currentItem?.icon ?? ('mixed' as const)} />
					</TldrawUiToolbarButton>
				</TldrawUiPopoverTrigger>
				<TldrawUiPopoverContent side="left" align="center">
					<TldrawUiToolbar orientation="grid" label={msg('style-panel.geo')}>
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
				</TldrawUiPopoverContent>
			</TldrawUiPopover>
		</TldrawUiToolbar>
	)
}

function CustomLibraryShapePicker() {
	const editor = useEditor()
	const msg = useTranslation()
	const { onHistoryMark } = useStylePanelContext()
	const { items, activeItem, activeItemId, setActiveItem, getItem } = useCustomShapeLibrary()
	const [isOpen, setIsOpen] = useState(false)

	const value = useValue<SharedMenuValue<string> | null>(
		'custom library shape picker value',
		() => {
			if (editor.isIn('select')) {
				const selected = editor.getSelectedShapes()
				if (selected.length > 0) {
					if (selected.some((shape) => !isGeoShape(shape) && !isDatabaseShape(shape))) return null

					const databaseSelected = selected.filter(isDatabaseShape)
					if (databaseSelected.length === selected.length) {
						const unique = new Set(databaseSelected.map((shape) => shape.props.libraryItemId))
						if (unique.size === 1) {
							return { type: 'shared', value: databaseSelected[0].props.libraryItemId }
						}
						return { type: 'mixed' }
					}

					if (activeItemId) {
						return { type: 'shared', value: activeItemId }
					}

					return null
				}
			}

			const currentTool = editor.getCurrentToolId()
			if ((currentTool === 'geo' || currentTool === DATABASE_SHAPE_TYPE) && activeItemId) {
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
		onHistoryMark('custom shape library item')

		editor.run(() => {
			const selected = editor
				.getSelectedShapes()
				.filter((shape) => isGeoShape(shape) || isDatabaseShape(shape))

			if (editor.isIn('select') && selected.length > 0) {
				const geoSelected = selected.filter(isGeoShape)
				const databaseSelected = selected.filter(isDatabaseShape)

				const updates: DatabaseShapeReplacement[] = databaseSelected
					.filter((shape) => shape.props.libraryItemId !== libraryItemId)
					.map((shape) => ({
						id: shape.id,
						type: DATABASE_SHAPE_TYPE,
						props: { libraryItemId },
					}))

				if (updates.length > 0) {
					editor.updateShapes(updates)
				}

				const replacements = geoSelected.map((shape) => toDatabaseShape(shape, libraryItemId))
				if (replacements.length > 0) {
					editor.deleteShapes(geoSelected.map((shape) => shape.id))
					editor.createShapes(replacements)
				}

				editor.setSelectedShapes([
					...databaseSelected.map((shape) => shape.id),
					...replacements.map((shape) => shape.id),
				])
			} else {
				editor.setCurrentTool(getCustomShapeRegistryEntry(item.type).toolId)
			}
		})

		setIsOpen(false)
	}

	return (
		<TldrawUiToolbar label="Custom shape">
			<TldrawUiPopover
				id="style-panel-custom-library-shape-picker"
				open={isOpen}
				onOpenChange={setIsOpen}
				className="tlui-style-panel__dropdown-picker"
			>
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
										<TldrawUiButtonIcon icon={getCustomShapeRegistryEntry(item.type).icon} />
									</span>
									<span className="custom-shape-library-item__label">{item.label}</span>
								</button>
							))}
						</div>
					</div>
				</TldrawUiPopoverContent>
			</TldrawUiPopover>
		</TldrawUiToolbar>
	)
}

function CustomStylePanelContent() {
	return (
		<>
			<StylePanelSection>
				<StylePanelColorPicker />
				<StylePanelOpacityPicker />
			</StylePanelSection>
			<StylePanelSection>
				<StylePanelFillPicker />
				<StylePanelDashPicker />
				<StylePanelSizePicker />
			</StylePanelSection>
			<StylePanelSection>
				<StylePanelFontPicker />
				<StylePanelTextAlignPicker />
				<StylePanelLabelAlignPicker />
			</StylePanelSection>
			<StylePanelSection>
				<GeoShapePicker />
				<CustomLibraryShapePicker />
				<StylePanelArrowKindPicker />
				<StylePanelArrowheadPicker />
				<StylePanelSplinePicker />
			</StylePanelSection>
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
