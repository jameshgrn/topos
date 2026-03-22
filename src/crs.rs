//! Coordinate Reference System (CRS) identification.
//!
//! A CRS defines how coordinates map to locations on Earth. Without a CRS,
//! coordinates are just numbers — `(45.0, -93.0)` could be lat/lon in WGS84
//! or meters in some projected system.
//!
//! This module provides the [`Crs`] type, which identifies *which* CRS a
//! spatial object uses. It does NOT (yet) perform reprojection — that
//! requires a math library like PROJ. For now, `Crs` is an opaque identifier
//! used to enforce that operations only combine compatible spatial objects.

use std::fmt;

/// Identifies a coordinate reference system.
///
/// # Variants
///
/// - `Epsg(u32)` — an EPSG code. Most common. Examples:
///   - `4326` = WGS 84 (lat/lon, the GPS one)
///   - `32611` = UTM Zone 11N (meters)
///   - `3857` = Web Mercator (what Google Maps uses internally)
///
/// - `Wkt(String)` — Well-Known Text definition. A verbose text format that
///   fully describes the CRS. Used when no EPSG code exists.
///
/// - `Proj(String)` — A PROJ string like `"+proj=utm +zone=11 +datum=WGS84"`.
///   Older format, still common in GDAL/PROJ workflows.
///
/// # Equality
///
/// Two `Crs` values are equal only if they are the same variant with the
/// same value. We do NOT attempt cross-format equivalence (e.g., we won't
/// detect that `Epsg(4326)` and a WKT string for WGS84 are the same CRS).
/// That requires a PROJ dependency and is deferred to a later version.
///
/// # Rust concepts
///
/// `#[derive(Debug, Clone, PartialEq, Eq, Hash)]` auto-generates
/// implementations of common traits:
/// - `Debug`: lets you print with `{:?}` for debugging
/// - `Clone`: lets you make copies (CRS is cheap to clone for EPSG, heap-alloc for strings)
/// - `PartialEq + Eq`: lets you compare with `==`
/// - `Hash`: lets you use as a `HashMap` key
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum Crs {
    /// An EPSG code (e.g., 4326 for WGS 84).
    Epsg(u32),
    /// A Well-Known Text CRS definition.
    Wkt(String),
    /// A PROJ string CRS definition.
    Proj(String),
}

impl Crs {
    /// Creates a CRS from an EPSG code.
    ///
    /// # Examples
    ///
    /// ```
    /// use topos::Crs;
    ///
    /// let wgs84 = Crs::epsg(4326);
    /// let utm11n = Crs::epsg(32611);
    /// assert_ne!(wgs84, utm11n);
    /// ```
    #[must_use]
    pub const fn epsg(code: u32) -> Self {
        Self::Epsg(code)
    }

    /// Creates a CRS from a WKT string.
    #[must_use]
    pub fn wkt(wkt: String) -> Self {
        Self::Wkt(wkt)
    }

    /// Creates a CRS from a PROJ string.
    #[must_use]
    pub fn proj(proj: String) -> Self {
        Self::Proj(proj)
    }

    /// Returns the EPSG code if this is an `Epsg` variant.
    #[must_use]
    pub const fn as_epsg(&self) -> Option<u32> {
        match self {
            Self::Epsg(code) => Some(*code),
            _ => None,
        }
    }
}

/// Display format for error messages and logging.
///
/// # Rust concept: trait implementation
///
/// `fmt::Display` is Rust's trait for user-facing string formatting (the `{}`
/// placeholder in `format!`/`println!`). Every type that implements `Display`
/// can be printed, interpolated into strings, and used in error messages.
///
/// We implement it manually here because the auto-derived `Debug` format
/// (`Crs::Epsg(4326)`) is too verbose for error messages.
impl fmt::Display for Crs {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Epsg(code) => write!(f, "EPSG:{code}"),
            Self::Wkt(wkt) => {
                // Truncate long WKT strings in display
                if wkt.len() > 40 {
                    write!(f, "WKT[{}...]", &wkt[..37])
                } else {
                    write!(f, "WKT[{wkt}]")
                }
            }
            Self::Proj(proj) => write!(f, "PROJ[{proj}]"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn epsg_equality() {
        assert_eq!(Crs::epsg(4326), Crs::epsg(4326));
        assert_ne!(Crs::epsg(4326), Crs::epsg(32611));
    }

    #[test]
    fn different_variants_are_not_equal() {
        // Even if they might represent the same CRS in reality,
        // we don't do cross-format equivalence yet.
        let epsg = Crs::epsg(4326);
        let proj = Crs::proj("+proj=longlat +datum=WGS84".to_string());
        assert_ne!(epsg, proj);
    }

    #[test]
    fn display_formatting() {
        assert_eq!(Crs::epsg(4326).to_string(), "EPSG:4326");
        assert_eq!(
            Crs::proj("+proj=utm +zone=11".to_string()).to_string(),
            "PROJ[+proj=utm +zone=11]"
        );
    }

    #[test]
    fn as_epsg_returns_code_for_epsg_variant() {
        assert_eq!(Crs::epsg(4326).as_epsg(), Some(4326));
        assert_eq!(Crs::proj("+proj=utm".to_string()).as_epsg(), None);
    }
}
