//! SQL statement splitter for MySQL. Same shape as the Postgres splitter,
//! with the addition of MySQL-specific syntax:
//!   - `#` line comments
//!   - backtick-quoted identifiers
//!
//! TODO(phase-2): unify with the Postgres splitter once we extract a shared
//! `dbstudio-sql-utils` crate.

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
                b'`' => state = State::Backtick,
                b'#' => {
                    i += 1;
                    while i < bytes.len() && bytes[i] != b'\n' {
                        i += 1;
                    }
                    continue;
                }
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
                if b == b'\\' && i + 1 < bytes.len() {
                    // MySQL supports `\` as an escape inside strings (unlike
                    // standard Postgres). Skip the next char.
                    i += 1;
                } else if b == b'\'' {
                    if bytes.get(i + 1) == Some(&b'\'') {
                        i += 1;
                    } else {
                        state = State::Normal;
                    }
                }
            }
            State::Double => {
                if b == b'\\' && i + 1 < bytes.len() {
                    i += 1;
                } else if b == b'"' {
                    if bytes.get(i + 1) == Some(&b'"') {
                        i += 1;
                    } else {
                        state = State::Normal;
                    }
                }
            }
            State::Backtick => {
                if b == b'`' {
                    if bytes.get(i + 1) == Some(&b'`') {
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
    Backtick,
    Block,
}

#[cfg(test)]
mod tests {
    use super::split_statements;

    #[test]
    fn backslash_escape_in_string() {
        // MySQL: \' is an escaped quote, doesn't end the string.
        assert_eq!(
            split_statements("SELECT 'it\\'s; fine'; SELECT 2"),
            vec!["SELECT 'it\\'s; fine'", "SELECT 2"]
        );
    }

    #[test]
    fn backtick_identifier_with_semicolon() {
        assert_eq!(
            split_statements("SELECT `col;ish` FROM t; SELECT 2"),
            vec!["SELECT `col;ish` FROM t", "SELECT 2"]
        );
    }

    #[test]
    fn hash_comment() {
        assert_eq!(
            split_statements("SELECT 1 # comment ;\n; SELECT 2"),
            vec!["SELECT 1 # comment ;", "SELECT 2"]
        );
    }
}
