use dbstudio_core::DbError;
use sqlx::Error as SqlxError;

/// Normalize sqlx errors into the engine-agnostic `DbError` taxonomy so the
/// frontend can render consistent UI regardless of which driver raised them.
pub fn map_sqlx_error(err: SqlxError) -> DbError {
    match err {
        SqlxError::Io(e) => DbError::Io(e),
        SqlxError::PoolTimedOut => DbError::Timeout { seconds: 10 },
        SqlxError::PoolClosed => DbError::Connection("pool closed".into()),
        SqlxError::Database(ref db_err) => {
            let code = db_err.code().unwrap_or_default().to_string();
            let msg = db_err.message().to_string();
            // SQLSTATE 57014 = `query_canceled` — raised when another
            // session calls pg_cancel_backend() on this query's PID. We
            // surface a dedicated DbError variant so the UI can tell
            // "I aborted this" apart from a real failure.
            if code == "57014" {
                return DbError::Cancelled;
            }
            // Postgres SQLSTATE classes:
            //   28xxx invalid authorization
            //   42xxx syntax error or access rule violation
            //   23xxx integrity constraint violation
            //   3F000 invalid schema
            match code.get(..2) {
                Some("28") => DbError::AuthFailed(msg),
                Some("42") => DbError::Syntax(msg),
                Some("23") => DbError::SchemaConflict(msg),
                _ => DbError::Internal(format!("[{code}] {msg}")),
            }
        }
        SqlxError::RowNotFound => DbError::NotFound("no rows".into()),
        SqlxError::ColumnNotFound(c) => DbError::NotFound(format!("column not found: {c}")),
        SqlxError::Configuration(c) => DbError::InvalidInput(c.to_string()),
        other => DbError::Internal(other.to_string()),
    }
}
