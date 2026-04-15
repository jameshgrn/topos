# D3 Geo Projections Reference

Quick reference for D3 geo projections including function signatures, typical use cases, rotation parameters, and recommended scale ranges.

## Common Projections

### geoOrthographic
**Locator globes, satellite views, hemisphere maps**

```javascript
d3.geoOrthographic()
  .scale(240)           // Globe radius in pixels
  .translate([250, 250]) // Center point [x, y]
  .rotate([-lon, -lat])  // Center on [lon, lat] - note negation
  .clipAngle(90)        // Cut off back hemisphere
```

| Parameter | Description | Typical Range |
|-----------|-------------|---------------|
| `scale` | Radius of the globe in pixels | 150-400 |
| `rotate` | [λ, φ, γ] - longitude, latitude, roll | [-180..180, -90..90, -180..180] |
| `clipAngle` | Hemisphere cutoff (90° = half) | 90-180 |

**Notes**: Always use `clipAngle(90)` for globe effect. Rotate negates coordinates: `-lon, -lat` centers on that point.

---

### geoNaturalEarth1
**World maps, thematic global visualization**

```javascript
d3.geoNaturalEarth1()
  .scale(160)
  .translate([width / 2, height / 2])
  .center([0, 0])  // Optional fine-tuning
```

| Parameter | Description | Typical Range |
|-----------|-------------|---------------|
| `scale` | Overall scale factor | 100-250 for full world |
| `center` | [λ, φ] to center map | [-30..30, -20..20] |

**Notes**: Pseudo-cylindrical projection with rounded corners. Good compromise between area and shape distortion for world maps.

---

### geoMercator
**Web tiles, navigation charts, small areas near equator**

```javascript
d3.geoMercator()
  .scale(1000)
  .translate([width / 2, height / 2])
  .center([lon, lat])
  // Or use .rotate() for positioning
```

| Parameter | Description | Typical Range |
|-----------|-------------|---------------|
| `scale` | Scale factor | 1000-100000 for regional |
| `center` | [λ, φ] focal point | Any |

**Notes**: Cylindrical, conformal. Preserves angles (good for navigation). Severe area distortion near poles. Standard for web maps (Google, OSM, etc).

---

### geoAlbersUsa
**United States maps (includes Alaska/Hawaii insets)**

```javascript
d3.geoAlbersUsa()
  .scale(1000)
  .translate([width / 2, height / 2])
```

| Parameter | Description | Typical Range |
|-----------|-------------|---------------|
| `scale` | Scale factor | 500-2000 |

**Notes**: Composite projection with lower 48, Alaska, Hawaii, and Puerto Rico positioned automatically. Does NOT support `.center()` or `.rotate()` - use `.translate()` only.

---

### geoEquirectangular
**Data overlay, simple lat/lon grids, quick prototyping**

```javascript
d3.geoEquirectangular()
  .scale(width / (2 * Math.PI))
  .translate([width / 2, height / 2])
  .center([0, 0])
```

| Parameter | Description | Typical Range |
|-----------|-------------|---------------|
| `scale` | Scale factor | width/6.28 for full world |

**Notes**: Plate carrée. Direct mapping of lat/lon to x/y. Massive area distortion at high latitudes. Fast, simple, but rarely publication-ready.

---

### geoTransverseMercator
**UTM-like zones, north-south oriented regions**

```javascript
d3.geoTransverseMercator()
  .scale(5000)
  .translate([width / 2, height / 2])
  .rotate([-centralMeridian, 0, 0])
  .center([0, latitudeOfOrigin])
```

| Parameter | Description | Typical Range |
|-----------|-------------|---------------|
| `scale` | Scale factor | 1000-50000 |
| `rotate` | Central meridian (negated) | Varies by zone |

**Notes**: Cylindrical, rotated 90°. Use for tall skinny regions. Each zone ~6° wide. Conformal like Mercator but handles north-south extents better.

---

### geoAzimuthalEqualArea
**Polar regions, ocean basin maps, area comparison**

```javascript
d3.geoAzimuthalEqualArea()
  .scale(200)
  .translate([width / 2, height / 2])
  .rotate([0, -90])  // North pole
  // .rotate([0, 90])  // South pole
  .clipAngle(90)
```

| Parameter | Description | Typical Range |
|-----------|-------------|---------------|
| `scale` | Radius to edge of map | 100-500 |
| `rotate` | Center point | [0, -90] for North pole |

**Notes**: Equal-area, azimuthal. Shows true area relationships from a central point. Circular boundary. Great for polar regions.

---

### geoConicEqualArea
**East-west wide countries (USA, Russia, China)**

```javascript
d3.geoConicEqualArea()
  .parallels([29.5, 45.5])  // Standard parallels
  .scale(1000)
  .translate([width / 2, height / 2])
  .rotate([96, 0])  // Central meridian
  .center([0, 37.5])
```

| Parameter | Description | Typical Range |
|-----------|-------------|---------------|
| `parallels` | [φ1, φ2] standard parallels | ~1/6 and ~5/6 of N-S extent |
| `scale` | Scale factor | 500-5000 |
| `rotate` | Central meridian | Longitude of center |

**Notes**: Equal-area, conic. Choose standard parallels at ~1/6 and ~5/6 of your region's north-south extent. Albers is a specific conic equal-area optimized for US.

---

### geoStereographic
**Polar maps, hemisphere close-ups, astro charts**

```javascript
d3.geoStereographic()
  .scale(300)
  .translate([width / 2, height / 2])
  .rotate([0, -90])
  .clipAngle(120)
  .precision(0.1)
```

| Parameter | Description | Typical Range |
|-----------|-------------|---------------|
| `scale` | Scale factor | 200-1000 |
| `clipAngle` | Visible hemisphere | 90-180 |

**Notes**: Azimuthal, conformal. Projects from opposite pole (perspective projection). Can show >90° with clipAngle > 90.

---

## Clipping & Precision

### clipAngle
Controls the angular radius visible from the projection center.

```javascript
projection.clipAngle(90)   // Standard hemisphere
projection.clipAngle(180)  // Full sphere (some distortions visible)
projection.clipAngle(null) // No clipping (antimeridian issues)
```

| Value | Effect |
|-------|--------|
| 90 | Hemisphere only (globe look) |
| 120 | Extended hemisphere |
| 180 | Full sphere |
| null | No clip (use with `clipExtent`) |

### clipExtent
Rectangle clipping (useful for flat projections):

```javascript
projection.clipExtent([[x0, y0], [x1, y1]])
```

### precision
Controls line simplification/smoothing. Lower = more detail, slower.

```javascript
projection.precision(0.1)  // Default, good balance
projection.precision(0.5)  // Faster, less detail
projection.precision(0.01) // High detail for print
```

**Note**: Set precision BEFORE drawing paths for effect.

---

## Quick Selection Guide

| Map Type | Recommended Projection |
|----------|----------------------|
| Globe locator | `geoOrthographic` |
| World thematic | `geoNaturalEarth1` |
| Web slippy map | `geoMercator` |
| United States | `geoAlbersUsa` |
| Europe/Asia (E-W wide) | `geoConicEqualArea` |
| Arctic/Antarctic | `geoAzimuthalEqualArea` |
| Tall N-S region | `geoTransverseMercator` |
| Data overlay/quick hack | `geoEquirectangular` |
| Ocean basins | `geoAzimuthalEqualArea` |

---

## See Also

- [Natural Earth Data](natural-earth-data.md) - Data sources for these projections
- D3 docs: https://d3js.org/d3-geo
