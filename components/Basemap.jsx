// Basemap for every map in the app.
// With VITE_MAPBOX_TOKEN set: Mapbox Streets (built on OpenStreetMap data), served through Mapbox's
// Static Tiles API. Without a token: plain OpenStreetMap tiles, so the app still works out of the box.
import { TileLayer } from 'react-leaflet'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
const STYLE = import.meta.env.VITE_MAPBOX_STYLE || 'mapbox/streets-v12'
export const USING_MAPBOX = Boolean(TOKEN)

export default function Basemap() {
  if (!TOKEN) {
    return (
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
    )
  }
  return (
    <TileLayer
      url={`https://api.mapbox.com/styles/v1/${STYLE}/tiles/512/{z}/{x}/{y}@2x?access_token=${TOKEN}`}
      tileSize={512}
      zoomOffset={-1}
      maxZoom={20}
      attribution='&copy; <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noreferrer">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> <a href="https://www.mapbox.com/map-feedback/" target="_blank" rel="noreferrer">Improve this map</a>'
    />
  )
}

/** Mapbox's terms require its wordmark on maps that use its tiles. */
export function MapboxMark() {
  if (!TOKEN) return null
  return (
    <a className="mapbox-mark" href="https://www.mapbox.com/" target="_blank" rel="noreferrer" aria-label="Mapbox">
      mapbox
    </a>
  )
}
