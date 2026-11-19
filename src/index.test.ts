import { describe, expect, it as vitestIt } from "vitest";
import { fc, it } from "@fast-check/vitest";
import { createGreeting } from "./index.js";

const defaultGreeting = "Hello, world!";

describe("createGreeting", () => {
  vitestIt("uses a default greeting when the name is omitted", () => {
    expect(createGreeting()).toBe(defaultGreeting);
  });

  vitestIt("uses a default greeting when the name is blank", () => {
    expect(createGreeting({ name: "   " })).toBe(defaultGreeting);
  });

  vitestIt("trims whitespace around the name", () => {
    expect(createGreeting({ name: "  Ada  " })).toBe("Hello, Ada!");
  });

  it.prop([fc.option(fc.string(), { nil: undefined })])(
    "trims names and defaults when the name is missing or blank",
    (name) => {
      const trimmed = name?.trim() ?? "";
      const expected = trimmed.length > 0 ? `Hello, ${trimmed}!` : defaultGreeting;
      const withOptions = createGreeting(name === undefined ? {} : { name }) === expected;
      if (name === undefined) {
        return withOptions && createGreeting() === expected;
      }
      return withOptions;
    },
  );
});
