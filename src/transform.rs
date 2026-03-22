//! Affine transformations for pixel ↔ world coordinate mapping.
//!
//! An [`AffineTransform`] defines the mapping between pixel coordinates
//! (row, col) and world coordinates (x, y) in some CRS. This is the
//! "geo-transform" from GDAL.
//!
//! # GDAL convention
//!
//! GDAL defines a 6-parameter affine transform:
//! ```text
//! x_world = c0 + col * c1 + row * c2
//! y_world = c3 + col * c4 + row * c5
//! ```
//!
//! Where:
//! - `c0` = x-coordinate of the upper-left corner of the upper-left pixel
//! - `c1` = pixel width (x-resolution)
//! - `c2` = row rotation (usually 0)
//! - `c3` = y-coordinate of the upper-left corner of the upper-left pixel
//! - `c4` = column rotation (usually 0)
//! - `c5` = pixel height (y-resolution, usually negative because rows go downward)
//!
//! For a north-up image with no rotation, this simplifies to:
//! ```text
//! x = origin_x + col * pixel_width
//! y = origin_y + row * pixel_height   (pixel_height is negative)
//! ```

use crate::coord::Coord2D;
use crate::error::{Result, ToposError};

/// A 6-parameter affine transformation (GDAL convention).
///
/// Maps between pixel space `(row, col)` and world space `(x, y)`.
///
/// # Rust concept: arrays
///
/// `[f64; 6]` is a fixed-size array of exactly 6 `f64` values. Unlike a
/// `Vec<f64>`, the size is known at compile time and the data lives on
/// the stack (no heap allocation). Perfect for a fixed set of coefficients.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct AffineTransform {
    /// The 6 GDAL geo-transform coefficients: [c0, c1, c2, c3, c4, c5].
    coeffs: [f64; 6],
}

impl AffineTransform {
    /// Creates a new affine transform from 6 GDAL-convention coefficients.
    ///
    /// # Arguments
    ///
    /// * `coeffs` - `[origin_x, pixel_width, row_rotation, origin_y, col_rotation, pixel_height]`
    ///
    /// # Errors
    ///
    /// Returns [`ToposError::DegenerateTransform`] if the transform has zero
    /// determinant (non-invertible).
    ///
    /// # Examples
    ///
    /// ```
    /// use topos::AffineTransform;
    ///
    /// // A typical north-up raster: origin at (-180, 90), 1-degree pixels
    /// let t = AffineTransform::new([
    ///     -180.0,  // origin x
    ///     1.0,     // pixel width
    ///     0.0,     // row rotation
    ///     90.0,    // origin y
    ///     0.0,     // col rotation
    ///     -1.0,    // pixel height (negative = north-up)
    /// ]).unwrap();
    /// ```
    pub fn new(coeffs: [f64; 6]) -> Result<Self> {
        if let Some(i) = coeffs.iter().position(|c| !c.is_finite()) {
            return Err(ToposError::NonFinite {
                reason: format!("coefficient c{i} is {}", coeffs[i]),
            });
        }
        let det = coeffs[1] * coeffs[5] - coeffs[2] * coeffs[4];
        if det == 0.0 {
            return Err(ToposError::DegenerateTransform {
                reason: "determinant is exactly zero".to_string(),
            });
        }
        Ok(Self { coeffs })
    }

    /// Creates a north-up (no rotation) transform from origin and pixel size.
    ///
    /// This is the most common case: pixels aligned to the CRS axes,
    /// rows going top-to-bottom (negative pixel height).
    ///
    /// # Errors
    ///
    /// Returns [`ToposError::DegenerateTransform`] if pixel width or height is zero.
    pub fn north_up(
        origin_x: f64,
        origin_y: f64,
        pixel_width: f64,
        pixel_height: f64,
    ) -> Result<Self> {
        Self::new([origin_x, pixel_width, 0.0, origin_y, 0.0, pixel_height])
    }

    /// Converts pixel coordinates (row, col) to world coordinates (x, y).
    ///
    /// Note: `row` and `col` are `f64` to support sub-pixel positions
    /// (e.g., pixel center = row + 0.5, col + 0.5).
    #[must_use]
    pub fn pixel_to_world(&self, row: f64, col: f64) -> Coord2D {
        let x = self.coeffs[0] + col * self.coeffs[1] + row * self.coeffs[2];
        let y = self.coeffs[3] + col * self.coeffs[4] + row * self.coeffs[5];
        Coord2D::new(x, y)
    }

    /// Converts world coordinates (x, y) to pixel coordinates (row, col).
    ///
    /// Returns fractional pixel coordinates. Use `.floor() as usize` to get
    /// integer pixel indices.
    #[must_use]
    pub fn world_to_pixel(&self, coord: Coord2D) -> (f64, f64) {
        // Inverse of the affine transform:
        // x = c0 + col*c1 + row*c2
        // y = c3 + col*c4 + row*c5
        //
        // Solving for (row, col):
        let det = self.coeffs[1] * self.coeffs[5] - self.coeffs[2] * self.coeffs[4];
        let dx = coord.x - self.coeffs[0];
        let dy = coord.y - self.coeffs[3];
        let col = (dx * self.coeffs[5] - dy * self.coeffs[2]) / det;
        let row = (dy * self.coeffs[1] - dx * self.coeffs[4]) / det;
        (row, col)
    }

