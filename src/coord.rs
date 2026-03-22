//! 2D coordinate type.
//!
//! A [`Coord2D`] is the most primitive spatial building block: a pair of
//! `f64` values representing a position. On its own, a coordinate has no
//! CRS — it's just numbers. CRS context comes from the containing object
//! (an `Extent2D`, a `GridDefinition`, etc.).
//!
//! We define our own rather than using `(f64, f64)` tuples because:
//! - Named fields (`x`, `y`) are clearer than `.0`, `.1`
//! - We can implement spatial-specific methods
//! - We control the API surface

/// A 2D coordinate (x, y) in some coordinate reference system.
///
/// The interpretation of `x` and `y` depends on the CRS of the containing
/// spatial object:
/// - In geographic CRS (like EPSG:4326): x = longitude, y = latitude
/// - In projected CRS (like UTM): x = easting, y = northing
///
/// # Rust concepts
///
/// `Copy` means this type is trivially copyable — like an integer. When you
/// assign a `Coord2D` to another variable, both variables hold independent
/// copies. This is appropriate because `Coord2D` is just two `f64`s (16 bytes).
///
/// We can't derive `Eq` or `Hash` because `f64` doesn't implement them
/// (due to `NaN != NaN`). We derive `PartialEq` which gives us `==` but
/// allows the possibility that `a != a` (if coordinates contain NaN).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Coord2D {
    /// The x-coordinate (longitude or easting).
    pub x: f64,
    /// The y-coordinate (latitude or northing).
    pub y: f64,
}

impl Coord2D {
    /// Creates a new 2D coordinate.
    ///
    /// # Examples
    ///
    /// ```
    /// use topos::Coord2D;
    ///
    /// // A point in WGS84 (lon, lat)
    /// let paris = Coord2D::new(2.3522, 48.8566);
    /// assert_eq!(paris.x, 2.3522);
    /// assert_eq!(paris.y, 48.8566);
    /// ```
    #[must_use]
    pub const fn new(x: f64, y: f64) -> Self {
        Self { x, y }
    }

    /// Euclidean distance to another coordinate.
    ///
    /// This is planar distance — meaningful in projected CRS (meters),
    /// but NOT meaningful for geographic CRS (degrees). The caller is
    /// responsible for knowing which CRS they're in.
    #[must_use]
    pub fn distance_to(self, other: Self) -> f64 {
        let dx = self.x - other.x;
        let dy = self.y - other.y;
        dx.hypot(dy)
    }
}

impl From<(f64, f64)> for Coord2D {
    fn from((x, y): (f64, f64)) -> Self {
        Self { x, y }
    }
}

impl From<Coord2D> for (f64, f64) {
    fn from(c: Coord2D) -> Self {
        (c.x, c.y)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn construction_and_access() {
        let c = Coord2D::new(1.0, 2.0);
        assert_eq!(c.x, 1.0);
        assert_eq!(c.y, 2.0);
    }

    #[test]
    fn from_tuple() {
        let c: Coord2D = (3.0, 4.0).into();
        assert_eq!(c, Coord2D::new(3.0, 4.0));
    }

    #[test]
    fn to_tuple() {
        let c = Coord2D::new(3.0, 4.0);
        let t: (f64, f64) = c.into();
        assert_eq!(t, (3.0, 4.0));
    }

    #[test]
    fn distance_3_4_5_triangle() {
        let a = Coord2D::new(0.0, 0.0);
        let b = Coord2D::new(3.0, 4.0);
        let dist = a.distance_to(b);
        assert!((dist - 5.0).abs() < f64::EPSILON);
    }

    #[test]
    fn distance_to_self_is_zero() {
        let c = Coord2D::new(42.0, -17.5);
        assert_eq!(c.distance_to(c), 0.0);
    }
}
