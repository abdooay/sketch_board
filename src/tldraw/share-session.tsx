import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { PeopleMenu, TldrawUiButton } from 'tldraw'

type CollaborationContextValue = {
	roomId: string | null
	isCollaborating: boolean
	canShare: boolean
	startSharing: () => void
	copyShareLink: () => Promise<void>
	leaveSession: () => void
	shareLabel: string
}

const CollaborationContext = createContext<CollaborationContextValue | null>(null)

function useCollaborationContext() {
	const value = useContext(CollaborationContext)
	if (!value) {
		throw new Error('useCollaborationContext must be used within a CollaborationProvider')
	}
	return value
}

export function CollaborationProvider({
	roomId,
	startSharing,
	copyShareLink,
	leaveSession,
	canShare,
	children,
}: {
	roomId: string | null
	startSharing: () => void
	copyShareLink: () => Promise<boolean>
	leaveSession: () => void
	canShare: boolean
	children: ReactNode
}) {
	const [didCopy, setDidCopy] = useState(false)
	const resetTimeoutRef = useRef<number | null>(null)
	const shareLabel = didCopy
		? 'Copied'
		: roomId
			? 'Copy link'
			: canShare
				? 'Share session'
				: 'Configure sync'

	const handleCopy = useCallback(async () => {
		const copied = await copyShareLink()
		if (!copied) return

		setDidCopy(true)
		if (resetTimeoutRef.current !== null) {
			window.clearTimeout(resetTimeoutRef.current)
		}
		resetTimeoutRef.current = window.setTimeout(() => {
			setDidCopy(false)
		}, 1800)
	}, [copyShareLink])

	useEffect(() => {
		return () => {
			if (resetTimeoutRef.current !== null) {
				window.clearTimeout(resetTimeoutRef.current)
			}
		}
	}, [])

	const value = useMemo<CollaborationContextValue>(
		() => ({
			roomId,
			isCollaborating: Boolean(roomId),
			canShare,
			startSharing,
			copyShareLink: handleCopy,
			leaveSession,
			shareLabel,
		}),
		[roomId, canShare, startSharing, handleCopy, leaveSession, shareLabel]
	)

	return <CollaborationContext.Provider value={value}>{children}</CollaborationContext.Provider>
}

export function CollaborationSharePanel() {
	const { isCollaborating, canShare, startSharing, copyShareLink, leaveSession, shareLabel } =
		useCollaborationContext()

	return (
		<div className="tlui-share-zone app-share-panel" draggable={false}>
			{isCollaborating && <PeopleMenu />}
			<TldrawUiButton
				type={isCollaborating ? 'normal' : 'primary'}
				className="app-share-panel__button"
				title={
					canShare
						? undefined
						: 'Set VITE_TLDRAW_SYNC_URL in Vercel to enable collaboration.'
				}
				onClick={() => {
					if (isCollaborating) {
						void copyShareLink()
					} else {
						startSharing()
					}
				}}
			>
				{shareLabel}
			</TldrawUiButton>
			{isCollaborating && (
				<TldrawUiButton
					type="low"
					className="app-share-panel__button"
					onClick={leaveSession}
				>
					Leave
				</TldrawUiButton>
			)}
		</div>
	)
}
