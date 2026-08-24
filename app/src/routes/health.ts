import type {FastifyPluginAsync} from "fastify";
import type {ApplicationState} from "../application-state.js";

const probeRouteOptions = {logLevel: "silent"} as const;

interface HealthRoutesOptions {
    state: ApplicationState;
}

export const healthRoutes: FastifyPluginAsync<HealthRoutesOptions> = async (
    app,
    {state},
) => {
    app.get("/health/live", probeRouteOptions, async () => ({status: "ok"}));
    app.get("/health/ready", probeRouteOptions, async (_request, reply) => {
        if (!state.isReady) {
            return reply.code(503).send({status: "not_ready"});
        }

        return {status: "ok"};
    });
};
