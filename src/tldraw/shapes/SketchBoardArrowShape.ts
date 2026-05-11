import {
	ArrowShapeUtil,
	getArrowInfo,
	type TLArrowShape,
	type TLHandle,
	type TLHandleDragInfo,
} from 'tldraw'
import { getIndices } from '@tldraw/utils'

const ELBOW_SEGMENT_HANDLE_PREFIX = 'sketch-board-elbow-segment:'
const MIN_SEGMENT_HANDLE_DISTANCE = 8

const ConfiguredArrowShapeUtil = ArrowShapeUtil.configure({
	elbowMidpointSnapDistance: 0,
	elbowMinSegmentLengthToShowMidpointHandle: MIN_SEGMENT_HANDLE_DISTANCE,
	minElbowHandleDistance: 28,
})

export class SketchBoardArrowShapeUtil extends ConfiguredArrowShapeUtil {
	override getHandles(shape: TLArrowShape) {
		const handles = super.getHandles(shape)
		if (shape.props.kind !== 'elbow') return handles

		const info = getArrowInfo(this.editor, shape)
		if (info?.type !== 'elbow') return handles

		const segmentHandles = getElbowSegmentHandles(info.route.points, handles)
		return segmentHandles.length ? [...handles, ...segmentHandles] : handles
	}

	override onHandleDrag(shape: TLArrowShape, info: TLHandleDragInfo<TLArrowShape>) {
		const segmentIndex = getElbowSegmentHandleIndex(info.handle.id)
		if (segmentIndex === null) return super.onHandleDrag(shape, info)

		const arrowInfo = getArrowInfo(this.editor, shape)
		if (arrowInfo?.type !== 'elbow') return

		const segmentStart = arrowInfo.route.points[segmentIndex]
		const segmentEnd = arrowInfo.route.points[segmentIndex + 1]
		if (!segmentStart || !segmentEnd) return

		const isVertical = Math.abs(segmentStart.x - segmentEnd.x) < 0.01
		const axis = isVertical ? 'x' : 'y'
		const axisValues = arrowInfo.route.points.map((point) => point[axis])
		const lo = Math.min(...axisValues)
		const hi = Math.max(...axisValues)

		if (Math.abs(hi - lo) < 0.01) return

		const elbowMidPoint = clamp01((info.handle[axis] - lo) / (hi - lo))
		return {
			id: shape.id,
			type: shape.type,
			props: {
				elbowMidPoint,
			},
		}
	}
}

function getElbowSegmentHandles(points: { x: number; y: number }[], existingHandles: TLHandle[]) {
	if (points.length < 2) return []

	const indices = getIndices(points.length + 2)
	const handles: TLHandle[] = []

	for (let index = 0; index < points.length - 1; index++) {
		const start = points[index]
		const end = points[index + 1]
		const midpoint = {
			x: (start.x + end.x) / 2,
			y: (start.y + end.y) / 2,
		}
		const length = Math.hypot(end.x - start.x, end.y - start.y)

		if (length < MIN_SEGMENT_HANDLE_DISTANCE) continue
		if (isNearExistingHandle(midpoint, existingHandles)) continue

		handles.push({
			id: `${ELBOW_SEGMENT_HANDLE_PREFIX}${index}`,
			type: 'vertex',
			index: indices[index + 1],
			x: midpoint.x,
			y: midpoint.y,
			canSnap: false,
		})
	}

	return handles
}

function isNearExistingHandle(point: { x: number; y: number }, handles: TLHandle[]) {
	return handles.some((handle) => Math.hypot(handle.x - point.x, handle.y - point.y) < 0.5)
}

function getElbowSegmentHandleIndex(handleId: string) {
	if (!handleId.startsWith(ELBOW_SEGMENT_HANDLE_PREFIX)) return null
	const rawIndex = Number(handleId.slice(ELBOW_SEGMENT_HANDLE_PREFIX.length))
	return Number.isInteger(rawIndex) && rawIndex >= 0 ? rawIndex : null
}

function clamp01(value: number) {
	return Math.max(0, Math.min(1, value))
}
