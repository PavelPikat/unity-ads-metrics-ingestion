# Unity Ads Metrics Ingestion

A small TypeScript and Fastify service for accepting mobile ads metrics. The application is designed as a stateless,
Kubernetes-oriented HTTP-to-Kafka ingestion boundary with explicit validation, backpressure, failure behavior, and
lifecycle handling.

Kafka is not connected yet. The current application uses a no-op publisher behind the same interface a Kafka publisher
will implement.

## Request flow

```text
POST /v1/metrics
    -> enforce JSON and request-size limits
    -> validate the event with Zod
    -> acquire per-pod publisher capacity
    -> await publisher acknowledgement
    -> return 202
```

The HTTP route depends on a `MetricsPublisher` interface rather than Kafka-specific APIs. A concurrency-limited
publisher wraps the concrete implementation and rejects excess work instead of building an unbounded in-memory queue.

## API

### Ingest a metric

```text
POST /v1/metrics
Content-Type: application/json
```

Example payload:

```json
{
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "eventType": "impression",
  "timestamp": "2026-08-24T16:00:00Z",
  "deviceId": "device-123",
  "adId": "ad-456"
}
```

Validation requires:

- an RFC-compliant UUID event ID;
- an event type of `impression`, `click`, or `conversion`;
- an ISO 8601 timestamp with a timezone;
- device and ad identifiers between 1 and 128 characters;
- no unknown properties.

Requests must use `application/json` and must not exceed 16 KiB. The server allows 30 seconds to receive a request.

Response codes:

| Status                       | Meaning                                                                       |
|------------------------------|-------------------------------------------------------------------------------|
| `202 Accepted`               | The publisher acknowledged the event.                                         |
| `400 Bad Request`            | The JSON payload does not match the event schema.                             |
| `413 Payload Too Large`      | The request exceeds 16 KiB.                                                   |
| `415 Unsupported Media Type` | The request is not `application/json`.                                        |
| `429 Too Many Requests`      | This pod has reached its concurrent publish limit. Includes `Retry-After: 1`. |
| `503 Service Unavailable`    | The publisher failed to acknowledge the event.                                |

Example request:

```powershell
curl.exe -i -X POST http://localhost:3000/v1/metrics `
  -H "Content-Type: application/json" `
  -d '{"eventId":"550e8400-e29b-41d4-a716-446655440000","eventType":"impression","timestamp":"2026-08-24T16:00:00Z","deviceId":"device-123","adId":"ad-456"}'
```

### Health probes

| Endpoint            | Purpose                                                                                           |
|---------------------|---------------------------------------------------------------------------------------------------|
| `GET /health/live`  | Confirms the process can serve requests. It does not depend on publisher availability.            |
| `GET /health/ready` | Returns `200` after initialization and `503` while the application is not ready or shutting down. |

Routine probe request logs are suppressed to avoid Kubernetes probe noise.

## Backpressure and failure behavior

Each pod limits concurrent calls to the publisher. The default is 100 and can be changed through
`MAX_INFLIGHT_PUBLISHES`.

When all permits are occupied, additional valid events receive `429` immediately. Requests are not queued in application
memory. Permits are released after both successful and failed publisher calls.

The limit is per pod. For example, three pods with a limit of 100 allow at most 300 concurrent publishes across the
service. This protects individual pods, but it does not increase Kafka capacity.

The route itself does not retry publishing. A real Kafka publisher should own bounded retries, exponential backoff with
jitter, idempotent producer configuration, and a total delivery timeout.

## Delivery semantics

HTTP success is returned only after `publisher.publish()` resolves. With Kafka, client timeouts and retries can still
produce duplicates:

```text
Kafka accepts event -> HTTP response is lost -> client retries event
```

The intended end-to-end model is therefore at-least-once delivery with possible duplicates, not exactly once. Clients
should reuse the same `eventId` when retrying so downstream consumers can deduplicate where required.

The current no-op publisher immediately acknowledges events and does not persist them.

## Logging

Fastify writes structured JSON logs to standard output. Accepted and failed publishing logs include `eventId` and
`eventType` for correlation.

Full payloads, `deviceId`, and `adId` are not logged by the application. Validation failure logs contain only issue
codes and field paths.

Logs are intentionally not exported through OpenTelemetry. They remain Pino JSON on standard output for the runtime or
log agent to collect independently.

## Observability

The application exports traces and metrics over OTLP using HTTP/protobuf.

Incoming HTTP requests receive automatic HTTP and Fastify spans. The ingestion path also creates spans for payload
validation and publisher acknowledgement. Health probe paths are excluded from tracing to avoid routine probe noise.

Custom metrics:

| Metric                        | Type            | Description                                                       |
|-------------------------------|-----------------|-------------------------------------------------------------------|
| `ingestion.requests`          | Counter         | Completed ingestion requests, grouped by outcome and status code. |
| `ingestion.request.duration`  | Histogram       | End-to-end ingestion request duration in seconds.                 |
| `ingestion.request.errors`    | Counter         | Unsuccessful or client-aborted ingestion requests.                |
| `ingestion.requests.inflight` | Up-down counter | Ingestion requests currently in flight.                           |
| `publisher.publish.duration`  | Histogram       | Time spent waiting for publisher acknowledgement, in seconds.     |
| `publisher.publish.errors`    | Counter         | Publisher failures and admission rejections.                      |
| `publisher.publish.inflight`  | Up-down counter | Publisher operations currently awaiting acknowledgement.          |

Metric attributes are deliberately low-cardinality: outcome, HTTP status code, error type, and the schema-controlled
event type. Identifiers such as `eventId`, `deviceId`, and `adId` are not metric attributes.

## Graceful shutdown

The server handles `SIGTERM` and `SIGINT`:

1. mark the application unready;
2. stop accepting new requests;
3. wait for in-flight handlers;
4. close the publisher;
5. flush and shut down OpenTelemetry;
6. allow Node.js to exit naturally.

The application does not call `process.exit()` during normal shutdown.

## Configuration

Configuration is read from the environment and validated at startup.

| Variable                              | Default                       | Description                                                             |
|---------------------------------------|-------------------------------|-------------------------------------------------------------------------|
| `HOST`                                | `0.0.0.0`                     | HTTP listening address.                                                 |
| `PORT`                                | `3000`                        | HTTP listening port. Must be between 1 and 65535.                       |
| `MAX_INFLIGHT_PUBLISHES`              | `100`                         | Maximum concurrent publisher calls per pod. Must be a positive integer. |
| `OTEL_SERVICE_NAME`                   | `unity-ads-metrics-ingestion` | OpenTelemetry service name.                                             |
| `OTEL_EXPORTER_OTLP_ENDPOINT`         | `http://localhost:4318`       | Base OTLP endpoint used for both traces and metrics.                    |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`  | `<base endpoint>/v1/traces`   | Optional signal-specific trace endpoint.                                |
| `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` | `<base endpoint>/v1/metrics`  | Optional signal-specific metrics endpoint.                              |
| `OTEL_EXPORTER_OTLP_HEADERS`          | none                          | Optional comma-separated OTLP authentication headers.                   |

## Local development

Requirements:

- Node.js 24
- pnpm 10

Install and start the development server:

```powershell
cd app
pnpm install
pnpm dev
```
