/* eslint-disable react-refresh/only-export-components */

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from 'react'

export interface ProjectSummary {
	id: string
	name: string
	persistenceKey: string
	createdAt: string
}

interface ProjectStateContextValue {
	projects: ProjectSummary[]
	activeProject: ProjectSummary
	selectProject(id: string): void
	createProject(name: string): ProjectSummary | null
	renameProject(id: string, name: string): void
	getSuggestedProjectName(): string
}

interface StoredProjectState {
	projects: ProjectSummary[]
	activeProjectId: string
}

const LEGACY_DOCUMENT_PERSISTENCE_KEY = 'sketch-board-document-v3'
const PROJECTS_STORAGE_KEY = 'sketch-board-projects'
const ACTIVE_PROJECT_STORAGE_KEY = 'sketch-board-active-project-id'
const PROJECT_PERSISTENCE_KEY_PREFIX = 'sketch-board-document-project'
const DEFAULT_PROJECT_ID = 'default-project'
const DEFAULT_PROJECT_NAME = 'Default project'

const ProjectStateContext = createContext<ProjectStateContextValue | null>(null)

function createProjectId() {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID()
	}

	return Math.random().toString(36).slice(2, 10)
}

function createDefaultProject(): ProjectSummary {
	return {
		id: DEFAULT_PROJECT_ID,
		name: DEFAULT_PROJECT_NAME,
		persistenceKey: LEGACY_DOCUMENT_PERSISTENCE_KEY,
		createdAt: new Date().toISOString(),
	}
}

function createDefaultProjectState(): StoredProjectState {
	const project = createDefaultProject()
	return {
		projects: [project],
		activeProjectId: project.id,
	}
}

function isProjectSummary(value: unknown): value is ProjectSummary {
	if (typeof value !== 'object' || value === null) return false

	const candidate = value as Record<string, unknown>
	return (
		typeof candidate.id === 'string' &&
		candidate.id.trim().length > 0 &&
		typeof candidate.name === 'string' &&
		candidate.name.trim().length > 0 &&
		typeof candidate.persistenceKey === 'string' &&
		candidate.persistenceKey.trim().length > 0 &&
		typeof candidate.createdAt === 'string' &&
		candidate.createdAt.trim().length > 0
	)
}

function normalizeStoredProjectState(): StoredProjectState {
	if (typeof window === 'undefined') {
		return createDefaultProjectState()
	}

	try {
		const rawProjects = window.localStorage.getItem(PROJECTS_STORAGE_KEY)
		if (!rawProjects) {
			return createDefaultProjectState()
		}

		const parsedProjects = JSON.parse(rawProjects) as unknown
		if (!Array.isArray(parsedProjects) || parsedProjects.length === 0) {
			return createDefaultProjectState()
		}

		if (!parsedProjects.every(isProjectSummary)) {
			return createDefaultProjectState()
		}

		const projects = parsedProjects.map((project) => ({
			id: project.id.trim(),
			name: project.name.trim(),
			persistenceKey: project.persistenceKey.trim(),
			createdAt: project.createdAt.trim(),
		}))
		const uniqueIds = new Set(projects.map((project) => project.id))
		if (uniqueIds.size !== projects.length) {
			return createDefaultProjectState()
		}

		const storedActiveProjectId = window.localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY)?.trim()
		const activeProjectId =
			storedActiveProjectId && uniqueIds.has(storedActiveProjectId)
				? storedActiveProjectId
				: projects[0].id

		return { projects, activeProjectId }
	} catch {
		return createDefaultProjectState()
	}
}

export function ProjectStateProvider({ children }: { children: ReactNode }) {
	const [state, setState] = useState<StoredProjectState>(() => normalizeStoredProjectState())

	useEffect(() => {
		window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(state.projects))
		window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, state.activeProjectId)
	}, [state])

	const activeProject = useMemo(
		() =>
			state.projects.find((project) => project.id === state.activeProjectId) ??
			state.projects[0] ??
			createDefaultProject(),
		[state]
	)

	const selectProject = useCallback((id: string) => {
		setState((current) => {
			if (!current.projects.some((project) => project.id === id)) {
				return current
			}

			if (current.activeProjectId === id) {
				return current
			}

			return {
				...current,
				activeProjectId: id,
			}
		})
	}, [])

	const createProject = useCallback((name: string) => {
		const trimmedName = name.trim()
		if (!trimmedName) return null

		const id = createProjectId()
		const project: ProjectSummary = {
			id,
			name: trimmedName,
			persistenceKey: `${PROJECT_PERSISTENCE_KEY_PREFIX}:${id}`,
			createdAt: new Date().toISOString(),
		}

		setState((current) => ({
			projects: [...current.projects, project],
			activeProjectId: project.id,
		}))

		return project
	}, [])

	const renameProject = useCallback((id: string, name: string) => {
		const trimmedName = name.trim()
		if (!trimmedName) return

		setState((current) => ({
			...current,
			projects: current.projects.map((project) =>
				project.id === id ? { ...project, name: trimmedName } : project
			),
		}))
	}, [])

	const getSuggestedProjectName = useCallback(() => {
		const usedNames = new Set(state.projects.map((project) => project.name.trim().toLowerCase()))
		let index = 1

		while (usedNames.has(`project ${index}`)) {
			index += 1
		}

		return `Project ${index}`
	}, [state.projects])

	const value = useMemo<ProjectStateContextValue>(
		() => ({
			projects: state.projects,
			activeProject,
			selectProject,
			createProject,
			renameProject,
			getSuggestedProjectName,
		}),
		[activeProject, state.projects, selectProject, createProject, renameProject, getSuggestedProjectName]
	)

	return <ProjectStateContext.Provider value={value}>{children}</ProjectStateContext.Provider>
}

export function useProjectState() {
	const context = useContext(ProjectStateContext)
	if (!context) {
		throw new Error('useProjectState must be used within a ProjectStateProvider')
	}
	return context
}
