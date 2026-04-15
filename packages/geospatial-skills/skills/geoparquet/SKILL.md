---
name: geoparquet
description: Inspect, validate, optimize, and distribute GeoParquet files with gpio CLI and DuckDB spatial SQL.
---

# GeoParquet Skill

Work with GeoParquet files using `gpio` (preferred) and DuckDB for heavier SQL.

## Tools

### gpio (geoparquet-io) — preferred

```bash
uvx --from geoparquet-io gpio inspect <file>
```

Or install globally:

```bash
uv tool install geoparquet-io
```

### DuckDB — for complex SQL, joins, geometry ops

When using DuckDB, apply best practices manually:

- `ORDER BY ST_Hilbert(geometry)` for spatial locality
- `COMPRESSION ZSTD` with `COMPRESSION_LEVEL 15`
- `ROW_GROUP_SIZE 100000`
- Validate output with `gpio check all`

## Workflow

### 1. Inspect

```bash
gpio inspect <file>
gpio inspect stats <file>
```

### 2. Convert / optimize

```bash
gpio convert geoparquet <input> <output>
gpio convert geoparquet <input> <output> --compression-level 15
```

### 3. Validate

```bash
gpio check all <file>
gpio check all <file> --fix --output <fixed>
```

### 4. Scale based on size

- **Small** (< 100MB): single file, Hilbert sorted, bbox column
- **Medium** (100MB–1GB): single file, covering metadata, compression level 15
- **Large** (> 1GB): partition with kdtree/admin/quadkey, generate STAC catalog

### 5. Spatial extract

```bash
gpio extract <input> <output> --bbox "minx,miny,maxx,maxy"
gpio extract <input> <output> --where "column > value"
```

### 6. Publish

```bash
gpio partition kdtree <input> <output_dir> --max-rows-per-file 500000
gpio publish stac <input> <output.json>
```

## DuckDB spatial patterns

```sql
-- Load spatial extension
INSTALL spatial; LOAD spatial;

-- Read GeoParquet
SELECT * FROM read_parquet('data.parquet') LIMIT 10;

-- Spatial filter
SELECT * FROM read_parquet('data.parquet')
WHERE ST_Intersects(geometry, ST_GeomFromText('POLYGON((...))'));

-- Export optimized GeoParquet
COPY (
  SELECT * FROM read_parquet('input.parquet')
  ORDER BY ST_Hilbert(geometry)
) TO 'output.parquet' (
  FORMAT PARQUET,
  COMPRESSION ZSTD,
  COMPRESSION_LEVEL 15,
  ROW_GROUP_SIZE 100000
);
```
