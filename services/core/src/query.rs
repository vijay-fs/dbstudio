use serde::{Deserialize, Serialize};

pub type Value = serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryRequest {
    pub sql: String,
    #[serde(default)]
    pub params: Vec<Value>,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResult {
    pub columns: Vec<ResultColumn>,
    pub rows: Vec<Vec<Value>>,
    #[serde(default)]
    pub rows_affected: Option<u64>,
    pub elapsed_ms: u64,
    #[serde(default)]
    pub truncated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResultColumn {
    pub name: String,
    pub data_type: String,
}
