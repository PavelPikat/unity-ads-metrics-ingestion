import {FastifyOtelInstrumentation} from "@fastify/otel";
import {OTLPMetricExporter} from "@opentelemetry/exporter-metrics-otlp-proto";
import {OTLPTraceExporter} from "@opentelemetry/exporter-trace-otlp-proto";
import {HttpInstrumentation} from "@opentelemetry/instrumentation-http";
import {RuntimeNodeInstrumentation} from "@opentelemetry/instrumentation-runtime-node";
import {defaultResource, resourceFromAttributes} from "@opentelemetry/resources";
import {PeriodicExportingMetricReader} from "@opentelemetry/sdk-metrics";
import {NodeSDK} from "@opentelemetry/sdk-node";
import {ATTR_SERVICE_NAME} from "@opentelemetry/semantic-conventions";
import type {TelemetryLifecycle} from "./lifecycle.js";

const defaultServiceName = "unity-ads-metrics-ingestion";

export function startTelemetry(): TelemetryLifecycle {
    const sdk = new NodeSDK({
        resource: defaultResource().merge(resourceFromAttributes({
            [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME
                ?? defaultServiceName,
        })),
        traceExporter: new OTLPTraceExporter(),
        metricReader: new PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporter(),
        }),
        instrumentations: [
            new HttpInstrumentation({
                ignoreIncomingRequestHook: (request) =>
                    request.url?.startsWith("/health/") ?? false,
            }),
            new FastifyOtelInstrumentation({
                registerOnInitialization: true,
                ignorePaths: "/health/*",
                instrumentHooks: false,
            }),
            new RuntimeNodeInstrumentation({
                monitoringPrecision: 5_000,
                captureUncaughtException: false,
            }),
        ],
    });

    sdk.start();

    return sdk;
}
