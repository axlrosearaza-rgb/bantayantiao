// Dataset register for the prototype. `status` is honest about what is real today:
//   real        – actually loaded from the named source
//   derived     – computed in this repo from a real source over schematic units
//   placeholder – illustrative values; `planned` lists candidate official sources (not yet used)
export const DATA_SOURCES = [
  {
    id: 'noah_flood',
    layer: 'Flood hazard, 100-year rain return (Project NOAH)',
    organization: 'UP Resilience Institute, NOAH Center',
    url: 'https://noah.up.edu.ph/',
    year: 2021,
    resolution: 'Source polygons from about 10 m models; shown here on 11 m cells',
    last_updated: 'Files dated Nov 2021; processed 2026-10-06',
    quality: 'High',
    status: 'real',
    note: 'Licensed ODbL. Downloaded from the BetterGov.ph public mirror of the NOAH hazard maps and clipped to Catbalogan City plus the part of the Antiao Watershed beyond the city line. A modelled hazard map for planning, not a live forecast.',
  },
  {
    id: 'noah_landslide',
    layer: 'Landslide hazard (Project NOAH)',
    organization: 'UP Resilience Institute, NOAH Center',
    url: 'https://noah.up.edu.ph/',
    year: 2021,
    resolution: 'Source polygons from LiDAR / IfSAR models; shown here on 11 m cells',
    last_updated: 'Files dated Oct 2021; processed 2026-10-06',
    quality: 'High',
    status: 'real',
    note: 'Licensed ODbL. Merged shallow-landslide, structurally controlled landslide and debris-flow models. High hazard is a no-dwelling zone.',
  },
  {
    id: 'noah_stormsurge',
    layer: 'Storm surge hazard, advisory 4 (Project NOAH)',
    organization: 'UP Resilience Institute, NOAH Center (model run by PAGASA under Project NOAH)',
    url: 'https://noah.up.edu.ph/',
    year: 2021,
    resolution: 'Source polygons from LiDAR / IfSAR models; shown here on 11 m cells',
    last_updated: 'Files dated Nov 2021; processed 2026-10-06',
    quality: 'High',
    status: 'real',
    note: 'Licensed ODbL. Inundation for a storm surge above 4 m (Storm Surge Advisory 4). A modelled scenario, not a live warning.',
  },
  {
    id: 'barangays',
    layer: 'Barangay boundaries',
    organization: 'faeldon/philippines-json-maps (PSGC 4Q 2023, from PSA / NAMRIA)',
    url: 'https://github.com/faeldon/philippines-json-maps',
    year: 2023,
    resolution: 'Generalised polygons',
    last_updated: '2026-10-06',
    quality: 'Medium',
    status: 'real',
    note: 'Indicative boundaries, not survey-grade. Used to suggest a barangay and for search; residents confirm the barangay themselves when reporting.',
  },
  {
    id: 'basemap',
    layer: 'Basemap',
    organization: 'OpenStreetMap contributors',
    url: 'https://www.openstreetmap.org/copyright',
    year: 2026,
    resolution: 'Vector tiles (street level)',
    last_updated: 'Live tiles',
    quality: 'High',
    status: 'real',
  },
  {
    id: 'satellite',
    layer: 'Satellite imagery (map background)',
    organization: 'EOX IT Services GmbH — Sentinel-2 cloudless (contains modified Copernicus Sentinel data 2020)',
    url: 'https://s2maps.eu',
    year: 2020,
    resolution: 'About 10 m per pixel',
    last_updated: '2020 mosaic',
    quality: 'High',
    status: 'real',
    note: 'A cloud-free mosaic of 2020 images, shown as the map background. Licensed CC BY-NC-SA 4.0 (non-commercial). It is a picture of the land in 2020, not a live view.',
  },
  {
    id: 'rivers',
    layer: 'Rivers & streams',
    organization: 'OpenStreetMap (Overpass API extract)',
    url: 'https://overpass-api.de',
    year: 2026,
    resolution: 'Vector, community-mapped',
    last_updated: '2026-10-06',
    quality: 'Medium',
    status: 'real',
    note: 'Antiao River and other waterways as mapped by OpenStreetMap volunteers; small streams are only partly mapped.',
  },
  {
    id: 'settlement_points',
    layer: 'Settlement points',
    organization: 'OpenStreetMap place nodes',
    url: 'https://overpass-api.de',
    year: 2026,
    resolution: 'Point locations',
    last_updated: '2026-10-06',
    quality: 'Medium',
    status: 'real',
  },
  {
    id: 'terrain',
    layer: 'Terrain view',
    organization: 'OpenTopoMap (SRTM-derived tiles)',
    url: 'https://opentopomap.org',
    year: 2026,
    resolution: '~30 m DEM rendering',
    last_updated: 'Live tiles',
    quality: 'Medium',
    status: 'real',
    note: 'The topographic map style. Display only.',
  },
  {
    id: 'elevation',
    layer: 'Ground elevation (3D terrain)',
    organization: 'Mapzen terrain tiles on AWS Open Data (SRTM-based)',
    url: 'https://registry.opendata.aws/terrain-tiles/',
    year: 2018,
    resolution: 'About 30 m',
    last_updated: 'Static',
    quality: 'Medium',
    status: 'real',
    note: 'Raises the map into 3D and is the input for the watershed boundary below. The per-barangay "mean slope" used in the pressure index is still a sample value, not yet computed from this layer.',
  },
  {
    id: 'watershed',
    layer: 'Antiao Watershed boundary, catchments and streams',
    organization: 'Derived in this project from the ground elevation above (scripts/build-watershed.mjs)',
    url: 'https://registry.opendata.aws/terrain-tiles/',
    year: 2026,
    resolution: 'About 37 m cells',
    last_updated: '2026-10-07',
    quality: 'Medium',
    status: 'derived',
    planned: 'An official delineation from DENR or NAMRIA, when available',
    note: 'A terrain-derived estimate (pits filled, steepest-descent flow, every cell draining through the river mouth): 22.4 km², with 98% of the mapped Antiao River inside it. Not an official delineation. Catchments on flat ground are the least reliable.',
  },
  {
    id: 'units',
    layer: 'Study area and management units',
    organization: 'Catbalogan City and its 57 barangays (PSGC 4Q 2023, from PSA / NAMRIA, via faeldon/philippines-json-maps)',
    url: 'https://github.com/faeldon/philippines-json-maps',
    year: 2023,
    resolution: 'Generalised polygons',
    last_updated: '2026-10-06',
    quality: 'Medium',
    status: 'real',
    note: 'City-wide figures and the pressure index use the 57 barangays. The Antiao Watershed (row above) is drawn on the map as its own, smaller area: parts of 10 barangays. Boundaries are indicative.',
  },
  {
    id: 'landcover',
    layer: 'Land cover (forest / agriculture / settlement %)',
    organization: 'Illustrative demo values',
    year: 2025,
    resolution: 'Per management unit',
    last_updated: '2026-10-06',
    quality: 'Low',
    status: 'placeholder',
    planned: 'NAMRIA land cover, DENR-FMB forest cover, Copernicus land-cover products',
    conf: { year: 2025, authority: 0.9, resolution: 0.85 },
  },
  {
    id: 'slope',
    layer: 'Mean slope',
    organization: 'Illustrative demo values',
    year: 2014,
    resolution: 'Per management unit',
    last_updated: '2026-10-06',
    quality: 'Low',
    status: 'placeholder',
    planned: 'SRTM / Copernicus DEM, NAMRIA IfSAR',
    conf: { year: 2014, authority: 0.85, resolution: 0.8, static: true },
  },
  {
    id: 'rainfall',
    layer: 'Rainfall indicator',
    organization: 'Illustrative demo values',
    year: 2023,
    resolution: 'Per management unit',
    last_updated: '2026-10-06',
    quality: 'Low',
    status: 'placeholder',
    planned: 'PAGASA climatological normals / station data',
    conf: { year: 2023, authority: 0.95, resolution: 0.55 },
  },
  {
    id: 'population',
    layer: 'Population',
    organization: 'Illustrative demo values',
    year: 2020,
    resolution: 'Per management unit',
    last_updated: '2026-10-06',
    quality: 'Low',
    status: 'placeholder',
    planned: 'Philippine Statistics Authority census (barangay level)',
    conf: { year: 2020, authority: 1, resolution: 0.8 },
  },
  {
    id: 'riparian',
    layer: 'Riparian buffer (100 m)',
    organization: 'Buffer length from OSM streams; disturbed shares are illustrative',
    year: 2025,
    resolution: 'Per management unit',
    last_updated: '2026-10-06',
    quality: 'Low',
    status: 'derived',
    planned: 'River buffers intersected with NAMRIA land cover in QGIS',
    conf: { year: 2025, authority: 0.75, resolution: 0.7 },
  },
  {
    id: 'reports',
    layer: 'Community reports',
    organization: 'Bantay Antiao submissions (demo seed + live entries)',
    year: 2026,
    resolution: 'GPS point',
    last_updated: 'Realtime',
    quality: 'Varies — verified by LGU reviewers',
    status: 'real',
    conf: { year: 2026, authority: 0.7, resolution: 0.9 },
  },
]

