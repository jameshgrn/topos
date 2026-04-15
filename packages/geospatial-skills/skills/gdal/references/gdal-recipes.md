# GDAL Extended Recipes

Detailed, copy-paste-ready GDAL workflows for advanced geospatial processing.

---

## COG Creation with Multiple Compression Options

### LZW (Best for general use, fast)
```bash
gdalwarp -of COG \
  -co COMPRESS=LZW \
  -co PREDICTOR=2 \
  -co NUM_THREADS=ALL_CPUS \
  -co BIGTIFF=YES \
  -co RESAMPLING=NEAREST \
  INPUT.tif OUTPUT_COG_LZW.tif
```

### DEFLATE (Better compression, slower)
```bash
gdalwarp -of COG \
  -co COMPRESS=DEFLATE \
  -co PREDICTOR=2 \
  -co LEVEL=9 \
  -co NUM_THREADS=ALL_CPUS \
  -co BIGTIFF=YES \
  INPUT.tif OUTPUT_COG_DEFLATE.tif
```

### ZSTD (Best compression, GDAL 3.4+)
```bash
gdalwarp -of COG \
  -co COMPRESS=ZSTD \
  -co PREDICTOR=2 \
  -co ZSTD_LEVEL=9 \
  -co NUM_THREADS=ALL_CPUS \
  -co BIGTIFF=YES \
  INPUT.tif OUTPUT_COG_ZSTD.tif
```

### JPEG (For 3-band RGB only)
```bash
gdalwarp -of COG \
  -co COMPRESS=JPEG \
  -co QUALITY=85 \
  -co NUM_THREADS=ALL_CPUS \
  -b 1 -b 2 -b 3 \
  INPUT_RGB.tif OUTPUT_COG_JPEG.tif
```

### WEBP (Smaller than JPEG, GDAL 3.4+)
```bash
gdalwarp -of COG \
  -co COMPRESS=WEBP \
  -co QUALITY=85 \
  -co NUM_THREADS=ALL_CPUS \
  -b 1 -b 2 -b 3 \
  INPUT_RGB.tif OUTPUT_COG_WEBP.tif
```

### Convert existing file to COG in-place (overwrite)
```bash
gdalwarp -of COG \
  -co COMPRESS=LZW \
  -co PREDICTOR=2 \
  -co NUM_THREADS=ALL_CPUS \
  INPUT.tif INPUT.tif
```

---

## VRT Mosaics from File Lists

### Create file list from directory
```bash
ls -1 /path/to/rasters/*.tif > raster_list.txt
```

### Simple virtual mosaic
```bash
gdalbuildvrt -input_file_list raster_list.txt mosaic.vrt
```

### Mosaic with explicit resolution and extent
```bash
gdalbuildvrt \
  -input_file_list raster_list.txt \
  -resolution user \
  -tr 0.0001 0.0001 \
  -te xmin ymin xmax ymax \
  mosaic.vrt
```

### Mosaic with nodata handling
```bash
gdalbuildvrt \
  -input_file_list raster_list.txt \
  -srcnodata 0 \
  -vrtnodata 0 \
  -hidenodata \
  mosaic.vrt
```

### VRT with spatial resolution matching a reference
```bash
REF_RES=$(gdalinfo REFERENCE.tif | grep "Pixel Size" | grep -oE '[0-9.]+' | head -1)
gdalbuildvrt \
  -input_file_list raster_list.txt \
  -resolution user \
  -tr $REF_RES $REF_RES \
  mosaic.vrt
```

### Materialize VRT to GeoTIFF
```bash
gdal_translate \
  -co BIGTIFF=YES \
  -co NUM_THREADS=ALL_CPUS \
  -co COMPRESS=LZW \
  -co PREDICTOR=2 \
  mosaic.vrt mosaic.tif
```

### VRT with overviews (for faster display)
```bash
gdalbuildvrt -input_file_list raster_list.txt mosaic.vrt
gdaladdo -r nearest mosaic.vrt 2 4 8 16 32 64
```

---

## River Corridor Extraction

