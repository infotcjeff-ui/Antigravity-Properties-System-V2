import arcjet, { detectBot, shield } from "@arcjet/next";
import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";

/**
 * Arcjet instance for Server Actions and API Routes.
 * This provides higher-level protection for specific sensitive operations.
 */
export const aj = arcjet({
    key: process.env.ARCJET_KEY!,
    rules: [
        shield({
            mode: "LIVE", // Block common attacks
        }),
        detectBot({
            mode: "LIVE", // Block bots/scrapers
            allow: [
                "CATEGORY:SEARCH_ENGINE",
                "CATEGORY:PREVIEW",
            ],
        }),
    ],
});

/**
 * Sanitizes an HTML string to prevent XSS attacks.
 * Uses DOMPurify with JSDOM for server-side compatibility.
 */
export const sanitizeInput = (html: string): string => {
    const window = new JSDOM("").window;
    const purify = DOMPurify(window);
    return purify.sanitize(html);
};

/**
 * Helper to verify a request with Arcjet in Server Actions.
 * Throws an error if the request is suspicious or blocked.
 */
export async function verifyRequest(req: Request) {
    const decision = await aj.protect(req);

    if (decision.isDenied()) {
        if (decision.reason.isShield()) {
            throw new Error("Potential attack detected");
        }
        if (decision.reason.isBot()) {
            throw new Error("Bot access denied");
        }
        if (decision.reason.isRateLimit()) {
            throw new Error("Too many requests");
        }
        throw new Error("Access denied");
    }

    return decision;
}
