---
name: basemaps
description: Load basemaps into QGIS — Planet mosaics, Esri, and 30+ free XYZ tile providers. Recipes for multi-layer map compositions.
---

# Basemaps Skill

Load satellite imagery, street maps, and terrain basemaps into QGIS via MCP tools.

## Tools

| Tool | Purpose |
|------|---------|
| `list_planet_basemaps` | Search Planet mosaic catalog (requires PL_API_KEY) |
| `add_planet_basemap` | Add Planet mosaic to QGIS project |
| `add_xyz_basemap` | Add any XYZ tile layer (free providers, no key needed) |

## Planet Basemaps

Requires `PL_API_KEY` environment variable. Mosaics are global, periodic, and analysis-ready.

### Naming pattern

```
global_monthly_YYYY_MM_mosaic
global_quarterly_YYYY_QN_mosaic
global_quarterly_YYYY_QN_mosaic
```

Available series:
- `global_monthly` — monthly global composites
- `global_quarterly` — quarterly global composites
- `tropics` — high-frequency tropical regions

### Processing options

| Value | Bands | Use case |
|-------|-------|----------|
| `""` (empty) | RGB visual | General reference mapping |
| `"off"` | All bands | Custom analysis, requires uint16 analytic/SR mosaic |
| `"ndvi"` | Single band | Vegetation health, requires analytic/SR |
| `"ndwi"` | Single band | Water detection, requires analytic/SR |
| `"msavi2"` | Single band | Modified soil-adjusted vegetation index, requires analytic/SR |

Processing options other than `""` only work with `analytic` or `surface_reflectance` mosaic variants (uint16), not `visual` (uint8 RGB).

### Tile formats

- `png` (default) — web-optimized, best compatibility
- `geotiff` — lossless, larger, for analysis workflows
- `jpeg` — smaller, no transparency
- `webp` — modern, efficient compression

### Usage

```python
# List available mosaics
list_planet_basemaps(name_contains="2024_03", limit=10)

# Add visual mosaic for reference mapping
add_planet_basemap(
    mosaic_name="global_monthly_2024_03_mosaic",
    name="Planet March 2024",
    proc="",
    tile_format="png"
)

# Add analytic mosaic for NDVI analysis
add_planet_basemap(
    mosaic_name="global_monthly_2024_03_mosaic_analytic",
    name="Planet March 2024 NDVI",
    proc="ndvi",
    tile_format="png"
)
```

## Free XYZ Basemaps

No API key required. Use `add_xyz_basemap(url_template, name, zmin, zmax)`.

**Note on URL order:** Esri tiles use `{z}/{y}/{x}` (Y before X). All others use `{z}/{x}/{y}`.

### General / Street

| Name | URL Template | Max Zoom | Notes |
|------|--------------|----------|-------|
| OSM Standard | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | 19 | Community-maintained, global |
| OSM HOT | `https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png` | 19 | Humanitarian OpenStreetMap style |
| CartoDB Positron | `https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png` | 20 | Clean, light background |
| CartoDB Dark Matter | `https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png` | 20 | Dark mode base |
| CartoDB Voyager | `https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png` | 20 | Balanced general purpose |

### Labels-only overlays

Use these *over* imagery or terrain bases for hybrid compositions.

| Name | URL Template | Max Zoom | Notes |
|------|--------------|----------|-------|
| CartoDB Positron Labels | `https://a.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png` | 20 | Light labels overlay |
| CartoDB Dark Labels | `https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png` | 20 | Dark labels overlay |
| CartoDB Voyager Labels | `https://a.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}.png` | 20 | Colored labels overlay |

### No-labels bases

Clean backgrounds for data-heavy visualizations where labels would clutter.

| Name | URL Template | Max Zoom | Notes |
|------|--------------|----------|-------|
| CartoDB Positron No Labels | `https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png` | 20 | Clean light base |
| CartoDB Dark No Labels | `https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png` | 20 | Clean dark base |

### Satellite / Imagery

| Name | URL Template | Max Zoom | Notes |
|------|--------------|----------|-------|
| Esri World Imagery | `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` | 18 | High-res global satellite |
| USGS Imagery | `https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}` | 20 | United States only |
| USGS Imagery+Topo | `https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}` | 20 | US imagery with contours |

### Terrain / Topo

| Name | URL Template | Max Zoom | Notes |
|------|--------------|----------|-------|
| OpenTopoMap | `https://a.tile.opentopomap.org/{z}/{x}/{y}.png` | 17 | OSM-based topo with hillshade |
| Esri World Topo | `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}` | 18 | Detailed global topo |
| Esri Terrain | `https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}` | 13 | Shaded terrain |
| Esri Shaded Relief | `https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}` | 13 | Hillshaded terrain |
| Esri Physical | `https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}` | 8 | Natural Earth physical |
| USGS Topo | `https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}` | 20 | United States topo maps |

### Ocean / Nautical

| Name | URL Template | Max Zoom | Notes |
|------|--------------|----------|-------|
| Esri Ocean | `https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}` | 13 | Bathymetric ocean base |
| OpenSeaMap | `https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png` | 19 | Nautical markers overlay only |

### Reference / Minimal

| Name | URL Template | Max Zoom | Notes |
|------|--------------|----------|-------|
| Esri Gray Canvas | `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}` | 16 | Neutral gray reference |
| Esri NatGeo | `https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}` | 16 | National Geographic style |
| Esri Street Map | `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}` | 18 | Detailed street network |

### Artistic / Specialty

| Name | URL Template | Max Zoom | Notes |
|------|--------------|----------|-------|
| Stadia Stamen Toner | `https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}.png` | 20 | High-contrast black/white, 200k tiles/mo free |
| Stadia Stamen Watercolor | `https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg` | 18 | Artistic watercolor effect, 200k tiles/mo free |

## Recipes

### Planet + Ocean

Satellite imagery over bathymetric base for coastal context:

```python
add_xyz_basemap(
    url_template="https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}",
    name="Esri Ocean",
    zmin=0,
    zmax=13
)
add_planet_basemap(
    mosaic_name="global_monthly_2024_03_mosaic",
    name="Planet March 2024",
    proc="",
    tile_format="png"
)
```

### Satellite + labels

Imagery with dark labels for location reference:

```python
add_xyz_basemap(
    url_template="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    name="Esri World Imagery",
    zmin=0,
    zmax=18
)
add_xyz_basemap(
    url_template="https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png",
    name="Labels",
    zmin=0,
    zmax=20
)
```

### Fieldwork topo

Topographic maps for field navigation:

```python
add_xyz_basemap(
    url_template="https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
    name="OpenTopoMap",
    zmin=0,
    zmax=17
)
```

For US fieldwork, use USGS Topo instead:

```python
add_xyz_basemap(
    url_template="https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}",
    name="USGS Topo",
    zmin=0,
    zmax=20
)
```

### Dark presentation

Dark base with data layers, then labels on top:

```python
add_xyz_basemap(
    url_template="https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    name="Dark Matter",
    zmin=0,
    zmax=20
)
# Add your data layers here
add_xyz_basemap(
    url_template="https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png",
    name="Labels",
    zmin=0,
    zmax=20
)
```

### Clean data canvas

Minimal base for data visualization where the data is the focus:

```python
add_xyz_basemap(
    url_template="https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
    name="Positron No Labels",
    zmin=0,
    zmax=20
)
```
