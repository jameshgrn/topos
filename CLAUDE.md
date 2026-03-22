# Topos — Geospatial Computation Kernel

## What this is

A typed geospatial computation kernel in Rust with first-class spatial semantics and composable execution.

General-purpose spatial foundations first. Domain layers (hydro, remote sensing, terrain) come later as separate crates.

## Development philosophy

- Slowly. Methodically. Autistically precise.
- Every type, every invariant, every API surface gets deliberate thought before code.
- Ask before writing interfaces, data models, or public API.
- "Three domains besides hydrology" filter: if a feature isn't useful for 3+ domains, it belongs in a domain crate, not the kernel.

## Rust conventions

- Edition 2024
- `cargo clippy -- -D warnings` — zero warnings
- `cargo fmt` — rustfmt default style
- `cargo test` — target specific modules, not full suite
- Prefer `thiserror` for library errors, `anyhow` only in examples/bins
- No `unsafe` without justification comment
- Public API must have doc comments
- No feature flags unless actively needed

## Architecture

### Layer 1: Spatial foundations (this crate)
Coordinates, CRS, extents, transforms, grids, geometries, topology, masks

### Layer 2: Spatial computation model (this crate)
Expression graph, validation, alignment rules, lazy/eager execution

### Layer 3: Domain layers (future crates)
spatial-hydro, spatial-rs, spatial-terrain, etc.

## Core semantic object families

1. **Field** — value over space (rasters, surfaces)
2. **Geometry** — discrete shapes (point, line, polygon)
3. **Coverage** — collections with shared semantics (feature collections, tilings)
4. **Topology** — adjacency/connectivity (pure combinatorial in kernel)
5. **Transform** — operations over the above

## Key invariants the kernel enforces

- Objects must declare CRS
- Cross-object ops require compatible CRS or explicit transform
- Raster-raster ops require alignment or explicit resampling
- Masks and nodata propagate explicitly
- Geometry validity is not hand-waved

## Testing

- `cargo test -- module_name` for targeted runs
- Test behavior, not implementation
- Test edge cases and error paths
- Verify tests catch failures before trusting them

## Dependencies

- Be extremely conservative with deps
- Prefer no-std-compatible where possible
- Every dependency must justify its inclusion
