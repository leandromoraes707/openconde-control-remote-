import { describe, expect, it } from "vitest";
import { createAuthorizer } from "../src/auth.js";

describe("createAuthorizer", () => {
  it("allows only configured Telegram users", () => {
    const auth = createAuthorizer([111, 222]);

    expect(auth.isAllowed(111)).toBe(true);
    expect(auth.isAllowed(333)).toBe(false);
    expect(auth.isAllowed(undefined)).toBe(false);
  });

  it("starts with empty allowlist in bootstrap mode", () => {
    const auth = createAuthorizer([]);

    expect(auth.isAllowed(111)).toBe(false);
    expect(auth.isAllowed(undefined)).toBe(false);
  });

  it("registers new user via register()", () => {
    const auth = createAuthorizer([]);

    auth.register(111);
    expect(auth.isAllowed(111)).toBe(true);
    expect(auth.isAllowed(222)).toBe(false);
  });

  it("does not duplicate already registered user", () => {
    const auth = createAuthorizer([111]);

    auth.register(111);
    expect(auth.isAllowed(111)).toBe(true);
  });
});
