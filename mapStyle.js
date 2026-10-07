// Shared look of the 3D hazard maps (Explore Map and the report form's map).
// Basemap: OpenFreeMap vector tiles, built from OpenStreetMap data; no account or key. If the vector style cannot
// be loaded, a flat OpenStreetMap raster map is used instead.

export const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
export const OSM_CREDIT = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
export const FLAT_STYLE = {
  version: 8,
  sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: OSM_CREDIT } },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
}
// Ground elevation: Mapzen "terrarium" tiles on AWS Open Data (SRTM-based, about 30 m). Free, no key.
export const DEM_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
export const DEM_CREDIT = 'Elevation: <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noreferrer">Mapzen terrain tiles</a>'
export const RELIEF = 1.5 // vertical exaggeration, so hills read clearly at city scale
export const HILLSHADE = { 'hillshade-exaggeration': 0.55, 'hillshade-shadow-color': '#5b2a1e', 'hillshade-highlight-color': '#fff6e6', 'hillshade-accent-color': '#7a3b2a', 'hillshade-illumination-direction': 315 }

const WATER = '#0b3fc4'
/** Restyles the open basemap toward the look of NOAH's map: deep blue water, tan-grey solid buildings, white outlined labels. */
export function restyle(style) {
  for (const l of style.layers) {
    l.paint = l.paint || {}
    if (l['source-layer'] === 'water' && l.type === 'fill') l.paint['fill-color'] = WATER
    if (l['source-layer'] === 'waterway' && l.type === 'line') l.paint['line-color'] = WATER
    if (l.type === 'fill-extrusion') Object.assign(l.paint, { 'fill-extrusion-color': '#b8aca1', 'fill-extrusion-opacity': 0.96 })
    if (l.type === 'symbol') Object.assign(l.paint, { 'text-color': '#ffffff', 'text-halo-color': 'rgba(60,56,54,0.9)', 'text-halo-width': 1.4, 'text-halo-blur': 0.2 })
  }
  return style
}

// Satellite imagery: "Sentinel-2 cloudless" by EOX, a cloud-free mosaic of 2020 Copernicus Sentinel-2 images at
// about 10 m per pixel. Free for non-commercial use with this credit (CC BY-NC-SA 4.0); no account or key.
export const SATELLITE = {
  type: 'raster',
  tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg'],
  tileSize: 256,
  maxzoom: 15, // finer tiles only enlarge the same 10 m pixels
  attribution:
    '<a href="https://s2maps.eu" target="_blank" rel="noreferrer">Sentinel-2 cloudless</a> by <a href="https://eox.at" target="_blank" rel="noreferrer">EOX IT Services GmbH</a> (contains modified Copernicus Sentinel data 2020)',
}
// how strongly the hazard colours are laid over the map: lighter over the satellite picture, so the land still shows
export const HAZARD_OPACITY = { satellite: 0.42, plain: 0.74 }
