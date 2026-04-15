import { useEditor, useValue } from 'tldraw'
import type { SvgContrastTone } from './svg-import'

const DARK_CANVAS_COLOR = '#f5f5f5'
const LIGHT_CANVAS_COLOR = '#111114'

export function useSvgContrastStyle(contrastTone: SvgContrastTone) {
	const editor = useEditor()
	const isDarkMode = useValue('svg symbol dark mode', () => editor.user.getIsDarkMode(), [editor])

	if (contrastTone === 'current') {
		return {
			color: isDarkMode ? DARK_CANVAS_COLOR : LIGHT_CANVAS_COLOR,
		}
	}

	if (
		(contrastTone === 'dark' && isDarkMode) ||
		(contrastTone === 'light' && !isDarkMode)
	) {
		return {
			filter: 'invert(1)',
		}
	}

	return undefined
}
