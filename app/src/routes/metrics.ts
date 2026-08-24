import type {FastifyPluginAsync} from "fastify";
import {metricEventSchema} from "../domain/metric-event.js";
import type {MetricsPublisher} from "../publisher/metrics-publisher.js";

interface MetricsRoutesOptions {
    publisher: MetricsPublisher;
}

export const metricsRoutes: FastifyPluginAsync<MetricsRoutesOptions> = async (
    app,
    {publisher},
) => {
    app.post("/v1/metrics", {
        onRequest: async (request, reply) => {
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
    }, async (request, reply) => {
        const result = metricEventSchema.safeParse(request.body);

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
