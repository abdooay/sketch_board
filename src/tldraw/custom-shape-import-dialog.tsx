import {
	useEffect,
	useRef,
	useState,
	type ChangeEvent,
	type ClipboardEvent,
	type DragEvent,
} from 'react'
import { useToasts } from 'tldraw'
import { useCustomShapeLibrary } from './custom-shape-library'

interface CustomShapeImportDialogProps {
	open: boolean
	onClose(): void
}

function hasImportSuccess(result: { added: number; updated: number }) {
	return result.added > 0 || result.updated > 0
}

export function CustomShapeImportDialog({ open, onClose }: CustomShapeImportDialogProps) {
	const { addToast } = useToasts()
	const { importItemsFromFiles, importItemsFromTextInputs } = useCustomShapeLibrary()
	const [isDragActive, setIsDragActive] = useState(false)
	const [isImporting, setIsImporting] = useState(false)
	const fileInputRef = useRef<HTMLInputElement | null>(null)
	const pasteTargetRef = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		if (!open) return

		const frame = window.requestAnimationFrame(() => {
			pasteTargetRef.current?.focus()
		})

		return () => window.cancelAnimationFrame(frame)
	}, [open])

	useEffect(() => {
		if (!open) return

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				onClose()
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [open, onClose])

	if (!open) return null

	const reportResult = (result: { added: number; updated: number; errors: string[] }) => {
		if (hasImportSuccess(result)) {
			addToast({
				severity: 'success',
				title: 'Custom shape library updated',
				description: `Added ${result.added}, updated ${result.updated}.`,
			})
			onClose()
		}

		if (result.errors.length > 0) {
			addToast({
				severity: 'warning',
				title: 'Some custom shapes were skipped',
				description: result.errors.join(' '),
			})
		}
	}

	const handleFiles = async (files: File[]) => {
		if (files.length === 0) return
		setIsImporting(true)
		try {
			reportResult(await importItemsFromFiles(files))
		} finally {
			setIsImporting(false)
		}
	}

	const handleTextInputs = async (inputs: { name: string; text: string }[]) => {
		const nonEmptyInputs = inputs.filter((input) => input.text.trim().length > 0)
		if (nonEmptyInputs.length === 0) return

		setIsImporting(true)
		try {
			reportResult(await importItemsFromTextInputs(nonEmptyInputs))
		} finally {
			setIsImporting(false)
		}
	}

	const handleFileInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(event.currentTarget.files ?? [])
		event.currentTarget.value = ''
		await handleFiles(files)
	}

	const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
		event.preventDefault()
		setIsDragActive(false)

		const files = Array.from(event.dataTransfer.files ?? [])
		if (files.length > 0) {
			await handleFiles(files)
			return
		}

		const html = event.dataTransfer.getData('text/html')
		const text = event.dataTransfer.getData('text/plain')
		await handleTextInputs(
			html.trim().length > 0
				? [{ name: 'Dropped content.html', text: html }]
				: [{ name: 'Dropped content.txt', text }]
		)
	}

	const handlePaste = async (event: ClipboardEvent<HTMLDivElement>) => {
		event.preventDefault()

		const files = Array.from(event.clipboardData.files ?? [])
		if (files.length > 0) {
			await handleFiles(files)
			return
		}

		const html = event.clipboardData.getData('text/html')
		const text = event.clipboardData.getData('text/plain')
		await handleTextInputs(
			html.trim().length > 0
				? [{ name: 'Clipboard content.html', text: html }]
				: [{ name: 'Clipboard content.txt', text }]
		)
	}

	return (
		<div className="custom-shape-import-dialog-backdrop" onClick={onClose}>
			<div
				className="custom-shape-import-dialog"
				role="dialog"
				aria-modal="true"
				aria-labelledby="custom-shape-import-dialog-title"
				onClick={(event) => event.stopPropagation()}
			>
				<div className="custom-shape-import-dialog__header">
					<div>
						<h2 id="custom-shape-import-dialog-title" className="custom-shape-import-dialog__title">
							Import custom shape
						</h2>
						<p className="custom-shape-import-dialog__subtitle">
							Drop files, paste SVG or JSON directly, or choose files from disk.
						</p>
					</div>
					<button
						type="button"
						className="custom-shape-import-dialog__close"
						onClick={onClose}
						aria-label="Close import dialog"
					>
						×
					</button>
				</div>
				<div
					ref={pasteTargetRef}
					tabIndex={0}
					className="custom-shape-import-dropzone"
					data-drag-active={isDragActive}
					onPaste={handlePaste}
					onDragOver={(event) => {
						event.preventDefault()
						setIsDragActive(true)
					}}
					onDragEnter={(event) => {
						event.preventDefault()
						setIsDragActive(true)
					}}
					onDragLeave={(event) => {
						event.preventDefault()
						if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
						setIsDragActive(false)
					}}
					onDrop={handleDrop}
				>
					<div className="custom-shape-import-dropzone__title">Drop SVG / JSON here</div>
					<div className="custom-shape-import-dropzone__hint">
						Paste copied SVG code, dropped web content, or copied SVG files.
					</div>
					<div className="custom-shape-import-dropzone__shortcut">Ctrl/Cmd + V</div>
				</div>
				<div className="custom-shape-import-dialog__actions">
					<button
						type="button"
						className="custom-shape-import-dialog__button"
						onClick={() => fileInputRef.current?.click()}
						disabled={isImporting}
					>
						Choose files
					</button>
					<button
						type="button"
						className="custom-shape-import-dialog__button custom-shape-import-dialog__button--secondary"
						onClick={() => pasteTargetRef.current?.focus()}
						disabled={isImporting}
					>
						Focus paste area
					</button>
				</div>
				<input
					ref={fileInputRef}
					type="file"
					accept=".svg,.json,image/svg+xml,application/json"
					multiple
					hidden
					onChange={handleFileInputChange}
				/>
			</div>
		</div>
	)
}
