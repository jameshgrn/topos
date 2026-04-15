# Natural Earth Data Reference

Guide to obtaining, converting, and using Natural Earth data with D3.js cartography.

## Pre-Bundled Sources

### world-atlas npm package
The fastest way to get started. TopoJSON files ready for D3.

```bash
npm install world-atlas
```

| File | Resolution | Size | Use Case |
|------|------------|------|----------|
| `countries-110m.json` | 1:110M | ~100KB | Overview, world maps |
| `countries-50m.json` | 1:50M | ~500KB | Standard for web |
| `countries-10m.json` | 1:10M | ~3MB | Detailed, print |
| `states-10m.json` | 1:10M | ~2MB | US states, admin-1 |

**CDN URLs:**
```javascript
// Via unpkg
const url = "https://unpkg.com/world-atlas@2.0.2/countries-50m.json";

// Via jsdelivr (recommended)
const url = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";
```

**Loading with D3:**
```javascript
d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json")
  .then(world => {
    const countries = topojson.feature(world, world.objects.countries);
    // countries is a GeoJSON FeatureCollection
  });
```

---

## Natural Earth Shapefiles (naturalearthdata.com)

For custom extracts, additional layers, or when npm packages don't suffice.

**Website:** https://www.naturalearthdata.com/downloads/

### Resolution Tiers

| Tier | Scale | Best For | File Size |
|------|-------|----------|-----------|
| **110m** | 1:110 million | Global overview, zoomed-out | Smallest |
| **50m** | 1:50 million | Regional maps, web standard | Medium |
| **10m** | 1:10 million | Detailed country maps, print | Largest |

### Size Tradeoffs

```
110m → 50m = ~5x more detail, ~5x file size
50m  → 10m = ~5x more detail, ~5-10x file size

Rule of thumb:
- World map on screen: 110m or 50m
- Country/regional: 50m or 10m
- Print publication: 10m
- Mobile/constrained: 110m
```

---

## Converting Shapefiles to TopoJSON

### Prerequisites

```bash
# GDAL for shapefile operations
brew install gdal        # macOS
apt-get install gdal-bin # Ubuntu

# topojson CLI
npm install -g topojson-server topojson-simplify
```

### Conversion Pipeline

```bash
# 1. Download Natural Earth shapefile (e.g., ne_50m_rivers_lake_centerlines.zip)
# 2. Unzip to get .shp, .shx, .dbf, .prj files

# 3. Convert Shapefile → GeoJSON (reproject to WGS84)
ogr2ogr -f GeoJSON \
  -t_srs EPSG:4326 \
  rivers.json \
  ne_50m_rivers_lake_centerlines.shp

# 4. Convert GeoJSON → TopoJSON
geo2topo rivers=rivers.json > rivers.topojson

# 5. Simplify (optional, reduces file size)
toposimplify -s 0.000001 \
  -f rivers.topojson > rivers-simplified.topojson

# 6. Quantize (optional, rounding for smaller files)
topoquantize 1e5 < rivers-simplified.topojson > rivers-final.topojson
```

### One-Liner Conversion

```bash
# Full pipeline for a downloaded shapefile
ogr2ogr -f GeoJSON -t_srs EPSG:4326 /dev/stdout ne_50m_lakes.shp | \
  geo2topo lakes=- > lakes.topojson
```

### Loading in D3

```javascript
const rivers = await d3.json("rivers.topojson");
const features = topojson.feature(rivers, rivers.objects.rivers);
// features is a GeoJSON FeatureCollection ready for d3.geoPath()
```

---

## Key Natural Earth Datasets

### Cultural Vectors

| Dataset | Description | Object Name | Typical Use |
|---------|-------------|-------------|-------------|
| **Admin-0 Countries** | Sovereign states | `countries` | Base map, choropleths |
| **Admin-1 States/Provinces** | Subnational divisions | `states` | Regional maps |
| **Populated Places** | Cities/towns (points) | `places` | Labels, markers |
| **Urban Areas** | Built-up regions | `urban` | Context |
| **Airports/Ports** | Transport infrastructure | `airports`, `ports` | Network maps |

### Physical Vectors

| Dataset | Description | Object Name | Notes |
|---------|-------------|-------------|-------|
| **Coastline** | Land/ocean boundary | `coastline` | Clean edge for ocean fill |
| **Land** | Continents/islands polygons | `land` | Ocean base layer inverse |
| **Ocean** | Ocean polygons | `ocean` | Alternative to land |
| **Lakes** | Freshwater bodies | `lakes` | Add to physical maps |
| **Rivers** | River centerlines | `rivers` | Flow networks |
| **Glaciated Areas** | Ice sheets | `glaciers` | Polar context |
| **Antarctic Ice Shelves** | Floating ice | `ice_shelves` | Antarctic detail |
| **Graticules** | Lat/lon grid lines | `graticules` | Reference grid |

### Derived/Convenience

| Dataset | Description |
|---------|-------------|
| **Bounding Boxes** | Country/region bounding boxes |
| **Scalerank** | Pre-calculated importance ranking for labels |
| **Label Points** | Optimized label placement points |

---

## Selection by Use Case

### Simple Country Choropleth
```javascript
// Use world-atlas
const world = await d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json");
const countries = topojson.feature(world, world.objects.countries);
```

### Map with Rivers and Lakes
```bash
# Download and convert physical features
wget https://naturalearthdata.com/http//www.naturalearthdata.com/download/50m/physical/ne_50m_rivers_lake_centerlines.zip
wget https://naturalearthdata.com/http//www.naturalearthdata.com/download/50m/physical/ne_50m_lakes.zip

# Convert both
ogr2ogr -f GeoJSON -t_srs EPSG:4326 rivers.json ne_50m_rivers_lake_centerlines.shp
ogr2ogr -f GeoJSON -t_srs EPSG:4326 lakes.json ne_50m_lakes.shp

# Combine into single TopoJSON
geo2topo rivers=rivers.json lakes=lakes.json > hydro.topojson
```

### Locator Globe with Graticule
```javascript
// Use D3's built-in graticule generator
const graticule = d3.geoGraticule10();

// Or from Natural Earth
const graticuleData = await d3.json("graticules-50m.json");
```

---

## CRS Notes

Natural Earth shapefiles ship in **WGS84 (EPSG:4326)** - lat/lon decimal degrees. 

**Always reproject when converting:**
```bash
ogr2ogr -f GeoJSON -t_srs EPSG:4326 output.json input.shp
```

Some shapefiles may have `.prj` files specifying other CRS - check with:
```bash
gdalsrsinfo input.shp
```

---

## File Size Reference

| Dataset | 110m | 50m | 10m |
|---------|------|-----|-----|
| Countries | 95KB | 440KB | 2.8MB |
| States | 20KB | 110KB | 2.1MB |
| Rivers | 180KB | 850KB | 4.5MB |
| Lakes | 45KB | 220KB | 1.8MB |
| Coastline | 240KB | 1.1MB | 5.2MB |
| Populated Places | 130KB | 600KB | 3.1MB |

---

## See Also

- [D3 Projections](d3-projections.md) - How to project this data
- Natural Earth: https://www.naturalearthdata.com
- world-atlas: https://github.com/topojson/world-atlas
- TopoJSON spec: https://github.com/topojson/topojson-specification
