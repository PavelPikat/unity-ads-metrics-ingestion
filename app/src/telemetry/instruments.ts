import {
    metrics,
    SpanKind,
    SpanStatusCode,
    trace,
    type Attributes,
} from "@opentelemetry/api";
import type {MetricEvent} from "../domain/metric-event.js";

const instrumentationName = "unity-ads-metrics-ingestion";
const meter = metrics.getMeter(instrumentationName);
const tracer = trace.getTracer(instrumentationName);

const ingestionRequests = meter.createCounter("ingestion.requests", {
    description: "Number of completed metrics ingestion requests",
    unit: "{request}",
});
const ingestionRequestDuration = meter.createHistogram(
    "ingestion.request.duration",
    {
        description: "Duration of metrics ingestion requests",
        unit: "s",
        advice: {
            explicitBucketBoundaries: [
                0.005,
                0.01,
                0.025,
                0.05,
                0.075,
                0.1,
                0.25,
                0.5,
                0.75,
                1,
                2.5,
                5,
                7.5,
                10,
            ],
        },
    },
);
const ingestionRequestErrors = meter.createCounter("ingestion.request.errors", {
    description: "Number of unsuccessful metrics ingestion requests",
    unit: "{request}",
});
const ingestionRequestsInflight = meter.createUpDownCounter(
    "ingestion.requests.inflight",
    {
        description: "Number of metrics ingestion requests currently in flight",
        unit: "{request}",
    },
);

const publisherDuration = meter.createHistogram("publisher.publish.duration", {
    description: "Duration of publisher operations",
    unit: "s",
    advice: {
        explicitBucketBoundaries: [
            0.001,
            0.005,
            0.01,
            0.025,
            0.05,
            0.1,
            0.25,
            0.5,
            1,
            2.5,
            5,
        ],
    },
});
const publisherErrors = meter.createCounter("publisher.publish.errors", {
    description: "Number of unsuccessful publisher operations",
    unit: "{operation}",
});
const publisherInflight = meter.createUpDownCounter(
    "publisher.publish.inflight",
    {
        description: "Number of publisher operations currently in flight",
        unit: "{operation}",
    },
);

interface RequestMeasurement {
    startedAt: number;
}

export class IngestionRequestTelemetry {
    readonly #measurements = new WeakMap<object, RequestMeasurement>();

    start(request: object): void {
        this.#measurements.set(request, {startedAt: performance.now()});
        ingestionRequestsInflight.add(1);
    }

    complete(request: object, statusCode: number): void {
        this.#finish(request, statusCode, requestOutcome(statusCode));
    }

    abort(request: object): void {
        this.#finish(request, undefined, "client_aborted");
    }

    #finish(
        request: object,
        statusCode: number | undefined,
        outcome: string,
    ): void {
        const measurement = this.#measurements.get(request);

        if (!measurement) {
            return;
        }

        this.#measurements.delete(request);
        ingestionRequestsInflight.add(-1);

        const attributes: Attributes = {"ingestion.outcome": outcome};
        if (statusCode !== undefined) {
            attributes["http.response.status_code"] = statusCode;
        }

        ingestionRequests.add(1, attributes);
        ingestionRequestDuration.record(
            (performance.now() - measurement.startedAt) / 1_000,
            attributes,
        );

        if (statusCode === undefined || statusCode >= 400) {
            ingestionRequestErrors.add(1, attributes);
        }
    }
}

export function traceValidation<T>(validate: () => T, isValid: (result: T) => boolean): T {
    return tracer.startActiveSpan("ingestion.validate", (span) => {
        try {
            const result = validate();
            span.setAttribute("ingestion.validation.success", isValid(result));
            return result;
        } finally {
            span.end();
        }
    });
}

export function recordPublisherOverload(event: MetricEvent): void {
    publisherErrors.add(1, {
        "error.type": "overloaded",
        "ingestion.event.type": event.eventType,
    });
}

export async function tracePublisherPublish(
    event: MetricEvent,
    publish: () => Promise<void>,
): Promise<void> {
    const attributes: Attributes = {
        "ingestion.event.type": event.eventType,
    };
    const startedAt = performance.now();

    publisherInflight.add(1, attributes);

    return tracer.startActiveSpan(
        "publisher.publish",
        {kind: SpanKind.INTERNAL, attributes},
        async (span) => {
            try {
                await publish();
            } catch (error) {
                publisherErrors.add(1, {
                    ...attributes,
                    "error.type": "publisher_failure",
                });
                span.recordException(error instanceof Error ? error : String(error));
                span.setStatus({
                    code: SpanStatusCode.ERROR,
                    message: error instanceof Error ? error.message : String(error),
                });
                throw error;
            } finally {
                publisherDuration.record(
                    (performance.now() - startedAt) / 1_000,
                    attributes,
                );
                publisherInflight.add(-1, attributes);
                span.end();
            }
        },
    );
}

function requestOutcome(statusCode: number): string {
    switch (statusCode) {
        case 202:
            return "accepted";
        case 400:
            return "invalid";
        case 413:
            return "too_large";
        case 415:
            return "unsupported_media_type";
        case 429:
            return "overloaded";
        case 503:
            return "publisher_unavailable";
        default:
            return statusCode >= 500 ? "server_error" : "other";
    }
}
