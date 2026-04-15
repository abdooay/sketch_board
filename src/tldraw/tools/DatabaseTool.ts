import { BaseBoxShapeTool } from 'tldraw'
import { DATABASE_SHAPE_TYPE } from '../shapes/DatabaseShape'

export class DatabaseTool extends BaseBoxShapeTool {
	static override id = DATABASE_SHAPE_TYPE
	override shapeType = DATABASE_SHAPE_TYPE
}
