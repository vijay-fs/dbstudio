use std::net::SocketAddr;

use anyhow::Result;
use axum::{routing::get, Router};
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::info;

mod routes;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,dbstudio_server=debug".into()),
        )
        .json()
        .init();

    let app = Router::new()
        .route("/health", get(health))
        .nest("/api/v1", routes::router())
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());

    let addr: SocketAddr = std::env::var("DBSTUDIO_BIND")
        .unwrap_or_else(|_| "0.0.0.0:8080".into())
        .parse()?;
    let listener = tokio::net::TcpListener::bind(addr).await?;
    info!(%addr, "dbstudio-server listening");
    axum::serve(listener, app).await?;
    Ok(())
}

async fn health() -> &'static str {
    "ok"
}
