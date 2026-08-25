# Load testing

The optional `load-test` Compose profile runs a k6 arrival-rate test against the containerized ingestion endpoint.

## Default profile

The test ramps through the following target rates:

```text
50 -> 100 -> 250 -> 500 -> 750 -> 1,000 -> 0 requests/second
```

Each stage lasts five minutes. The complete run takes approximately 30 minutes and schedules roughly 788,000
requests.

k6 pre-allocates 500 VUs and can grow to 2,000 VUs by default. These VUs are load-generator capacity, not the requested
concurrency level; the `ramping-arrival-rate` executor schedules iterations at the configured requests-per-second rate.

## Run the test

```powershell
$env:K6_TEST_RUN_ID = "local-1"
docker compose up -d --build
docker compose --profile load-test run --rm k6
```

The application and observability stack remain running after the test so results can be inspected.

## Results

k6 writes live results into the LGTM Prometheus instance. Grafana provisions the **k6 Prometheus** dashboard at:

```text
http://localhost:3001/d/ccbb2351-2ae2-462f-ae0e-f2c893ad1028/k6-prometheus
```

Filter by the `testid` label when comparing runs. Trend metrics export `p(90)`, `p(95)`, `p(99)`, `min`, and `max`
through `K6_PROMETHEUS_RW_TREND_STATS`. The end-of-test summary is also printed to the terminal.

## Configuration

| Variable                       | Default                     | Description                                    |
|--------------------------------|-----------------------------|------------------------------------------------|
| `K6_MAX_RATE`                  | `1000`                      | Peak scheduled iterations per second.          |
| `K6_STAGE_DURATION`            | `5m`                        | Duration of each of the six stages.            |
| `K6_TEST_RUN_ID`               | `local`                     | Value exported as the `testid` metric label.   |
| `K6_PRE_ALLOCATED_VUS`         | `500`                       | Initial VU capacity for the default peak rate. |
| `K6_MAX_VUS`                   | `2000`                      | Maximum VU capacity for the default peak rate. |
| `K6_PROMETHEUS_RW_TREND_STATS` | `p(90),p(95),p(99),min,max` | Exported statistics for k6 Trend metrics.      |

When VU variables are omitted, k6 derives them from `K6_MAX_RATE`: half the peak rate is pre-allocated, with a minimum
of 50, and the maximum is twice the peak rate or the pre-allocated value, whichever is larger.

## Short smoke test

```powershell
$env:K6_MAX_RATE = "10"
$env:K6_STAGE_DURATION = "10s"
$env:K6_TEST_RUN_ID = "smoke"
docker compose up -d --build
docker compose --profile load-test run --rm k6
```

## Thresholds

The test fails when:

- fewer than 99% of checks pass;
- k6 drops any scheduled iterations;
- HTTP p95 latency reaches 500 ms or more;
- 1% or more HTTP requests fail.
