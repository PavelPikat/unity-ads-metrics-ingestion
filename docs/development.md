# Development and configuration

## Requirements

- Node.js 24
- pnpm 10

## Run locally

```powershell
cd app
pnpm install
pnpm dev
```

The server listens on `http://localhost:3000` by default.

## Validation commands

Run these commands from `app/`:

```powershell
pnpm typecheck
pnpm test
pnpm build
```

The GitHub pull-request workflow runs the type checker and build when files under `app/` change.

## Application configuration

Application configuration is read from the environment and validated at startup.

| Variable                 | Default   | Description                                                             |
|--------------------------|-----------|-------------------------------------------------------------------------|
| `HOST`                   | `0.0.0.0` | HTTP listening address.                                                 |
| `PORT`                   | `3000`    | HTTP listening port. Must be between 1 and 65535.                       |
| `MAX_INFLIGHT_PUBLISHES` | `100`     | Maximum concurrent publisher calls per pod. Must be a positive integer. |

## OpenTelemetry configuration

The OpenTelemetry SDK reads its standard exporter variables from the environment.

| Variable                              | Default                       | Description                                           |
|---------------------------------------|-------------------------------|-------------------------------------------------------|
| `OTEL_SERVICE_NAME`                   | `unity-ads-metrics-ingestion` | OpenTelemetry service name.                           |
| `OTEL_EXPORTER_OTLP_ENDPOINT`         | `http://localhost:4318`       | Base OTLP endpoint for traces and metrics.            |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`  | `<base endpoint>/v1/traces`   | Optional signal-specific trace endpoint.              |
| `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` | `<base endpoint>/v1/metrics`  | Optional signal-specific metrics endpoint.            |
| `OTEL_EXPORTER_OTLP_HEADERS`          | none                          | Optional comma-separated OTLP authentication headers. |

## Docker Compose

Build and start the application with its local observability stack from the repository root:

```powershell
docker compose up --build
```

See [Observability](observability.md) for local endpoints, dashboards, and collector behavior.
