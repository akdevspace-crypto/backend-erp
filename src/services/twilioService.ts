import twilio from "twilio";
import { getTwilioEnv } from "../config/omnichannel.js";

let cachedClient: ReturnType<typeof twilio> | null = null;

const getTwilioClient = () => {
    if (!cachedClient) {
        const env = getTwilioEnv();
        cachedClient = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    }

    return cachedClient;
};

const toTwilioPhoneNumber = (value: string) => {
    const trimmed = String(value || "").trim();
    if (trimmed.startsWith("+")) return trimmed;

    const digits = trimmed.replace(/[^\d]/g, "");
    return digits ? `+${digits}` : trimmed;
};

export async function sendSMS(to: string, message: string) {
    const env = getTwilioEnv();

    return getTwilioClient().messages.create({
        body: message,
        from: env.TWILIO_PHONE_NUMBER,
        to: toTwilioPhoneNumber(to)
    });
}