const SOURCE = Object.fromEntries(DATA_SOURCES.map((s) => [s.id, s]))
const INDICATOR_SOURCES = ['landcover', 'slope', 'rainfall', 'population', 'riparian', 'reports']
const NOW_YEAR = 2026

const label = (v) => (v >= 75 ? 'High' : v >= 50 ? 'Medium' : 'Low')

/**
 * Data Confidence = average over the six indicator datasets of
 *   40% dataset age + 30% source authority + 30% resolution,
 * halved for any indicator flagged as having gaps in this area.
 * The age / authority / resolution figures describe the PLANNED datasets, so an indicator that still runs on sample
 * values is capped: it cannot rate above Low (fully sample) or Medium (partly derived) until real data is loaded.
 */
const CAP = { placeholder: 35, derived: 55 }
export function dataConfidence(area) {
  const items = INDICATOR_SOURCES.map((id) => {
    const s = SOURCE[id]
    const age = NOW_YEAR - s.conf.year
    const ageScore = s.conf.static ? 90 : Math.max(30, 100 - Math.max(0, age - 1) * 8)
    let score = 0.4 * ageScore + 0.3 * s.conf.authority * 100 + 0.3 * s.conf.resolution * 100
    const gap = area.data_gaps?.includes(id)
    if (gap) score *= 0.5
    const sample = s.status in CAP
    if (sample) score = Math.min(score, CAP[s.status])
    return { id, layer: s.layer, year: s.year, score: Math.round(score), level: label(score), gap, sample }
  })
  const score = Math.round(items.reduce((a, i) => a + i.score, 0) / items.length)
  return { score, level: label(score), items }
}
