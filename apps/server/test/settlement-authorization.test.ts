import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { assertSettlementParticipant } from "../src/routers/settlements";

describe("settlement participant authorization", () => {
  it("allows either person involved in the debt", () => {
    expect(() =>
      assertSettlementParticipant("payer", "payer", "recipient"),
    ).not.toThrow();
    expect(() =>
      assertSettlementParticipant("recipient", "payer", "recipient"),
    ).not.toThrow();
  });

  it("rejects another member of the same group", () => {
    try {
      assertSettlementParticipant("other-member", "payer", "recipient");
      throw new Error("Expected authorization to fail");
    } catch (cause) {
      expect(cause).toBeInstanceOf(TRPCError);
      expect((cause as TRPCError).code).toBe("FORBIDDEN");
      expect((cause as Error).message).toBe(
        "Only the people involved can record this settlement",
      );
    }
  });
});
