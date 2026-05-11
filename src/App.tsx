import { useCallback, useEffect, useRef, useState } from 'react'
import {
	getSnapshot,
	inlineBase64AssetStore,
	Tldraw,
	type Editor,
	type TLEditorSnapshot,
} from 'tldraw'
import { useSync } from '@tldraw/sync'
import 'tldraw/tldraw.css'
import './index.css'
import { createCanvasAutomationClient, type CanvasAutomationClient } from './tldraw/automation/client'
import {
	CustomShapeLibraryProvider,
	useCustomShapeLibrary,
} from './tldraw/custom-shape-library'
import {
	createBrowserCloudDocument,
	fetchCloudDocument,
	fetchCloudSession,
	hasCloudSnapshotForProject,
	mergeCloudDocumentWithBrowserData,
	saveCloudDocument,
	signOutCloud,
	startGoogleCloudSignIn,
	updateCloudDocumentFromBrowserState,
	type CloudSaveStatus,
	type CloudUser,
	type SketchBoardCloudDocument,
} from './tldraw/cloud-storage'
import { shapeUtils, syncBindingUtils, syncShapeUtils, tools } from './tldraw/config'
import { uiOverrides } from './tldraw/overrides'
import { ProjectStateProvider, useProjectState } from './tldraw/project-state'
import { CollaborationProvider, CollaborationSharePanel } from './tldraw/share-session'
import { CustomStylePanel } from './tldraw/style-panel'
import { CustomToolbar } from './tldraw/toolbar'

const ROOM_PARAM = 'room'
const ROOM_PREFIX = 'sketch-board'
const ROOM_SNAPSHOT_PREFIX = 'sketch-board-room-seed'
const DEFAULT_SYNC_SERVER_URL = 'http://localhost:8787'

const components = {
	StylePanel: CustomStylePanel,
	Toolbar: CustomToolbar,
	SharePanel: CollaborationSharePanel,
}

function getRoomSnapshotKey(roomId: string) {
	return `${ROOM_SNAPSHOT_PREFIX}:${roomId}`
}

function getRoomIdFromUrl() {
	if (typeof window === 'undefined') return null
	const params = new URLSearchParams(window.location.search)
	const roomId = params.get(ROOM_PARAM)?.trim()
	return roomId || null
}

function generateRoomId() {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return `${ROOM_PREFIX}-${crypto.randomUUID()}`
	}

	return `${ROOM_PREFIX}-${Math.random().toString(36).slice(2, 10)}`
}

function updateRoomUrl(roomId: string | null) {
	if (typeof window === 'undefined') return

	const url = new URL(window.location.href)
	if (roomId) {
		url.searchParams.set(ROOM_PARAM, roomId)
	} else {
		url.searchParams.delete(ROOM_PARAM)
	}

	window.history.pushState({}, '', url)
}

async function copyText(text: string) {
	if (navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text)
			return
		} catch {
			// Browser clipboard permissions vary, especially in embedded previews.
		}
	}

	window.prompt('Copy this collaboration link', text)
}

function getShareUrl(roomId: string) {
	if (typeof window === 'undefined') return ''
	const url = new URL(window.location.href)
	url.searchParams.set(ROOM_PARAM, roomId)
	return url.toString()
}

function getSyncServerBaseUrl() {
	const configured = import.meta.env.VITE_TLDRAW_SYNC_URL?.trim()
	if (configured) return configured.replace(/\/$/, '')
	if (import.meta.env.DEV) return DEFAULT_SYNC_SERVER_URL
	return null
}

function getSyncServerUri(roomId: string) {
	const baseUrl = getSyncServerBaseUrl()
	if (!baseUrl) {
		throw new Error('VITE_TLDRAW_SYNC_URL is required before collaboration can start.')
	}

	return `${baseUrl}/connect/${encodeURIComponent(roomId)}`
}

function getStoredRoomSnapshot(roomId: string): TLEditorSnapshot | null {
	if (typeof window === 'undefined') return null
	const raw = window.sessionStorage.getItem(getRoomSnapshotKey(roomId))
	if (!raw) return null

	try {
		return JSON.parse(raw) as TLEditorSnapshot
	} catch {
		window.sessionStorage.removeItem(getRoomSnapshotKey(roomId))
		return null
	}
}

function clearStoredRoomSnapshot(roomId: string) {
	if (typeof window === 'undefined') return
	window.sessionStorage.removeItem(getRoomSnapshotKey(roomId))
}

