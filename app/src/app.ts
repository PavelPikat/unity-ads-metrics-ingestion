import Fastify, {
    type FastifyInstance,
    type FastifyServerOptions,
} from "fastify";
import {metricsRoutes} from "./routes/metrics.js";

export function buildApp(
    options: FastifyServerOptions = {},
): FastifyInstance {
    const app = Fastify({
        logger: true,
        bodyLimit: 16 * 1024,
        requestTimeout: 30_000,
        ...options,
    });

    app.register(metricsRoutes);

    return app;
}
