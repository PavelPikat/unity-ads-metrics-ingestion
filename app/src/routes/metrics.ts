import type {FastifyPluginAsync} from "fastify";
import {metricEventSchema} from "../domain/metric-event.js";
import {PublisherOverloadedError} from "../publisher/concurrency-limited-metrics-publisher.js";
import type {MetricsPublisher} from "../publisher/metrics-publisher.js";
import {
    IngestionRequestTelemetry,
    traceValidation,
} from "../telemetry/instruments.js";

interface MetricsRoutesOptions {
    publisher: MetricsPublisher;
}

export const metricsRoutes: FastifyPluginAsync<MetricsRoutesOptions> = async (
    app,
    {publisher},
) => {
    const requestTelemetry = new IngestionRequestTelemetry();

    app.post("/v1/metrics", {
        onRequest: [
            async (request) => {
                requestTelemetry.start(request);
            },
            async (request, reply) => {
                const mediaType = request.headers["content-type"]
                    ?.split(";", 1)[0]
                    ?.trim()
                    .toLowerCase();

                if (mediaType !== "application/json") {
                    return reply.code(415).send({
                        statusCode: 415,
                        error: "Unsupported Media Type",
                        message: "Content-Type must be application/json",
                    });
                }
            },
        ],
        onResponse: async (request, reply) => {
            requestTelemetry.complete(request, reply.statusCode);
        },
        onRequestAbort: async (request) => {
            requestTelemetry.abort(request);
        },
    }, async (request, reply) => {
        const result = traceValidation(
            () => metricEventSchema.safeParse(request.body),
            (validation) => validation.success,
        );

        if (!result.success) {
            request.log.info({
                validationIssues: result.error.issues.map((issue) => ({
                    code: issue.code,
                    path: issue.path.join("."),
                })),
            }, "Metrics event rejected");

            return reply.code(400).send({
                statusCode: 400,
                error: "Bad Request",
                message: "Invalid metrics event",
            });
        }

        try {
            await publisher.publish(result.data);
        } catch (error) {
            if (error instanceof PublisherOverloadedError) {
                request.log.warn({
                    limit: error.limit,
                }, "Metrics publisher capacity is exhausted");

                return reply
                    .header("retry-after", "1")
                    .code(429)
                    .send({
                        statusCode: 429,
                        error: "Too Many Requests",
                        message: "Publisher capacity is exhausted",
                    });
            }

            request.log.error({
                err: error,
                eventId: result.data.eventId,
                eventType: result.data.eventType,
            }, "Metrics publisher failed to acknowledge event");

            return reply.code(503).send({
                statusCode: 503,
                error: "Service Unavailable",
                message: "Metrics publisher is unavailable",
            });
        }

        request.log.info({
            eventId: result.data.eventId,
            eventType: result.data.eventType,
        }, "Metrics event accepted");

        return reply.code(202).send();
    });
};
