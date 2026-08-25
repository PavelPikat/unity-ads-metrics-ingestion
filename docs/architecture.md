# Architecture

The service is a stateless, Kubernetes-oriented HTTP-to-Kafka ingestion boundary. It owns request validation,
per-pod backpressure, publisher acknowledgement, and application lifecycle handling.

Kafka is not connected yet. The current application uses a no-op publisher behind the same `MetricsPublisher`
interface that a Kafka-backed implementation will implement.

## Request flow

```text
POST /v1/metrics
    -> enforce JSON and request-size limits
    -> validate the event with Zod
    -> acquire per-pod publisher capacity
    -> await publisher acknowledgement
    -> return 202
```

The HTTP route depends on `MetricsPublisher` rather than Kafka-specific APIs. A concurrency-limited publisher wraps the
concrete implementation and rejects excess work instead of building an unbounded in-memory queue.

## Backpressure and failure behavior

Each pod limits concurrent calls to the publisher. The default is 100 and can be changed through
`MAX_INFLIGHT_PUBLISHES`.

When all permits are occupied, additional valid events receive `429 Too Many Requests` immediately. Requests are not
queued in application memory. Permits are released after both successful and failed publisher calls.

The limit is per pod. For example, three pods with a limit of 100 allow at most 300 concurrent publishes across the
service. This protects individual pods, but it does not increase Kafka capacity.

The route does not retry publishing. A real Kafka publisher should own:

- bounded retries;
- exponential backoff with jitter;
- idempotent producer configuration;
- a total delivery timeout.

Keeping retries inside the publisher allows its timeout and retry policy to remain aligned with Kafka producer
semantics while the HTTP layer retains one clear deadline.

## Delivery semantics

HTTP success is returned only after `publisher.publish()` resolves. With Kafka, client timeouts and retries can still
produce duplicates:

```text
Kafka accepts event -> HTTP response is lost -> client retries event
```

The intended end-to-end model is therefore at-least-once delivery with possible duplicates, not exactly once. Clients
should reuse the same `eventId` when retrying so downstream consumers can deduplicate where required.

The current no-op publisher immediately acknowledges events and does not persist them.

## Graceful shutdown

The server handles `SIGTERM` and `SIGINT`:

1. mark the application unready;
2. stop accepting new requests;
3. wait for in-flight handlers;
4. close the publisher;
5. flush and shut down OpenTelemetry;
6. allow Node.js to exit naturally.

The application does not call `process.exit()` during normal shutdown.

## Related documentation

- [API contract](api.md)
- [Observability](observability.md)
- [Development and configuration](development.md)
