---
name: d3-cartography
description: Generate publication-ready SVG maps with D3.js — locator globes, choropleths, thematic maps. Server-side via JSDOM or inline HTML. No QGIS needed.
---

# D3 Cartography Skill

Generate SVG maps programmatically with D3.js. Fast, lightweight, publication-ready output that can be dropped into Illustrator, papers, or the web.

## When to use

- Locator globes (orthographic projection, point + country highlight)
- Choropleths (country/region fill by data value)
- Thematic maps (rivers, basins, points of interest)
- Any map that's faster to code than to click through QGIS

## Core patterns

### Locator globe

Orthographic projection centered on a point, with Natural Earth country boundaries.

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <script src="https://d3js.org/topojson.v3.min.js"></script>
</head>
<body>
<script>
const width = 500, height = 500;
const lat = -21.2, lon = -175.2; // Tonga

const projection = d3.geoOrthographic()
  .scale(240)
  .translate([width / 2, height / 2])
  .rotate([-lon, -lat])
  .clipAngle(90);

const path = d3.geoPath(projection);

const svg = d3.select("body").append("svg")
  .attr("xmlns", "http://www.w3.org/2000/svg")
  .attr("width", width)
  .attr("height", height)
  .attr("viewBox", `0 0 ${width} ${height}`);

// Ocean + graticule
svg.append("path").datum({type: "Sphere"})
  .attr("d", path).attr("fill", "#e8f4f8").attr("stroke", "#ccc");
svg.append("path").datum(d3.geoGraticule10())
  .attr("d", path).attr("fill", "none").attr("stroke", "#ddd").attr("stroke-width", 0.5);

// Load Natural Earth TopoJSON (50m)
d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json").then(world => {
  const countries = topojson.feature(world, world.objects.countries);

  svg.selectAll("path.country")
    .data(countries.features)
    .join("path")
    .attr("class", "country")
    .attr("d", path)
    .attr("fill", "#d0d0d0")
    .attr("stroke", "#fff")
    .attr("stroke-width", 0.5);

  // Highlight target country
  // Use country numeric ID or filter by name from a lookup

  // Location marker
  const [px, py] = projection([lon, lat]);
  svg.append("circle")
    .attr("cx", px).attr("cy", py).attr("r", 5)
    .attr("fill", "red").attr("stroke", "#fff").attr("stroke-width", 1.5);

  // Label
  svg.append("text")
    .attr("x", px + 10).attr("y", py + 5)
    .attr("font-family", "sans-serif").attr("font-size", 14).attr("font-weight", "bold")
    .text("TONGA");
});
</script>
</body>
</html>
```

### Server-side SVG (Node.js + JSDOM)

For generating SVGs without a browser:

```typescript
import { JSDOM } from "jsdom";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import { readFileSync, writeFileSync } from "fs";

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
const document = dom.window.document;

const svg = d3.select(document.body).append("svg")
  .attr("xmlns", "http://www.w3.org/2000/svg")
  .attr("width", 500).attr("height", 500);

// ... same D3 code as above ...

writeFileSync("globe.svg", document.body.innerHTML);
```

### Choropleth

```javascript
const color = d3.scaleSequential(d3.interpolateYlOrRd)
  .domain([0, maxValue]);

svg.selectAll("path.country")
  .data(countries.features)
  .join("path")
  .attr("d", path)
  .attr("fill", d => {
    const val = dataMap.get(d.id);
    return val != null ? color(val) : "#eee";
  })
  .attr("stroke", "#fff")
  .attr("stroke-width", 0.3);
```

## Data sources

| Source | URL | Resolution |
|--------|-----|-----------|
| Natural Earth countries | `world-atlas` npm / `countries-50m.json` | 50m |
| Natural Earth countries (hi-res) | `countries-110m.json` or `countries-10m.json` | 110m / 10m |
| Rivers | Natural Earth rivers shapefiles → convert with `ogr2ogr` | 50m / 10m |
| Admin boundaries | Natural Earth admin-1 | 50m / 10m |

## Projections cheat sheet

| Projection | Use case |
|-----------|----------|
| `geoOrthographic` | Locator globes |
| `geoNaturalEarth1` | World maps |
| `geoMercator` | Web tiles, small areas |
| `geoAlbersUsa` | US maps |
| `geoEquirectangular` | Data overlay, simple lat/lon |
| `geoTransverseMercator` | UTM-like strips |

## SVG export tips

- Always set `xmlns="http://www.w3.org/2000/svg"` for standalone SVG files
- Use `viewBox` for scalability
- Embed fonts or convert text to paths for Illustrator compatibility
- Keep stroke widths thin (0.3-0.5px) for print
- Use `fill-rule: evenodd` for complex polygons with holes

## References

- `references/d3-projections.md`
- `references/natural-earth-data.md`
