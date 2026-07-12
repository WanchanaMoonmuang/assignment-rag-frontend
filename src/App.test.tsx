import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { API_BASE_URL } from "./api/client";
import { App } from "./App";
import { renderApp } from "./test/render";
import { server } from "./test/server";

describe("authentication flow", () => {
  it("signs in and stores the access token for the tab session", async () => {
    server.use(
      http.post(`${API_BASE_URL}/auth/login`, () =>
        HttpResponse.json({ access_token: "test-token", token_type: "bearer" }),
      ),
    );
    const user = userEvent.setup();
    renderApp(<App />);

    await user.type(screen.getByLabelText(/Username/), "admin");
    await user.type(screen.getByLabelText(/Password/), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "No conversation selected" })).toBeInTheDocument();
    expect(sessionStorage.getItem("knowledge-assistant.access-token")).toBe("test-token");
  });

  it("shows the backend login error", async () => {
    server.use(
      http.post(`${API_BASE_URL}/auth/login`, () =>
        HttpResponse.json({ detail: "Invalid username or password" }, { status: 401 }),
      ),
    );
    const user = userEvent.setup();
    renderApp(<App />);

    await user.type(screen.getByLabelText(/Username/), "admin");
    await user.type(screen.getByLabelText(/Password/), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid username or password");
    expect(sessionStorage.getItem("knowledge-assistant.access-token")).toBeNull();
  });

  it("restores a valid stored session and logs out", async () => {
    sessionStorage.setItem("knowledge-assistant.access-token", "stored-token");
    server.use(
      http.get(`${API_BASE_URL}/auth/me`, ({ request }) => {
        expect(request.headers.get("Authorization")).toBe("Bearer stored-token");
        return HttpResponse.json({ username: "admin" });
      }),
    );
    const user = userEvent.setup();
    renderApp(<App />);

    expect(await screen.findByText("admin")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Logout" }));
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(sessionStorage.getItem("knowledge-assistant.access-token")).toBeNull();
  });

  it("clears an expired stored session", async () => {
    sessionStorage.setItem("knowledge-assistant.access-token", "expired-token");
    server.use(
      http.get(`${API_BASE_URL}/auth/me`, () =>
        HttpResponse.json({ detail: "Invalid authentication token" }, { status: 401 }),
      ),
    );
    renderApp(<App />);

    expect(await screen.findByText("Your session expired. Sign in again to continue.")).toBeInTheDocument();
    await waitFor(() => expect(sessionStorage.getItem("knowledge-assistant.access-token")).toBeNull());
  });

  it("does not describe an unavailable profile check as an expired session", async () => {
    sessionStorage.setItem("knowledge-assistant.access-token", "stored-token");
    server.use(http.get(`${API_BASE_URL}/auth/me`, () => HttpResponse.error()));
    renderApp(<App />);

    expect(await screen.findByText("Unable to verify your session. Check the backend connection and retry.")).toBeInTheDocument();
    expect(sessionStorage.getItem("knowledge-assistant.access-token")).toBe("stored-token");
    expect(screen.getByRole("button", { name: "Retry session" })).toBeInTheDocument();
  });

  it("requires both credentials before sending a request", async () => {
    const user = userEvent.setup();
    renderApp(<App />);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter both your username and password.");
    expect(screen.getByLabelText(/Username/)).toHaveFocus();
  });

  it("expires the UI session when streamed chat setup returns 401", async () => {
    sessionStorage.setItem("knowledge-assistant.access-token", "expired-token");
    server.use(
      http.get(API_BASE_URL + "/auth/me", () => HttpResponse.json({ username: "admin" })),
      http.post(API_BASE_URL + "/chat/stream", () => HttpResponse.json({ detail: "Invalid token" }, { status: 401 })),
    );
    const user = userEvent.setup();
    renderApp(<App />);
    await screen.findByText("admin");
    await user.type(screen.getByRole("textbox", { name: "Question" }), "Question");
    await user.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(sessionStorage.getItem("knowledge-assistant.access-token")).toBeNull();
  });
});
