import {startTelemetry} from "./telemetry/sdk.js";

const telemetry = await startTelemetry();

try {
    const {startServer} = await import("./server.js");
    await startServer(telemetry);
} catch (error) {
    console.error("Application startup failed", error);
    process.exitCode = 1;

    try {
        await telemetry.shutdown();
    } catch (shutdownError) {
        console.error("Telemetry shutdown failed", shutdownError);
    }
}
