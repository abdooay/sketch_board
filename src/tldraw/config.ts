import { defaultBindingUtils, defaultShapeUtils } from 'tldraw'
import { DatabaseShapeUtil } from './shapes/DatabaseShape'
import { SketchBoardArrowShapeUtil } from './shapes/SketchBoardArrowShape'
import { SvgSymbolShapeUtil } from './shapes/SvgSymbolShape'
import { DatabaseTool } from './tools/DatabaseTool'
import { SvgSymbolTool } from './tools/SvgSymbolTool'

export const shapeUtils = [SketchBoardArrowShapeUtil, DatabaseShapeUtil, SvgSymbolShapeUtil] as const
export const syncShapeUtils = [
	...defaultShapeUtils.filter((shapeUtil) => shapeUtil.type !== 'arrow'),
	...shapeUtils,
] as const
export const syncBindingUtils = defaultBindingUtils
export const tools = [DatabaseTool, SvgSymbolTool] as const
