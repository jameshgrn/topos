//! Grid definition — the spatial metadata of a raster.
//!
//! A [`GridDefinition`] describes the spatial layout of a regular grid:
//! how many rows and columns, where it sits in world coordinates, and
//! what CRS it uses. It's the raster's "shape + position" without any
//! pixel data.
//!
//! This separation is deliberate: the grid definition is lightweight and
//! can be compared, aligned, and validated before touching any data.

use crate::coord::Coord2D;
use crate::crs::Crs;
use crate::error::{Result, ToposError};
use crate::extent::Extent2D;
use crate::transform::AffineTransform;

/// The spatial definition of a regular 2D grid.
///
/// Combines dimensions (rows, cols), position (transform), and reference
/// system (CRS) into a single validated object.
///
/// # Invariants
///
/// - `rows > 0` and `cols > 0`
/// - Transform is non-degenerate (enforced by [`AffineTransform`])
///
/// # Rust concept: structs with owned data
///
/// `GridDefinition` owns its `Crs` and `AffineTransform`. When you create
/// a `GridDefinition`, the data is moved into it. This means there's no
/// question about lifetimes or dangling references — the grid definition
/// is self-contained.
#[derive(Debug, Clone, PartialEq)]
pub struct GridDefinition {
    rows: usize,
    cols: usize,
    transform: AffineTransform,
    crs: Crs,
}

impl GridDefinition {
    /// Creates a new grid definition.
    ///
    /// # Errors
    ///
    /// Returns [`ToposError::InvalidGrid`] if `rows` or `cols` is zero.
    ///
    /// # Examples
    ///
    /// ```
    /// use topos::{GridDefinition, AffineTransform, Crs};
    ///
    /// let transform = AffineTransform::north_up(-180.0, 90.0, 1.0, -1.0).unwrap();
    /// let grid = GridDefinition::new(180, 360, transform, Crs::epsg(4326)).unwrap();
    ///
    /// assert_eq!(grid.rows(), 180);
    /// assert_eq!(grid.cols(), 360);
    /// ```
    pub fn new(rows: usize, cols: usize, transform: AffineTransform, crs: Crs) -> Result<Self> {
        if rows == 0 {
            return Err(ToposError::InvalidGrid {
                reason: "rows must be > 0".to_string(),
            });
        }
        if cols == 0 {
            return Err(ToposError::InvalidGrid {
                reason: "cols must be > 0".to_string(),
            });
        }
        Ok(Self {
            rows,
            cols,
            transform,
            crs,
        })
    }

    /// Number of rows.
    #[must_use]
    pub const fn rows(&self) -> usize {
        self.rows
    }

    /// Number of columns.
    #[must_use]
    pub const fn cols(&self) -> usize {
        self.cols
    }

    /// Total number of cells (rows * cols).
    #[must_use]
    pub const fn cell_count(&self) -> usize {
        self.rows * self.cols
    }

    /// The affine transform.
    #[must_use]
    pub const fn transform(&self) -> &AffineTransform {
        &self.transform
    }

    /// The coordinate reference system.
    #[must_use]
    pub const fn crs(&self) -> &Crs {
        &self.crs
    }

    /// World coordinate of a pixel's upper-left corner.
    #[must_use]
    pub fn pixel_to_world(&self, row: usize, col: usize) -> Coord2D {
        // Precision loss only occurs for grids with >2^52 rows/cols,
        // which exceeds addressable memory regardless.
        #[allow(clippy::cast_precision_loss)]
        self.transform.pixel_to_world(row as f64, col as f64)
    }

    /// World coordinate of a pixel's center.
    #[must_use]
    pub fn pixel_center(&self, row: usize, col: usize) -> Coord2D {
        #[allow(clippy::cast_precision_loss)]
        let (r, c) = (row as f64 + 0.5, col as f64 + 0.5);
        self.transform.pixel_to_world(r, c)
    }

    /// Which pixel (row, col) contains the given world coordinate.
    ///
    /// # Errors
    ///
    /// Returns [`ToposError::IndexOutOfBounds`] if the coordinate falls
    /// outside the grid.
    pub fn world_to_pixel(&self, coord: Coord2D) -> Result<(usize, usize)> {
        let (row_f, col_f) = self.transform.world_to_pixel(coord);
        let row_floor = row_f.floor();
        let col_floor = col_f.floor();

        #[allow(clippy::cast_precision_loss)]
        let (nrows, ncols) = (self.rows as f64, self.cols as f64);

        if row_floor < 0.0 || row_floor >= nrows || col_floor < 0.0 || col_floor >= ncols {
            return Err(ToposError::IndexOutOfBounds {
                row: row_f,
                col: col_f,
                rows: self.rows,
                cols: self.cols,
            });
        }

        // Safe: we verified 0.0 <= floor < dimension, so the cast is in range.
        #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
        Ok((row_floor as usize, col_floor as usize))
    }

