import { describe } from "vitest";
import { fc, it } from "@fast-check/vitest";
import { createGreeting } from "./index.js";

describe("createGreeting", () => {
  it.prop([fc.option(fc.string(), { nil: undefined })])(
    "trims names and defaults when the name is missing or blank",
    (name) => {
      const trimmed = name?.trim() ?? "";
      const expected = trimmed.length > 0 ? `Hello, ${trimmed}!` : "Hello, world!";
      const withOptions = createGreeting(name === undefined ? {} : { name }) === expected;
      if (name === undefined) {
        return withOptions && createGreeting() === expected;
      }
      return withOptions;
    },
  );
});
