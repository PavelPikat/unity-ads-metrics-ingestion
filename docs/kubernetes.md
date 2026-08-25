# Kubernetes deployment

The `k8s/` directory is a Kustomize base that demonstrates how the ingestion service could run in Kubernetes. It is
intended for design review and interview discussion rather than deployment to a real cluster.

## Resources

| Manifest                     | Purpose                                                                                   |
|------------------------------|-------------------------------------------------------------------------------------------|
| `namespace.yaml`             | Isolates the workload and enforces the Restricted Pod Security Standard.                  |
| `service-account.yaml`       | Gives the pod an identity without mounting Kubernetes API credentials.                    |
| `deployment.yaml`            | Runs three replicas with safe rollout, health, resource, security, and shutdown settings. |
| `service.yaml`               | Exposes the ingestion endpoint inside the cluster through a stable ClusterIP.             |
| `pod-disruption-budget.yaml` | Keeps at least two replicas available during voluntary disruptions.                       |

## Render and validate

Render the final resources without contacting a cluster:

```powershell
kubectl kustomize k8s
```

Validate the rendered resources against Kubernetes OpenAPI schemas without connecting to a cluster:

```powershell
kubectl kustomize k8s |
  docker run --rm -i ghcr.io/yannh/kubeconform:v0.8.0-alpine -strict -summary
```

The deployment references `unity-ads-metrics-ingestion:0.1.0` as a demonstration image. A real environment should use
Kustomize to replace it with an immutable registry digest, for example:

```powershell
cd k8s
kustomize edit set image unity-ads-metrics-ingestion=registry.example.com/ads/metrics-ingestion@sha256:<digest>
```

## Availability and rollout behavior

- Three replicas avoid a single-pod availability boundary.
- `maxUnavailable: 0` and `maxSurge: 1` retain all existing capacity while a replacement pod becomes ready.
- `minReadySeconds` prevents a briefly healthy pod from immediately counting as available.
- The disruption budget allows one replica at a time to be voluntarily evicted.
- Topology spread constraints prefer separate zones and require available replicas to spread across nodes.
- Explicit CPU and memory requests make scheduling predictable; limits bound a runaway container.

The resource values are starting assumptions. Production requests, limits, and replica counts should be derived from
load-test results and observed utilization rather than copied unchanged.

## Health and shutdown

The probes have distinct responsibilities:

- the startup probe gives the process up to 60 seconds to initialize before liveness checks begin;
- the readiness probe controls whether the pod receives Service traffic;
- the liveness probe restarts a process that can no longer serve requests.

On termination, Kubernetes first marks the endpoint as terminating. A five-second pre-stop delay gives endpoint changes
time to propagate. The process then receives `SIGTERM`, marks itself unready, stops accepting new requests, drains
in-flight handlers, closes the publisher, and flushes telemetry. The 45-second grace period includes the pre-stop delay.

## Security posture

- The namespace enforces the Restricted Pod Security Standard.
- The image already runs as the non-root `node` user.
- Privilege escalation is disabled and all Linux capabilities are dropped.
- The root filesystem is read-only.
- The runtime-default seccomp profile is enabled.
- Service account tokens and Kubernetes service environment variables are not mounted into the pod.

The application needs no Kubernetes API permissions, so no Role or RoleBinding is included.

## Telemetry

The deployment sends OTLP HTTP telemetry to the placeholder endpoint
`opentelemetry-collector.observability.svc.cluster.local:4318`.

The collector itself is intentionally outside this workload's Kustomize base. In a real platform it would normally be
owned by the cluster observability team.

## Deliberate omissions

- An Ingress or Gateway depends on the platform's routing, TLS, and authentication standards.
- Horizontal autoscaling needs an agreed scaling signal and targets supported by load-test evidence.
- NetworkPolicy needs the actual Kafka, DNS, and OpenTelemetry destinations before egress can be safely restricted.
- Kafka credentials and configuration belong in environment-specific secret/configuration resources.

These should be added through environment overlays once the deployment platform and operational contracts are known.
