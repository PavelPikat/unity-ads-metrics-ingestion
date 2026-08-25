# API contract

## Ingest a metric

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

## Responses

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

## Health probes

| Endpoint            | Purpose                                                                                           |
|---------------------|---------------------------------------------------------------------------------------------------|
| `GET /health/live`  | Confirms the process can serve requests. It does not depend on publisher availability.            |
| `GET /health/ready` | Returns `200` after initialization and `503` while the application is not ready or shutting down. |

Routine probe request logs and traces are suppressed to avoid Kubernetes probe noise.

## Client behavior

Clients should retry `429` and transient `503` responses with bounded exponential backoff and jitter. Retries must
reuse the original `eventId`; see [Delivery semantics](architecture.md#delivery-semantics).
