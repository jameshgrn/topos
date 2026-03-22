//! Topos — a typed geospatial computation kernel.
//!
//! Provides first-class spatial semantics with composable execution
//! for coordinates, grids, geometries, and spatial operations.
//!
//! # Core types
//!
//! - [`Crs`] — coordinate reference system identifier
//! - [`Coord2D`] — a 2D coordinate (x, y)
//! - [`Extent2D`] — axis-aligned bounding box with CRS
//! - [`AffineTransform`] — pixel ↔ world coordinate mapping (GDAL convention)
//! - [`GridDefinition`] — spatial metadata of a regular grid
//!
//! # Design principles
//!
//! - Every spatial object carries its CRS
//! - Cross-object operations require compatible CRS or explicit transform
//! - Invalid states are unrepresentable (validated at construction)
//! - Errors are informative and actionable

pub mod coord;
pub mod crs;
pub mod error;
pub mod extent;
pub mod grid;
pub mod transform;

// Re-export core types at the crate root for ergonomic access.
// Users can write `use topos::Crs` instead of `use topos::crs::Crs`.
pub use coord::Coord2D;
pub use crs::Crs;
pub use error::{Result, ToposError};
pub use extent::Extent2D;
pub use grid::GridDefinition;
pub use transform::AffineTransform;
