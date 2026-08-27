import { assertAuthRuntimeConfigured, auth } from "@/auth/server";

async function configuredHandler(request: Request) {
  try {
    assertAuthRuntimeConfigured();
    return await auth.handler(request);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("BETTER_AUTH_SECRET")) {
      return Response.json({ code: "AUTH_NOT_CONFIGURED", message: error.message }, { status: 503 });
    }
    throw error;
  }
}

export const GET = configuredHandler;
export const POST = configuredHandler;
export const PATCH = configuredHandler;
export const PUT = configuredHandler;
export const DELETE = configuredHandler;
