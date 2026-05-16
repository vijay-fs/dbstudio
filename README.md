# dbstudio

Cross-platform database management studio. Connect to PostgreSQL, MySQL, MongoDB, Redis, and more — with a SQL editor, result grid, and visual ER diagrams. Ships as a web SaaS and as native macOS + Windows desktop apps.

## Status

Phase 1 (MVP) — in development. Currently targets PostgreSQL only.

## Architecture

```
apps/
  web/         Next.js 15 SaaS (SSR)
  desktop/     Tauri 2 shell (same Next.js, static export)

packages/
  ui/          shadcn/ui based shared components
  editor/      Monaco SQL editor wrapper
  erd/         ER diagram (React Flow + Dagre)
  api-client/  Typed client for services/server

services/
  core/        Rust library crate: connections, query exec, schema introspection
  drivers/     Per-engine Rust crates (postgres first, mysql/mongo/etc later)
  server/      Axum HTTP server wrapping core, for cloud deployment

infra/
  k8s/         Helm charts for cloud
  terraform/   AWS multi-region (later phases)
```

The `dbstudio-core` Rust crate is **shared** across web and desktop. In the
desktop app, Tauri commands call the crate directly in-process — no sidecar,
no localhost port. In the cloud, `services/server` wraps the same crate in
an Axum HTTP API behind a load balancer.

## Prerequisites

- Node.js >= 20 (we use 24)
- pnpm >= 10
- Rust (stable, >= 1.80) — used by Tauri AND the backend
- Platform tools:
  - macOS: Xcode Command Line Tools
  - Windows: Microsoft C++ Build Tools + WebView2

## First-time setup

```bash
pnpm install
cargo build --workspace
```

## Running

```bash
# Web app only (Next.js dev server, no backend)
pnpm dev:web

# Desktop app (launches Tauri + Next.js, Rust core in-process)
pnpm dev:desktop

# Cloud HTTP server (Axum, wraps the same core crate)
pnpm server:dev
```

## Installing the unsigned desktop build

During development we ship unsigned `.dmg` and `.msi`. Users will see warnings:

- **macOS**: right-click the app -> Open -> confirm. Or:
  `xattr -dr com.apple.quarantine /Applications/dbstudio.app`
- **Windows**: "Windows protected your PC" -> More info -> Run anyway.

Code signing + notarization will be wired up before public launch.

## License

TBD.
