import assert from "node:assert/strict";
import test from "node:test";
import {metrics} from "@opentelemetry/api";
import {
    AggregationTemporality,
    InMemoryMetricExporter,
    MeterProvider,
    PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";

test("records ingestion request metrics", async () => {
    const exporter = new InMemoryMetricExporter(
        AggregationTemporality.CUMULATIVE,
    );
    const reader = new PeriodicExportingMetricReader({
        exporter,
        exportIntervalMillis: 60_000,
    });
    const provider = new MeterProvider({readers: [reader]});

    metrics.setGlobalMeterProvider(provider);

    const {IngestionRequestTelemetry} = await import(
        "../src/telemetry/instruments.js"
        );
    const telemetry = new IngestionRequestTelemetry();
    const acceptedRequest = {};
    const invalidRequest = {};

    telemetry.start(acceptedRequest);
    telemetry.complete(acceptedRequest, 202);
    telemetry.start(invalidRequest);
    telemetry.complete(invalidRequest, 400);

    await provider.forceFlush();

    const exportedMetrics = new Map(
        exporter.getMetrics().flatMap((resourceMetrics) =>
            resourceMetrics.scopeMetrics.flatMap((scopeMetrics) =>
                scopeMetrics.metrics.map((metric) => [
                    metric.descriptor.name,
                    metric,
                ] as const),
            ),
        ),
    );

    assert.equal(sumValues(exportedMetrics.get("ingestion.requests")), 2);
    assert.equal(sumValues(exportedMetrics.get("ingestion.request.errors")), 1);
    assert.equal(sumValues(exportedMetrics.get("ingestion.requests.inflight")), 0);
    assert.equal(
        sumHistogramCounts(exportedMetrics.get("ingestion.request.duration")),
        2,
    );

    await provider.shutdown();
});

interface ExportedMetric {
    dataPoints: Array<{ value: unknown }>;
}

function sumValues(metric: ExportedMetric | undefined): number {
    assert.ok(metric);

    return metric.dataPoints.reduce((total, point) => {
        if (typeof point.value !== "number") {
            throw new TypeError("Expected a numeric metric value");
        }

        return total + point.value;
    }, 0);
}

function sumHistogramCounts(metric: ExportedMetric | undefined): number {
    assert.ok(metric);

    return metric.dataPoints.reduce((total, point) => {
        assert.ok(isHistogramValue(point.value));
        return total + point.value.count;
    }, 0);
}

function isHistogramValue(value: unknown): value is { count: number } {
    return typeof value === "object"
        && value !== null
        && "count" in value
        && typeof value.count === "number";
}
