import { computeFilingsDeadlines } from "./filingsDeadlines";
import { describe, it, expect, test } from "vitest";

describe("computeFilingsDeadlines", () => {
  const today = "2026-02-22";

  it("First year accounts deadline = incorporation + 21 months", () => {
    const company = {
      incorporationDate: "2025-01-10",
      lastAccountsPeriodEnd: null,
      accountingStart: null,
    };

    const items = computeFilingsDeadlines(company, today);
    const accounts = items.find(i => i.title === "Annual Accounts");

    // 2025-01-10 + 21 months = 2026-10-10
    expect(accounts.deadline).toBe("2026-10-10");
  });

  test("Established accounts deadline = nextPeriodEnd + 9 months", () => {
    const company = {
      incorporationDate: "2020-01-01",
      lastAccountsPeriodEnd: "2024-12-31",
      accountingStart: "2020-02-01",
    };

    const items = computeFilingsDeadlines(company, today);
    const accounts = items.find(i => i.title === "Annual Accounts");

    // nextPeriodEnd = 2025-12-31
    // deadline = 2025-12-31 + 9 months = 2026-09-30
    expect(accounts.deadline).toBe("2026-09-30");
  });

  test("Corporation Tax payment deadline = nextPeriodEnd + 9 months + 1 day", () => {
    const company = {
      incorporationDate: "2020-01-01",
      lastAccountsPeriodEnd: "2024-12-31",
      accountingStart: "2020-02-01",
    };

    const items = computeFilingsDeadlines(company, today);
    const ctPay = items.find(i => i.title === "Corporation Tax Payment");

    // nextPeriodEnd = 2025-12-31
    // +9 months = 2026-09-30
    // +1 day = 2026-10-01
    expect(ctPay.deadline).toBe("2026-10-01");
  });

  test("CT600 deadline = nextPeriodEnd + 12 months", () => {
    const company = {
      incorporationDate: "2020-01-01",
      lastAccountsPeriodEnd: "2024-12-31",
      accountingStart: "2020-02-01",
    };

    const items = computeFilingsDeadlines(company, today);
    const ct600 = items.find(i => i.title === "Company Tax Return (CT600)");

    // nextPeriodEnd = 2025-12-31; +12 months = 2026-12-31
    expect(ct600.deadline).toBe("2026-12-31");
  });

  test("If trading started but no lastAccountsPeriodEnd yet, HMRC deadlines are estimated", () => {
    const company = {
      incorporationDate: "2025-06-01",
      lastAccountsPeriodEnd: null,
      accountingStart: "2025-06-10",
    };

    const items = computeFilingsDeadlines(company, today);
    const ctPay = items.find(i => i.title === "Corporation Tax Payment");
    const ct600 = items.find(i => i.title === "Company Tax Return (CT600)");

    expect(ctPay).toBeTruthy();
    expect(ct600).toBeTruthy();
    
    // nextPeriodEnd estimated as 2026-06-30
    // +9 months = 2027-03-30
    // +1 day = 2027-04-01 (Wait, June 30 + 9 months is March 30? June 6, July 7, Aug 8, Sep 9, Oct 10, Nov 11, Dec 12, Jan 1, Feb 2, Mar 3. Yes, Mar 30)
    // Actually, dayjs(2026-06-30).add(9, 'month') = 2027-03-30.
    // + 1 day = 2027-03-31.
    expect(ctPay.deadline).toBe("2027-03-31");
    expect(ct600.deadline).toBe("2027-06-30");
  });

  test("If accountingStart missing or in future, HMRC items not returned", () => {
    const company = {
      incorporationDate: "2025-06-01",
      lastAccountsPeriodEnd: "2025-12-31",
      accountingStart: "2026-03-01", // future vs today
    };

    const items = computeFilingsDeadlines(company, today);
    const titles = items.map(i => i.title);

    expect(titles).not.toContain("Corporation Tax Payment");
    expect(titles).not.toContain("Company Tax Return (CT600)");
  });

  test("Confirmation Statement deadline should not jump to next year if still within the 14-day window", () => {
    // Incorporation: 2025-01-10
    // Anniversary: 2026-01-10
    // Deadline: 2026-01-24
    // Today: 2026-01-15 (Window is still open)
    const todayWithinWindow = "2026-01-15";
    const company = {
      incorporationDate: "2025-01-10",
    };

    const items = computeFilingsDeadlines(company, todayWithinWindow);
    const conf = items.find(i => i.title === "Confirmation Statement");

    // Should be 2026, NOT 2027
    expect(conf.deadline).toBe("2026-01-24");
  });
});