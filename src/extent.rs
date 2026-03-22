//! Axis-aligned bounding boxes with CRS.
//!
//! An [`Extent2D`] defines a rectangular region in some coordinate reference
//! system. It is the spatial "where" of a dataset — the bounding box.
//!
//! Every extent carries its CRS because an extent without CRS is meaningless.
//! Operations that combine extents (intersection, union) require matching CRS.

use std::fmt;

use crate::coord::Coord2D;
use crate::crs::Crs;
use crate::error::{Result, ToposError};

/// An axis-aligned bounding box in a specific CRS.
///
/// Defined by its minimum (lower-left) and maximum (upper-right) corners.
///
/// # Invariants
///
/// - `min.x <= max.x`
/// - `min.y <= max.y`
/// - `crs` is always present
///
/// These invariants are enforced at construction time. You cannot create
/// an invalid `Extent2D`.
///
/// # Rust concept: private fields + constructor
///
/// The fields are private — you can't write `Extent2D { min: ..., max: ..., crs: ... }`
/// from outside this module. You MUST go through `Extent2D::new()`, which
/// validates the invariants. This is how Rust enforces "parse, don't validate" —
/// if you have an `Extent2D`, you know it's valid.
#[derive(Debug, Clone, PartialEq)]
pub struct Extent2D {
    min: Coord2D,
    max: Coord2D,
    crs: Crs,
}

impl Extent2D {
    /// Creates a new extent from min/max corners and CRS.
    ///
    /// # Errors
    ///
    /// Returns [`ToposError::InvalidExtent`] if `min.x > max.x` or `min.y > max.y`.
    ///
    /// # Examples
    ///
    /// ```
    /// use topos::{Extent2D, Crs, Coord2D};
    ///
    /// let extent = Extent2D::new(
    ///     Coord2D::new(-180.0, -90.0),
    ///     Coord2D::new(180.0, 90.0),
    ///     Crs::epsg(4326),
    /// ).unwrap();
    ///
    /// assert_eq!(extent.width(), 360.0);
    /// assert_eq!(extent.height(), 180.0);
    /// ```
    pub fn new(min: Coord2D, max: Coord2D, crs: Crs) -> Result<Self> {
        if min.x > max.x {
            return Err(ToposError::InvalidExtent {
                reason: format!("min_x ({}) > max_x ({})", min.x, max.x),
            });
        }
        if min.y > max.y {
            return Err(ToposError::InvalidExtent {
                reason: format!("min_y ({}) > max_y ({})", min.y, max.y),
            });
        }
        Ok(Self { min, max, crs })
    }

    /// The lower-left corner.
    #[must_use]
    pub const fn min(&self) -> Coord2D {
        self.min
    }

    /// The upper-right corner.
    #[must_use]
    pub const fn max(&self) -> Coord2D {
        self.max
    }

    /// The CRS of this extent.
    #[must_use]
    pub const fn crs(&self) -> &Crs {
        &self.crs
    }

    /// Width (`max_x - min_x`) in CRS units.
    #[must_use]
    pub fn width(&self) -> f64 {
        self.max.x - self.min.x
    }

    /// Height (`max_y - min_y`) in CRS units.
    #[must_use]
    pub fn height(&self) -> f64 {
        self.max.y - self.min.y
    }

    /// Whether a coordinate falls within this extent (inclusive).
    #[must_use]
    pub fn contains(&self, coord: Coord2D) -> bool {
        coord.x >= self.min.x
            && coord.x <= self.max.x
            && coord.y >= self.min.y
            && coord.y <= self.max.y
    }

    /// Intersection of two extents. Both must share the same CRS.
    ///
    /// Returns `None` if the extents don't overlap.
    ///
    /// # Errors
    ///
    /// Returns [`ToposError::CrsMismatch`] if the CRS values differ.
    pub fn intersection(&self, other: &Self) -> Result<Option<Self>> {
        if self.crs != other.crs {
            return Err(ToposError::CrsMismatch {
                expected: self.crs.clone(),
                actual: other.crs.clone(),
            });
        }

        let min_x = self.min.x.max(other.min.x);
        let min_y = self.min.y.max(other.min.y);
        let max_x = self.max.x.min(other.max.x);
        let max_y = self.max.y.min(other.max.y);

        if min_x > max_x || min_y > max_y {
            Ok(None)
        } else {
            // Safe to unwrap: we just checked min <= max
            Ok(Some(Self {
                min: Coord2D::new(min_x, min_y),
                max: Coord2D::new(max_x, max_y),
                crs: self.crs.clone(),
            }))
        }
    }

