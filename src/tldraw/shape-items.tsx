import type { TLGeoShape } from 'tldraw'

export type GeoShapeMenuValue = TLGeoShape['props']['geo']

export const geoShapeItems: readonly {
	value: GeoShapeMenuValue
	icon: string
}[] = [
	{ value: 'rectangle', icon: 'geo-rectangle' },
	{ value: 'ellipse', icon: 'geo-ellipse' },
	{ value: 'triangle', icon: 'geo-triangle' },
	{ value: 'diamond', icon: 'geo-diamond' },
	{ value: 'star', icon: 'geo-star' },
	{ value: 'pentagon', icon: 'geo-pentagon' },
	{ value: 'hexagon', icon: 'geo-hexagon' },
	{ value: 'octagon', icon: 'geo-octagon' },
	{ value: 'rhombus', icon: 'geo-rhombus' },
	{ value: 'rhombus-2', icon: 'geo-rhombus-2' },
	{ value: 'oval', icon: 'geo-oval' },
	{ value: 'trapezoid', icon: 'geo-trapezoid' },
	{ value: 'arrow-left', icon: 'geo-arrow-left' },
	{ value: 'arrow-up', icon: 'geo-arrow-up' },
	{ value: 'arrow-down', icon: 'geo-arrow-down' },
	{ value: 'arrow-right', icon: 'geo-arrow-right' },
	{ value: 'cloud', icon: 'geo-cloud' },
	{ value: 'x-box', icon: 'geo-x-box' },
	{ value: 'check-box', icon: 'geo-check-box' },
	{ value: 'heart', icon: 'geo-heart' },
] as const