    /// Computes the spatial extent of this grid.
    ///
    /// For a north-up (non-rotated) grid, this is straightforward.
    /// For rotated grids, returns the axis-aligned bounding box of all
    /// four corners.
    ///
    /// # Panics
    ///
    /// Cannot panic: a grid with positive dimensions and non-degenerate
    /// transform always produces a valid extent.
    #[must_use]
    pub fn extent(&self) -> Extent2D {
        #[allow(clippy::cast_precision_loss)]
        let (rows_f, cols_f) = (self.rows as f64, self.cols as f64);

        let corners = [
            self.transform.pixel_to_world(0.0, 0.0),
            self.transform.pixel_to_world(0.0, cols_f),
            self.transform.pixel_to_world(rows_f, 0.0),
            self.transform.pixel_to_world(rows_f, cols_f),
        ];

        let min_x = corners.iter().map(|c| c.x).fold(f64::INFINITY, f64::min);
        let min_y = corners.iter().map(|c| c.y).fold(f64::INFINITY, f64::min);
        let max_x = corners
            .iter()
            .map(|c| c.x)
            .fold(f64::NEG_INFINITY, f64::max);
        let max_y = corners
            .iter()
            .map(|c| c.y)
            .fold(f64::NEG_INFINITY, f64::max);

        // Grid has positive dimensions and non-degenerate transform,
        // so min < max is guaranteed. The expect will never fire.
        Extent2D::new(
            Coord2D::new(min_x, min_y),
            Coord2D::new(max_x, max_y),
            self.crs.clone(),
        )
        .expect("grid with non-degenerate transform always produces valid extent")
    }

    /// Whether two grids are spatially aligned (same CRS, same transform,
    /// same dimensions).
    ///
    /// Aligned grids can have their pixels combined directly without
    /// resampling.
    #[must_use]
    pub fn is_aligned_with(&self, other: &Self) -> bool {
        self.crs == other.crs
            && self.rows == other.rows
            && self.cols == other.cols
            && self.transform == other.transform
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_grid() -> GridDefinition {
        let t = AffineTransform::north_up(100.0, 200.0, 10.0, -10.0).unwrap();
        GridDefinition::new(20, 30, t, Crs::epsg(32611)).unwrap()
    }

    #[test]
    fn dimensions() {
        let g = make_grid();
        assert_eq!(g.rows(), 20);
        assert_eq!(g.cols(), 30);
        assert_eq!(g.cell_count(), 600);
    }

    #[test]
    fn zero_rows_rejected() {
        let t = AffineTransform::north_up(0.0, 0.0, 1.0, -1.0).unwrap();
        assert!(GridDefinition::new(0, 10, t, Crs::epsg(4326)).is_err());
    }

    #[test]
    fn zero_cols_rejected() {
        let t = AffineTransform::north_up(0.0, 0.0, 1.0, -1.0).unwrap();
        assert!(GridDefinition::new(10, 0, t, Crs::epsg(4326)).is_err());
    }

    #[test]
    fn pixel_to_world_origin() {
        let g = make_grid();
        let world = g.pixel_to_world(0, 0);
        assert_eq!(world, Coord2D::new(100.0, 200.0));
    }

    #[test]
    fn pixel_center() {
        let g = make_grid();
        let center = g.pixel_center(0, 0);
        assert_eq!(center, Coord2D::new(105.0, 195.0));
    }

    #[test]
    fn world_to_pixel_roundtrip() {
        let g = make_grid();
        let center = g.pixel_center(5, 10);
        let (row, col) = g.world_to_pixel(center).unwrap();
        assert_eq!(row, 5);
        assert_eq!(col, 10);
    }

    #[test]
    fn world_to_pixel_out_of_bounds() {
        let g = make_grid();
        let result = g.world_to_pixel(Coord2D::new(0.0, 0.0));
        assert!(result.is_err());
    }

    #[test]
    fn extent_north_up() {
        let g = make_grid();
        let e = g.extent();
        // Origin at (100, 200), 30 cols * 10m wide, 20 rows * 10m tall (going down)
        assert_eq!(e.min(), Coord2D::new(100.0, 0.0)); // y: 200 + 20*(-10) = 0
        assert_eq!(e.max(), Coord2D::new(400.0, 200.0)); // x: 100 + 30*10 = 400
    }

    #[test]
    fn alignment_check() {
        let g1 = make_grid();
        let g2 = make_grid();
        assert!(g1.is_aligned_with(&g2));

        let t = AffineTransform::north_up(100.0, 200.0, 10.0, -10.0).unwrap();
        let g3 = GridDefinition::new(10, 30, t, Crs::epsg(32611)).unwrap();
        assert!(!g1.is_aligned_with(&g3));
    }

    #[test]
    fn extent_rotated_grid() {
        // 45-degree rotation: c1=cos(45)*res, c2=sin(45)*res, c4=-sin(45)*res, c5=cos(45)*res
        // For simplicity, use a known rotated transform
        let t = AffineTransform::new([0.0, 1.0, 1.0, 0.0, -1.0, 1.0]).unwrap();
        let g = GridDefinition::new(10, 10, t, Crs::epsg(32611)).unwrap();
        let e = g.extent();

        // Corners: (0,0)=(0,0), (0,10)=(10,-10), (10,0)=(10,10), (10,10)=(20,0)
        // Bounding box: x=[0,20], y=[-10,10]
        assert!((e.min().x - 0.0).abs() < 1e-10);
        assert!((e.min().y - (-10.0)).abs() < 1e-10);
        assert!((e.max().x - 20.0).abs() < 1e-10);
        assert!((e.max().y - 10.0).abs() < 1e-10);
    }

    #[test]
    fn world_to_pixel_negative_reports_actual_coords() {
        let g = make_grid();
        // (0, 0) is far outside the grid (grid origin is at (100, 200))
        let err = g.world_to_pixel(Coord2D::new(0.0, 0.0)).unwrap_err();
        let msg = err.to_string();
        // Should show negative pixel coordinates, not clamped zeros
        assert!(
            msg.contains("-"),
            "error should show negative coords: {msg}"
        );
    }
}
