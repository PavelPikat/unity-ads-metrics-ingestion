import Fastify, {
    type FastifyInstance,
    type FastifyServerOptions,
} from "fastify";
import {metricsRoutes} from "./routes/metrics.js";

export function buildApp(
    options: FastifyServerOptions = {},
): FastifyInstance {
    const app = Fastify({logger: true, ...options});

    app.register(metricsRoutes);

    return app;
}
