use axum::{routing::post, Json, Router};
use serde::Deserialize;

/// Phase 1 surface: the desktop app talks to the core crate directly via Tauri
/// commands, so these HTTP routes only matter for the eventual web SaaS. They
/// exist as a stub so the server compiles and so the API contract is visible.
pub fn router() -> Router {
    Router::new()
        .route("/connections/test", post(test_connection))
        .route("/connections/schema", post(get_schema))
}

#[derive(Debug, Deserialize)]
struct ConnectionRequest {
    profile: dbstudio_core::ConnectionProfile,
}

async fn test_connection(Json(_req): Json<ConnectionRequest>) -> Json<serde_json::Value> {
    // Phase 2: wire driver registry, look up by engine, call `ping`.
    Json(serde_json::json!({ "ok": true, "phase": 1 }))
}

async fn get_schema(Json(_req): Json<ConnectionRequest>) -> Json<serde_json::Value> {
    Json(serde_json::json!({ "schemas": [], "phase": 1 }))
}
