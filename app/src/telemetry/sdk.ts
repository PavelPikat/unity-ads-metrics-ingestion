import {FastifyOtelInstrumentation} from "@fastify/otel";
import {OTLPMetricExporter} from "@opentelemetry/exporter-metrics-otlp-proto";
import {OTLPTraceExporter} from "@opentelemetry/exporter-trace-otlp-proto";
import {HttpInstrumentation} from "@opentelemetry/instrumentation-http";
import {RuntimeNodeInstrumentation} from "@opentelemetry/instrumentation-runtime-node";
import {defaultResource, resourceFromAttributes} from "@opentelemetry/resources";
import {PeriodicExportingMetricReader} from "@opentelemetry/sdk-metrics";
import {NodeSDK} from "@opentelemetry/sdk-node";
import {ATTR_SERVICE_NAME} from "@opentelemetry/semantic-conventions";
import {startProfiling} from "../profiling/sdk.js";
import type {TelemetryLifecycle} from "./lifecycle.js";

const defaultServiceName = "unity-ads-metrics-ingestion";

export async function startTelemetry(): Promise<TelemetryLifecycle> {
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

    try {
        const profiling = await startProfiling();
        return combineLifecycles(profiling, sdk);
    } catch (error) {
        await sdk.shutdown();
        throw error;
    }
}

function combineLifecycles(
    ...lifecycles: TelemetryLifecycle[]
): TelemetryLifecycle {
    let shutdownPromise: Promise<void> | undefined;

    return {
        shutdown() {
            shutdownPromise ??= shutdownAll(lifecycles);
            return shutdownPromise;
        },
    };
}

async function shutdownAll(
    lifecycles: TelemetryLifecycle[],
): Promise<void> {
    const results = await Promise.allSettled(
        lifecycles.map(async (lifecycle) => lifecycle.shutdown()),
    );
    const failures = results.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : []
    );

    if (failures.length > 0) {
        throw new AggregateError(failures, "Telemetry shutdown failed");
    }
}
