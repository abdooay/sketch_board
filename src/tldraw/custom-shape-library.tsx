/* eslint-disable react-refresh/only-export-components */

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from 'react'
import {
	getCustomShapeRegistryEntry,
	getDefaultCustomShapeLibraryItems,
	normalizeImportedCustomShapeDescriptor,
	normalizeStoredCustomShapeLibraryItems,
	type CustomShapeImportDescriptor,
	type CustomShapeLibraryItem,
	type CustomShapeType,
} from './custom-shape-registry'
import { setRuntimeCustomShapeLibraryState } from './custom-shape-library-state'
import {
	createLibraryItemIdFromFilename,
	createLibraryItemLabelFromFilename,
	isSvgFile,
	sanitizeSvgMarkup,
} from './svg-import'

const CUSTOM_SHAPE_LIBRARY_STORAGE_KEY = 'sketch-board-custom-shape-library'
const CUSTOM_SHAPE_LIBRARY_ACTIVE_ITEM_STORAGE_KEY = 'sketch-board-custom-shape-library-active-item'

export interface ImportCustomShapeLibraryResult {
	added: number
	updated: number
	errors: string[]
}

interface CustomShapeLibraryContextValue {
	items: CustomShapeLibraryItem[]
	activeItemId: string | null
	activeItem: CustomShapeLibraryItem | null
	setActiveItem(id: string): void
	importItemsFromFiles(files: File[]): Promise<ImportCustomShapeLibraryResult>
	renameItem(id: string, label: string): void
	deleteItem(id: string): void
	getItem(id: string | null | undefined): CustomShapeLibraryItem | null
	getActiveItemForType(type: CustomShapeType): CustomShapeLibraryItem | null
}

const CustomShapeLibraryContext = createContext<CustomShapeLibraryContextValue | null>(null)

function loadInitialLibraryItems() {
	const stored = window.localStorage.getItem(CUSTOM_SHAPE_LIBRARY_STORAGE_KEY)
	if (stored === null) {
		return getDefaultCustomShapeLibraryItems()
	}

	try {
		return normalizeStoredCustomShapeLibraryItems(JSON.parse(stored))
	} catch {
		return getDefaultCustomShapeLibraryItems()
	}
}

function loadInitialActiveItemId(items: CustomShapeLibraryItem[]) {
	const stored = window.localStorage.getItem(CUSTOM_SHAPE_LIBRARY_ACTIVE_ITEM_STORAGE_KEY)
	if (stored && items.some((item) => item.id === stored)) return stored
	return items[0]?.id ?? null
}

function upsertLibraryItems(
	currentItems: CustomShapeLibraryItem[],
	incomingItems: CustomShapeLibraryItem[]
) {
	const nextItems = [...currentItems]
	let added = 0
	let updated = 0

	for (const item of incomingItems) {
		const index = nextItems.findIndex((existing) => existing.id === item.id)
		if (index >= 0) {
			nextItems[index] = item
			updated += 1
		} else {
			nextItems.push(item)
			added += 1
		}
	}

	return { nextItems, added, updated }
}

