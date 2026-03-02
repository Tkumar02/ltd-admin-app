import dayjs from "dayjs";
import { db } from "../firebase/firebaseConfig";
import {
  collection,
  doc,
  query,
  where,
  getDocs,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";

/**
 * Demo seeding strategy:
 * - Uses demoSeed=true on every created doc for safe deletion.
 * - Generates:
 *   companies/{companyId} anchors
 *   companies/{companyId}/transactions (expenses)
 *   companies/{companyId}/other_revenue (manual income)
 *   invoices (top-level, paid invoices matching businessName)
 *   companies/{companyId}/filingHistory
 *   companies/{companyId}/registerUpdates
 */

const clampYears = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return 3;
  return Math.max(1, Math.min(10, Math.floor(x)));
};

// deterministic-ish pseudo random (so demos are stable between runs)
const mulberry32 = (seed) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const money = (n) => Number(Number(n || 0).toFixed(2));

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

const pad2 = (n) => String(n).padStart(2, "0");

const makeInvoiceNumber = (date, idx) =>
  `INV-${date.format("YYYY")}${pad2(date.month() + 1)}-${pad2(idx + 1)}`;

export async function seedDemoData({
  companyId,
  companyName,
  userEmail,
  years = 3,
  scenario = "UP_TO_DATE", // UP_TO_DATE | MISSED
}) {
  if (!companyId) throw new Error("Missing companyId");
  years = clampYears(years);

  const rng = mulberry32(
    // seed derived from companyId length + years for repeatability
    (companyId.length + years * 101 + (scenario === "MISSED" ? 999 : 111)) >>> 0
  );

  const today = dayjs();
  const batch = writeBatch(db);

  const companyRef = doc(db, "companies", companyId);

  // ---- Anchors (drive Filings + periods logic) ----
  // Choose an incorporation date if you don't already have one in Firestore
  // We don't read the company doc here; we just write sensible anchors for demo.
  const inc = today.subtract(Math.max(2, years + 1), "year").month(0).date(10);
  const accountingStart = inc.add(20, "day");

  // Make lastAccountsPeriodEnd either recent (UP_TO_DATE) or older (MISSED)
  const lastAccountsPeriodEnd =
    scenario === "UP_TO_DATE"
      ? dayjs(`${today.year() - 1}-12-31`)
      : dayjs(`${today.year() - 2}-12-31`);

batch.set(companyRef, {
     email: String(userEmail || "").trim().toLowerCase(),
     name: companyName || "Demo Company Ltd",
     incorporationDate: inc.format("YYYY-MM-DD"),
     accountingStart: accountingStart.format("YYYY-MM-DD"),
     lastAccountsPeriodEnd: lastAccountsPeriodEnd.format("YYYY-MM-DD"),
     isFirstYear: false,
     demoSeed: true,
     demoUpdatedAt: serverTimestamp(),
}, { merge: true });

  // ---- Generate ledger/invoices range ----
  // We'll generate monthly activity for "years" back from lastAccountsPeriodEnd.
  const startDate = lastAccountsPeriodEnd.subtract(years, "year").add(1, "day");
  const endDate = today;

  const expensePayees = [
    "Amazon",
    "Google Workspace",
    "HMRC",
    "Office Supplies Ltd",
    "Trainline",
    "Software Co",
    "Marketing Agency",
    "Insurance Broker",
  ];

  const expenseCats = [
    "Software",
    "Travel",
    "Office",
    "Marketing",
    "Insurance",
    "Accountancy",
    "Utilities",
  ];

  const clients = ["Acme Ltd", "Bluebird Studio", "Northstar Group", "Citrus Co", "Orbit Digital"];
  const invoiceServices = ["Consulting", "Development", "Design", "Retainer", "Support"];

  const otherRevSources = ["Grant", "Director's Loan (In)", "Refund"];
  const otherRevCats = ["Grant", "Director's Loan (In)", "Tax Refund (VAT/Corp Tax)", "Other"];

  // refs
  const txRef = collection(db, "companies", companyId, "transactions");
  const otherRef = collection(db, "companies", companyId, "other_revenue");
  const invRef = collection(db, "invoices");
  const filingRef = collection(db, "companies", companyId, "filingHistory");
  const regRef = collection(db, "companies", companyId, "registerUpdates");

  // ---- Monthly loop ----
  let cursor = startDate.startOf("month");
  let invoiceIdx = 0;

  while (cursor.isBefore(endDate, "day")) {
    // create 1–4 paid invoices in this month
    const invCount = 1 + Math.floor(rng() * 4);

    for (let i = 0; i < invCount; i++) {
      const day = 1 + Math.floor(rng() * 27);
      const date = cursor.date(day);

      const total = money(1200 + rng() * 6000); // £1.2k–£7.2k
      const clientName = pick(rng, clients);
      const service = pick(rng, invoiceServices);

      const invDoc = doc(invRef);
      batch.set(invDoc, {
        demoSeed: true,
        createdAt: serverTimestamp(),
        date: date.format("YYYY-MM-DD"),
        paid: true,
        total,
        clientName,
        // IMPORTANT: your app matches invoices by businessName === company.name
        businessName: (companyName || "Demo Company Ltd").trim(),
        companyId,
        userEmail: userEmail || "",
        invoiceNumber: makeInvoiceNumber(date, invoiceIdx++),
        description: `${service} (${date.format("MMM YYYY")})`,
      });
    }

    // create 3–8 expenses in this month
    const expCount = 3 + Math.floor(rng() * 6);
    for (let i = 0; i < expCount; i++) {
      const day = 1 + Math.floor(rng() * 27);
      const date = cursor.date(day);

      const amount = money(20 + rng() * 650); // £20–£670
      const payee = pick(rng, expensePayees);
      const category = pick(rng, expenseCats);

      const tDoc = doc(txRef);
      batch.set(tDoc, {
        demoSeed: true,
        createdAt: serverTimestamp(),
        date: date.format("YYYY-MM-DD"),
        amount,
        payee,
        category,
        notes: `Demo expense: ${category}`,
      });
    }

    // create 0–2 manual revenue items in this month (including some non-taxable)
    const otherCount = Math.floor(rng() * 3);
    for (let i = 0; i < otherCount; i++) {
      const day = 1 + Math.floor(rng() * 27);
      const date = cursor.date(day);

      const cat = pick(rng, otherRevCats);
      const source = pick(rng, otherRevSources);

      // Keep DLA and refunds smaller; grants can be big
      const amount =
        cat === "Director's Loan (In)"
          ? money(200 + rng() * 2000)
          : cat === "Tax Refund (VAT/Corp Tax)"
          ? money(100 + rng() * 900)
          : cat === "Grant"
          ? money(1000 + rng() * 10000)
          : money(200 + rng() * 4000);

      const oDoc = doc(otherRef);
      batch.set(oDoc, {
        demoSeed: true,
        createdAt: serverTimestamp(),
        date: date.format("YYYY-MM-DD"),
        amount,
        payee: source,
        source,
        category: cat,
        notes: `Demo other revenue: ${cat}`,
      });
    }

    cursor = cursor.add(1, "month");
  }

  // ---- Filings history (N years) ----
  for (let i = 0; i < years; i++) {
    const periodEnd = lastAccountsPeriodEnd.subtract(i, "year");
    const periodStart = periodEnd.subtract(1, "year").add(1, "day");

    const accountsDeadline = periodEnd.add(9, "month");
    const ctPayDeadline = periodEnd.add(9, "month").add(1, "day");
    const ct600Deadline = periodEnd.add(12, "month");

    const late = scenario === "MISSED" && i % 2 === 0;
    const lateDays = 45;

    const accountsFiledOn = late
      ? accountsDeadline.add(lateDays, "day")
      : accountsDeadline.subtract(10, "day");
    const ctPayFiledOn = late
      ? ctPayDeadline.add(lateDays, "day")
      : ctPayDeadline.subtract(5, "day");
    const ct600FiledOn = late
      ? ct600Deadline.add(lateDays, "day")
      : ct600Deadline.subtract(15, "day");

    const taxLiability = money(2500 + rng() * 12000);

    batch.set(doc(filingRef), {
      demoSeed: true,
      createdAt: serverTimestamp(),
      filingType: "Annual Accounts",
      dateFiled: accountsFiledOn.format("YYYY-MM-DD"),
      submissionDetails: {
        periodStart: periodStart.format("YYYY-MM-DD"),
        periodEnd: periodEnd.format("YYYY-MM-DD"),
        turnover: String(money(90000 + rng() * 120000)),
        profit: String(money(12000 + rng() * 60000)),
      },
    });

    batch.set(doc(filingRef), {
      demoSeed: true,
      createdAt: serverTimestamp(),
      filingType: "Corporation Tax Payment",
      dateFiled: ctPayFiledOn.format("YYYY-MM-DD"),
      submissionDetails: {
        taxPaid: String(taxLiability),
        transactionRef: `DEMO-HMRC-${periodEnd.format("YYYY")}`,
      },
    });

    batch.set(doc(filingRef), {
      demoSeed: true,
      createdAt: serverTimestamp(),
      filingType: "Company Tax Return (CT600)",
      dateFiled: ct600FiledOn.format("YYYY-MM-DD"),
      submissionDetails: {
        periodStart: periodStart.format("YYYY-MM-DD"),
        periodEnd: periodEnd.format("YYYY-MM-DD"),
        turnover: String(money(90000 + rng() * 120000)),
        profit: String(money(12000 + rng() * 60000)),
        taxLiability: String(taxLiability),
      },
    });

    // Confirmation Statement for the same year
    const anniv = inc.add(i + 1, "year");
    const csDeadline = anniv.add(14, "day");
    const csFiledOn = late ? csDeadline.add(lateDays, "day") : csDeadline.subtract(2, "day");

    batch.set(doc(filingRef), {
      demoSeed: true,
      createdAt: serverTimestamp(),
      filingType: "Confirmation Statement",
      dateFiled: csFiledOn.format("YYYY-MM-DD"),
      submissionDetails: {
        directors: "Alex Demo, Taylor Demo",
        sicCode: "62020",
        shareCapital: "100 ORD £1",
        shareholders: "Alex Demo (50), Taylor Demo (50)",
      },
    });

    // Register updates
    batch.set(doc(regRef), {
      demoSeed: true,
      createdAt: serverTimestamp(),
      data: {
        effectiveDate: periodStart.add(20, "day").format("YYYY-MM-DD"),
        changeType: "ISSUE_SHARES",
        toMemberName: "Alex Demo",
        fromMemberName: "",
        memberAddress: "1 Demo Street, London, UK",
        shareClass: "Ordinary",
        sharesChange: 100,
        certificateRef: `CERT-${periodEnd.format("YYYY")}-A`,
        notes: late ? "Demo seed: late year" : "Demo seed",
      },
    });
  }

  await batch.commit();
}

export async function clearDemoData({ companyId }) {
  if (!companyId) throw new Error("Missing companyId");

  const batch = writeBatch(db);

  const deleteDemoDocs = async (colPath) => {
    const colRef = collection(db, ...colPath);
    const snap = await getDocs(query(colRef, where("demoSeed", "==", true)));
    snap.docs.forEach((d) => batch.delete(d.ref));
  };

  // subcollections
  await deleteDemoDocs(["companies", companyId, "transactions"]);
  await deleteDemoDocs(["companies", companyId, "other_revenue"]);
  await deleteDemoDocs(["companies", companyId, "filingHistory"]);
  await deleteDemoDocs(["companies", companyId, "registerUpdates"]);

  // invoices top-level (filter by companyId is not in your schema; we use demoSeed)
  // NOTE: this clears ALL demoSeed invoices in your environment (safe if you only use demoSeed for demos)
  // If you'd rather scope invoices to company, add companyId field when seeding and filter by it.
  const invSnap = await getDocs(query(
        collection(db, "invoices"), 
        where("demoSeed", "==", true),
        where("companyId", "==", companyId) // ✅ scoped
    ));
  invSnap.docs.forEach((d) => batch.delete(d.ref));

  await batch.commit();
}