import {buildApp} from "./app.js";
import {ApplicationState} from "./application-state.js";

const state = new ApplicationState();
const app = buildApp({}, {state});
const host = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);
let shutdownPromise: Promise<void> | undefined;

function beginShutdown(signal: NodeJS.Signals): void {
    if (shutdownPromise) {
        return;
    }

    state.markNotReady();
    app.log.info({signal}, "Graceful shutdown started");

    shutdownPromise = app.close()
        .then(() => {
            app.log.info("Graceful shutdown completed");
        })
        .catch((error: unknown) => {
            app.log.error({err: error}, "Graceful shutdown failed");
            process.exitCode = 1;
        });
}

process.once("SIGTERM", beginShutdown);
process.once("SIGINT", beginShutdown);

try {
    await app.listen({host, port});
} catch (error) {
    app.log.error(error);
    process.exitCode = 1;
    await app.close();
}
