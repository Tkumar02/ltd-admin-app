import dayjs from "dayjs";

/**
 * Returns filing items with computed deadlines for a given company.
 * Pure function: no Firestore, no React, easy to test.
 * 
 * @param {Object} company - The company document
 * @param {string} todayISO - Today's date in YYYY-MM-DD
 * @param {Array} history - The local filing history
 * @param {Object} chData - Data extracted from Companies House API
 */
export function computeFilingsDeadlines(company, todayISO, history = [], chData = null) {
  const today = dayjs(todayISO);
  const isDormant = !!company?.isDormant;

  const incorporationDate = company?.incorporationDate ? dayjs(company.incorporationDate) : null;
  const lastAccountsPeriodEnd = company?.lastAccountsPeriodEnd
    ? dayjs(company.lastAccountsPeriodEnd)
    : null;

  const tradingStarted =
    company?.accountingStart && dayjs(company.accountingStart).isBefore(today, "day");
  const accountingStart = tradingStarted ? dayjs(company.accountingStart) : null;

  // Helper to check history
  const hasHistoryFor = (type, periodEnd = null) => {
    return history.some((h) => {
      const isType = h.filingType === type;
      if (!isType) return false;
      if (!periodEnd) return true;
      const hEnd = h.submissionDetails?.periodEnd;
      return hEnd && dayjs(hEnd).isSame(dayjs(periodEnd), "day");
    });
  };

  // --- 1) Confirmation Statement (CS01) ---
  let confDeadline = null;
  let confWindowOpens = null;
  let missingConf = [];
  let confSource = "Company Settings Estimate";

  // Hierarchy: CH -> History -> Doc
  if (chData?.nextConfirmationDue) {
    confDeadline = dayjs(chData.nextConfirmationDue);
    confSource = "Companies House Official";
  } else {
    const lastCS01Date = company.lastCS01FiledOn ? dayjs(company.lastCS01FiledOn) : incorporationDate;
    if (company.lastCS01FiledOn) confSource = "Local Filing History";
    
    if (lastCS01Date) {
      confDeadline = lastCS01Date.add(1, "year").add(14, "day");
      while (confDeadline.isBefore(today, "day")) {
        confDeadline = confDeadline.add(1, "year");
      }
    }
  }
  if (confDeadline) confWindowOpens = confDeadline.subtract(14, "day");

  // Missing CS01 logic (always based on History vs expected dates since inc)
  if (incorporationDate) {
    const yearsSinceInc = today.diff(incorporationDate, "year");
    for (let i = 1; i <= yearsSinceInc; i++) {
      const anniversary = incorporationDate.add(i, "year");
      const deadline = anniversary.add(14, "day");
      if (deadline.isBefore(today, "day")) {
        const wasFiled = history.some(h => {
          if (h.filingType !== "Confirmation Statement") return false;
          const filedOn = dayjs(h.dateFiled || h.createdAt?.toDate?.());
          return filedOn.isAfter(anniversary.subtract(30, "day")) && filedOn.isBefore(deadline.add(60, "day"));
        });
        if (!wasFiled) missingConf.push({ label: anniversary.year().toString(), date: anniversary.format("YYYY-MM-DD") });
      }
    }
  }

  // --- 2) Accounts ---
  let accountsDeadline = null;
  let accountsWindowOpens = null;
  let nextAccountsPeriodEnd = null;
  let missingAccounts = [];
  let accountsSource = "Company Settings Estimate";

  if (chData?.nextAccountsDue) {
    accountsDeadline = dayjs(chData.nextAccountsDue);
    nextAccountsPeriodEnd = chData.nextAccountsEnd ? dayjs(chData.nextAccountsEnd) : null;
    accountsSource = "Companies House Official";
  } else {
    if (lastAccountsPeriodEnd) accountsSource = "Local Filing History";
    nextAccountsPeriodEnd = lastAccountsPeriodEnd ? lastAccountsPeriodEnd.add(1, "year") : (incorporationDate ? incorporationDate.add(1, "year").endOf("month") : null);
    
    if (nextAccountsPeriodEnd) {
      accountsDeadline = nextAccountsPeriodEnd.add(9, "month");
      while (accountsDeadline.isBefore(today, "day")) {
        nextAccountsPeriodEnd = nextAccountsPeriodEnd.add(1, "year");
        accountsDeadline = nextAccountsPeriodEnd.add(9, "month");
      }
    }
  }
  // Accounts window opens the day AFTER the period ends
  if (nextAccountsPeriodEnd) accountsWindowOpens = nextAccountsPeriodEnd.add(1, "day");

  // Missing Accounts gaps (Local History vs Expected)
  if (incorporationDate) {
    let checkPeriodEnd = incorporationDate.add(1, "year").endOf("month");
    while (checkPeriodEnd.add(9, "month").isBefore(today, "day")) {
      const formattedEnd = checkPeriodEnd.format("YYYY-MM-DD");
      if (!hasHistoryFor("Annual Accounts", formattedEnd)) {
        missingAccounts.push({
          label: checkPeriodEnd.format("MMM YYYY"),
          periodStart: checkPeriodEnd.subtract(1, "year").add(1, "day").format("YYYY-MM-DD"),
          periodEnd: formattedEnd,
        });
      }
      checkPeriodEnd = checkPeriodEnd.add(1, "year");
    }
  }

  // --- 3) HMRC (Tax Return & Payment) ---
  let ct600Deadline = null;
  let ctPaymentDeadline = null;
  let hmrcWindowOpens = null;
  let missingHMRC = [];
  let hmrcSource = "Company Settings Estimate";

  // Show HMRC if trading OR if established (has last accounts)
  const showHMRC = tradingStarted || !!lastAccountsPeriodEnd || !!company?.lastCTPeriodEnd;
  const effectiveHMRCStart = accountingStart || incorporationDate;

  if (showHMRC && effectiveHMRCStart) {
    const lastCTEnd = company.lastCTPeriodEnd ? dayjs(company.lastCTPeriodEnd) : null;
    if (lastCTEnd) hmrcSource = "Local Filing History";

    let nextCTEnd = lastCTEnd ? lastCTEnd.add(1, "year") : effectiveHMRCStart.add(1, "year");
    ctPaymentDeadline = nextCTEnd.add(9, "month").add(1, "day");
    
    while (ctPaymentDeadline.isBefore(today, "day")) {
      nextCTEnd = nextCTEnd.add(1, "year");
      ctPaymentDeadline = nextCTEnd.add(9, "month").add(1, "day");
    }
    ct600Deadline = nextCTEnd.add(12, "month");
    
    // HMRC window technically opens the day after the period ends
    hmrcWindowOpens = nextCTEnd.add(1, "day");

    // Missing HMRC gaps
    let checkPeriodEnd = effectiveHMRCStart.add(1, "year");
    while (checkPeriodEnd.add(9, "month").isBefore(today, "day")) {
      const formattedEnd = checkPeriodEnd.format("YYYY-MM-DD");
      const hasCT = hasHistoryFor("Company Tax Return (CT600)", formattedEnd);
      const hasPay = history.some(h => 
        (h.filingType === "Corporation Tax Payment" || h.filingType === "Payment") && 
        h.submissionDetails?.periodEnd === formattedEnd
      );
      if (!hasCT || !hasPay) {
        missingHMRC.push({
          label: checkPeriodEnd.format("MMM YYYY"),
          periodStart: checkPeriodEnd.subtract(1, "year").add(1, "day").format("YYYY-MM-DD"),
          periodEnd: formattedEnd,
        });
      }
      checkPeriodEnd = checkPeriodEnd.add(1, "year");
    }
  }

  const items = [
    {
      title: isDormant ? "Dormant Accounts" : "Annual Accounts",
      deadline: accountsDeadline ? accountsDeadline.format("YYYY-MM-DD") : null,
      windowOpens: accountsWindowOpens ? accountsWindowOpens.format("YYYY-MM-DD") : null,
      missingFilings: missingAccounts,
      source: accountsSource,
    },
    {
      title: "Confirmation Statement",
      deadline: confDeadline ? confDeadline.format("YYYY-MM-DD") : null,
      windowOpens: confWindowOpens ? confWindowOpens.format("YYYY-MM-DD") : null,
      missingFilings: missingConf,
      source: confSource,
    },
  ];

  if (showHMRC) {
    items.push(
      {
        title: "Corporation Tax Payment",
        deadline: isDormant ? null : (ctPaymentDeadline ? ctPaymentDeadline.format("YYYY-MM-DD") : null),
        windowOpens: isDormant ? null : (hmrcWindowOpens ? hmrcWindowOpens.format("YYYY-MM-DD") : null),
        missingFilings: isDormant ? [] : missingHMRC,
        source: isDormant ? "Dormant Mode" : hmrcSource,
        statusOverride: isDormant ? "DORMANT" : null,
      },
      {
        title: "Company Tax Return (CT600)",
        deadline: isDormant ? null : (ct600Deadline ? ct600Deadline.format("YYYY-MM-DD") : null),
        windowOpens: isDormant ? null : (hmrcWindowOpens ? hmrcWindowOpens.format("YYYY-MM-DD") : null),
        missingFilings: isDormant ? [] : missingHMRC,
        source: isDormant ? "Dormant Mode" : hmrcSource,
        statusOverride: isDormant ? "DORMANT" : null,
      }
    );
  }

  return items;
}
