import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUTH_COOKIE_NAME,
  authenticatedFetch,
  clearAuthToken,
  ensureAuthToken,
  getStoredAuthToken,
  isTokenExpired,
  isTokenForAddress,
  setAuthenticator,
  storeAuthToken,
  verifyAuthToken,
} from "./authSession";

const ADDRESS = "0xfE598f2f4F4e0aD4E2016aA33C4fD2a10A929BDC";

/** Build an unsigned JWT whose payload is what the code introspects. */
const makeToken = (payload: Record<string, unknown>) =>
  ["eyJhbGciOiJIUzI1NiJ9", btoa(JSON.stringify(payload)).replace(/=+$/, ""), "signature"].join(".");

const validToken = (address = ADDRESS) =>
  makeToken({ address: address.toLowerCase(), exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 });

const expiredToken = (address = ADDRESS) =>
  makeToken({ address: address.toLowerCase(), exp: Math.floor(Date.now() / 1000) - 60 });

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("authSession", () => {
  beforeEach(() => {
    clearAuthToken();
    setAuthenticator(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearAuthToken();
    setAuthenticator(null);
  });

  describe("token store", () => {
    it("returns a stored, unexpired token", () => {
      const token = validToken();
      storeAuthToken(token);

      expect(getStoredAuthToken()).toBe(token);
    });

    it("purges an expired token instead of handing it out", () => {
      storeAuthToken(expiredToken());

      expect(getStoredAuthToken()).toBeNull();
      expect(document.cookie).not.toContain(`${AUTH_COOKIE_NAME}=eyJ`);
    });

    it("keeps a token whose expiry cannot be read, leaving the verdict to the backend", () => {
      expect(isTokenExpired("not-a-jwt")).toBe(false);
    });

    it("matches a token against the wallet it was issued for", () => {
      const token = validToken();

      expect(isTokenForAddress(token, ADDRESS)).toBe(true);
      expect(isTokenForAddress(token, ADDRESS.toLowerCase())).toBe(true);
      expect(isTokenForAddress(token, "0x0000000000000000000000000000000000000001")).toBe(false);
      expect(isTokenForAddress(null, ADDRESS)).toBe(false);
    });
  });

  describe("ensureAuthToken", () => {
    it("reuses a usable token without prompting", async () => {
      const token = validToken();
      storeAuthToken(token);
      const authenticator = vi.fn();
      setAuthenticator(authenticator);

      await expect(ensureAuthToken()).resolves.toBe(token);
      expect(authenticator).not.toHaveBeenCalled();
    });

    it("prompts only once for concurrent callers", async () => {
      const token = validToken();
      const authenticator = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        storeAuthToken(token);
        return token;
      });
      setAuthenticator(authenticator);

      const results = await Promise.all([ensureAuthToken(), ensureAuthToken(), ensureAuthToken()]);

      expect(results).toEqual([token, token, token]);
      expect(authenticator).toHaveBeenCalledTimes(1);
    });

    it("allows a later attempt after a failed one", async () => {
      const authenticator = vi
        .fn()
        .mockRejectedValueOnce(new Error("user rejected the request"))
        .mockResolvedValueOnce(validToken());
      setAuthenticator(authenticator);

      await expect(ensureAuthToken()).rejects.toThrow("user rejected");
      await expect(ensureAuthToken()).resolves.toEqual(expect.stringContaining("."));
      expect(authenticator).toHaveBeenCalledTimes(2);
    });

    it("resolves to null when no wallet can sign", async () => {
      await expect(ensureAuthToken()).resolves.toBeNull();
    });
  });

  describe("authenticatedFetch", () => {
    it("attaches the stored token", async () => {
      const token = validToken();
      storeAuthToken(token);
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { status: true }));
      vi.stubGlobal("fetch", fetchMock);

      await authenticatedFetch("https://example.test/api");

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({
        Authorization: `Bearer ${token}`,
      });
    });

    it("re-authenticates and retries once when the backend rejects the token", async () => {
      const staleToken = validToken();
      const freshToken = validToken();
      storeAuthToken(staleToken);

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(403, { status: false, message: "Invalid or expired token" }))
        .mockResolvedValueOnce(jsonResponse(200, { status: true, data: "ok" }));
      vi.stubGlobal("fetch", fetchMock);

      const authenticator = vi.fn(async () => {
        storeAuthToken(freshToken);
        return freshToken;
      });
      setAuthenticator(authenticator);

      const response = await authenticatedFetch("https://example.test/api");

      expect(response?.status).toBe(200);
      expect(authenticator).toHaveBeenCalledTimes(1);
      expect((fetchMock.mock.calls[1][1] as RequestInit).headers).toMatchObject({
        Authorization: `Bearer ${freshToken}`,
      });
    });

    it("does not prompt for a signature on an authorization failure", async () => {
      storeAuthToken(validToken());
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse(403, { status: false, message: "Admin privileges required" }));
      vi.stubGlobal("fetch", fetchMock);

      const authenticator = vi.fn();
      setAuthenticator(authenticator);

      const response = await authenticatedFetch("https://example.test/api");

      expect(response?.status).toBe(403);
      expect(authenticator).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("leaves the rejected response body readable for the caller", async () => {
      storeAuthToken(validToken());
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(jsonResponse(403, { status: false, message: "Admin privileges required" }))
      );

      const response = await authenticatedFetch("https://example.test/api");

      await expect(response!.json()).resolves.toMatchObject({ message: "Admin privileges required" });
    });
  });

  describe("verifyAuthToken", () => {
    it("reports a valid session", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(jsonResponse(200, { status: true, data: { user: { address: ADDRESS } } }))
      );

      await expect(verifyAuthToken(validToken())).resolves.toMatchObject({ state: "valid" });
    });

    it("reports an explicitly rejected session", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(403, { message: "Invalid or expired token" })));

      await expect(verifyAuthToken(validToken())).resolves.toEqual({ state: "invalid" });
    });

    it("stays inconclusive on a network or server failure, so the session survives a blip", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
      await expect(verifyAuthToken(validToken())).resolves.toEqual({ state: "unknown" });

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(502, { message: "Bad gateway" })));
      await expect(verifyAuthToken(validToken())).resolves.toEqual({ state: "unknown" });
    });
  });
});
