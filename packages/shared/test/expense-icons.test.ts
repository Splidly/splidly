import { describe, expect, it } from "vitest";
import {
  detectExpenseIconKey,
  normalizeExpenseIconKey,
} from "../src/expense-icons";

describe("detectExpenseIconKey", () => {
  it.each([
    ["Monthly apartment rent", "housing"],
    ["Warmmiete Juli", "housing"],
    ["REWE groceries", "groceries"],
    ["Lebensmitteleinkauf bei Edeka", "groceries"],
    ["Dinner at Luigi's", "dining"],
    ["Kaffee und Kuchen", "dining"],
    ["Beer at the pub", "drinks"],
    ["Bier in der Kneipe", "drinks"],
    ["DB train ticket", "transport"],
    ["Straßenbahn-Fahrkarte", "transport"],
    ["Shell petrol", "fuel"],
    ["Autotanken", "fuel"],
    ["Flight to Berlin", "travel"],
    ["Booking.com hotel", "travel"],
    ["New shoes from Zalando", "shopping"],
    ["Handyhülle", "shopping"],
    ["Cinema tickets", "entertainment"],
    ["Kinobesuch", "entertainment"],
    ["Dentist appointment", "health"],
    ["Zahnarztrechnung", "health"],
    ["Prescription medication", "pharmacy"],
    ["Apothekenbestellung", "pharmacy"],
    ["University tuition", "education"],
    ["Studiengebühr", "education"],
    ["Electricity bill", "bills"],
    ["Stromrechnung", "bills"],
    ["Netflix subscription", "subscriptions"],
    ["Spotify Monatsbeitrag", "subscriptions"],
    ["Birthday present", "gifts"],
    ["Geburtstagsgeschenk", "gifts"],
    ["Veterinarian", "pets"],
    ["Tierarztkosten", "pets"],
    ["Daycare", "childcare"],
    ["Kitabeitrag", "childcare"],
    ["Gym membership", "sports"],
    ["Fitnessstudio", "sports"],
    ["Hairdresser", "personal-care"],
    ["Friseurtermin", "personal-care"],
    ["Office supplies", "work"],
    ["Büromaterial", "work"],
    ["Bank fee", "finance"],
    ["Kontogebühr", "finance"],
    ["Car insurance", "insurance"],
    ["Autoversicherung", "insurance"],
    ["Income tax", "taxes"],
    ["Einkommensteuer", "taxes"],
    ["Something entirely uncategorized", "other"],
  ] as const)(
    "maps %s to %s",
    (name, expected) => {
      expect(detectExpenseIconKey(name)).toBe(expected);
    },
  );

  it("normalizes accents, punctuation, and German spelling variants", () => {
    expect(detectExpenseIconKey("  CAFÉ—Frühstück!!! ")).toBe("dining");
    expect(detectExpenseIconKey("STRASSENBAHN")).toBe("transport");
  });

  it("does not treat short text fragments as financial keywords", () => {
    expect(detectExpenseIconKey("Parents evening")).toBe("other");
    expect(detectExpenseIconKey("Vegas weekend")).toBe("other");
  });
});

describe("normalizeExpenseIconKey", () => {
  it("keeps a stored specific icon", () => {
    expect(normalizeExpenseIconKey("travel", "Restaurant")).toBe("travel");
  });

  it("detects an icon for old, missing, or invalid values", () => {
    expect(normalizeExpenseIconKey("other", "Restaurant")).toBe("dining");
    expect(normalizeExpenseIconKey(undefined, "Miete")).toBe("housing");
    expect(normalizeExpenseIconKey("unknown", "Apotheke")).toBe("pharmacy");
  });
});
