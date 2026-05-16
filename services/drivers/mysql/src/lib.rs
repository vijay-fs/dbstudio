//! MySQL / MariaDB driver. Uses sqlx with the Tokio runtime.

mod decode;
mod introspect;
mod map_error;
mod split;

use std::path::PathBuf;
use std::sync::Arc;

use async_trait::async_trait;
use dashmap::DashMap;
use dbstudio_core::{
    secrets::{self, Slot},
    ssh_tunnel::{self, BastionAuth, SshTunnelConfig, Tunnel},
    AuthMethod, ConnectionProfile, DbError, Driver, QueryRequest, QueryResult, ResultColumn,
    Result, Schema, SshAuth,
};
use sqlx::{
    mysql::{MySqlPool, MySqlPoolOptions},
    Column, Row, TypeInfo,
};
use tracing::info;
use uuid::Uuid;

use crate::map_error::map_sqlx_error;

const DEFAULT_ROW_LIMIT: u32 = 10_000;

pub struct MySqlDriver {
    pools: Arc<DashMap<Uuid, MySqlPool>>,
    tunnels: Arc<DashMap<Uuid, Arc<Tunnel>>>,
}

impl MySqlDriver {
    pub fn new() -> Self {
        Self {
            pools: Arc::new(DashMap::new()),
            tunnels: Arc::new(DashMap::new()),
        }
    }

    async fn pool_for(&self, profile: &ConnectionProfile) -> Result<MySqlPool> {
        if let Some(pool) = self.pools.get(&profile.id) {
            return Ok(pool.clone());
        }

        let (host, port) = if let Some(cfg) = &profile.ssh_tunnel {
            let tunnel = self.ensure_tunnel(profile, cfg).await?;
            ("127.0.0.1".to_string(), tunnel.local_port())
        } else {
            (profile.host.clone(), profile.port)
        };

        let url = build_connection_url(profile, &host, port).await?;
        let pool = MySqlPoolOptions::new()
            .max_connections(5)
            .acquire_timeout(std::time::Duration::from_secs(10))
            .connect(&url)
            .await
            .map_err(map_sqlx_error)?;

        self.pools.insert(profile.id, pool.clone());
        Ok(pool)
    }

    async fn ensure_tunnel(
        &self,
        profile: &ConnectionProfile,
        cfg: &dbstudio_core::SshTunnel,
    ) -> Result<Arc<Tunnel>> {
        if let Some(t) = self.tunnels.get(&profile.id) {
            return Ok(t.clone());
        }
        let auth = resolve_bastion_auth(profile.id, &cfg.auth).await?;
        let tunnel = ssh_tunnel::open(SshTunnelConfig {
            bastion_host: cfg.host.clone(),
            bastion_port: cfg.port,
            username: cfg.username.clone(),
            auth,
            target_host: profile.host.clone(),
            target_port: profile.port,
            expected_fingerprint: cfg.host_key_fingerprint.clone(),
        })
        .await?;
        let tunnel = Arc::new(tunnel);
        self.tunnels.insert(profile.id, tunnel.clone());
        Ok(tunnel)
    }
}

async fn resolve_bastion_auth(profile_id: Uuid, auth: &SshAuth) -> Result<BastionAuth> {
    match auth {
        SshAuth::Password { password_ref } => {
            let pw = if password_ref.is_empty() {
                secrets::get(profile_id, Slot::SshTunnelPassword).await?
            } else {
                Some(password_ref.clone())
            };
            let pw = pw.ok_or_else(|| {
                DbError::AuthFailed("ssh tunnel password not in keychain".into())
            })?;
            Ok(BastionAuth::Password(pw))
        }
        SshAuth::Key { key_ref, passphrase_ref } => {
            let passphrase = match passphrase_ref {
                Some(p) if !p.is_empty() => Some(p.clone()),
                _ => secrets::get(profile_id, Slot::SshTunnelPassphrase).await?,
            };
            Ok(BastionAuth::Key {
                path: PathBuf::from(key_ref),
                passphrase,
            })
        }
    }
}

impl Default for MySqlDriver {
    fn default() -> Self {
        Self::new()
    }
}

async fn build_connection_url(
    profile: &ConnectionProfile,
    host: &str,
    port: u16,
) -> Result<String> {
    let (username, password) = match &profile.auth {
        AuthMethod::Password { username, password_ref } => {
            let pw = if password_ref.is_empty() {
                secrets::get(profile.id, Slot::Password).await?
            } else {
                Some(password_ref.clone())
            };
            (username.clone(), pw)
        }
        AuthMethod::SshKey { username, .. } => (username.clone(), None),
        _ => {
            return Err(DbError::InvalidInput(
                "mysql requires a username".to_string(),
            ))
        }
    };

    let mut url = url::Url::parse("mysql://placeholder/")
        .map_err(|e| DbError::Internal(e.to_string()))?;
    url.set_host(Some(host))
        .map_err(|e| DbError::Internal(format!("invalid host: {e:?}")))?;
    url.set_port(Some(port))
        .map_err(|_| DbError::Internal("invalid port".to_string()))?;
    if !profile.database.is_empty() {
        url.set_path(&profile.database);
    }
    url.set_username(&username)
        .map_err(|_| DbError::Internal("invalid username".to_string()))?;
    if let Some(p) = password {
        if !p.is_empty() {
            url.set_password(Some(&p))
                .map_err(|_| DbError::Internal("invalid password".to_string()))?;
        }
    }
    Ok(url.into())
}

