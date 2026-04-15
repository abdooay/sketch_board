import { BaseBoxShapeTool } from 'tldraw'
import { SVG_SYMBOL_SHAPE_TYPE } from '../shapes/SvgSymbolShape'

export class SvgSymbolTool extends BaseBoxShapeTool {
	static override id = SVG_SYMBOL_SHAPE_TYPE
	// tldraw's BaseBoxShapeTool boxed-shape union doesn't widen for this custom shape.
	// The runtime supports the tool correctly once the shape util is registered.
	// @ts-expect-error custom boxed shape
	override shapeType = SVG_SYMBOL_SHAPE_TYPE
}
