import { describe, expect, it } from "vitest";

import { evaluateDepcruiseGate, runLintDepsCli } from "./lint-deps.js";

describe("evaluateDepcruiseGate", () => {
  it("accepts a non-empty cruise summary", () => {
    expect(evaluateDepcruiseGate('{"summary":{"totalCruised":12,"error":0,"warn":0}}')).toEqual({
      ok: true,
    });
  });

  it("rejects zero modules cruised", () => {
    const result = evaluateDepcruiseGate('{"summary":{"totalCruised":0,"error":0,"warn":0}}');
    expect(result).toMatchObject({
      ok: false,
      message: expect.stringMatching(/0 modules/),
    });
  });

  it("rejects missing totalCruised", () => {
    const result = evaluateDepcruiseGate('{"summary":{"error":0}}');
    expect(result.ok).toBe(false);
  });

  it("rejects invalid JSON", () => {
    const result = evaluateDepcruiseGate("not-json");
    expect(result.ok).toBe(false);
  });

  it("rejects non-object JSON", () => {
    const result = evaluateDepcruiseGate("[]");
    expect(result).toMatchObject({ ok: false, message: expect.stringMatching(/not an object/) });
  });

  it("rejects invalid summary shape", () => {
    const result = evaluateDepcruiseGate('{"summary":"bad"}');
    expect(result).toMatchObject({ ok: false, message: expect.stringMatching(/summary was not an object/) });
  });
});

describe("runLintDepsCli", () => {
  it("fails when zero modules are cruised", async () => {
    const code = await runLintDepsCli(["src"], {
      ensureSonarWorkspace: () => {},
      runJson: () => Promise.resolve({ status: 0, stdout: '{"summary":{"totalCruised":0}}', stderr: "" }),
      runErr: () => Promise.resolve(0),
    });
    expect(code).toBe(1);
  });

  it("returns depcruise err output status on violations", async () => {
    const code = await runLintDepsCli([], {
      ensureSonarWorkspace: () => {},
      runJson: () => Promise.resolve({ status: 0, stdout: '{"summary":{"totalCruised":12}}', stderr: "" }),
      runErr: () => Promise.resolve(2),
    });
    expect(code).toBe(2);
  });

  it("returns json status when err output passes but json failed", async () => {
    const code = await runLintDepsCli([], {
      ensureSonarWorkspace: () => {},
      runJson: () => Promise.resolve({ status: 3, stdout: '{"summary":{"totalCruised":12}}', stderr: "warn\n" }),
      runErr: () => Promise.resolve(0),
    });
    expect(code).toBe(3);
  });

  it("succeeds when json and err outputs pass", async () => {
    const code = await runLintDepsCli([], {
      ensureSonarWorkspace: () => {},
      runJson: () =>
        Promise.resolve({
          status: 0,
          stdout: '{"summary":{"totalCruised":12,"error":0,"warn":1}}',
          stderr: "",
        }),
      runErr: () => Promise.resolve(0),
    });
    expect(code).toBe(0);
  });
});