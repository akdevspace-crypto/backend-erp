import axios from "axios";
import { getExotelEnv } from "../../config/omnichannel.js";
import { logger } from "../../shared/services/logger.js";

const exotelLogger = logger.child({ scope: "exotel-service" });

const extractXmlValue = (xml, tagName) => {
    const match = String(xml || "").match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, "i"));
    return match?.[1]?.trim() || null;
};

export const normalizeExotelCallStatus = (value) => {
    const normalized = String(value || "")
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, "_");

    switch (normalized) {
        case "INPROGRESS":
            return "IN_PROGRESS";
        case "NOANSWER":
            return "NO_ANSWER";
        default:
            return normalized || "RINGING";
    }
};

export const formatExotelDialablePhone = (value) => {
    const rawValue = String(value || "").trim();
    if (!rawValue) return "";

    const digits = rawValue.replace(/[^\d]/g, "");
    if (!digits) return "";

    if (digits.length === 10) {
        return `0${digits}`;
    }

    if (digits.length === 12 && digits.startsWith("91")) {
        return `0${digits.slice(2)}`;
    }

    return digits;
};

const parseExotelErrorMessage = (payload) =>
    extractXmlValue(payload, "Message")
    || extractXmlValue(payload, "RestException")
    || "Exotel call request failed";

export const parseExotelConnectResponse = (payload) => {
    const rawResponse = String(payload || "");
    const callSid = extractXmlValue(rawResponse, "Sid") || extractXmlValue(rawResponse, "sid");
    const status = normalizeExotelCallStatus(
        extractXmlValue(rawResponse, "Status") || extractXmlValue(rawResponse, "status") || "in-progress"
    );

    return {
        callSid,
        status,
        from: extractXmlValue(rawResponse, "From") || extractXmlValue(rawResponse, "from"),
        to: extractXmlValue(rawResponse, "To") || extractXmlValue(rawResponse, "to"),
        recordingUrl: extractXmlValue(rawResponse, "RecordingUrl") || extractXmlValue(rawResponse, "recordingurl"),
        rawResponse
    };
};

export const resolveExotelStatusCallbackUrl = (explicitUrl) => {
    const directUrl = String(explicitUrl || "").trim();
    if (directUrl) return directUrl;

    const env = getExotelEnv();
    if (env.EXOTEL_STATUS_CALLBACK_URL?.trim()) {
        return env.EXOTEL_STATUS_CALLBACK_URL.trim();
    }

    const baseUrl = String(process.env.BASE_URL || "").trim().replace(/\/+$/, "");
    return baseUrl ? `${baseUrl}/api/v1/webhooks/exotel/call-status` : "";
};

export async function makeOutboundExotelCall({
    agentPhone,
    customerPhone,
    statusCallback
}) {
    const env = getExotelEnv();
    const from = formatExotelDialablePhone(agentPhone);
    const to = formatExotelDialablePhone(customerPhone);

    if (!from) {
        throw new Error("Agent phone number is required to place an Exotel call");
    }

    if (!to) {
        throw new Error("Customer phone number is required to place an Exotel call");
    }

    const requestBody = new URLSearchParams();
    requestBody.set("From", from);
    requestBody.set("To", to);
    requestBody.set("CallerId", env.EXOTEL_CALLER_ID.trim());
    requestBody.set("CallType", "trans");
    requestBody.set("TimeOut", String(env.EXOTEL_CALL_TIMEOUT));
    requestBody.set("TimeLimit", String(env.EXOTEL_CALL_TIMELIMIT));

    if (statusCallback) {
        requestBody.set("StatusCallback", statusCallback);
    }

    const endpoint = `https://${env.EXOTEL_SUBDOMAIN.trim()}/v1/Accounts/${env.EXOTEL_SID.trim()}/Calls/connect`;
    const response = await axios.post(endpoint, requestBody.toString(), {
        auth: {
            username: env.EXOTEL_API_KEY.trim(),
            password: env.EXOTEL_API_TOKEN.trim()
        },
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        timeout: 15000,
        responseType: "text",
        validateStatus: () => true
    });

    if (response.status < 200 || response.status >= 300) {
        exotelLogger.error("Exotel outbound call failed", {
            statusCode: response.status,
            response: String(response.data || ""),
            from,
            to
        });
        throw new Error(parseExotelErrorMessage(response.data));
    }

    return {
        ...parseExotelConnectResponse(response.data),
        request: {
            from,
            to,
            statusCallback: statusCallback || null
        }
    };
}
