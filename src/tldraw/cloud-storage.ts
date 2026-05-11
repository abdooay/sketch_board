import type { TLEditorSnapshot } from 'tldraw'
import type { ProjectSummary } from './project-state'
import type { CustomShapeLibraryItem } from './custom-shape-registry'

const CLOUD_DOCUMENT_VERSION = 1
const TLDRAW_INDEXED_DB_PREFIX = 'TLDRAW_DOCUMENT_v2'
const TLDRAW_DB_NAME_INDEX_KEY = 'TLDRAW_DB_NAME_INDEX_v2'

export type CloudSaveStatus = 'local' | 'connecting' | 'saving' | 'saved' | 'error'

export interface CloudUser {
	email: string
	name: string
	picture?: string
}

export interface StoredCustomShapeLibraryState {
	items: CustomShapeLibraryItem[]
	activeItemId: string | null
}

export interface SketchBoardCloudDocument {
	version: typeof CLOUD_DOCUMENT_VERSION
	updatedAt: string
	activeProjectId: string
	projects: ProjectSummary[]
	projectSnapshots: Record<string, Partial<TLEditorSnapshot>>
	customShapeLibrary: StoredCustomShapeLibraryState
}

export interface BrowserCloudDocumentInput {
	projects: ProjectSummary[]
	activeProjectId: string
	activeSnapshot: TLEditorSnapshot | null
	customShapeLibrary: StoredCustomShapeLibraryState
}

export async function fetchCloudSession() {
	const response = await fetch('/api/auth/session', {
		method: 'GET',
		headers: { Accept: 'application/json' },
	})

	if (!response.ok) {
		throw new Error(await getCloudErrorMessage(response, 'Could not load cloud session.'))
	}

	if (!response.headers.get('Content-Type')?.includes('application/json')) {
		return null
	}

	const payload = (await response.json()) as { user?: unknown }
	return normalizeCloudUser(payload.user)
}

export function startGoogleCloudSignIn() {
	window.location.href = '/api/auth/google'
}

export async function signOutCloud() {
	const response = await fetch('/api/auth/logout', {
		method: 'POST',
		headers: { Accept: 'application/json' },
	})

	if (!response.ok) {
		throw new Error(await getCloudErrorMessage(response, 'Could not sign out.'))
	}
}

export async function fetchCloudDocument() {
	const response = await fetch('/api/cloud-document', {
		method: 'GET',
		headers: { Accept: 'application/json' },
	})

	if (!response.ok) {
		throw new Error(await getCloudErrorMessage(response, 'Could not load cloud save.'))
	}

	const payload = (await response.json()) as { document?: unknown }
	return normalizeCloudDocument(payload.document)
}

export async function saveCloudDocument(document: SketchBoardCloudDocument) {
	const response = await fetch('/api/cloud-document', {
		method: 'PUT',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ document }),
	})

	if (!response.ok) {
		throw new Error(await getCloudErrorMessage(response, 'Could not save to cloud.'))
	}
}

function normalizeCloudUser(value: unknown): CloudUser | null {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return null

	const candidate = value as Partial<CloudUser>
	if (typeof candidate.email !== 'string' || typeof candidate.name !== 'string') return null

	return {
		email: candidate.email,
		name: candidate.name,
		...(typeof candidate.picture === 'string' ? { picture: candidate.picture } : {}),
	}
}

async function getCloudErrorMessage(response: Response, fallback: string) {
	try {
		const payload = (await response.json()) as { error?: unknown }
		return typeof payload.error === 'string' ? payload.error : fallback
	} catch {
		return fallback
	}
}

export async function createBrowserCloudDocument({
	projects,
	activeProjectId,
	activeSnapshot,
	customShapeLibrary,
}: BrowserCloudDocumentInput): Promise<SketchBoardCloudDocument> {
	const projectSnapshots: Record<string, Partial<TLEditorSnapshot>> = {}

	for (const project of projects) {
		const snapshot =
			project.id === activeProjectId && activeSnapshot
				? activeSnapshot
				: await readSnapshotFromIndexedDb(project.persistenceKey)
		if (snapshot) {
			projectSnapshots[project.id] = snapshot
		}
	}

	return {
		version: CLOUD_DOCUMENT_VERSION,
		updatedAt: new Date().toISOString(),
		activeProjectId,
		projects,
		projectSnapshots,
		customShapeLibrary,
	}
}

