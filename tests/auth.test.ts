import { describe, expect, it } from "vitest";
import { createAuthorizer } from "../src/auth.js";
import { authorizeStartUser } from "../src/telegram/bot.js";

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

    expect(auth.register(111)).toBe(true);
    expect(auth.isAllowed(111)).toBe(true);
    expect(auth.isAllowed(222)).toBe(false);
    expect(auth.allowedUserIds()).toEqual([111]);
  });

  it("does not duplicate already registered user", () => {
    const auth = createAuthorizer([111]);

    expect(auth.register(111)).toBe(false);
    expect(auth.isAllowed(111)).toBe(true);
    expect(auth.allowedUserIds()).toEqual([111]);
  });

  it("returns sorted allowed users for persistence", () => {
    const auth = createAuthorizer([333, 111]);

    auth.register(222);
    expect(auth.allowedUserIds()).toEqual([111, 222, 333]);
  });

  it("registers /start only while bootstrap allowlist is empty", () => {
    const auth = createAuthorizer([]);

    expect(authorizeStartUser(auth, 111)).toEqual({ status: "registered", userIds: [111] });
    expect(authorizeStartUser(auth, 222)).toEqual({ status: "denied", userIds: [111] });
    expect(auth.isAllowed(222)).toBe(false);
  });
});
