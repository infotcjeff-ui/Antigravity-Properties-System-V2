import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
    // matcher tells Next.js which routes to run the middleware on.
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

export default function middleware(request: NextRequest) {
    return NextResponse.next();
}
