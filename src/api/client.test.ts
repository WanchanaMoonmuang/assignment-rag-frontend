import { describe, expect, it } from "vitest";

import { ApiError, parseApiError } from "./client";

describe("parseApiError", () => {
  it("uses a FastAPI string detail", async () => {
    const error = await parseApiError(
      new Response(JSON.stringify({ detail: "Invalid username or password" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(error).toEqual(expect.objectContaining({ status: 401, message: "Invalid username or password" }));
  });

  it("combines FastAPI validation details", async () => {
    const error = await parseApiError(
      new Response(JSON.stringify({ detail: [{ loc: ["body", "username"], msg: "Required", type: "missing" }] }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe("Required");
    expect(error.details).toHaveLength(1);
  });

  it("falls back when the response is not JSON", async () => {
    const error = await parseApiError(new Response("Bad gateway", { status: 502 }));
    expect(error.message).toBe("The service is temporarily unavailable.");
  });
});
