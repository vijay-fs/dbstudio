//! SQL splitter for SQLite. Same shape as the Postgres splitter — SQLite's
//! syntax for strings, identifiers, and comments matches ANSI SQL.

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
