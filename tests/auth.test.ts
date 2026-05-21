import { describe, expect, it } from "vitest";
import { createAuthorizer } from "../src/auth.js";

describe("createAuthorizer", () => {
  it("allows only configured Telegram users", () => {
    const auth = createAuthorizer([111, 222]);

    expect(auth.isAllowed(111)).toBe(true);
    expect(auth.isAllowed(333)).toBe(false);
    expect(auth.isAllowed(undefined)).toBe(false);
  });
});