### Full pipeline: buffer centerline + clip DEM

#### Step 1: Create buffer around centerline (GeoJSON)
```bash
# Buffer in degrees (for geographic CRS)
ogr2ogr -f GeoJSON \
  -dialect SQLite \
  -sql "SELECT ST_Buffer(geometry, 0.01) AS geometry FROM centerline" \
  corridor_buffer_1km.geojson \
  centerline.geojson
```

#### Step 2: Buffer in meters (projected CRS recommended)
```bash
# First reproject centerline to UTM
ogr2ogr -f GeoJSON -t_srs EPSG:32633 \
  centerline_utm.geojson \
  centerline.geojson

# Buffer by 500 meters
ogr2ogr -f GeoJSON \
  -dialect SQLite \
  -sql "SELECT ST_Buffer(geometry, 500) AS geometry FROM centerline_utm" \
  corridor_buffer_500m.geojson \
  centerline_utm.geojson
```

#### Step 3: Clip DEM to buffered corridor
```bash
gdalwarp \
  -cutline corridor_buffer_500m.geojson \
  -crop_to_cutline \
  -dstnodata -9999 \
  -co COMPRESS=LZW \
  -co PREDICTOR=2 \
  dem.tif corridor_dem.tif
```

#### Step 4: Alternative - clip with pixel buffer (no vector buffer)
```bash
# Use rasterize to create mask, then mask the DEM
gdal_rasterize \
  -burn 1 \
  -ot Byte \
  -tr 30 30 \
  -te $(gdalinfo dem.tif | grep "Lower Left" | grep -oE '[0-9.-]+' | tr '\n' ' ') \
  $(gdalinfo dem.tif | grep "Upper Right" | grep -oE '[0-9.-]+' | tr '\n' ' ') \
  centerline.geojson centerline_mask.tif

# Buffer the mask using gdalwarp (simplified - for full buffer use numpy/gdal_calc)
gdalwarp -of GTiff -co COMPRESS=LZW centerline_mask.tif centerline_mask_buffer.tif

# Mask the DEM
gdal_calc.py -A dem.tif -B centerline_mask_buffer.tif \
  --outfile corridor_dem.tif \
  --calc "A * B" \
  --NoDataValue=-9999 \
  --co COMPRESS=LZW
```

---

## SWOT Pass Merging

### Merge multiple SWOT pass files into single mosaic

#### Step 1: Create file list of SWOT passes
```bash
ls -1 /data/swot/*_SWOT_L2_HR_Raster_*.nc > swot_passes.txt
cat swot_passes.txt
```

#### Step 2: Build VRT from NetCDF subdatasets (elevation example)
```bash
# Create VRT with explicit subdataset reference
gdalbuildvrt \
  -input_file_list swot_passes.txt \
  -sd 1 \
  -srcnodata -999999 \
  -vrtnodata -999999 \
  swot_elevation.vrt
```

#### Step 3: Merge to COG with proper nodata
```bash
gdalwarp \
  -of COG \
  -co COMPRESS=LZW \
  -co PREDICTOR=2 \
  -co NUM_THREADS=ALL_CPUS \
  -co BIGTIFF=YES \
  -srcnodata -999999 \
  -dstnodata -999999 \
  -ot Float32 \
  swot_elevation.vrt swot_elevation_merged.tif
```

#### Step 4: Alternative - direct merge without VRT intermediate
```bash
gdalwarp \
  -of COG \
  -co COMPRESS=LZW \
  -co PREDICTOR=2 \
  -co NUM_THREADS=ALL_CPUS \
  $(cat swot_passes.txt | sed 's/^/NETCDF:/; s/:$/:/') \
  swot_elevation_merged.tif
```

#### Step 5: Extract and merge specific band from NetCDF
```bash
# For SWOT water mask (typically different subdataset)
gdalwarp \
  -of COG \
  -b 1 \
  -co COMPRESS=LZW \
  $(cat swot_passes.txt | sed 's/^/NETCDF:/') \
  swot_watermask_merged.tif
```

---

