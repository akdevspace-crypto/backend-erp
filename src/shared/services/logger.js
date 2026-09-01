const LOG_LEVELS = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40
};

const resolveLevel = () => {
    const configured = String(process.env.LOG_LEVEL || "info").trim().toLowerCase();
    return LOG_LEVELS[configured] ? configured : "info";
};

const activeLevel = resolveLevel();
const activeLevelWeight = LOG_LEVELS[activeLevel];

const serializeError = (error) => {
    if (!error) return undefined;
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack
        };
    }

    return error;
};

const toPayload = (level, bindings, message, context) => {
    const normalizedContext = context && typeof context === "object"
        ? { ...context }
        : {};

    if (normalizedContext.error) {
        normalizedContext.error = serializeError(normalizedContext.error);
    }

    if (normalizedContext.err) {
        normalizedContext.error = serializeError(normalizedContext.err);
        delete normalizedContext.err;
    }

    return {
        level,
        timestamp: new Date().toISOString(),
        service: "erp-omnichannel",
        environment: process.env.NODE_ENV || "development",
        message,
        ...bindings,
        ...normalizedContext
    };
};

const writeLog = (level, bindings, firstArg, secondArg) => {
    if (LOG_LEVELS[level] < activeLevelWeight) return;

    const hasMessageFirst = typeof firstArg === "string";
    const message = hasMessageFirst ? firstArg : (typeof secondArg === "string" ? secondArg : "");
    const context = hasMessageFirst ? secondArg : firstArg;
    const payload = toPayload(level, bindings, message, context);
    const sink = level === "debug" ? console.log : console[level];
    sink(JSON.stringify(payload));
};

const createLogger = (bindings = {}) => ({
    child(childBindings = {}) {
        return createLogger({ ...bindings, ...childBindings });
    },
    debug(firstArg, secondArg) {
        writeLog("debug", bindings, firstArg, secondArg);
    },
    info(firstArg, secondArg) {
        writeLog("info", bindings, firstArg, secondArg);
    },
    warn(firstArg, secondArg) {
        writeLog("warn", bindings, firstArg, secondArg);
    },
    error(firstArg, secondArg) {
        writeLog("error", bindings, firstArg, secondArg);
    }
});

export const logger = createLogger();
export const createLoggerWithBindings = (bindings) => logger.child(bindings);
