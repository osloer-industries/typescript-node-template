import { describe, expect, it } from "vitest";
import { createGreeting } from "./index.js";

describe("createGreeting", () => {
  it("uses a default name", () => expect(createGreeting()).toBe("Hello, world!"));
  it("uses a supplied name", () => expect(createGreeting({ name: "Oslo" })).toBe("Hello, Oslo!"));
  it("falls back for a blank name", () => expect(createGreeting({ name: "  " })).toBe("Hello, world!"));
});
