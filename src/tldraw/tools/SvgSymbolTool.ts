import { BaseBoxShapeTool } from 'tldraw'
import { SVG_SYMBOL_SHAPE_TYPE } from '../shapes/SvgSymbolShape'

export class SvgSymbolTool extends BaseBoxShapeTool {
	static override id = SVG_SYMBOL_SHAPE_TYPE
	override shapeType = SVG_SYMBOL_SHAPE_TYPE
}
