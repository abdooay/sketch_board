import { Tldraw } from 'tldraw'
import 'tldraw/tldraw.css'
import './index.css'
import { CustomShapeLibraryProvider } from './tldraw/custom-shape-library'
import { uiOverrides } from './tldraw/overrides'
import { DatabaseShapeUtil } from './tldraw/shapes/DatabaseShape'
import { SvgSymbolShapeUtil } from './tldraw/shapes/SvgSymbolShape'
import { CustomStylePanel } from './tldraw/style-panel'
import { CustomToolbar } from './tldraw/toolbar'
import { DatabaseTool } from './tldraw/tools/DatabaseTool'
import { SvgSymbolTool } from './tldraw/tools/SvgSymbolTool'

const shapeUtils = [DatabaseShapeUtil, SvgSymbolShapeUtil]
const tools = [DatabaseTool, SvgSymbolTool]
// tldraw 3.x cannot read the persisted store produced by the 4.x branch.
// Keep this branch on its own storage namespace so older saved data doesn't
// crash the app during startup migration.
const persistenceKey = 'sketch-board-document-v3'
const components = {
	StylePanel: CustomStylePanel,
	Toolbar: CustomToolbar,
}

function App() {
	return (
		<div className="app-shell">
			<CustomShapeLibraryProvider>
				<Tldraw
					shapeUtils={shapeUtils}
					tools={tools}
					persistenceKey={persistenceKey}
					overrides={uiOverrides}
					components={components}
					onMount={(editor) => {
						editor.user.updateUserPreferences({ colorScheme: 'dark' })
					}}
				/>
			</CustomShapeLibraryProvider>
		</div>
	)
}

export default App
