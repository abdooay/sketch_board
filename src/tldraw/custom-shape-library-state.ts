import type { CustomShapeLibraryItem } from './custom-shape-registry'

let runtimeLibraryItems: CustomShapeLibraryItem[] = []
let runtimeActiveItemId: string | null = null

export function setRuntimeCustomShapeLibraryState(
	items: CustomShapeLibraryItem[],
	activeItemId: string | null
) {
	runtimeLibraryItems = items
	runtimeActiveItemId = activeItemId
}

export function getRuntimeCustomShapeLibraryItems() {
	return runtimeLibraryItems
}

export function getRuntimeActiveCustomShapeLibraryItemId() {
	return runtimeActiveItemId
}

export function getRuntimeActiveCustomShapeLibraryItem() {
	if (!runtimeActiveItemId) return null
	return runtimeLibraryItems.find((item) => item.id === runtimeActiveItemId) ?? null
}