/// Same heuristic as the Postgres driver — see notes in that crate.
fn is_query_statement(sql: &str) -> bool {
    matches!(
        leading_keyword(sql).to_ascii_uppercase().as_str(),
        "SELECT" | "WITH" | "SHOW" | "EXPLAIN" | "DESCRIBE" | "DESC" | "VALUES" | "TABLE"
    )
}

fn leading_keyword(sql: &str) -> String {
    let bytes = sql.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        let b = bytes[i];
        if b.is_ascii_whitespace() {
            i += 1;
        } else if b == b'-' && bytes.get(i + 1) == Some(&b'-') {
            i += 2;
            while i < bytes.len() && bytes[i] != b'\n' {
                i += 1;
            }
        } else if b == b'/' && bytes.get(i + 1) == Some(&b'*') {
            i += 2;
            while i + 1 < bytes.len() && !(bytes[i] == b'*' && bytes[i + 1] == b'/') {
                i += 1;
            }
            i = (i + 2).min(bytes.len());
        } else if b == b'#' {
            // MySQL also recognises `#` as a line-comment.
            i += 1;
            while i < bytes.len() && bytes[i] != b'\n' {
                i += 1;
            }
        } else {
            break;
        }
    }
    let start = i;
    while i < bytes.len() && bytes[i].is_ascii_alphabetic() {
        i += 1;
    }
    std::str::from_utf8(&bytes[start..i]).unwrap_or("").to_string()
}

#[async_trait]
impl Driver for MySqlDriver {
    async fn connect(&self, profile: &ConnectionProfile) -> Result<()> {
        info!(profile_id = %profile.id, "opening mysql pool");
        let _pool = self.pool_for(profile).await?;
        Ok(())
    }

    async fn ping(&self, profile: &ConnectionProfile) -> Result<()> {
        let pool = self.pool_for(profile).await?;
        sqlx::query("SELECT 1")
            .execute(&pool)
            .await
            .map_err(map_sqlx_error)?;
        Ok(())
    }

    async fn execute(
        &self,
        profile: &ConnectionProfile,
        req: QueryRequest,
    ) -> Result<QueryResult> {
        let pool = self.pool_for(profile).await?;
        let started = std::time::Instant::now();
        let limit = req.limit.unwrap_or(DEFAULT_ROW_LIMIT) as usize;

        let statements = split::split_statements(&req.sql);
        if statements.is_empty() {
            return Err(DbError::InvalidInput(
                "no SQL statement to execute".to_string(),
            ));
        }

        let mut last: Option<QueryResult> = None;
        for stmt in &statements {
            last = Some(run_single(&pool, stmt, limit).await?);
        }

        let mut out = last.expect("at least one statement");
        out.elapsed_ms = started.elapsed().as_millis() as u64;
        Ok(out)
    }

    async fn schema(&self, profile: &ConnectionProfile) -> Result<Schema> {
        let pool = self.pool_for(profile).await?;
        introspect::load_schema(&pool, &profile.database).await
    }

    async fn disconnect(&self, profile: &ConnectionProfile) -> Result<()> {
        if let Some((_, pool)) = self.pools.remove(&profile.id) {
            pool.close().await;
        }
        self.tunnels.remove(&profile.id);
        Ok(())
    }
}

async fn run_single(pool: &MySqlPool, sql: &str, limit: usize) -> Result<QueryResult> {
    if !is_query_statement(sql) {
        let result = sqlx::query(sql)
            .execute(pool)
            .await
            .map_err(map_sqlx_error)?;
        return Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            rows_affected: Some(result.rows_affected()),
            elapsed_ms: 0,
            truncated: false,
        });
    }

    let mysql_rows = sqlx::query(sql)
        .fetch_all(pool)
        .await
        .map_err(map_sqlx_error)?;

    let columns: Vec<ResultColumn> = mysql_rows
        .first()
        .map(|r| {
            r.columns()
                .iter()
                .map(|c| ResultColumn {
                    name: c.name().to_string(),
                    data_type: c.type_info().name().to_string(),
                })
                .collect()
        })
        .unwrap_or_default();

    let truncated = mysql_rows.len() > limit;
    let mut rows = Vec::with_capacity(mysql_rows.len().min(limit));
    for row in mysql_rows.iter().take(limit) {
        let mut cells = Vec::with_capacity(row.columns().len());
        for (i, col) in row.columns().iter().enumerate() {
            cells.push(decode::decode_cell(row, i, col.type_info().name()));
        }
        rows.push(cells);
    }

    Ok(QueryResult {
        columns,
        rows,
        rows_affected: None,
        elapsed_ms: 0,
        truncated,
    })
}
