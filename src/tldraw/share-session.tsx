import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
	PeopleMenu,
	TldrawUiButton,
	TldrawUiPopover,
	TldrawUiPopoverContent,
	TldrawUiPopoverTrigger,
} from 'tldraw'
import { useProjectState } from './project-state'

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
	const {
		projects,
		activeProject,
		selectProject,
		createProject,
		renameProject,
		getSuggestedProjectName,
	} = useProjectState()
	const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false)
	const projectManagementDisabled = isCollaborating
	const projectManagementReason = 'Leave the shared session to switch or create projects.'

	const handleSelectProject = (projectId: string) => {
		if (projectManagementDisabled) return
		selectProject(projectId)
		setIsProjectMenuOpen(false)
	}

	const handleCreateProject = () => {
		if (projectManagementDisabled) return

		const nextName = window.prompt('New project name', getSuggestedProjectName())?.trim()
		if (!nextName) return

		createProject(nextName)
		setIsProjectMenuOpen(false)
	}

	const handleRenameProject = () => {
		if (projectManagementDisabled) return

		const nextName = window.prompt('Rename project', activeProject.name)?.trim()
		if (!nextName) return

		renameProject(activeProject.id, nextName)
		setIsProjectMenuOpen(false)
	}

	return (
		<div className="tlui-share-zone app-share-panel" draggable={false}>
			{isCollaborating && <PeopleMenu />}
			<TldrawUiPopover
				id="share-panel-projects"
				open={isProjectMenuOpen}
				onOpenChange={setIsProjectMenuOpen}
			>
				<TldrawUiPopoverTrigger>
					<TldrawUiButton
						type="normal"
						className="app-share-panel__button app-share-panel__button--project"
						title={
							projectManagementDisabled
								? projectManagementReason
								: 'Select, create, or rename projects.'
						}
					>
						{activeProject.name}
					</TldrawUiButton>
				</TldrawUiPopoverTrigger>
				<TldrawUiPopoverContent side="bottom" align="end">
					<div className="project-menu">
						<div className="project-menu__header">
							<h3 className="project-menu__title">Projects</h3>
							<p className="project-menu__subtitle">Each project keeps its own autosaved board.</p>
						</div>
						<div className="project-menu__list" role="list" aria-label="Projects">
							{projects.map((project) => (
								<button
									key={project.id}
									type="button"
									role="listitem"
									className="project-menu__item"
									data-active={project.id === activeProject.id}
									disabled={projectManagementDisabled}
									onClick={() => handleSelectProject(project.id)}
								>
									<span className="project-menu__item-name">{project.name}</span>
									<span className="project-menu__item-meta">
										{project.id === activeProject.id ? 'Current project' : 'Load project'}
									</span>
								</button>
							))}
						</div>
						{projectManagementDisabled && (
							<p className="project-menu__note">{projectManagementReason}</p>
						)}
						<div className="project-menu__actions">
							<button
								type="button"
								className="project-menu__action"
								disabled={projectManagementDisabled}
								onClick={handleCreateProject}
							>
								New project
							</button>
							<button
								type="button"
								className="project-menu__action"
								disabled={projectManagementDisabled}
								onClick={handleRenameProject}
							>
								Rename current
							</button>
						</div>
					</div>
				</TldrawUiPopoverContent>
			</TldrawUiPopover>
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
