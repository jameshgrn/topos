---
name: gdal
description: GDAL/OGR command-line workflows for raster and vector geospatial processing. Inspection, reprojection, clipping, mosaics, COG creation, rasterization, and tiling.
---

# GDAL Skill

Use GDAL/OGR CLI tools for raster and vector geospatial processing.

## Tools

Pick the smallest tool that fits:

| Tool | Purpose |
|------|---------|
| `gdalinfo` | Raster metadata, bounds, CRS, band stats |
| `ogrinfo` | Vector metadata, layer list, schema, feature count |
| `gdalwarp` | Reproject, clip, resample, mosaic, COG output |
| `gdal_translate` | Band extract, format convert, thumbnail, compress |
| `gdalbuildvrt` | Virtual mosaic or band stack without copying data |
| `gdal_rasterize` | Burn vector into raster |
| `gdal2tiles.py` | XYZ tile pyramid from byte raster |
| `ogr2ogr` | Vector convert, reproject, clip, SQL filter |
| `gdaltindex` | Raster footprint as vector polygon |

If GDAL is not installed, ask the user to install it before continuing.

## Workflow

### 1. Always inspect first

```bash
gdalinfo INPUT.tif
ogrinfo INPUT.shp -so
```

### 2. Raster vs vector

- **Raster**: `gdalwarp`, `gdal_translate`, `gdalbuildvrt`, `gdal_rasterize`, `gdal2tiles.py`
- **Vector**: `ogr2ogr`, `ogrinfo`, `gdaltindex`

### 3. Write new output — never overwrite input

- Preserve CRS and nodata intentionally
- Use compression for large rasters (`-co COMPRESS=LZW -co PREDICTOR=2`)
- Use `-co BIGTIFF=YES` for anything > 4GB
- Use `-co NUM_THREADS=ALL_CPUS` for parallel compression

### 4. Validate output

```bash
gdalinfo OUTPUT.tif
ogrinfo OUTPUT.geojson -so
```

## Quick Reference

```bash
# === INSPECT ===
gdalinfo INPUT.tif
gdalinfo -stats INPUT.tif
ogrinfo INPUT.shp -so
ogrinfo INPUT.gpkg -sql "SELECT COUNT(*) FROM layer_name"

# === VECTOR ===
# Convert + reproject
ogr2ogr -f GeoJSON -t_srs EPSG:4326 OUTPUT.geojson INPUT.shp

# Clip vector to raster extent
gdaltindex -t_srs EPSG:4326 -f GeoJSON extent.geojson INPUT.tif
ogr2ogr -f GeoJSON -clipsrc extent.geojson OUTPUT.geojson INPUT.shp

# SQL filter
ogr2ogr -f GeoJSON -sql "SELECT * FROM layer WHERE area > 1000" OUTPUT.geojson INPUT.gpkg

# === RASTER ===
# Reproject
gdalwarp -t_srs EPSG:4326 INPUT.tif OUTPUT.tif

# Clip to shapefile
gdalwarp -cutline mask.shp -crop_to_cutline -dstalpha INPUT.tif OUTPUT.tif

# Extract bands (e.g. RGB from multiband)
gdal_translate -b 1 -b 2 -b 3 INPUT.tif OUTPUT.tif

# Thumbnail
gdal_translate -b 1 -b 2 -b 3 -of JPEG -outsize 400 0 INPUT.tif OUTPUT.jpg

# Quantize float to byte
gdal_translate -ot Byte -scale 0 4000 0 255 -co COMPRESS=LZW INPUT.tif OUTPUT.tif

# === MOSAIC / STACK ===
# Virtual mosaic
gdalbuildvrt mosaic.vrt path/to/tiffs/*.tif

# Band stack
gdalbuildvrt -separate stack.vrt band1.tif band2.tif band3.tif

# Materialize VRT
gdal_translate -co BIGTIFF=YES -co NUM_THREADS=ALL_CPUS -co COMPRESS=LZW -co PREDICTOR=2 mosaic.vrt OUTPUT.tif

# === COG ===
gdalwarp -of COG -co BIGTIFF=YES -co NUM_THREADS=ALL_CPUS -co COMPRESS=LZW -co PREDICTOR=2 INPUT.tif OUTPUT.tif

# === RASTERIZE / TILE ===
gdal_rasterize -burn 1.0 -ot Byte -tr 0.001 0.001 -co COMPRESS=LZW INPUT.shp OUTPUT.tif
gdal2tiles.py -z 10-16 INPUT_BYTE.tif tiles/
```

## River-specific patterns

```bash
# Extract river centerline mask from water classification raster
gdal_translate -b 1 -ot Byte -a_nodata 0 water_class.tif river_mask.tif

# Clip DEM to river corridor buffer
ogr2ogr -f GeoJSON buffer.geojson centerline.geojson -dialect SQLite \
  -sql "SELECT ST_Buffer(geometry, 0.01) AS geometry FROM centerline"
gdalwarp -cutline buffer.geojson -crop_to_cutline -dstalpha dem.tif corridor_dem.tif

# Merge SWOT pass rasters
gdalbuildvrt -input_file_list swot_passes.txt swot_mosaic.vrt
gdalwarp -of COG -co COMPRESS=LZW swot_mosaic.vrt swot_merged.tif
```

## References

- `references/gdal-recipes.md`
