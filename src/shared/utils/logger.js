const serializeError = (error) => {
    if (!error) return null;

    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack
        };
    }

    if (typeof error === "object") {
        return error;
    }

    return { message: String(error) };
};

const sanitizeValue = (value) => {
    if (value instanceof Date) {
        return value.toISOString();
    }

    if (value instanceof Error) {
        return serializeError(value);
    }

    if (Array.isArray(value)) {
        return value.map((item) => sanitizeValue(item));
    }

    if (value && typeof value === "object") {
        return Object.entries(value).reduce((result, [key, entryValue]) => {
            result[key] = sanitizeValue(entryValue);
            return result;
        }, {});
    }

    return value;
};

const writeLog = (level, message, context = {}) => {
    const entry = sanitizeValue({
        timestamp: new Date().toISOString(),
        level,
        message,
        ...context
    });

    const payload = JSON.stringify(entry);

    if (level === "error") {
        console.error(payload);
        return;
    }

    if (level === "warn") {
        console.warn(payload);
        return;
    }

    console.log(payload);
};

const makeLogger = (baseContext = {}) => ({
    child(extraContext = {}) {
        return makeLogger({
            ...baseContext,
            ...extraContext
        });
    },
    debug(message, context = {}) {
        writeLog("debug", message, { ...baseContext, ...context });
    },
    info(message, context = {}) {
        writeLog("info", message, { ...baseContext, ...context });
    },
    warn(message, context = {}) {
        writeLog("warn", message, { ...baseContext, ...context });
    },
    error(message, context = {}) {
        writeLog("error", message, { ...baseContext, ...context });
    }
});

export const logger = makeLogger({ service: "erp-backend" });