function storeRoomSnapshot(roomId: string, snapshot: TLEditorSnapshot) {
	if (typeof window === 'undefined') return
	window.sessionStorage.setItem(getRoomSnapshotKey(roomId), JSON.stringify(snapshot))
}

function isBlankRoom(editor: Editor) {
	return editor.getPages().length === 1 && editor.getCurrentPageShapeIds().size === 0
}

function LocalCanvas({
	projectId,
	persistenceKey,
	onMount,
}: {
	projectId: string
	persistenceKey: string
	onMount: (editor: Editor) => void
}) {
	return (
		<Tldraw
			key={`project:${projectId}`}
			shapeUtils={shapeUtils}
			tools={tools}
			persistenceKey={persistenceKey}
			overrides={uiOverrides}
			components={components}
			onMount={onMount}
		/>
	)
}

function CollaborativeCanvas({
	roomId,
	onMount,
}: {
	roomId: string
	onMount: (editor: Editor) => void
}) {
	const store = useSync({
		uri: getSyncServerUri(roomId),
		assets: inlineBase64AssetStore,
		shapeUtils: syncShapeUtils,
		bindingUtils: syncBindingUtils,
	})

	return (
		<Tldraw
			key={`room:${roomId}`}
			store={store}
			shapeUtils={shapeUtils}
			tools={tools}
			overrides={uiOverrides}
			components={components}
			onMount={onMount}
		/>
	)
}