export function updateCloudDocumentFromBrowserState(
	baseDocument: SketchBoardCloudDocument | null,
	input: BrowserCloudDocumentInput
): SketchBoardCloudDocument {
	const projectSnapshots = {
		...(baseDocument?.projectSnapshots ?? {}),
	}

	if (input.activeSnapshot) {
		projectSnapshots[input.activeProjectId] = input.activeSnapshot
	}

	return {
		version: CLOUD_DOCUMENT_VERSION,
		updatedAt: new Date().toISOString(),
		activeProjectId: input.activeProjectId,
		projects: input.projects,
		projectSnapshots,
		customShapeLibrary: input.customShapeLibrary,
	}
}

export function mergeCloudDocumentWithBrowserData(
	cloudDocument: SketchBoardCloudDocument,
	browserDocument: SketchBoardCloudDocument
) {
	let didChange = false
	const nextProjects = [...cloudDocument.projects]
	const nextProjectSnapshots = { ...cloudDocument.projectSnapshots }
	const cloudProjectIds = new Set(nextProjects.map((project) => project.id))
	const now = new Date().toISOString()

	for (const browserProject of browserDocument.projects) {
		const browserSnapshot = browserDocument.projectSnapshots[browserProject.id]

		if (!cloudProjectIds.has(browserProject.id)) {
			nextProjects.push(browserProject)
			if (browserSnapshot) {
				nextProjectSnapshots[browserProject.id] = browserSnapshot
			}
			cloudProjectIds.add(browserProject.id)
			didChange = true
			continue
		}

		const cloudSnapshot = nextProjectSnapshots[browserProject.id]
		if (
			browserSnapshot &&
			hasDrawingRecords(browserSnapshot) &&
			cloudSnapshot &&
			!areSnapshotsEquivalent(browserSnapshot, cloudSnapshot)
		) {
			const copyId = createBrowserCopyProjectId(browserProject.id)
			nextProjects.push({
				...browserProject,
				id: copyId,
				name: `${browserProject.name} (browser copy)`,
				persistenceKey: `${browserProject.persistenceKey}:browser-copy:${copyId}`,
				createdAt: now,
			})
			nextProjectSnapshots[copyId] = browserSnapshot
			didChange = true
		}
	}

	const customShapeLibrary = mergeCustomShapeLibraries(
		cloudDocument.customShapeLibrary,
		browserDocument.customShapeLibrary
	)

	if (customShapeLibrary !== cloudDocument.customShapeLibrary) {
		didChange = true
	}

	return {
		document: {
			...cloudDocument,
			updatedAt: didChange ? now : cloudDocument.updatedAt,
			projects: nextProjects,
			projectSnapshots: nextProjectSnapshots,
			customShapeLibrary,
		},
		didChange,
	}
}

export function normalizeCloudDocument(value: unknown): SketchBoardCloudDocument | null {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return null

	const candidate = value as Partial<SketchBoardCloudDocument>
	if (
		candidate.version !== CLOUD_DOCUMENT_VERSION ||
		typeof candidate.updatedAt !== 'string' ||
		typeof candidate.activeProjectId !== 'string' ||
		!Array.isArray(candidate.projects) ||
		typeof candidate.projectSnapshots !== 'object' ||
		candidate.projectSnapshots === null ||
		!candidate.customShapeLibrary ||
		!Array.isArray(candidate.customShapeLibrary.items)
	) {
		return null
	}

	return candidate as SketchBoardCloudDocument
}

export function hasCloudSnapshotForProject(
	document: SketchBoardCloudDocument | null,
	projectId: string
) {
	return Boolean(document?.projectSnapshots[projectId])
}

function createBrowserCopyProjectId(projectId: string) {
	const suffix =
		typeof crypto.randomUUID === 'function'
			? crypto.randomUUID()
			: Math.random().toString(36).slice(2, 10)
	return `${projectId}-browser-copy-${suffix}`
}