export function CustomShapeLibraryProvider({ children }: { children: ReactNode }) {
	const [items, setItems] = useState<CustomShapeLibraryItem[]>(() => loadInitialLibraryItems())
	const [activeItemId, setActiveItemId] = useState<string | null>(() =>
		loadInitialActiveItemId(loadInitialLibraryItems())
	)

	useEffect(() => {
		window.localStorage.setItem(CUSTOM_SHAPE_LIBRARY_STORAGE_KEY, JSON.stringify(items))
		setRuntimeCustomShapeLibraryState(items, activeItemId)
	}, [items, activeItemId])

	useEffect(() => {
		if (activeItemId) {
			window.localStorage.setItem(CUSTOM_SHAPE_LIBRARY_ACTIVE_ITEM_STORAGE_KEY, activeItemId)
		} else {
			window.localStorage.removeItem(CUSTOM_SHAPE_LIBRARY_ACTIVE_ITEM_STORAGE_KEY)
		}
	}, [activeItemId])

	const setActiveItem = useCallback(
		(id: string) => {
			if (!items.some((item) => item.id === id)) return
			setActiveItemId(id)
			setRuntimeCustomShapeLibraryState(items, id)
		},
		[items]
	)

	const importItemsFromFiles = useCallback(
		async (files: File[]): Promise<ImportCustomShapeLibraryResult> => {
			const parsedItems: CustomShapeLibraryItem[] = []
			const errors: string[] = []

			for (const file of files) {
				if (isSvgFile(file)) {
					try {
						const svgSource = sanitizeSvgMarkup(await file.text())
						if (!svgSource) {
							errors.push(`Could not sanitize ${file.name}`)
							continue
						}

						const svgEntry = getCustomShapeRegistryEntry('svg-symbol')
						parsedItems.push({
							id: createLibraryItemIdFromFilename(file.name),
							type: 'svg-symbol',
							label: createLibraryItemLabelFromFilename(file.name),
							defaultProps: svgEntry.normalizeDefaults({
								w: svgSource.width,
								h: svgSource.height,
							}),
							source: {
								kind: 'svg',
								viewBox: svgSource.viewBox,
								markup: svgSource.markup,
							},
							version: 1,
						})
					} catch {
						errors.push(`Could not parse ${file.name}`)
					}
					continue
				}

				try {
					const raw = JSON.parse(await file.text()) as
						| CustomShapeImportDescriptor
						| CustomShapeImportDescriptor[]
					const candidates = Array.isArray(raw) ? raw : [raw]

					for (const candidate of candidates) {
						const item = normalizeImportedCustomShapeDescriptor(candidate)
						if (item) {
							parsedItems.push(item)
						} else {
							errors.push(`Skipped invalid item in ${file.name}`)
						}
					}
				} catch {
					errors.push(`Could not parse ${file.name}`)
				}
			}

			const { nextItems, added, updated } = upsertLibraryItems(items, parsedItems)
			if (parsedItems.length > 0) {
				setItems(nextItems)
				if (!activeItemId && nextItems[0]) {
					setActiveItemId(nextItems[0].id)
				}
			}

			return { added, updated, errors }
		},
		[items, activeItemId]
	)

	const renameItem = useCallback((id: string, label: string) => {
		const nextLabel = label.trim()
		if (!nextLabel) return

		setItems((currentItems) =>
			currentItems.map((item) => (item.id === id ? { ...item, label: nextLabel } : item))
		)
	}, [])

	const deleteItem = useCallback(
		(id: string) => {
			const nextItems = items.filter((item) => item.id !== id)
			setItems(nextItems)
			setActiveItemId((currentActiveItemId) =>
				currentActiveItemId === id ? (nextItems[0]?.id ?? null) : currentActiveItemId
			)
		},
		[items]
	)

	const getItem = useCallback(
		(id: string | null | undefined) => {
			if (!id) return null
			return items.find((item) => item.id === id) ?? null
		},
		[items]
	)

	const activeItem = useMemo(() => getItem(activeItemId), [getItem, activeItemId])

	const getActiveItemForType = useCallback(
		(type: CustomShapeType) => {
			const currentActiveItem = getItem(activeItemId)
			if (currentActiveItem?.type === type) return currentActiveItem
			return items.find((item) => item.type === type) ?? null
		},
		[getItem, items, activeItemId]
	)

	const value = useMemo<CustomShapeLibraryContextValue>(
		() => ({
			items,
			activeItemId,
			activeItem,
			setActiveItem,
			importItemsFromFiles,
			renameItem,
			deleteItem,
			getItem,
			getActiveItemForType,
		}),
		[
			items,
			activeItemId,
			activeItem,
			setActiveItem,
			importItemsFromFiles,
			renameItem,
			deleteItem,
			getItem,
			getActiveItemForType,
		]
	)

	return <CustomShapeLibraryContext.Provider value={value}>{children}</CustomShapeLibraryContext.Provider>
}

export function useCustomShapeLibrary() {
	const context = useContext(CustomShapeLibraryContext)
	if (!context) {
		throw new Error('useCustomShapeLibrary must be used within a CustomShapeLibraryProvider')
	}
	return context
}
