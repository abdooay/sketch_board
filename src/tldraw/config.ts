import { defaultBindingUtils, defaultShapeUtils } from 'tldraw'
import { DatabaseShapeUtil } from './shapes/DatabaseShape'
import { SvgSymbolShapeUtil } from './shapes/SvgSymbolShape'
import { DatabaseTool } from './tools/DatabaseTool'
import { SvgSymbolTool } from './tools/SvgSymbolTool'

export const shapeUtils = [DatabaseShapeUtil, SvgSymbolShapeUtil] as const
export const syncShapeUtils = [...defaultShapeUtils, ...shapeUtils] as const
export const syncBindingUtils = defaultBindingUtils
export const tools = [DatabaseTool, SvgSymbolTool] as const
