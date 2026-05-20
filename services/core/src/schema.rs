//! Normalized schema model used by the ER diagram view.
//!
//! Every driver implements `Driver::schema()` to return this shape, regardless
//! of the underlying engine. The frontend renders the graph from this without
//! knowing which database it came from.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Schema {
    pub schemas: Vec<NamedSchema>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NamedSchema {
    pub name: String,
    pub tables: Vec<Table>,
    #[serde(default)]
    pub views: Vec<View>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Table {
    pub schema: String,
    pub name: String,
    pub columns: Vec<Column>,
    #[serde(default)]
    pub primary_key: Option<PrimaryKey>,
    #[serde(default)]
    pub foreign_keys: Vec<ForeignKey>,
    #[serde(default)]
    pub indexes: Vec<Index>,
    #[serde(default)]
    pub comment: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Column {
    pub name: String,
    pub data_type: String,
    pub nullable: bool,
    #[serde(default)]
    pub default: Option<String>,
    pub position: u32,
    #[serde(default)]
    pub comment: Option<String>,
    /// When the column has a finite set of allowed string values (PG user-
    /// defined enum, MySQL `enum(...)`), the engine driver resolves and
    /// attaches the option list here so the UI can render a dropdown
    /// rather than a free-text input.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub enum_options: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrimaryKey {
    pub name: String,
    pub columns: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForeignKey {
    pub name: String,
    pub columns: Vec<String>,
    pub references_schema: String,
    pub references_table: String,
    pub references_columns: Vec<String>,
    #[serde(default)]
    pub on_delete: Option<RefAction>,
    #[serde(default)]
    pub on_update: Option<RefAction>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RefAction {
    NoAction,
    Restrict,
    Cascade,
    SetNull,
    SetDefault,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Index {
    pub name: String,
    pub columns: Vec<String>,
    pub unique: bool,
    #[serde(default)]
    pub primary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct View {
    pub schema: String,
    pub name: String,
    pub columns: Vec<Column>,
    #[serde(default)]
    pub definition: Option<String>,
}
