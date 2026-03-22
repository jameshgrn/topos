//! Error types for topos operations.
//!
//! Every fallible operation in the kernel returns `Result<T, ToposError>`.
//! Errors are informative: they tell you what went wrong, what the inputs were,
//! and (where possible) what to do about it.

use thiserror::Error;

use crate::crs::Crs;

/// The main error type for all topos operations.
///
/// # Rust concept: enums
///
/// In Rust, an `enum` isn't just a list of integer constants like in C.
/// Each variant can carry data. This lets us express "what went wrong"
/// and "what were the inputs" in a single type-safe value.
///
/// The `#[derive(Error)]` macro from `thiserror` auto-generates the
/// `std::error::Error` trait implementation, and `#[error("...")]`
/// generates the `Display` formatting.
#[derive(Debug, Error)]
pub enum ToposError {
    /// Two spatial objects have incompatible CRS and no explicit transform was provided.
    #[error("CRS mismatch: expected {expected}, got {actual}")]
    CrsMismatch {
        /// The CRS that was expected (e.g., from the left operand).
        expected: Crs,
        /// The CRS that was actually encountered.
        actual: Crs,
    },

    /// An extent has invalid bounds (e.g., min > max).
    #[error("invalid extent: {reason}")]
    InvalidExtent {
        /// What specifically is wrong.
        reason: String,
    },

    /// An affine transform is degenerate (zero determinant, non-invertible).
    #[error("degenerate transform: {reason}")]
    DegenerateTransform {
        /// What makes the transform degenerate.
        reason: String,
    },

    /// Grid dimensions are invalid (zero rows/cols, mismatched extent).
    #[error("invalid grid: {reason}")]
    InvalidGrid {
        /// What specifically is wrong.
        reason: String,
    },

    /// A pixel or grid coordinate is out of bounds.
    #[error("index out of bounds: pixel ({row:.1}, {col:.1}) outside {rows}x{cols} grid")]
    IndexOutOfBounds {
        /// Computed pixel row (may be negative or fractional).
        row: f64,
        /// Computed pixel column (may be negative or fractional).
        col: f64,
        /// Grid row count.
        rows: usize,
        /// Grid column count.
        cols: usize,
    },

    /// A coordinate contains non-finite values (NaN or infinity).
    #[error("non-finite coordinate: {reason}")]
    NonFinite {
        /// What contained the non-finite value.
        reason: String,
    },
}

/// Convenience type alias so callers can write `Result<T>` instead of
/// `Result<T, ToposError>`.
///
/// # Rust concept: type aliases
///
/// `type Result<T> = std::result::Result<T, ToposError>` just means
/// "when someone writes `crate::Result<Foo>`, it expands to
/// `std::result::Result<Foo, ToposError>`." Saves typing.
pub type Result<T> = std::result::Result<T, ToposError>;