## Float-to-Byte Quantization

### Linear scale to byte (0-255)

#### Method 1: gdal_translate with scale (static range)
```bash
# Scale from input range 0-4000 to output 0-255
gdal_translate \
  -ot Byte \
  -scale 0 4000 0 255 \
  -co COMPRESS=LZW \
  INPUT_FLOAT.tif OUTPUT_BYTE.tif
```

#### Method 2: gdal_translate with automatic scale
```bash
# Auto-scale based on min/max values in source
gdal_translate \
  -ot Byte \
  -scale \
  -co COMPRESS=LZW \
  INPUT_FLOAT.tif OUTPUT_BYTE.tif
```

#### Method 3: gdal_calc.py (percentile-based for better contrast)
```bash
# First get percentiles
gdalinfo -mm INPUT_FLOAT.tif 2>/dev/null

# Scale using custom range
gdal_calc.py \
  -A INPUT_FLOAT.tif \
  --outfile OUTPUT_BYTE.tif \
  --calc "numpy.clip((A - 10) / (90 - 10) * 255, 0, 255).astype(numpy.uint8)" \
  --co COMPRESS=LZW \
  --NoDataValue=0
```

### Logarithmic quantization (for data with wide dynamic range)
```bash
gdal_calc.py \
  -A INPUT_FLOAT.tif \
  --outfile OUTPUT_BYTE.tif \
  --calc "(numpy.log1p(A) / numpy.log1p(A.max())) * 255" \
  --co COMPRESS=LZW \
  --NoDataValue=0 \
  --type Byte
```

### Quantize with nodata preservation
```bash
gdal_translate \
  -ot Byte \
  -scale -50 100 0 255 \
  -a_nodata 0 \
  -co COMPRESS=LZW \
  INPUT_FLOAT.tif OUTPUT_BYTE.tif
```

---

## Band Math with gdal_calc.py

### Basic operations

#### Single band calculation (convert units)
```bash
gdal_calc.py \
  -A INPUT.tif \
  --outfile OUTPUT.tif \
  --calc "A * 0.0001" \
  --NoDataValue=-9999 \
  --co COMPRESS=LZW
```

#### Two band operations
```bash
gdal_calc.py \
  -A band1.tif -B band2.tif \
  --outfile result.tif \
  --calc "A + B" \
  --NoDataValue=-9999 \
  --co COMPRESS=LZW
```

#### NDVI calculation
```bash
gdal_calc.py \
  -A NIR.tif -B RED.tif \
  --outfile NDVI.tif \
  --calc "numpy.where((A + B) == 0, 0, (A - B) / (A + B))" \
  --NoDataValue=-9999 \
  --type Float32 \
  --co COMPRESS=LZW
```

#### Mask application (A where B > threshold)
```bash
gdal_calc.py \
  -A INPUT.tif -B MASK.tif \
  --outfile masked_result.tif \
  --calc "numpy.where(B > 0.5, A, -9999)" \
  --NoDataValue=-9999 \
  --co COMPRESS=LZW
```

#### Multi-band index calculation
```bash
gdal_calc.py \
  -A GREEN.tif -B RED.tif -C NIR.tif -D SWIR1.tif \
  --outfile NDWI.tif \
  --calc "(GREEN - NIR) / (GREEN + NIR)" \
  --NoDataValue=-9999 \
  --type Float32 \
  --co COMPRESS=LZW
```

#### Conditional logic
```bash
gdal_calc.py \
  -A ELEVATION.tif -B WATER_MASK.tif \
  --outfile FLOOD_DEPTH.tif \
  --calc "numpy.where((B == 1) & (A < 100), 100 - A, 0)" \
  --NoDataValue=0 \
  --type Float32 \
  --co COMPRESS=LZW
```

#### Band extraction with calculation
```bash
gdal_calc.py \
  -A MULTIBAND.tif \
  --outfile RED_EDGE.tif \
  --calc "A" \
  --A_band=5 \
  --co COMPRESS=LZW
```

---

## Batch Processing Patterns with Shell Loops

