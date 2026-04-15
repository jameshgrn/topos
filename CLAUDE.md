# topos

Monorepo for geospatial tooling.

## Repository Structure

```
topos/
├── packages/
│   ├── geo-renderer/        # TypeScript MCP server for D3/GDAL rendering
│   └── geospatial-skills/   # Claude Code skills as markdown SKILL.md files
└── plans/
    └── scaffold-complete.toml
```

## Packages

### geo-renderer

A lightweight MCP server for geospatial rendering. Provides:
- D3 SVG map generation
- Locator globe rendering
- GDAL-based geoprocessing

**Build Commands:**
```bash
cd packages/geo-renderer && npm run build
```

**Type Check:**
```bash
cd packages/geo-renderer && npx tsc --noEmit
```

### geospatial-skills

Pure markdown skill documentation for Claude Code. Contains SKILL.md files organized by topic:
- `d3-cartography/` — D3 cartography patterns
- `gdal/` — GDAL command references
- `geoparquet/` — GeoParquet handling
- `geospatial-viewers/` — Viewer integration patterns

**Note:** No build step required — content is consumed directly as markdown.

## Branch Strategy

- **Feature branches only** — All work must go through PRs from feature branches
- **Never push directly to `main`** — The main branch is protected

## Future

- `qgis-mcp` will be added later (lives separately for now)
