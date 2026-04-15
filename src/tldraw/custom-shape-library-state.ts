import type { CustomShapeLibraryItem, CustomShapeType } from './custom-shape-registry'

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

export function getRuntimeActiveCustomShapeLibraryItemForType<TType extends CustomShapeType>(
	type: TType
) {
	const activeItem = getRuntimeActiveCustomShapeLibraryItem()
	if (activeItem?.type === type) {
		return activeItem as Extract<CustomShapeLibraryItem, { type: TType }>
	}

	const matchingItem = runtimeLibraryItems.find((item) => item.type === type)
	return (matchingItem as Extract<CustomShapeLibraryItem, { type: TType }> | undefined) ?? null
}
