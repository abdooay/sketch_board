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
import { CustomShapeLibraryProvider } from './tldraw/custom-shape-library'
import { shapeUtils, tools } from './tldraw/config'
import { uiOverrides } from './tldraw/overrides'
import { CollaborationProvider, CollaborationSharePanel } from './tldraw/share-session'
import { CustomStylePanel } from './tldraw/style-panel'
import { CustomToolbar } from './tldraw/toolbar'
// tldraw 3.x cannot read the persisted store produced by the 4.x branch.
// Keep this branch on its own storage namespace so older saved data doesn't
// crash the app during startup migration.
const persistenceKey = 'sketch-board-document-v3'
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
		await navigator.clipboard.writeText(text)
		return
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

function LocalCanvas({ onMount }: { onMount: (editor: Editor) => void }) {
	return (
		<Tldraw
			key="local"
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
		shapeUtils,
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

function App() {
	const editorRef = useRef<Editor | null>(null)
	const canUseSyncServer = Boolean(getSyncServerBaseUrl())
	const [roomId, setRoomId] = useState<string | null>(() =>
		canUseSyncServer ? getRoomIdFromUrl() : null
	)

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

	const handleEditorMount = useCallback(
		(editor: Editor) => {
			editorRef.current = editor
			editor.user.updateUserPreferences({ colorScheme: 'dark' })

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
		[roomId]
	)

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
			>
				<CustomShapeLibraryProvider>
					{roomId ? (
						<CollaborativeCanvas roomId={roomId} onMount={handleEditorMount} />
					) : (
						<LocalCanvas onMount={handleEditorMount} />
					)}
				</CustomShapeLibraryProvider>
			</CollaborationProvider>
		</div>
	)
}

export default App