### Process all files in directory

#### Basic loop over all GeoTIFFs
```bash
for file in /path/to/input/*.tif; do
  filename=$(basename "$file" .tif)
  gdalwarp -t_srs EPSG:4326 "$file" "/path/to/output/${filename}_4326.tif"
done
```

#### Parallel processing with GNU parallel
```bash
ls /path/to/input/*.tif | parallel \
  'filename=$(basename {.} .tif); gdalwarp -t_srs EPSG:4326 {} /path/to/output/{}_4326.tif'
```

#### Reproject with specific options
```bash
for file in /data/raw/*.tif; do
  filename=$(basename "$file")
  gdalwarp \
    -t_srs EPSG:3857 \
    -tr 10 10 \
    -r bilinear \
    -co COMPRESS=LZW \
    -co BIGTIFF=YES \
    "$file" "/data/processed/webmerc_${filename}"
done
```

#### Batch COG conversion
```bash
for file in /data/raw/*.tif; do
  filename=$(basename "$file" .tif)
  gdalwarp \
    -of COG \
    -co COMPRESS=LZW \
    -co PREDICTOR=2 \
    -co NUM_THREADS=ALL_CPUS \
    "$file" "/data/cog/${filename}_cog.tif"
done
```

#### Batch extract bands
```bash
for file in /data/sentinel2/*.tif; do
  filename=$(basename "$file" .tif)
  # Extract RGB bands
  gdal_translate \
    -b 4 -b 3 -b 2 \
    -co COMPRESS=LZW \
    "$file" "/data/rgb/${filename}_rgb.tif"
done
```

#### Batch file format conversion
```bash
for file in /data/ecw/*.ecw; do
  filename=$(basename "$file" .ecw)
  gdal_translate \
    -co COMPRESS=DEFLATE \
    -co TILED=YES \
    "$file" "/data/geotiff/${filename}.tif"
done
```

#### Process with file list from text file
```bash
cat processing_list.txt | while read file; do
  filename=$(basename "$file" .tif)
  gdalwarp \
    -cutline study_area.shp \
    -crop_to_cutline \
    -co COMPRESS=LZW \
    "$file" "/output/clipped/${filename}_clipped.tif"
done
```

#### Batch rasterize vectors
```bash
for file in /vectors/shapefiles/*.shp; do
  filename=$(basename "$file" .shp)
  gdal_rasterize \
    -burn 1 \
    -ot Byte \
    -tr 0.001 0.001 \
    -co COMPRESS=LZW \
    "$file" "/output/rasters/${filename}.tif"
done
```

#### Conditional processing (skip if output exists)
```bash
for file in /input/*.tif; do
  filename=$(basename "$file" .tif)
  output="/output/${filename}_processed.tif"
  
  if [ ! -f "$output" ]; then
    gdalwarp \
      -t_srs EPSG:4326 \
      -co COMPRESS=LZW \
      "$file" "$output"
  else
    echo "Skipping $filename (already exists)"
  fi
done
```

#### Batch gdal_calc.py with pattern
```bash
for a in /input/nir/*.tif; do
  b="/input/red/$(basename $a)"
  output="/output/ndvi/$(basename $a)"
  
  if [ -f "$b" ]; then
    gdal_calc.py \
      -A "$a" -B "$b" \
      --outfile "$output" \
      --calc "(A - B) / (A + B)" \
      --NoDataValue=-9999 \
      --type Float32 \
      --co COMPRESS=LZW
  fi
done
```

---

## Performance Tips

### Check block size for tiling
```bash
gdalinfo INPUT.tif | grep "Block="
```

### Optimal tiling (match block size)
```bash
gdalwarp \
  -co TILED=YES \
  -co BLOCKXSIZE=512 \
  -co BLOCKYSIZE=512 \
  INPUT.tif OUTPUT.tif
```

### Verify COG tiling
```bash
gdalinfo OUTPUT_COG.tif | grep "OVERVIEWS"
gdalinfo OUTPUT_COG.tif | grep "INTERLEAVE"
```
