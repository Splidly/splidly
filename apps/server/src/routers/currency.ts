import { currencyQuotes, eq } from "@splidly/db";
import {
  currencyCodeSchema,
  quoteRequestSchema,
  type RateSnapshot,
} from "@splidly/shared";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";

const frankfurterRateSchema = z.object({
  date: z.string(),
  base: currencyCodeSchema,
  quote: currencyCodeSchema,
  rate: z.number().positive(),
});

const frankfurterCurrencySchema = z.object({
  iso_code: currencyCodeSchema,
  name: z.string(),
  symbol: z.string().nullable().optional(),
});

export const currencyRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const response = await fetch(`${ctx.env.FRANKFURTER_URL}/v2/currencies`);
    if (!response.ok) {
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: "Currency service unavailable",
      });
    }
    return z.array(frankfurterCurrencySchema).parse(await response.json());
  }),

  quote: protectedProcedure
    .input(quoteRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const targets = [...new Set(input.targets)];
      const remoteTargets = targets.filter((target) => target !== input.base);
      let remoteRates: z.infer<typeof frankfurterRateSchema>[] = [];
      if (remoteTargets.length > 0) {
        const url = new URL("/v2/rates", ctx.env.FRANKFURTER_URL);
        url.searchParams.set("base", input.base);
        url.searchParams.set("quotes", remoteTargets.join(","));
        let response: Response;
        try {
          response = await fetch(url, {
            signal: AbortSignal.timeout(5_000),
          });
        } catch {
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message:
              "No fresh exchange rate is available. Try again shortly.",
          });
        }
        if (!response.ok) {
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: "Currency service unavailable",
          });
        }
        remoteRates = z
          .array(frankfurterRateSchema)
          .parse(await response.json());
      }

      const today = new Date().toISOString().slice(0, 10);
      const rates: RateSnapshot[] = targets.map((target) => {
        if (target === input.base) {
          return {
            base: input.base,
            quote: target,
            rate: "1",
            provider: "identity",
            providerDate: today,
            source: "automatic",
          };
        }
        const match = remoteRates.find((rate) => rate.quote === target);
        if (!match) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `No automatic ${input.base}/${target} rate is available`,
          });
        }
        return {
          base: match.base,
          quote: match.quote,
          rate: String(match.rate),
          provider: "Frankfurter",
          providerDate: match.date,
          source: "automatic",
        };
      });
      const expiresAt = new Date(Date.now() + 15 * 60 * 1_000);
      const [quote] = await ctx.db
        .insert(currencyQuotes)
        .values({
          userId: ctx.session.user.id,
          base: input.base,
          rates,
          expiresAt,
        })
        .returning();
      if (!quote) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return {
        id: quote.id,
        expiresAt: quote.expiresAt.toISOString(),
        rates,
      };
    }),
});