function mergeCustomShapeLibraries(
	cloudLibrary: StoredCustomShapeLibraryState,
	browserLibrary: StoredCustomShapeLibraryState
) {
	const nextItems = [...cloudLibrary.items]
	let didChange = false

	for (const browserItem of browserLibrary.items) {
		if (!nextItems.some((cloudItem) => cloudItem.id === browserItem.id)) {
			nextItems.push(browserItem)
			didChange = true
		}
	}

	if (!didChange) return cloudLibrary

	return {
		items: nextItems,
		activeItemId: cloudLibrary.activeItemId ?? browserLibrary.activeItemId,
	}
}

function areSnapshotsEquivalent(
	a: Partial<TLEditorSnapshot>,
	b: Partial<TLEditorSnapshot>
) {
	return JSON.stringify(a.document?.store ?? null) === JSON.stringify(b.document?.store ?? null)
}

function hasDrawingRecords(snapshot: Partial<TLEditorSnapshot>) {
	const records = snapshot.document?.store
	if (!records) return false
	return Object.values(records).some((record) => {
		if (typeof record !== 'object' || record === null) return false
		return (record as { typeName?: unknown }).typeName === 'shape'
	})
}

async function readSnapshotFromIndexedDb(
	persistenceKey: string
): Promise<Partial<TLEditorSnapshot> | null> {
	if (typeof window === 'undefined' || !window.indexedDB) return null

	const dbName = `${TLDRAW_INDEXED_DB_PREFIX}${persistenceKey}`
	if (!(await doesIndexedDbExist(dbName))) return null

	const db = await openIndexedDb(dbName)
	try {
		if (
			!db.objectStoreNames.contains('records') ||
			!db.objectStoreNames.contains('schema') ||
			!db.objectStoreNames.contains('session_state')
		) {
			return null
		}

		const transaction = db.transaction(['records', 'schema', 'session_state'], 'readonly')
		const recordsStore = transaction.objectStore('records')
		const schemaStore = transaction.objectStore('schema')
		const sessionStateStore = transaction.objectStore('session_state')

		const records = await requestToPromise<unknown[]>(recordsStore.getAll())
		const schema = await requestToPromise<unknown>(schemaStore.get('schema'))
		const sessionRows = await requestToPromise<Array<{ snapshot?: unknown; updatedAt?: number }>>(
			sessionStateStore.getAll()
		)
		await transactionToPromise(transaction)

		if (records.length === 0 || typeof schema !== 'object' || schema === null) return null

		const store = Object.fromEntries(
			records
				.filter((record): record is { id: string } => {
					return (
						typeof record === 'object' &&
						record !== null &&
						typeof (record as { id?: unknown }).id === 'string'
					)
				})
				.map((record) => [record.id, record])
		)
		const session = sessionRows
			.filter((row) => typeof row.updatedAt === 'number' && row.snapshot)
			.sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0))
			.pop()?.snapshot

		return {
			document: { schema, store } as TLEditorSnapshot['document'],
			...(session ? { session: session as TLEditorSnapshot['session'] } : {}),
		}
	} finally {
		db.close()
	}
}

async function doesIndexedDbExist(dbName: string) {
	if ('databases' in window.indexedDB) {
		const databases = await window.indexedDB.databases()
		return databases.some((database) => database.name === dbName)
	}

	try {
		const storedNames = JSON.parse(window.localStorage.getItem(TLDRAW_DB_NAME_INDEX_KEY) ?? '[]')
		return Array.isArray(storedNames) && storedNames.includes(dbName)
	} catch {
		return false
	}
}

function openIndexedDb(dbName: string) {
	return requestToPromise<IDBDatabase>(window.indexedDB.open(dbName))
}

function requestToPromise<T>(request: IDBRequest<T>) {
	return new Promise<T>((resolve, reject) => {
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'))
	})
}

function transactionToPromise(transaction: IDBTransaction) {
	return new Promise<void>((resolve, reject) => {
		transaction.oncomplete = () => resolve()
		transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'))
		transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'))
	})
}
