const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const DEFAULT_SVG_WIDTH = 240
const DEFAULT_SVG_HEIGHT = 160

const ALLOWED_ELEMENTS = new Set([
	'g',
	'path',
	'rect',
	'circle',
	'ellipse',
	'line',
	'polyline',
	'polygon',
])

const ALLOWED_ATTRIBUTES = new Set([
	'd',
	'x',
	'y',
	'x1',
	'y1',
	'x2',
	'y2',
	'cx',
	'cy',
	'r',
	'rx',
	'ry',
	'width',
	'height',
	'points',
	'fill',
	'fill-opacity',
	'fill-rule',
	'stroke',
	'stroke-opacity',
	'stroke-width',
	'stroke-linecap',
	'stroke-linejoin',
	'stroke-dasharray',
	'stroke-dashoffset',
	'stroke-miterlimit',
	'opacity',
	'transform',
	'clip-rule',
	'style',
	'vector-effect',
])

const ALLOWED_STYLE_PROPERTIES = new Set([
	'fill',
	'fill-opacity',
	'fill-rule',
	'stroke',
	'stroke-opacity',
	'stroke-width',
	'stroke-linecap',
	'stroke-linejoin',
	'stroke-dasharray',
	'stroke-dashoffset',
	'stroke-miterlimit',
	'opacity',
	'vector-effect',
])

export interface SanitizedSvgSource {
	viewBox: string
	markup: string
	width: number
	height: number
}

function createSlug(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
}

function parseNumericLength(value: string | null) {
	if (!value) return null
	const parsed = Number.parseFloat(value)
	if (!Number.isFinite(parsed) || parsed <= 0) return null
	return parsed
}

function parseViewBox(value: string | null) {
	if (!value) return null

	const numbers = value
		.split(/[\s,]+/)
		.map((part) => Number.parseFloat(part))
		.filter((part) => Number.isFinite(part))

	if (numbers.length !== 4) return null
	if (numbers[2] <= 0 || numbers[3] <= 0) return null

	return numbers as [number, number, number, number]
}

