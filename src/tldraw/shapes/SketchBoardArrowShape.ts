import {
	ArrowShapeUtil,
	Group2d,
	Polyline2d,
	SVGContainer,
	STROKE_SIZES,
	Vec,
	getArrowInfo,
	useDefaultColorTheme,
	type TLArrowShape,
	type TLHandle,
	type TLHandleDragInfo,
} from 'tldraw'
import { getIndices } from '@tldraw/utils'
import React from 'react'

const ELBOW_SEGMENT_HANDLE_PREFIX = 'sketch-board-elbow-segment:'
const MANUAL_ELBOW_ROUTE_META_KEY = 'sketchBoardManualElbowRoute'
const MIN_SEGMENT_HANDLE_DISTANCE = 8

const ConfiguredArrowShapeUtil = ArrowShapeUtil.configure({
	elbowMidpointSnapDistance: 0,
	elbowMinSegmentLengthToShowMidpointHandle: MIN_SEGMENT_HANDLE_DISTANCE,
	minElbowHandleDistance: 28,
})

export class SketchBoardArrowShapeUtil extends ConfiguredArrowShapeUtil {
	override getGeometry(shape: TLArrowShape) {
		const manualRoute = getManualElbowRoute(shape)
		if (!manualRoute) return super.getGeometry(shape)
		const points = this.getEffectiveManualElbowPoints(shape, manualRoute)

		return new Group2d({
			children: [new Polyline2d({ points: points.map(Vec.From) })],
		})
	}

	override getHandles(shape: TLArrowShape) {
		const manualRoute = getManualElbowRoute(shape)
		if (manualRoute) return getManualElbowHandles(this.getEffectiveManualElbowPoints(shape, manualRoute))

		const handles = super.getHandles(shape)
		if (shape.props.kind !== 'elbow') return handles

		const info = getArrowInfo(this.editor, shape)
		if (info?.type !== 'elbow') return handles

		const segmentHandles = getElbowSegmentHandles(info.route.points, handles)
		return segmentHandles.length ? [...handles, ...segmentHandles] : handles
	}

	override onHandleDrag(shape: TLArrowShape, info: TLHandleDragInfo<TLArrowShape>) {
		const manualRoute = getManualElbowRoute(shape)
		if (manualRoute) return this.onManualElbowHandleDrag(shape, info, manualRoute)

		const segmentIndex = getElbowSegmentHandleIndex(info.handle.id)
		if (segmentIndex === null) return super.onHandleDrag(shape, info)

		const arrowInfo = getArrowInfo(this.editor, shape)
		if (arrowInfo?.type !== 'elbow') return

		const segmentStart = arrowInfo.route.points[segmentIndex]
		const segmentEnd = arrowInfo.route.points[segmentIndex + 1]
		if (!segmentStart || !segmentEnd) return

		const points = arrowInfo.route.points.map((point) => ({ x: point.x, y: point.y }))
		moveElbowSegment(points, segmentIndex, info.handle)

		return {
			id: shape.id,
			type: shape.type,
			meta: {
				...shape.meta,
				[MANUAL_ELBOW_ROUTE_META_KEY]: {
					version: 1,
					points,
				},
			},
			props: {
				start: points[0],
				end: points[points.length - 1],
			},
		}
	}

	override component(shape: TLArrowShape) {
		const defaultComponent = super.component(shape)
		const manualRoute = getManualElbowRoute(shape)
		if (!manualRoute) return defaultComponent
		const points = this.getEffectiveManualElbowPoints(shape, manualRoute)

		return React.createElement(ManualElbowArrowSvg, { shape, points })
	}

	override indicator(shape: TLArrowShape) {
		const defaultIndicator = super.indicator(shape)
		const manualRoute = getManualElbowRoute(shape)
		if (!manualRoute) return defaultIndicator
		const points = this.getEffectiveManualElbowPoints(shape, manualRoute)

		return React.createElement('path', {
			d: getManualElbowPath(points),
			fill: 'none',
		})
	}

	private onManualElbowHandleDrag(
		shape: TLArrowShape,
		info: TLHandleDragInfo<TLArrowShape>,
		route: ManualElbowRoute
	) {
		const points = this.getEffectiveManualElbowPoints(shape, route)
		const segmentIndex = getElbowSegmentHandleIndex(info.handle.id)

		if (info.handle.id === 'start') {
			points[0] = { x: info.handle.x, y: info.handle.y }
		} else if (info.handle.id === 'end') {
			points[points.length - 1] = { x: info.handle.x, y: info.handle.y }
		} else if (segmentIndex !== null) {
			moveElbowSegment(points, segmentIndex, info.handle)
		} else {
			return
		}

		return {
			id: shape.id,
			type: shape.type,
			meta: {
				...shape.meta,
				[MANUAL_ELBOW_ROUTE_META_KEY]: {
					version: 1,
					points,
				},
			},
			props: {
				start: points[0],
				end: points[points.length - 1],
			},
		}
	}

