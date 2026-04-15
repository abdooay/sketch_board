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
	type TLGeoShape,
	type TLShape,
	type TLShapePartial,
	type TLUiStylePanelProps,
	type TLUiTranslationKey,
	createShapeId,
	useEditor,
	useStylePanelContext,
	useTranslation,
	useValue,
} from 'tldraw'
import { useMemo, useState } from 'react'
import { shapeItems, type ShapeMenuValue } from './shape-items'
import { DATABASE_SHAPE_TYPE, type DatabaseShape } from './shapes/DatabaseShape'

type ShapeMenuSharedValue = { type: 'shared'; value: ShapeMenuValue } | { type: 'mixed' }
type ShapeReplacement = TLShapePartial<TLGeoShape> | TLShapePartial<DatabaseShape>

function getConvertibleShapeValue(shape: TLShape): ShapeMenuValue | null {
	if (shape.type === 'geo') return shape.props.geo
	if (shape.type === DATABASE_SHAPE_TYPE) return DATABASE_SHAPE_TYPE
	return null
}

function isDatabaseShape(shape: TLShape): shape is DatabaseShape {
	return shape.type === DATABASE_SHAPE_TYPE
}

function toGeoShape(
	shape: TLShape,
	geo: TLGeoShape['props']['geo']
): TLShapePartial<TLGeoShape> | null {
	const source = isDatabaseShape(shape) ? shape.props : shape.type === 'geo' ? shape.props : null
	if (!source) return null

	return {
		id: createShapeId(),
		type: 'geo' as const,
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

function toDatabaseShape(shape: TLShape): TLShapePartial<DatabaseShape> | null {
	const source = shape.type === 'geo' ? shape.props : isDatabaseShape(shape) ? shape.props : null
	if (!source) return null

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
		},
	}
}

function isShapePartial(shape: ShapeReplacement | null): shape is ShapeReplacement {
	return shape !== null
}

function CustomShapePicker() {
	const editor = useEditor()
	const msg = useTranslation()
	const { onHistoryMark } = useStylePanelContext()
	const [isOpen, setIsOpen] = useState(false)

	const value = useValue<ShapeMenuSharedValue | null>(
		'shape picker value',
		() => {
			if (editor.isIn('select')) {
				const selected = editor.getSelectedShapes()
				if (selected.length > 0) {
					const resolved = selected.map(getConvertibleShapeValue)
					if (resolved.some((item) => item === null)) return null
					const unique = new Set(resolved)
					if (unique.size === 1) {
						return { type: 'shared', value: resolved[0]! }
					}
					return { type: 'mixed' }
				}
			}

			const currentTool = editor.getCurrentToolId()
			if (currentTool === DATABASE_SHAPE_TYPE) {
				return { type: 'shared', value: DATABASE_SHAPE_TYPE }
			}
			if (currentTool === 'geo') {
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
		return shapeItems.find((item) => item.value === value.value) ?? null
	}, [value])

	if (!value) return null

	const title =
		value.type === 'mixed'
			? `${msg('style-panel.geo')} - ${msg('style-panel.mixed')}`
			: `${msg('style-panel.geo')} - ${msg(
					`geo-style.${value.value}` as TLUiTranslationKey
				)}`

	const applyValue = (nextValue: ShapeMenuValue) => {
		onHistoryMark('shape picker item')

		editor.run(() => {
			const selected = editor
				.getSelectedShapes()
				.filter((shape) => getConvertibleShapeValue(shape) !== null)

			if (editor.isIn('select') && selected.length > 0) {
				const replacements = selected
					.map((shape) =>
						nextValue === DATABASE_SHAPE_TYPE ? toDatabaseShape(shape) : toGeoShape(shape, nextValue)
					)
					.filter(isShapePartial)

				if (replacements.length > 0) {
					editor.markHistoryStoppingPoint('change shape kind')
					editor.deleteShapes(selected.map((shape) => shape.id))
					editor.createShapes(replacements)
					editor.setSelectedShapes(replacements.map((shape) => shape.id))
				}
			} else if (nextValue === DATABASE_SHAPE_TYPE) {
				editor.setCurrentTool(DATABASE_SHAPE_TYPE)
			} else {
				editor.setStyleForNextShapes(GeoShapeGeoStyle, nextValue)
				editor.setCurrentTool('geo')
			}

			if (nextValue !== DATABASE_SHAPE_TYPE) {
				editor.setStyleForNextShapes(GeoShapeGeoStyle, nextValue)
			}
		})

		setIsOpen(false)
	}

	return (
		<TldrawUiToolbar label={msg('style-panel.geo')}>
			<TldrawUiPopover
				id="custom-shape-picker"
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
							{shapeItems.map((item) => {
								const itemTitle = `${msg('style-panel.geo')} - ${msg(
									`geo-style.${item.value}` as TLUiTranslationKey
								)}`
								const isActive =
									value.type === 'shared' && value.value === item.value

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
				<CustomShapePicker />
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
