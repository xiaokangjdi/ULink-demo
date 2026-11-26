/**
 * Basemap definitions for the Leaflet trajectory map.
 *
 * Leaflet owns the tile lifecycle (pan, zoom, retina, retries), so this module only
 * has to describe *where* tiles come from and *how far* each provider really has
 * data. That distinction matters: Esri's World Street Map answers HTTP 200 with a
 * grey "Map data not yet available" placeholder above zoom 13 around Shanghai.
 * `maxNativeZoom` tells Leaflet to upscale a real z13 tile instead of ever asking
 * for the placeholder, so the map can never paint that grey card again.
 *
 * The OSM mirrors are ordered by observed reachability from mainland China. They
 * all serve Shanghai down to z19; Esri street is the last resort below z14, and
 * Esri World Imagery is the final fallback when every OSM host is blocked.
 */

export interface BasemapProvider {
  id: string;
  label: string;
  url: string;
  /** Highest zoom with real imagery; Leaflet upscales lower zooms above this. */
  maxNativeZoom: number;
  attribution: string;
  /**
   * Esri rejects browser requests that carry a localhost Referer with 403.
   * Requesting its tiles without a Referer is what makes the satellite toggle work
   * from a local demo; OSM mirrors keep the normal Referer.
   */
  noReferrer?: boolean;
}

export const STREET_BASEMAPS: BasemapProvider[] = [
  {
    id: "osm-de",
    label: "OpenStreetMap DE",
    url: "https://tile.openstreetmap.de/{z}/{x}/{y}.png",
    maxNativeZoom: 19,
    attribution: "© OpenStreetMap contributors",
  },
  {
    id: "osm-fr",
    label: "OpenStreetMap FR",
    url: "https://a.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png",
    maxNativeZoom: 19,
    attribution: "© OpenStreetMap contributors",
  },
  {
    id: "osm-jp",
    label: "OpenStreetMap JP",
    url: "https://tile.openstreetmap.jp/{z}/{x}/{y}.png",
    maxNativeZoom: 19,
    attribution: "© OpenStreetMap contributors",
  },
  {
    id: "osm",
    label: "OpenStreetMap",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxNativeZoom: 19,
    attribution: "© OpenStreetMap contributors",
  },
  {
    id: "esri-street",
    label: "Esri World Street Map",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    maxNativeZoom: 13,
    attribution: "Tiles © Esri",
    noReferrer: true,
  },
  {
    id: "esri-imagery",
    label: "Esri World Imagery",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxNativeZoom: 19,
    attribution: "Tiles © Esri",
    noReferrer: true,
  },
];

export const SATELLITE_BASEMAPS: BasemapProvider[] = [
  {
    id: "esri-imagery",
    label: "Esri World Imagery",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxNativeZoom: 19,
    attribution: "Tiles © Esri",
    noReferrer: true,
  },
];

export type BasemapKind = "street" | "satellite";

export const basemapProviders = (kind: BasemapKind): BasemapProvider[] =>
  kind === "satellite" ? SATELLITE_BASEMAPS : STREET_BASEMAPS;
