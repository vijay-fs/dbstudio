use dbstudio_core::DbError;
use sqlx::Error as SqlxError;

/// SQLite has a small set of error codes. Bucket the common ones; everything
/// else falls through to `Internal` so the raw message still surfaces.
pub fn map_sqlx_error(err: SqlxError) -> DbError {
    match err {
        SqlxError::Io(e) => DbError::Io(e),
        SqlxError::PoolTimedOut => DbError::Timeout { seconds: 10 },
        SqlxError::PoolClosed => DbError::Connection("pool closed".into()),
        SqlxError::Database(ref db_err) => {
            let code = db_err.code().unwrap_or_default().to_string();
            let msg = db_err.message().to_string();
            match code.as_str() {
                // Common SQLite extended error codes (cf. sqlite3.h)
                "1555" | "2067" | "1811" => DbError::SchemaConflict(msg), // CONSTRAINT_*
                "1" => {
                    // generic SQLITE_ERROR — message often distinguishes
                    if msg.contains("syntax") {
                        DbError::Syntax(msg)
                    } else if msg.contains("no such") {
                        DbError::NotFound(msg)
                    } else {
                        DbError::Internal(msg)
                    }
                }
                "13" => DbError::PermissionDenied(msg), // SQLITE_FULL
                "14" => DbError::Connection(msg),       // SQLITE_CANTOPEN
                _ => DbError::Internal(if code.is_empty() {
                    msg
                } else {
                    format!("[{code}] {msg}")
                }),
            }
        }
        SqlxError::RowNotFound => DbError::NotFound("no rows".into()),
        SqlxError::ColumnNotFound(c) => DbError::NotFound(format!("column not found: {c}")),
        SqlxError::Configuration(c) => DbError::InvalidInput(c.to_string()),
        other => DbError::Internal(other.to_string()),
    }
}
