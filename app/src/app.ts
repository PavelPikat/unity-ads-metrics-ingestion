import Fastify, {
    type FastifyInstance,
    type FastifyServerOptions,
} from "fastify";
import type {MetricsPublisher} from "./publisher/metrics-publisher.js";
import {NoopMetricsPublisher} from "./publisher/noop-metrics-publisher.js";
import {metricsRoutes} from "./routes/metrics.js";

export function buildApp(
    options: FastifyServerOptions = {},
    publisher: MetricsPublisher = new NoopMetricsPublisher(),
): FastifyInstance {
    const app = Fastify({
        logger: true,
        bodyLimit: 16 * 1024,
        requestTimeout: 30_000,
        ...options,
    });

    app.register(metricsRoutes, {publisher});

    return app;
}
