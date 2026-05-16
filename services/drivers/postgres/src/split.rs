//! SQL statement splitter.
//!
//! Postgres's extended-query (prepared-statement) protocol — which sqlx uses by
//! default — only accepts a single command per query. Users routinely paste
//! scripts with multiple `;`-separated statements. We split them client-side
//! and run each in turn.
//!
//! The splitter respects:
//! - single-quoted strings (`'text'` with `''` escapes)
//! - double-quoted identifiers (`"col"` with `""` escapes)
//! - line comments (`-- ...`)
//! - block comments (`/* ... */`)
//!
//! Dollar-quoted strings (`$tag$ ... $tag$`, used in PL/pgSQL function bodies)
//! are not yet handled. Out of scope for Phase 1; revisit when adding stored
//! procedure editing.

/// Split a SQL script into individual statements. Empty/whitespace-only
/// segments are dropped. Each returned statement is trimmed.
pub fn split_statements(sql: &str) -> Vec<String> {
    let bytes = sql.as_bytes();
    let mut out = Vec::new();
    let mut start = 0usize;
    let mut i = 0usize;
    let mut state = State::Normal;

    while i < bytes.len() {
        let b = bytes[i];
        match state {
            State::Normal => match b {
                b';' => {
                    push_trimmed(&mut out, &bytes[start..i]);
                    start = i + 1;
                }
                b'\'' => state = State::Single,
                b'"' => state = State::Double,
                b'-' if bytes.get(i + 1) == Some(&b'-') => {
                    i += 2;
                    while i < bytes.len() && bytes[i] != b'\n' {
                        i += 1;
                    }
                    continue;
                }
                b'/' if bytes.get(i + 1) == Some(&b'*') => {
                    state = State::Block;
                    i += 1;
                }
                _ => {}
            },
            State::Single => {
                if b == b'\'' {
                    if bytes.get(i + 1) == Some(&b'\'') {
                        i += 1;
                    } else {
                        state = State::Normal;
                    }
                }
            }
            State::Double => {
                if b == b'"' {
                    if bytes.get(i + 1) == Some(&b'"') {
                        i += 1;
                    } else {
                        state = State::Normal;
                    }
                }
            }
            State::Block => {
                if b == b'*' && bytes.get(i + 1) == Some(&b'/') {
                    state = State::Normal;
                    i += 1;
                }
            }
        }
        i += 1;
    }

    push_trimmed(&mut out, &bytes[start..]);
    out
}

fn push_trimmed(out: &mut Vec<String>, bytes: &[u8]) {
    let s = std::str::from_utf8(bytes).unwrap_or("").trim();
    if !s.is_empty() {
        out.push(s.to_string());
    }
}

#[derive(Debug)]
enum State {
    Normal,
    Single,
    Double,
    Block,
}

#[cfg(test)]
mod tests {
    use super::split_statements;

    #[test]
    fn single_statement() {
        assert_eq!(split_statements("SELECT 1"), vec!["SELECT 1"]);
    }

    #[test]
    fn trailing_semicolon_is_dropped() {
        assert_eq!(split_statements("SELECT 1;"), vec!["SELECT 1"]);
    }

    #[test]
    fn two_statements() {
        assert_eq!(
            split_statements("SELECT 1; SELECT 2"),
            vec!["SELECT 1", "SELECT 2"]
        );
    }

    #[test]
    fn semicolon_inside_single_quote_is_ignored() {
        assert_eq!(
            split_statements("SELECT 'a;b'; SELECT 2"),
            vec!["SELECT 'a;b'", "SELECT 2"]
        );
    }

    #[test]
    fn escaped_single_quote_inside_string() {
        assert_eq!(
            split_statements("SELECT 'it''s; fine'; SELECT 2"),
            vec!["SELECT 'it''s; fine'", "SELECT 2"]
        );
    }

    #[test]
    fn semicolon_inside_double_quoted_identifier_is_ignored() {
        assert_eq!(
            split_statements(r#"SELECT "weird;col" FROM t; SELECT 2"#),
            vec![r#"SELECT "weird;col" FROM t"#, "SELECT 2"]
        );
    }

    #[test]
    fn line_comment_with_semicolon_is_ignored() {
        assert_eq!(
            split_statements("SELECT 1 -- this; is a comment\n; SELECT 2"),
            vec!["SELECT 1 -- this; is a comment", "SELECT 2"]
        );
    }

    #[test]
    fn block_comment_with_semicolon_is_ignored() {
        assert_eq!(
            split_statements("SELECT /* a;b */ 1; SELECT 2"),
            vec!["SELECT /* a;b */ 1", "SELECT 2"]
        );
    }

    #[test]
    fn empty_statements_are_dropped() {
        assert_eq!(
            split_statements(";;; SELECT 1 ;;; SELECT 2 ;;"),
            vec!["SELECT 1", "SELECT 2"]
        );
    }
}
