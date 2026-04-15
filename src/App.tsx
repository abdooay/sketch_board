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
const persistenceKey = 'sketch-board-document'
const licenseKey = import.meta.env.VITE_TLDRAW_LICENSE_KEY?.trim()
const components = {
	StylePanel: CustomStylePanel,
	Toolbar: CustomToolbar,
}

function isProductionLicenseEnvironment() {
	if (typeof window === 'undefined') return false
	if (!import.meta.env.PROD) return false

	const hostname = window.location.hostname
	const isLocalHost =
		hostname === 'localhost' ||
		hostname === '127.0.0.1' ||
		hostname === '0.0.0.0' ||
		hostname.endsWith('.local')

	return window.location.protocol === 'https:' && !isLocalHost
}

function MissingLicenseScreen() {
	return (
		<div className="license-screen">
			<div className="license-screen__card">
				<h1 className="license-screen__title">Missing tldraw license key</h1>
				<p className="license-screen__body">
					This deployment is running on a production host, and the tldraw SDK requires a valid
					license key in production.
				</p>
				<p className="license-screen__body">
					Set <code>VITE_TLDRAW_LICENSE_KEY</code> in Vercel, then redeploy the app.
				</p>
				<div className="license-screen__links">
					<a
						href="https://tldraw.dev/sdk-features/license-key"
						target="_blank"
						rel="noreferrer"
					>
						tldraw license key docs
					</a>
					<a
						href="https://tldraw.dev/community/license"
						target="_blank"
						rel="noreferrer"
					>
						tldraw license overview
					</a>
				</div>
			</div>
		</div>
	)
}

function App() {
	if (isProductionLicenseEnvironment() && !licenseKey) {
		return <MissingLicenseScreen />
	}

	return (
		<div className="app-shell">
			<CustomShapeLibraryProvider>
				<Tldraw
					licenseKey={licenseKey}
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
