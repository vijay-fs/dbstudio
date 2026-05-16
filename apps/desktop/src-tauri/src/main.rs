// Prevents the extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    dbstudio_desktop_lib::run();
}
