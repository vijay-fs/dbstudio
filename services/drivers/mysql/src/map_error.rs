use dbstudio_core::DbError;
use sqlx::Error as SqlxError;

/// Normalize sqlx/MySQL errors into the engine-agnostic `DbError` taxonomy.
/// MySQL uses numeric error codes (e.g. 1045 = bad password, 1062 = duplicate
/// entry, 1146 = table doesn't exist). We bucket the common ones.
pub fn map_sqlx_error(err: SqlxError) -> DbError {
    match err {
        SqlxError::Io(e) => DbError::Io(e),
        SqlxError::PoolTimedOut => DbError::Timeout { seconds: 10 },
        SqlxError::PoolClosed => DbError::Connection("pool closed".into()),
        SqlxError::Database(ref db_err) => {
            let code = db_err.code().unwrap_or_default().to_string();
            let msg = db_err.message().to_string();
            match code.as_str() {
                // Auth failures
                "1045" => DbError::AuthFailed(msg),
                // Access denied (lacks privilege, etc.)
                "1044" | "1142" | "1143" => DbError::PermissionDenied(msg),
                // Duplicate entry / FK conflict / cannot drop FK / etc.
                "1062" | "1216" | "1217" | "1451" | "1452" => DbError::SchemaConflict(msg),
                // Table / column not found
                "1146" | "1054" | "1049" => DbError::NotFound(msg),
                // SQL syntax errors
                "1064" | "1149" => DbError::Syntax(msg),
                // `KILL QUERY <id>` aborts the running statement with
                // errno 1317 ("Query execution was interrupted"). Map it
                // to the engine-agnostic `Cancelled` so the UI uses the
                // muted "Query cancelled" panel rather than the red
                // "Query failed" one.
                "1317" => DbError::Cancelled,
                // Unknown / fallthrough
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