    /// The raw 6-element coefficient array.
    #[must_use]
    pub const fn coefficients(&self) -> &[f64; 6] {
        &self.coeffs
    }

    /// X-coordinate of the upper-left pixel origin.
    #[must_use]
    pub const fn origin_x(&self) -> f64 {
        self.coeffs[0]
    }

    /// Y-coordinate of the upper-left pixel origin.
    #[must_use]
    pub const fn origin_y(&self) -> f64 {
        self.coeffs[3]
    }

    /// Pixel width (x-resolution). May be negative.
    #[must_use]
    pub const fn pixel_width(&self) -> f64 {
        self.coeffs[1]
    }

    /// Pixel height (y-resolution). Usually negative for north-up images.
    #[must_use]
    pub const fn pixel_height(&self) -> f64 {
        self.coeffs[5]
    }

    /// Whether this transform has rotation (non-zero c2 or c4).
    #[must_use]
    pub fn is_rotated(&self) -> bool {
        self.coeffs[2] != 0.0 || self.coeffs[4] != 0.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn simple_transform() -> AffineTransform {
        // Origin at (100, 200), 10m pixels, north-up
        AffineTransform::north_up(100.0, 200.0, 10.0, -10.0).unwrap()
    }

    #[test]
    fn pixel_to_world_origin() {
        let t = simple_transform();
        // Pixel (0, 0) should map to the origin
        let world = t.pixel_to_world(0.0, 0.0);
        assert_eq!(world, Coord2D::new(100.0, 200.0));
    }

    #[test]
    fn pixel_to_world_offset() {
        let t = simple_transform();
        // Pixel row=1, col=2: x = 100 + 2*10 = 120, y = 200 + 1*(-10) = 190
        let world = t.pixel_to_world(1.0, 2.0);
        assert_eq!(world, Coord2D::new(120.0, 190.0));
    }

    #[test]
    fn pixel_to_world_center() {
        let t = simple_transform();
        // Center of pixel (0,0) is at (0.5, 0.5)
        let world = t.pixel_to_world(0.5, 0.5);
        assert_eq!(world, Coord2D::new(105.0, 195.0));
    }

    #[test]
    fn world_to_pixel_roundtrip() {
        let t = simple_transform();
        let world = Coord2D::new(130.0, 170.0);
        let (row, col) = t.world_to_pixel(world);
        let back = t.pixel_to_world(row, col);
        assert!((back.x - world.x).abs() < 1e-10);
        assert!((back.y - world.y).abs() < 1e-10);
    }

    #[test]
    fn degenerate_transform_rejected() {
        // Zero pixel width = degenerate
        let result = AffineTransform::new([0.0, 0.0, 0.0, 0.0, 0.0, 0.0]);
        assert!(result.is_err());
    }

    #[test]
    fn not_rotated() {
        let t = simple_transform();
        assert!(!t.is_rotated());
    }

    #[test]
    fn rotated() {
        let t = AffineTransform::new([0.0, 1.0, 0.5, 0.0, -0.5, 1.0]).unwrap();
        assert!(t.is_rotated());
    }

    #[test]
    fn accessors() {
        let t = simple_transform();
        assert_eq!(t.origin_x(), 100.0);
        assert_eq!(t.origin_y(), 200.0);
        assert_eq!(t.pixel_width(), 10.0);
        assert_eq!(t.pixel_height(), -10.0);
    }

    #[test]
    fn nan_coefficient_rejected() {
        let result = AffineTransform::new([0.0, 1.0, 0.0, 0.0, 0.0, f64::NAN]);
        assert!(result.is_err());
    }

    #[test]
    fn infinity_coefficient_rejected() {
        let result = AffineTransform::new([0.0, f64::INFINITY, 0.0, 0.0, 0.0, -1.0]);
        assert!(result.is_err());
    }

    #[test]
    fn world_to_pixel_known_values() {
        let t = simple_transform();
        // World (120, 190): col = (120-100)/10 = 2.0, row = (190-200)/(-10) = 1.0
        let (row, col) = t.world_to_pixel(Coord2D::new(120.0, 190.0));
        assert!((row - 1.0).abs() < 1e-10);
        assert!((col - 2.0).abs() < 1e-10);
    }

    #[test]
    fn world_to_pixel_fractional() {
        let t = simple_transform();
        // World (105, 195): center of pixel (0,0)
        let (row, col) = t.world_to_pixel(Coord2D::new(105.0, 195.0));
        assert!((row - 0.5).abs() < 1e-10);
        assert!((col - 0.5).abs() < 1e-10);
    }

    #[test]
    fn very_small_pixel_size_accepted() {
        // 1e-8 degree pixels (~1mm) should not be rejected as degenerate
        let result = AffineTransform::north_up(0.0, 0.0, 1e-8, -1e-8);
        assert!(result.is_ok());
    }
}
