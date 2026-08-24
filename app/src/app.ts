import Fastify, {
    type FastifyInstance,
    type FastifyServerOptions,
} from "fastify";

export function buildApp(
    options: FastifyServerOptions = {},
): FastifyInstance {
    return Fastify({logger: true, ...options});
}
