use thiserror::Error;

/// Engine-agnostic error taxonomy. Every driver maps its native errors into
/// these variants so the frontend can render consistent, user-friendly messages
/// regardless of which database raised them.
#[derive(Error, Debug)]
pub enum DbError {
    #[error("connection failed: {0}")]
    Connection(String),

    #[error("authentication failed: {0}")]
    AuthFailed(String),

    #[error("permission denied: {0}")]
    PermissionDenied(String),

    #[error("timed out after {seconds}s")]
    Timeout { seconds: u64 },

    #[error("syntax error: {0}")]
    Syntax(String),

    #[error("schema conflict: {0}")]
    SchemaConflict(String),

    #[error("not found: {0}")]
    NotFound(String),

    #[error("feature not supported by this engine: {0}")]
    Unsupported(String),

    #[error("invalid input: {0}")]
    InvalidInput(String),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("ssh tunnel error: {0}")]
    SshTunnel(String),

    #[error(
        "ssh host key not pinned — discover the bastion's fingerprint and save the profile before connecting"
    )]
    HostKeyMissing,

    #[error(
        "ssh host key mismatch — expected {expected}, server presented {actual}. \
         The bastion's key changed (re-provisioned host, or a man-in-the-middle). \
         Verify the new key out-of-band before re-pinning."
    )]
    HostKeyMismatch { expected: String, actual: String },

    #[error("query cancelled by user")]
    Cancelled,

    #[error("internal error: {0}")]
    Internal(String),
}

impl DbError {
    /// Stable error code for API responses and logging. Frontend keys
    /// user-facing copy off this, never the message string.
    pub fn code(&self) -> &'static str {
        match self {
            DbError::Connection(_) => "connection_failed",
            DbError::AuthFailed(_) => "auth_failed",
            DbError::PermissionDenied(_) => "permission_denied",
            DbError::Timeout { .. } => "timeout",
            DbError::Syntax(_) => "syntax_error",
            DbError::SchemaConflict(_) => "schema_conflict",
            DbError::NotFound(_) => "not_found",
            DbError::Unsupported(_) => "unsupported",
            DbError::InvalidInput(_) => "invalid_input",
            DbError::Io(_) => "io_error",
            DbError::SshTunnel(_) => "ssh_tunnel_error",
            DbError::HostKeyMissing => "host_key_missing",
            DbError::HostKeyMismatch { .. } => "host_key_mismatch",
            DbError::Cancelled => "query_cancelled",
            DbError::Internal(_) => "internal_error",
        }
    }
}

pub type Result<T> = std::result::Result<T, DbError>;