    /// Union (bounding box) of two extents. Both must share the same CRS.
    ///
    /// # Errors
    ///
    /// Returns [`ToposError::CrsMismatch`] if the CRS values differ.
    pub fn union(&self, other: &Self) -> Result<Self> {
        if self.crs != other.crs {
            return Err(ToposError::CrsMismatch {
                expected: self.crs.clone(),
                actual: other.crs.clone(),
            });
        }

        // Safe to construct directly: union of valid extents is always valid
        Ok(Self {
            min: Coord2D::new(self.min.x.min(other.min.x), self.min.y.min(other.min.y)),
            max: Coord2D::new(self.max.x.max(other.max.x), self.max.y.max(other.max.y)),
            crs: self.crs.clone(),
        })
    }
}

impl fmt::Display for Extent2D {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "Extent2D([{}, {}] -> [{}, {}], {})",
            self.min.x, self.min.y, self.max.x, self.max.y, self.crs
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn wgs84() -> Crs {
        Crs::epsg(4326)
    }

    fn utm11n() -> Crs {
        Crs::epsg(32611)
    }

    #[test]
    fn valid_extent() {
        let e = Extent2D::new(Coord2D::new(0.0, 0.0), Coord2D::new(1.0, 1.0), wgs84());
        assert!(e.is_ok());
    }

    #[test]
    fn invalid_extent_min_x_gt_max_x() {
        let e = Extent2D::new(Coord2D::new(1.0, 0.0), Coord2D::new(0.0, 1.0), wgs84());
        assert!(e.is_err());
    }

    #[test]
    fn invalid_extent_min_y_gt_max_y() {
        let e = Extent2D::new(Coord2D::new(0.0, 1.0), Coord2D::new(1.0, 0.0), wgs84());
        assert!(e.is_err());
    }

    #[test]
    fn width_and_height() {
        let e =
            Extent2D::new(Coord2D::new(10.0, 20.0), Coord2D::new(30.0, 50.0), wgs84()).unwrap();
        assert_eq!(e.width(), 20.0);
        assert_eq!(e.height(), 30.0);
    }

    #[test]
    fn contains_point() {
        let e =
            Extent2D::new(Coord2D::new(0.0, 0.0), Coord2D::new(10.0, 10.0), wgs84()).unwrap();

        assert!(e.contains(Coord2D::new(5.0, 5.0)));
        assert!(e.contains(Coord2D::new(0.0, 0.0))); // inclusive min
        assert!(e.contains(Coord2D::new(10.0, 10.0))); // inclusive max
        assert!(!e.contains(Coord2D::new(-1.0, 5.0))); // outside
    }

    #[test]
    fn intersection_overlapping() {
        let a =
            Extent2D::new(Coord2D::new(0.0, 0.0), Coord2D::new(10.0, 10.0), wgs84()).unwrap();
        let b =
            Extent2D::new(Coord2D::new(5.0, 5.0), Coord2D::new(15.0, 15.0), wgs84()).unwrap();

        let result = a.intersection(&b).unwrap().unwrap();
        assert_eq!(result.min(), Coord2D::new(5.0, 5.0));
        assert_eq!(result.max(), Coord2D::new(10.0, 10.0));
    }

    #[test]
    fn intersection_no_overlap() {
        let a =
            Extent2D::new(Coord2D::new(0.0, 0.0), Coord2D::new(1.0, 1.0), wgs84()).unwrap();
        let b =
            Extent2D::new(Coord2D::new(5.0, 5.0), Coord2D::new(6.0, 6.0), wgs84()).unwrap();

        assert!(a.intersection(&b).unwrap().is_none());
    }

    #[test]
    fn intersection_crs_mismatch() {
        let a =
            Extent2D::new(Coord2D::new(0.0, 0.0), Coord2D::new(1.0, 1.0), wgs84()).unwrap();
        let b =
            Extent2D::new(Coord2D::new(0.0, 0.0), Coord2D::new(1.0, 1.0), utm11n()).unwrap();

        assert!(a.intersection(&b).is_err());
    }

    #[test]
    fn union_extents() {
        let a =
            Extent2D::new(Coord2D::new(0.0, 0.0), Coord2D::new(5.0, 5.0), wgs84()).unwrap();
        let b =
            Extent2D::new(Coord2D::new(3.0, 3.0), Coord2D::new(10.0, 10.0), wgs84()).unwrap();

        let result = a.union(&b).unwrap();
        assert_eq!(result.min(), Coord2D::new(0.0, 0.0));
        assert_eq!(result.max(), Coord2D::new(10.0, 10.0));
    }

    #[test]
    fn union_crs_mismatch() {
        let a =
            Extent2D::new(Coord2D::new(0.0, 0.0), Coord2D::new(1.0, 1.0), wgs84()).unwrap();
        let b =
            Extent2D::new(Coord2D::new(0.0, 0.0), Coord2D::new(1.0, 1.0), utm11n()).unwrap();

        assert!(a.union(&b).is_err());
    }
}
