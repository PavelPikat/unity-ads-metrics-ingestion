# Observability

The application exports metrics and traces through OpenTelemetry and sends continuous profiles through the Pyroscope
Node.js SDK. Logs remain structured Pino JSON on standard output and are collected independently by the local
OpenTelemetry Collector.

## Traces

Traces are exported over OTLP using HTTP/protobuf. Incoming requests receive automatic HTTP and Fastify spans. The
ingestion path also creates spans for payload validation and publisher acknowledgement.

Health probe paths are excluded from tracing to avoid routine probe noise.

## Profiles

Profiling is opt-in outside Compose and starts when `PYROSCOPE_SERVER_ADDRESS` is configured. The profiler continuously
captures wall time, CPU time, and sampled heap allocations. Profiles use the same
`unity-ads-metrics-ingestion` service name as traces and metrics so the signals are easy to compare.

The Pyroscope SDK pushes profiles directly to port 4040; profiling data does not pass through the OpenTelemetry
Collector. During graceful shutdown, the application stops the profiler and uploads its final partial profile before
exiting.

## Application metrics

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

OpenTelemetry also collects Node.js runtime metrics with five-second monitoring precision, including:

- event-loop utilization, active/idle time, and delay percentiles;
- garbage-collection pause duration by collection type;
- V8 heap size, used memory, available memory, and physical memory by heap space;
- active resources keeping the event loop alive.

## Logging

Fastify writes structured JSON logs to standard output. Accepted and failed publishing logs include `eventId` and
`eventType` for correlation.

Full payloads, `deviceId`, and `adId` are not logged. Validation failure logs contain only issue codes and field paths.
The application does not export logs through its OpenTelemetry SDK.

When a log is written within an active span, Pino adds `trace_id` and `span_id` fields from the OpenTelemetry context.
Grafana can use `trace_id` to navigate from a Loki log record to the corresponding Tempo trace. Lifecycle and other
process-level logs without an active span do not contain correlation IDs.

## Local LGTM stack

Docker Compose runs the production app image together with Grafana's OpenTelemetry LGTM development stack:

```powershell
docker compose up --build
```

| Endpoint                | Purpose                                      |
|-------------------------|----------------------------------------------|
| `http://localhost:3000` | Metrics ingestion application.               |
| `http://localhost:3001` | Grafana UI.                                  |
| `http://localhost:4040` | Pyroscope API for host-based profilers.       |
| `http://localhost:9090` | Prometheus UI.                               |
| `http://localhost:4318` | OTLP HTTP receiver for host-based processes. |

The Compose network sends the application's OTLP data directly to the bundled collector. In Grafana Metrics Drilldown
or Explore, search for `ingestion_`, `publisher_`, `nodejs_`, or `v8js_`. Traces use the
`unity-ads-metrics-ingestion` service name.

Open **Profiles Drilldown** in Grafana and select `unity-ads-metrics-ingestion` to explore flame graphs. Compose uploads
profiles every ten seconds; generate traffic with the k6 profile to produce a more representative CPU flame graph.

## Provisioned dashboards

### Application overview

The **Metrics Ingestion — Application Overview** dashboard combines request rate, acceptance and error rates, latency
percentiles, publisher backpressure, Node.js runtime metrics, container CPU and memory, recent traces, and structured
application logs.

Open it under **Dashboards** or directly at:

```text
http://localhost:3001/d/unity-ads-metrics-ingestion-overview/metrics-ingestion-e28094-application-overview
```

Use the **Service name** selector for application metrics, traces, and logs. The independent **Container** selector
controls only Docker CPU and memory panels because OpenTelemetry service names and Docker container names are different
dimensions.

### k6

The **k6 Prometheus** dashboard is available at:

```text
http://localhost:3001/d/ccbb2351-2ae2-462f-ae0e-f2c893ad1028/k6-prometheus
```

See [Load testing](load-testing.md) for the test profile and k6 metric configuration.

## Container metrics

The collector reads local Docker container statistics every five seconds. Search for `container_cpu_` and
`container_memory_` metrics and filter by `container_name`.

```promql
container_cpu_utilization_ratio{container_name="unity-ads-metrics-ingestion-app-1"}
container_memory_usage_total_bytes{container_name="unity-ads-metrics-ingestion-app-1"}
```

The Docker socket mount used for container discovery and statistics is intended for local development. Kubernetes
resource metrics should be collected from the kubelet or cluster telemetry pipeline instead.

## Local log collection

The collector discovers the app container through Docker, reads its standard output, parses the Docker and Pino JSON
layers, and forwards records to Loki. In Grafana Explore, select the Loki data source and use:

```logql
{service_name="unity-ads-metrics-ingestion"}
```

Stop the stack gracefully so the application flushes pending telemetry:

```powershell
docker compose down
```