function sanitizeStyle(styleText: string) {
	const safeDeclarations: string[] = []
	const declarations = styleText.split(';')

	for (const declaration of declarations) {
		const [rawProperty, ...rawValueParts] = declaration.split(':')
		if (!rawProperty || rawValueParts.length === 0) continue

		const property = rawProperty.trim().toLowerCase()
		if (!ALLOWED_STYLE_PROPERTIES.has(property)) continue

		const value = rawValueParts.join(':').trim()
		if (!value || /(javascript:|data:text\/html|url\s*\()/i.test(value)) continue

		safeDeclarations.push(`${property}:${value}`)
	}

	return safeDeclarations.join(';')
}

function sanitizeAttributeValue(name: string, value: string) {
	if (name.startsWith('on')) return null
	if (!ALLOWED_ATTRIBUTES.has(name)) return null

	if (name === 'style') {
		const safeStyle = sanitizeStyle(value)
		return safeStyle.length > 0 ? safeStyle : null
	}

	if (/(javascript:|data:text\/html|url\s*\()/i.test(value)) return null

	return value.trim()
}

function cloneSafeNode(node: ChildNode, doc: XMLDocument): ChildNode | null {
	if (node.nodeType === Node.TEXT_NODE) {
		const text = node.textContent ?? ''
		return text.trim().length > 0 ? doc.createTextNode(text) : null
	}

	if (node.nodeType !== Node.ELEMENT_NODE) return null

	const element = node as Element
	const localName = element.localName.toLowerCase()
	if (!ALLOWED_ELEMENTS.has(localName)) return null

	const clone = doc.createElementNS(SVG_NAMESPACE, localName)

	for (const attribute of Array.from(element.attributes)) {
		const name = attribute.name.toLowerCase()
		const safeValue = sanitizeAttributeValue(name, attribute.value)
		if (safeValue === null) continue
		clone.setAttribute(name, safeValue)
	}

	for (const child of Array.from(element.childNodes)) {
		const safeChild = cloneSafeNode(child, doc)
		if (safeChild) {
			clone.appendChild(safeChild)
		}
	}

	return clone
}

function serializeChildren(root: Element) {
	const serializer = new XMLSerializer()
	return Array.from(root.childNodes)
		.map((child) => serializer.serializeToString(child))
		.join('')
		.trim()
}

function getSvgSize(svgElement: SVGSVGElement) {
	const parsedViewBox = parseViewBox(svgElement.getAttribute('viewBox'))
	if (parsedViewBox) {
		return {
			viewBox: parsedViewBox.join(' '),
			width: parsedViewBox[2],
			height: parsedViewBox[3],
		}
	}

	const width = parseNumericLength(svgElement.getAttribute('width')) ?? DEFAULT_SVG_WIDTH
	const height = parseNumericLength(svgElement.getAttribute('height')) ?? DEFAULT_SVG_HEIGHT

	return {
		viewBox: `0 0 ${width} ${height}`,
		width,
		height,
	}
}

export function sanitizeSvgMarkup(rawSvg: string): SanitizedSvgSource | null {
	const parser = new DOMParser()
	const parsed = parser.parseFromString(rawSvg, 'image/svg+xml')
	if (parsed.querySelector('parsererror')) return null

	const svgElement = parsed.documentElement as unknown as SVGSVGElement
	if (svgElement.localName.toLowerCase() !== 'svg') return null

	const svgSize = getSvgSize(svgElement as SVGSVGElement)
	const safeDoc = document.implementation.createDocument(SVG_NAMESPACE, 'svg', null)
	const safeRoot = safeDoc.documentElement

	for (const child of Array.from(svgElement.childNodes)) {
		const safeChild = cloneSafeNode(child, safeDoc)
		if (safeChild) {
			safeRoot.appendChild(safeChild)
		}
	}

	const markup = serializeChildren(safeRoot)
	if (!markup) return null

	return {
		viewBox: svgSize.viewBox,
		markup,
		width: svgSize.width,
		height: svgSize.height,
	}
}

export function normalizeImportedSvgSource(value: unknown): SanitizedSvgSource | null {
	if (!value || typeof value !== 'object') return null

	const source = value as { kind?: unknown; markup?: unknown; viewBox?: unknown }
	if (source.kind !== 'svg') return null
	if (typeof source.markup !== 'string' || typeof source.viewBox !== 'string') return null

	return sanitizeSvgMarkup(
		`<svg xmlns="${SVG_NAMESPACE}" viewBox="${source.viewBox}">${source.markup}</svg>`
	)
}

export function isSvgFile(file: File) {
	return file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')
}

export function createLibraryItemIdFromFilename(filename: string) {
	const baseName = filename.replace(/\.[^.]+$/, '')
	const slug = createSlug(baseName)

	return slug || 'svg-symbol'
}

export function createLibraryItemLabelFromFilename(filename: string) {
	const baseName = filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()
	if (!baseName) return 'SVG Symbol'

	return baseName.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function createLibraryItemIdFromText(label: string) {
	const slug = createSlug(label)
	const suffix =
		typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
			? crypto.randomUUID().slice(0, 8)
			: Math.random().toString(36).slice(2, 10)

	return `${slug || 'svg-symbol'}-${suffix}`
}

export function extractSvgTextFromMarkup(rawText: string) {
	const trimmed = rawText.trim()
	if (!trimmed) return null

	if (trimmed.startsWith('<svg') && trimmed.includes('</svg>')) {
		return trimmed
	}

	if (!trimmed.includes('<svg')) return null

	const html = new DOMParser().parseFromString(trimmed, 'text/html')
	const svgElement = html.querySelector('svg')
	return svgElement?.outerHTML ?? null
}