function SketchBoardApp() {
	const {
		projects,
		activeProject,
		replaceProjectState,
	} = useProjectState()
	const customShapeLibrary = useCustomShapeLibrary()
	const { replaceLibraryState } = customShapeLibrary
	const editorRef = useRef<Editor | null>(null)
	const automationRef = useRef<CanvasAutomationClient | null>(null)
	const cloudSaveTimeoutRef = useRef<number | null>(null)
	const cloudSaveListenerRef = useRef<(() => void) | null>(null)
	const cloudDocumentRef = useRef<SketchBoardCloudDocument | null>(null)
	const cloudUserRef = useRef<CloudUser | null>(null)
	const isApplyingCloudSnapshotRef = useRef(false)
	const isHydratingCloudRef = useRef(false)
	const projectsRef = useRef(projects)
	const activeProjectRef = useRef(activeProject)
	const customShapeLibraryRef = useRef(customShapeLibrary)
	const canUseSyncServer = Boolean(getSyncServerBaseUrl())
	const [roomId, setRoomId] = useState<string | null>(() =>
		canUseSyncServer ? getRoomIdFromUrl() : null
	)
	const [cloudUser, setCloudUser] = useState<CloudUser | null>(null)
	const [cloudStatus, setCloudStatus] = useState<CloudSaveStatus>('connecting')
	const [cloudDetail, setCloudDetail] = useState('Checking Google sign-in.')

	useEffect(() => {
		projectsRef.current = projects
		activeProjectRef.current = activeProject
		customShapeLibraryRef.current = customShapeLibrary
	}, [projects, activeProject, customShapeLibrary])

	useEffect(() => {
		cloudUserRef.current = cloudUser
	}, [cloudUser])

	useEffect(() => {
		const onPopState = () => {
			setRoomId(canUseSyncServer ? getRoomIdFromUrl() : null)
		}

		window.addEventListener('popstate', onPopState)
		return () => {
			window.removeEventListener('popstate', onPopState)
		}
	}, [canUseSyncServer])

	useEffect(() => {
		if (!canUseSyncServer && getRoomIdFromUrl()) {
			const url = new URL(window.location.href)
			url.searchParams.delete(ROOM_PARAM)
			window.history.replaceState({}, '', url)
		}
	}, [canUseSyncServer])

	const saveCloudNow = useCallback(async () => {
		const user = cloudUserRef.current
		const editor = editorRef.current
		if (!user || !editor || roomId || isHydratingCloudRef.current) return

		setCloudStatus('saving')
		setCloudDetail('Saving board to cloud.')

		try {
			const nextDocument = updateCloudDocumentFromBrowserState(cloudDocumentRef.current, {
				projects: projectsRef.current,
				activeProjectId: activeProjectRef.current.id,
				activeSnapshot: getSnapshot(editor.store),
				customShapeLibrary: {
					items: customShapeLibraryRef.current.items,
					activeItemId: customShapeLibraryRef.current.activeItemId,
				},
			})
			await saveCloudDocument(nextDocument)
			cloudDocumentRef.current = nextDocument
			setCloudStatus('saved')
			setCloudDetail(`Cloud saved to ${user.email} at ${new Date().toLocaleTimeString()}.`)
		} catch (error) {
			setCloudStatus('error')
			setCloudDetail(error instanceof Error ? error.message : 'Could not save to cloud.')
		}
	}, [roomId])

	const scheduleCloudSave = useCallback(() => {
		if (!cloudUserRef.current || roomId || isHydratingCloudRef.current) return

		if (cloudSaveTimeoutRef.current !== null) {
			window.clearTimeout(cloudSaveTimeoutRef.current)
		}

		setCloudStatus('saving')
		setCloudDetail('Saving board to cloud.')
		cloudSaveTimeoutRef.current = window.setTimeout(() => {
			cloudSaveTimeoutRef.current = null
			void saveCloudNow()
		}, 1800)
	}, [roomId, saveCloudNow])

	const applyCloudSnapshotToEditor = useCallback((editor: Editor, projectId: string) => {
		const cloudDocument = cloudDocumentRef.current
		const snapshot = cloudDocument?.projectSnapshots[projectId]
		if (!snapshot) return

		window.requestAnimationFrame(() => {
			isApplyingCloudSnapshotRef.current = true
			try {
				editor.loadSnapshot(snapshot)
			} finally {
				window.setTimeout(() => {
					isApplyingCloudSnapshotRef.current = false
				}, 0)
			}
		})
	}, [])

	const handleEditorMount = useCallback(
		(editor: Editor) => {
			automationRef.current?.dispose()
			cloudSaveListenerRef.current?.()
			editorRef.current = editor
			editor.user.updateUserPreferences({ colorScheme: 'dark' })
			automationRef.current = createCanvasAutomationClient(editor, () => ({
				roomId,
				isCollaborating: Boolean(roomId),
				pageUrl: window.location.href,
				projectId: activeProject.id,
				projectName: activeProject.name,
			}))

			if (!roomId && hasCloudSnapshotForProject(cloudDocumentRef.current, activeProject.id)) {
				applyCloudSnapshotToEditor(editor, activeProject.id)
			}

			cloudSaveListenerRef.current = editor.store.listen(
				() => {
					if (isApplyingCloudSnapshotRef.current) return
					scheduleCloudSave()
				},
				{ source: 'user', scope: 'document' }
			)

			if (!roomId) return

			const snapshot = getStoredRoomSnapshot(roomId)
			if (!snapshot) return

			window.requestAnimationFrame(() => {
				if (isBlankRoom(editor)) {
					editor.loadSnapshot(snapshot)
				}

				clearStoredRoomSnapshot(roomId)
			})
		},
		[activeProject.id, activeProject.name, roomId, applyCloudSnapshotToEditor, scheduleCloudSave]
	)

	useEffect(() => {
		return () => {
			automationRef.current?.dispose()
			cloudSaveListenerRef.current?.()
			if (cloudSaveTimeoutRef.current !== null) {
				window.clearTimeout(cloudSaveTimeoutRef.current)
			}
		}
	}, [])

	useEffect(() => {
		let didCancel = false

		const loadCloudSession = async () => {
			try {
				const user = await fetchCloudSession()
				if (didCancel) return
				setCloudUser(user)
				if (!user) {
					cloudDocumentRef.current = null
					setCloudStatus('local')
					setCloudDetail('Browser-only autosave is active. Sign in with Google to enable cloud save.')
				}
			} catch (error) {
				if (didCancel) return
				setCloudStatus('error')
				setCloudDetail(error instanceof Error ? error.message : 'Could not load cloud session.')
			}
		}

		void loadCloudSession()

		return () => {
			didCancel = true
		}
	}, [])

	useEffect(() => {
		if (!cloudUser) {
			cloudDocumentRef.current = null
			return
		}

		let didCancel = false
		isHydratingCloudRef.current = true
		setCloudStatus('connecting')
		setCloudDetail('Loading cloud save.')

		const hydrateCloudDocument = async () => {
			try {
				const activeSnapshot = editorRef.current ? getSnapshot(editorRef.current.store) : null
				const browserDocument = await createBrowserCloudDocument({
					projects: projectsRef.current,
					activeProjectId: activeProjectRef.current.id,
					activeSnapshot,
					customShapeLibrary: {
						items: customShapeLibraryRef.current.items,
						activeItemId: customShapeLibraryRef.current.activeItemId,
					},
				})
				const remoteDocument = await fetchCloudDocument()
				const { document, didChange } = remoteDocument
					? mergeCloudDocumentWithBrowserData(remoteDocument, browserDocument)
					: { document: browserDocument, didChange: true }

				if (didChange) {
					await saveCloudDocument(document)
				}

				if (didCancel) return

				cloudDocumentRef.current = document
				replaceProjectState(document.projects, document.activeProjectId)
				replaceLibraryState(document.customShapeLibrary)
				const editor = editorRef.current
				if (editor && document.activeProjectId === activeProjectRef.current.id) {
					applyCloudSnapshotToEditor(editor, document.activeProjectId)
				}
				setCloudStatus('saved')
				setCloudDetail(
					remoteDocument
						? `Cloud save is active for ${cloudUser.email}.`
						: `Browser data copied to ${cloudUser.email}.`
				)
			} catch (error) {
				if (didCancel) return
				setCloudStatus('error')
				setCloudDetail(error instanceof Error ? error.message : 'Could not load cloud save.')
			} finally {
				if (!didCancel) {
					isHydratingCloudRef.current = false
				}
			}
		}

		void hydrateCloudDocument()

		return () => {
			didCancel = true
			isHydratingCloudRef.current = false
		}
	}, [
		cloudUser,
		replaceProjectState,
		replaceLibraryState,
		applyCloudSnapshotToEditor,
	])

	useEffect(() => {
		if (!cloudUser || isHydratingCloudRef.current) return
		scheduleCloudSave()
	}, [
		cloudUser,
		projects,
		activeProject.id,
		customShapeLibrary.items,
		customShapeLibrary.activeItemId,
		scheduleCloudSave,
	])

	const connectCloud = useCallback(() => {
		startGoogleCloudSignIn()
	}, [])

	const disconnectCloud = useCallback(() => {
		if (cloudSaveTimeoutRef.current !== null) {
			window.clearTimeout(cloudSaveTimeoutRef.current)
			cloudSaveTimeoutRef.current = null
		}
		void signOutCloud().finally(() => {
			setCloudUser(null)
			cloudDocumentRef.current = null
			setCloudStatus('local')
			setCloudDetail('Browser-only autosave is active. Sign in with Google to enable cloud save.')
		})
	}, [])

	const startSharing = useCallback(() => {
		if (!canUseSyncServer) {
			window.alert(
				'Collaboration needs a tldraw sync server. Set VITE_TLDRAW_SYNC_URL in Vercel to enable Share session.'
			)
			return
		}

		const nextRoomId = generateRoomId()
		const editor = editorRef.current

		if (editor) {
			storeRoomSnapshot(nextRoomId, getSnapshot(editor.store))
		}

		updateRoomUrl(nextRoomId)
		setRoomId(nextRoomId)
		void copyText(getShareUrl(nextRoomId))
	}, [canUseSyncServer])

	const copyShareLink = useCallback(async () => {
		if (!roomId) return false
		await copyText(getShareUrl(roomId))
		return true
	}, [roomId])

	const leaveSession = useCallback(() => {
		updateRoomUrl(null)
		setRoomId(null)
	}, [])

	return (
		<div className="app-shell">
			<CollaborationProvider
				key={roomId ?? 'local'}
				roomId={roomId}
				startSharing={startSharing}
				copyShareLink={copyShareLink}
				leaveSession={leaveSession}
				canShare={canUseSyncServer}
				cloudStatus={cloudStatus}
				cloudDetail={cloudDetail}
				isCloudEnabled={Boolean(cloudUser)}
				connectCloud={connectCloud}
				disconnectCloud={disconnectCloud}
			>
				{roomId ? (
					<CollaborativeCanvas roomId={roomId} onMount={handleEditorMount} />
				) : (
					<LocalCanvas
						projectId={activeProject.id}
						persistenceKey={activeProject.persistenceKey}
						onMount={handleEditorMount}
					/>
				)}
			</CollaborationProvider>
		</div>
	)
}

function App() {
	return (
		<ProjectStateProvider>
			<CustomShapeLibraryProvider>
				<SketchBoardApp />
			</CustomShapeLibraryProvider>
		</ProjectStateProvider>
	)
}

export default App
