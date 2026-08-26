# Unity Ads Metrics Ingestion

A TypeScript and Fastify service for accepting mobile ads metrics. It is designed as a stateless, Kubernetes-oriented
HTTP-to-Kafka ingestion boundary with explicit validation, backpressure, observability, and graceful shutdown.

Kafka is not connected yet. The current no-op publisher implements the same interface intended for the Kafka-backed
publisher.

## Request flow

```text
POST /v1/metrics
    -> enforce JSON and request-size limits
    -> validate the event
    -> acquire publisher capacity
    -> await publisher acknowledgement
    -> return 202 Accepted
```

## Documentation

| Document                               | Contents                                                       |
|----------------------------------------|----------------------------------------------------------------|
| [Architecture](docs/architecture.md)   | Request flow, backpressure, delivery semantics, and shutdown.  |
| [API contract](docs/api.md)            | Payload schema, response codes, probes, and client behavior.   |
| [Observability](docs/observability.md) | Metrics, traces, logs, dashboards, and the local LGTM stack.   |
| [Development](docs/development.md)     | Local setup, validation commands, and environment variables.   |
| [Load testing](docs/load-testing.md)   | k6 profile, thresholds, configuration, and result exploration. |
| [Kubernetes](docs/kubernetes.md)       | Kustomize manifests, availability, security, and tradeoffs.    |

## Quick start

Requirements: Node.js 24 and pnpm 10.

```powershell
cd app
pnpm install
pnpm dev
```

The server starts on `http://localhost:3000`.

| Endpoint            | Purpose                                 |
|---------------------|-----------------------------------------|
| `POST /v1/metrics`  | Validate and publish one metrics event. |
| `GET /health/live`  | Process liveness probe.                 |
| `GET /health/ready` | Traffic readiness and shutdown state.   |

## Local observability

Start the application with Grafana, Prometheus, Tempo, Loki, and the OpenTelemetry Collector:

```powershell
docker compose up --build
```

or with k6 load test profile

```powershell
docker compose --profile load-test run --rm k6
```

Grafana is available at `http://localhost:3001` with provisioned application and k6 dashboards, traces, logs, and
Pyroscope CPU/heap profiles. See [Observability](docs/observability.md) for details.

## Validate the app

```powershell
cd app
pnpm typecheck
pnpm test
pnpm build
```
