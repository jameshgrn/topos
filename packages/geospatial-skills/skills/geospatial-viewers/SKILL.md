---
name: geospatial-viewers
description: Quick-look inspection of geospatial files from the terminal. Interactive raster/vector viewers and non-interactive terminal-inline previews via uvx.
---

# Geospatial Viewers

Three CLI tools for quick-look inspection of geospatial data. Run via `uvx` — no install needed.

| Tool | Purpose |
|------|---------|
| `viewtif` | Interactive Qt viewer for rasters (GeoTIFF, HDF, NetCDF) |
| `viewgeom` | Interactive Qt viewer for vector datasets |
| `viewinline` | Terminal-inline viewer (rasters, vectors, CSV, Parquet) |

## Choosing the right tool

- **Interactive zoom/pan/contrast?** → `viewtif` (raster) or `viewgeom` (vector)
- **Quick terminal preview?** → `viewinline` (no GUI, renders inline in iTerm2/Ghostty/WezTerm)
- **CSV/Parquet stats?** → `viewinline --describe`, `--hist`, `--sql`
- **Headless / SSH?** → `viewinline` (no X11 needed)

## Quick reference

```bash
# Raster
uvx viewtif image.tif
uvx viewtif image.tif --shapefile overlay.shp
uvx viewtif image.tif --rgb 4 3 2
uvx viewtif image.tif --vmin 280 --vmax 320
uvx viewtif huge.tif --scale 10

# NetCDF / HDF
uvx --from "viewtif[netcdf]" viewtif data.nc --subset 1 --timestep 100

# Remote raster
AWS_NO_SIGN_REQUEST=YES uvx --from "viewtif[geo]" viewtif s3://bucket/raster.tif

# Vector
uvx viewgeom boundaries.geojson
uvx viewgeom landuse.shp --column area_sqkm
uvx viewgeom data.geojson --filter "mag > 5"
uvx viewgeom data.geojson --duckdb "SELECT * FROM data WHERE mag > 5"

# Terminal inline
uvx viewinline file.tif --colormap
uvx viewinline sentinel2.tif --rgb 4 3 2
uvx viewinline boundaries.geojson --color-by population

# Data analysis
uvx viewinline data.csv --describe
uvx viewinline data.csv --hist area_km2 --bins 30
uvx viewinline data.csv --scatter lon lat
uvx viewinline data.csv --sql "SELECT state, AVG(income) FROM data GROUP BY state"

# Vector as table
uvx viewinline counties.shp --table --describe
uvx viewinline data.geoparquet --table --where "POP > 100000" --sort POP --desc

# Image gallery
uvx viewinline outputs/ --gallery 4x3
```
