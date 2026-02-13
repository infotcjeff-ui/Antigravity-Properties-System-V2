import arcjet, { detectBot, fixedWindow, shield } from "@arcjet/next";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
    // matcher tells Next.js which routes to run the middleware on.
    // This matches all routes except static files and Next.js internals.
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

const aj = arcjet({
    key: process.env.ARCJET_KEY!, // Get your site key from https://app.arcjet.com
    rules: [
        // Shield protects your app from common attacks e.g. SQLi, XSS, CSRF.
        shield({
            mode: "DRY_RUN", // Try "LIVE" to block requests
        }),
        detectBot({
            mode: "DRY_RUN", // Try "LIVE" to block requests
            allow: [
                "CATEGORY:SEARCH_ENGINE", // Google, Bing, etc
                "CATEGORY:PREVIEW", // Slack, Discord, etc
                "CATEGORY:MONITOR", // Uptime monitors, etc
            ],
        }),
        // Create a fixed window rate limit. Other algorithms are supported.
        fixedWindow({
            mode: "DRY_RUN", // Try "LIVE" to block requests
            window: "60s", // 1 minute fixed window
            max: 100, // Allow 100 requests per window
        }),
    ],
});

export default async function middleware(request: NextRequest) {
    const decision = await aj.protect(request);

    if (decision.isDenied()) {
        return new NextResponse(null, {
            status: 403,
            statusText: "Forbidden"
        });
    }

    return NextResponse.next();
}
