import { ArrowShapeUtil, defaultBindingUtils, defaultShapeUtils } from 'tldraw'
import { DatabaseShapeUtil } from './shapes/DatabaseShape'
import { SvgSymbolShapeUtil } from './shapes/SvgSymbolShape'
import { DatabaseTool } from './tools/DatabaseTool'
import { SvgSymbolTool } from './tools/SvgSymbolTool'

const SketchBoardArrowShapeUtil = ArrowShapeUtil.configure({
	elbowMidpointSnapDistance: 0,
	elbowMinSegmentLengthToShowMidpointHandle: 8,
	minElbowHandleDistance: 28,
})

export const shapeUtils = [SketchBoardArrowShapeUtil, DatabaseShapeUtil, SvgSymbolShapeUtil] as const
export const syncShapeUtils = [
	...defaultShapeUtils.filter((shapeUtil) => shapeUtil.type !== 'arrow'),
	...shapeUtils,
] as const
export const syncBindingUtils = defaultBindingUtils
export const tools = [DatabaseTool, SvgSymbolTool] as const
