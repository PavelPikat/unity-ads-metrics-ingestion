import {buildApp} from "./app.js";
import {ApplicationState} from "./application-state.js";
import {loadConfig} from "./config.js";
import {PublishAdmissionController} from "./publisher/publish-admission-controller.js";

const config = loadConfig();
const state = new ApplicationState();
const admission = new PublishAdmissionController(config.maxInflightPublishes);
const app = buildApp({}, {admission, state});
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
    await app.listen({host: config.host, port: config.port});
} catch (error) {
    app.log.error(error);
    process.exitCode = 1;
    await app.close();
}
