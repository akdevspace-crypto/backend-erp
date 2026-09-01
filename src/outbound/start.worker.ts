import dotenv from "dotenv";
import { validateOutboundWorkerEnv } from "../config/omnichannel.js";
import { logger } from "../shared/services/logger.js";
import { startOutboundWorker, stopOutboundWorker } from "./worker.runtime.js";

dotenv.config();

const workerLogger = logger.child({
    scope: "outbound-worker-standalone"
});

const shutdown = async (signal: string) => {
    workerLogger.info("Shutting down outbound worker", { signal });

    try {
        await stopOutboundWorker();
        process.exit(0);
    } catch (error) {
        workerLogger.error("Outbound worker shutdown failed", { error });
        process.exit(1);
    }
};

validateOutboundWorkerEnv();
await startOutboundWorker();
workerLogger.info("Outbound worker started");

process.on("SIGINT", () => {
    void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
});