	private getEffectiveManualElbowPoints(shape: TLArrowShape, route: ManualElbowRoute) {
		const points = route.points.map((point) => ({ ...point }))
		const info = getArrowInfo(this.editor, shape)
		if (!info) return points

		syncManualEndpoint(points, 'start', info.start.point)
		syncManualEndpoint(points, 'end', info.end.point)
		return points
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

function getManualElbowHandles(points: { x: number; y: number }[]) {
	if (points.length < 2) return []

	const indices = getIndices(points.length + 2)
	const handles: TLHandle[] = [
		{
			id: 'start',
			type: 'vertex',
			index: indices[0],
			x: points[0].x,
			y: points[0].y,
			canSnap: true,
		},
		{
			id: 'end',
			type: 'vertex',
			index: indices[indices.length - 1],
			x: points[points.length - 1].x,
			y: points[points.length - 1].y,
			canSnap: true,
		},
	]

	handles.push(...getElbowSegmentHandles(points, handles))
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

function moveElbowSegment(
	points: { x: number; y: number }[],
	segmentIndex: number,
	handle: { x: number; y: number }
) {
	const start = points[segmentIndex]
	const end = points[segmentIndex + 1]
	if (!start || !end) return

	const isVertical = Math.abs(start.x - end.x) < Math.abs(start.y - end.y)
	if (isVertical) {
		start.x = handle.x
		end.x = handle.x
	} else {
		start.y = handle.y
		end.y = handle.y
	}
}

function syncManualEndpoint(
	points: { x: number; y: number }[],
	terminal: 'start' | 'end',
	nextPoint: { x: number; y: number }
) {
	if (points.length < 2) return

	const endpointIndex = terminal === 'start' ? 0 : points.length - 1
	const adjacentIndex = terminal === 'start' ? 1 : points.length - 2
	const endpoint = points[endpointIndex]
	const adjacent = points[adjacentIndex]
	if (!endpoint || !adjacent) return

	const wasVertical = Math.abs(endpoint.x - adjacent.x) < Math.abs(endpoint.y - adjacent.y)
	points[endpointIndex] = { x: nextPoint.x, y: nextPoint.y }

	if (wasVertical) {
		adjacent.x = nextPoint.x
	} else {
		adjacent.y = nextPoint.y
	}
}

type ManualElbowRoute = {
	version: 1
	points: { x: number; y: number }[]
}

function getManualElbowRoute(shape: TLArrowShape): ManualElbowRoute | null {
	const value = shape.meta[MANUAL_ELBOW_ROUTE_META_KEY]
	if (!isManualElbowRoute(value)) return null
	if (value.points.length < 2) return null
	return value
}

function isManualElbowRoute(value: unknown): value is ManualElbowRoute {
	if (!value || typeof value !== 'object') return false

	const candidate = value as { version?: unknown; points?: unknown }
	return (
		candidate.version === 1 &&
		Array.isArray(candidate.points) &&
		candidate.points.every(
			(point) =>
				point &&
				typeof point === 'object' &&
				typeof (point as { x?: unknown }).x === 'number' &&
				typeof (point as { y?: unknown }).y === 'number'
		)
	)
}

function ManualElbowArrowSvg({
	shape,
	points,
}: {
	shape: TLArrowShape
	points: { x: number; y: number }[]
}) {
	const theme = useDefaultColorTheme()
	const strokeWidth = STROKE_SIZES[shape.props.size] * shape.props.scale
	const stroke = theme[shape.props.color].solid
	const path = getManualElbowPath(points)

	return React.createElement(
		SVGContainer,
		{ style: { minWidth: 50, minHeight: 50 } },
		React.createElement(
			'g',
			{
				fill: 'none',
				stroke,
				strokeWidth,
				strokeLinejoin: 'round',
				strokeLinecap: 'round',
				pointerEvents: 'none',
			},
			React.createElement('path', { d: path }),
			shape.props.arrowheadStart !== 'none' &&
				React.createElement('path', {
					d: getManualArrowheadPath(points, 'start', strokeWidth),
					fill: stroke,
				}),
			shape.props.arrowheadEnd !== 'none' &&
				React.createElement('path', {
					d: getManualArrowheadPath(points, 'end', strokeWidth),
					fill: stroke,
				})
		)
	)
}

function getManualElbowPath(points: { x: number; y: number }[]) {
	return points
		.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
		.join(' ')
}

function getManualArrowheadPath(
	points: { x: number; y: number }[],
	terminal: 'start' | 'end',
	strokeWidth: number
) {
	const tip = terminal === 'start' ? points[0] : points[points.length - 1]
	const adjacent = terminal === 'start' ? points[1] : points[points.length - 2]
	if (!tip || !adjacent) return ''

	const angle = Math.atan2(tip.y - adjacent.y, tip.x - adjacent.x)
	const length = Math.max(10, strokeWidth * 4)
	const spread = Math.PI / 7
	const left = {
		x: tip.x - Math.cos(angle - spread) * length,
		y: tip.y - Math.sin(angle - spread) * length,
	}
	const right = {
		x: tip.x - Math.cos(angle + spread) * length,
		y: tip.y - Math.sin(angle + spread) * length,
	}

	return `M ${tip.x} ${tip.y} L ${left.x} ${left.y} L ${right.x} ${right.y} Z`
}
