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
	createLibraryItemIdFromText,
	createLibraryItemIdFromFilename,
	createLibraryItemLabelFromFilename,
	extractSvgTextFromMarkup,
	isSvgFile,
	sanitizeSvgMarkup,
} from './svg-import'
import type { StoredCustomShapeLibraryState } from './cloud-storage'

const CUSTOM_SHAPE_LIBRARY_STORAGE_KEY = 'sketch-board-custom-shape-library'
const CUSTOM_SHAPE_LIBRARY_ACTIVE_ITEM_STORAGE_KEY = 'sketch-board-custom-shape-library-active-item'

export interface ImportCustomShapeLibraryResult {
	added: number
	updated: number
	errors: string[]
}

export interface ImportCustomShapeLibraryTextInput {
	name: string
	text: string
}

interface CustomShapeLibraryContextValue {
	items: CustomShapeLibraryItem[]
	activeItemId: string | null
	activeItem: CustomShapeLibraryItem | null
	setActiveItem(id: string): void
	importItemsFromFiles(files: File[]): Promise<ImportCustomShapeLibraryResult>
	importItemsFromTextInputs(
		inputs: ImportCustomShapeLibraryTextInput[]
	): Promise<ImportCustomShapeLibraryResult>
	renameItem(id: string, label: string): void
	deleteItem(id: string): void
	replaceLibraryState(state: StoredCustomShapeLibraryState): void
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

function createSvgLibraryItemFromSource(
	name: string,
	svgSource: Awaited<ReturnType<typeof sanitizeSvgMarkup>>
): CustomShapeLibraryItem | null {
	if (!svgSource) return null

	const svgEntry = getCustomShapeRegistryEntry('svg-symbol')
	const label = createLibraryItemLabelFromFilename(name)

	return {
		id: createLibraryItemIdFromText(label),
		type: 'svg-symbol',
		label,
		defaultProps: svgEntry.normalizeDefaults({
			w: svgSource.width,
			h: svgSource.height,
		}),
							source: {
								kind: 'svg',
								viewBox: svgSource.viewBox,
								markup: svgSource.markup,
								contrastTone: svgSource.contrastTone,
							},
							version: 1,
						}
}

function parseImportedJsonText(name: string, text: string, errors: string[]) {
	const parsedItems: CustomShapeLibraryItem[] = []

	try {
		const raw = JSON.parse(text) as CustomShapeImportDescriptor | CustomShapeImportDescriptor[]
		const candidates = Array.isArray(raw) ? raw : [raw]

		for (const candidate of candidates) {
			const item = normalizeImportedCustomShapeDescriptor(candidate)
			if (item) {
				parsedItems.push(item)
			} else {
				errors.push(`Skipped invalid item in ${name}`)
			}
		}
	} catch {
		errors.push(`Could not parse ${name}`)
	}

	return parsedItems
}

function mergeImportedItems(
	currentItems: CustomShapeLibraryItem[],
	importedItems: CustomShapeLibraryItem[],
	activeItemId: string | null,
	setItems: (items: CustomShapeLibraryItem[]) => void,
	setActiveItemId: (id: string | null) => void
) {
	const { nextItems, added, updated } = upsertLibraryItems(currentItems, importedItems)
	if (importedItems.length > 0) {
		setItems(nextItems)
		if (!activeItemId && nextItems[0]) {
			setActiveItemId(nextItems[0].id)
		}
	}

	return { added, updated }
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
			const importedItems: CustomShapeLibraryItem[] = []
			const errors: string[] = []

			for (const file of files) {
				if (isSvgFile(file)) {
					try {
						const svgSource = sanitizeSvgMarkup(await file.text())
						const svgItem = createSvgLibraryItemFromSource(file.name, svgSource)
						if (!svgItem) {
							errors.push(`Could not sanitize ${file.name}`)
							continue
						}
						svgItem.id = createLibraryItemIdFromFilename(file.name)
						importedItems.push(svgItem)
					} catch {
						errors.push(`Could not parse ${file.name}`)
					}
					continue
				}

				importedItems.push(...parseImportedJsonText(file.name, await file.text(), errors))
			}

			const { added, updated } = mergeImportedItems(
				items,
				importedItems,
				activeItemId,
				setItems,
				setActiveItemId
			)

			return { added, updated, errors }
		},
		[items, activeItemId]
	)

	const importItemsFromTextInputs = useCallback(
		async (inputs: ImportCustomShapeLibraryTextInput[]): Promise<ImportCustomShapeLibraryResult> => {
			const importedItems: CustomShapeLibraryItem[] = []
			const errors: string[] = []

			for (const input of inputs) {
				const svgText = extractSvgTextFromMarkup(input.text)
				if (svgText) {
					const svgItem = createSvgLibraryItemFromSource(input.name, sanitizeSvgMarkup(svgText))
					if (svgItem) {
						importedItems.push(svgItem)
					} else {
						errors.push(`Could not sanitize ${input.name}`)
					}
					continue
				}

				importedItems.push(...parseImportedJsonText(input.name, input.text, errors))
			}

			const { added, updated } = mergeImportedItems(
				items,
				importedItems,
				activeItemId,
				setItems,
				setActiveItemId
			)

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

	const replaceLibraryState = useCallback((nextState: StoredCustomShapeLibraryState) => {
		const nextItems = normalizeStoredCustomShapeLibraryItems(nextState.items)
		setItems(nextItems)
		setActiveItemId(
			nextState.activeItemId && nextItems.some((item) => item.id === nextState.activeItemId)
				? nextState.activeItemId
				: (nextItems[0]?.id ?? null)
		)
	}, [])

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
			importItemsFromTextInputs,
			renameItem,
			deleteItem,
			replaceLibraryState,
			getItem,
			getActiveItemForType,
		}),
		[
			items,
			activeItemId,
			activeItem,
			setActiveItem,
			importItemsFromFiles,
			importItemsFromTextInputs,
			renameItem,
			deleteItem,
			replaceLibraryState,
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
