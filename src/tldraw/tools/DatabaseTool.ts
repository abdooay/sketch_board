import { BaseBoxShapeTool } from 'tldraw'
import { DATABASE_SHAPE_TYPE } from '../shapes/DatabaseShape'

export class DatabaseTool extends BaseBoxShapeTool {
	static override id = DATABASE_SHAPE_TYPE
	// tldraw's BaseBoxShapeTool boxed-shape union doesn't widen for this custom shape.
	// The runtime supports the tool correctly once the shape util is registered.
	// @ts-expect-error custom boxed shape
	override shapeType = DATABASE_SHAPE_TYPE
}
