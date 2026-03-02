import dayjs from "dayjs";

/**
 * Returns filing items with computed deadlines for a given company.
 * Pure function: no Firestore, no React, easy to test.
 */
export function computeFilingsDeadlines(company, todayISO) {
  const today = dayjs(todayISO);

  const incorporationDate = company?.incorporationDate ? dayjs(company.incorporationDate) : null;
  const lastAccountsPeriodEnd = company?.lastAccountsPeriodEnd
    ? dayjs(company.lastAccountsPeriodEnd)
    : null;

  const isFirstYear = !lastAccountsPeriodEnd;

  // --- Confirmation Statement (anniversary + 14 days) ---
  let confDeadline = null;
  let confWindowOpens = null;

  if (incorporationDate) {
    const anniversary = incorporationDate.year(today.year());
    confDeadline = anniversary.isBefore(today.subtract(1, "day"))
      ? anniversary.add(1, "year").add(14, "day")
      : anniversary.add(14, "day");
    confWindowOpens = confDeadline.subtract(14, "day");
  }

  // --- Accounts ---
  let accountsDeadline = null;
  let accountsWindowOpens = null;
  let nextPeriodEnd = null;

  if (incorporationDate && isFirstYear) {
    // First accounts deadline: 21 months from incorporation
    accountsDeadline = incorporationDate.add(21, "month");
    accountsWindowOpens = incorporationDate; // open any time
  } else if (lastAccountsPeriodEnd) {
    // Next statutory period end
    nextPeriodEnd = lastAccountsPeriodEnd.add(1, "year");
    accountsDeadline = nextPeriodEnd.add(9, "month");
    accountsWindowOpens = nextPeriodEnd.add(1, "day");
  }

  // --- HMRC (only show if accountingStart exists and is in the past) ---
  const tradingStarted =
    company?.accountingStart && dayjs(company.accountingStart).isBefore(today, "day");

  const canComputeHMRC = tradingStarted && !!nextPeriodEnd;

  const items = [
    {
      title: "Confirmation Statement",
      deadline: confDeadline ? confDeadline.format("YYYY-MM-DD") : null,
      windowOpens: confWindowOpens ? confWindowOpens.format("YYYY-MM-DD") : null,
    },
    {
      title: "Annual Accounts",
      deadline: accountsDeadline ? accountsDeadline.format("YYYY-MM-DD") : null,
      windowOpens: accountsWindowOpens ? accountsWindowOpens.format("YYYY-MM-DD") : null,
    },
  ];

  if (tradingStarted) {
    items.push(
      {
        title: "Corporation Tax Payment",
        deadline: canComputeHMRC ? nextPeriodEnd.add(9, "month").add(1, "day").format("YYYY-MM-DD") : null,
        windowOpens: canComputeHMRC ? nextPeriodEnd.add(1, "day").format("YYYY-MM-DD") : null,
      },
      {
        title: "Company Tax Return (CT600)",
        deadline: canComputeHMRC ? nextPeriodEnd.add(12, "month").format("YYYY-MM-DD") : null,
        windowOpens: canComputeHMRC ? nextPeriodEnd.add(1, "day").format("YYYY-MM-DD") : null,
      }
    );
  }

  return items;
}