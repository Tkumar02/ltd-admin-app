import React, { useMemo, useState } from "react";
import dayjs from "dayjs";
import { db } from "../firebase/firebaseConfig";
import useCurrentUser from "../utils/getCurrentUser";
import {
  collection,
  doc,
  setDoc,
  addDoc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const isDemoUser = (user) => !!user?.email && user.email.toLowerCase().startsWith("demo");

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[rand(0, arr.length - 1)];
const slugSeed = () => Math.random().toString(36).slice(2, 10).toUpperCase();

const DemoTools = () => {
  const user = useCurrentUser();
  const demoAllowed = useMemo(() => isDemoUser(user), [user]);

  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);

  // options
  const [years, setYears] = useState(2);
  const [scenario, setScenario] = useState("UP_TO_DATE"); // UP_TO_DATE | MISSED_DEADLINES

  const ensureDemoCompany = async ({ seedId }) => {
    // Create 1 demo company (you can extend to multiple)
    const companyId = `demo_company_${seedId.toLowerCase()}`; // stable and easy to find
    const companyRef = doc(db, "companies", companyId);

    const inc = dayjs().subtract(years + 1, "year").month(0).date(10); // Jan 10 a few years ago
    const tradingStart = inc.add(20, "day");
    const lastPeriodEnd = dayjs().subtract(1, "year").month(11).date(31); // last Dec 31 (rough)

    // If "missed deadlines" scenario, make last period end older (so filings show overdue)
    const adjustedLastPeriodEnd =
      scenario === "MISSED_DEADLINES" ? lastPeriodEnd.subtract(1, "year") : lastPeriodEnd;

    await setDoc(
      companyRef,
      {
        demoSeed: true,
        demoSeedId: seedId,
        userEmail: user?.email || "",
        name: "Demo Trading Ltd",
        number: "12345678",
        address: "1 Demo Street, London, UK",
        incorporationDate: inc.format("YYYY-MM-DD"),
        accountingStart: tradingStart.format("YYYY-MM-DD"),

        // key anchors your app uses:
        lastAccountsPeriodEnd: adjustedLastPeriodEnd.format("YYYY-MM-DD"),
        isFirstYear: false,

        createdAt: serverTimestamp(),
      },
      { merge: true }
    );

    return { companyId, companyName: "Demo Trading Ltd", inc, tradingStart, lastPeriodEnd: adjustedLastPeriodEnd };
  };

  const seedLedgerAndRevenueAndInvoices = async ({ seedId, companyId, companyName }) => {
    // We’ll seed month-by-month so the charts look realistic.
    const months = years * 12;

    const services = ["Consulting", "Design", "Development", "Retainer", "Support"];
    const payees = ["Amazon", "Google", "Apple", "Trainline", "Adobe", "Office Supplies Co", "Fuel Station"];

    for (let m = 0; m < months; m++) {
      const monthStart = dayjs().subtract(m, "month").startOf("month");

      // 1) Paid invoices (top-level collection)
      const invoiceCount = rand(2, 6);
      for (let i = 0; i < invoiceCount; i++) {
        const d = monthStart.add(rand(1, 25), "day");
        const total = rand(1200, 8500);

        await addDoc(collection(db, "invoices"), {
          demoSeed: true,
          demoSeedId: seedId,
          userEmail: user?.email || "",

          companyId, // ✅ you asked for this
          businessName: companyName.trim(), // keep existing matching logic happy
          paid: true,
          date: d.format("YYYY-MM-DD"),
          total,
          clientName: `Client ${rand(1, 18)}`,
          description: `${pick(services)} (${d.format("MMM YYYY")})`,
          createdAt: serverTimestamp(),
        });
      }

      // 2) Other revenue (company subcollection)
      const otherRevCount = rand(0, 2);
      for (let i = 0; i < otherRevCount; i++) {
        const d = monthStart.add(rand(1, 27), "day");
        const amount = rand(200, 2500);
        await addDoc(collection(db, "companies", companyId, "other_revenue"), {
          demoSeed: true,
          demoSeedId: seedId,
          date: d.format("YYYY-MM-DD"),
          amount,
          source: pick(["Grant", "Affiliate", "Refund", "Other Income"]),
          category: pick(["Other", "Grant", "Affiliate"]),
          notes: "Seeded demo revenue",
          createdAt: serverTimestamp(),
        });
      }

      // 3) Expenses (company subcollection)
      const expenseCount = rand(6, 14);
      for (let i = 0; i < expenseCount; i++) {
        const d = monthStart.add(rand(1, 27), "day");
        const amount = rand(20, 1200);

        await addDoc(collection(db, "companies", companyId, "transactions"), {
          demoSeed: true,
          demoSeedId: seedId,
          date: d.format("YYYY-MM-DD"),
          amount,
          payee: pick(payees),
          category: pick(["Travel", "Software", "Meals", "Office", "Marketing", "Professional Fees"]),
          notes: "Seeded demo expense",
          createdAt: serverTimestamp(),
        });
      }
    }
  };

  const seedFilingsAndRegisters = async ({ seedId, companyId, inc, lastPeriodEnd }) => {
    const filingHistoryRef = collection(db, "companies", companyId, "filingHistory");
    const registerRef = collection(db, "companies", companyId, "registerUpdates");

    // Seed confirmation statements (annual-ish)
    for (let y = 0; y < years; y++) {
      const filed = inc.add(y + 1, "year").add(10, "day"); // around anniversary
      await addDoc(filingHistoryRef, {
        demoSeed: true,
        demoSeedId: seedId,
        filingType: "Confirmation Statement",
        dateFiled: filed.format("YYYY-MM-DD"),
        submissionDetails: {
          directors: "Demo Director (1)",
          sicCode: "62020",
          shareCapital: "100 Ordinary shares @ £1",
          shareholders: "Demo Shareholder (100%)",
        },
        createdAt: serverTimestamp(),
      });
    }

    // Seed accounts filings (using period end anchor)
    for (let y = 0; y < years; y++) {
      const periodEnd = lastPeriodEnd.subtract(y, "year"); // older periods
      const periodStart = periodEnd.subtract(1, "year").add(1, "day");
      const filed = periodEnd.add(7, "month"); // pretend filed before deadline
      await addDoc(filingHistoryRef, {
        demoSeed: true,
        demoSeedId: seedId,
        filingType: "Annual Accounts",
        dateFiled: filed.format("YYYY-MM-DD"),
        submissionDetails: {
          periodStart: periodStart.format("YYYY-MM-DD"),
          periodEnd: periodEnd.format("YYYY-MM-DD"),
          turnover: String(rand(80000, 180000)),
          profit: String(rand(8000, 45000)),
        },
        createdAt: serverTimestamp(),
      });
    }

    // Seed a register update
    await addDoc(registerRef, {
      demoSeed: true,
      demoSeedId: seedId,
      createdAt: serverTimestamp(),
      data: {
        effectiveDate: inc.add(1, "month").format("YYYY-MM-DD"),
        changeType: "ISSUE_SHARES",
        toMemberName: "Demo Shareholder",
        fromMemberName: "",
        memberAddress: "1 Demo Street, London, UK",
        shareClass: "Ordinary",
        sharesChange: 100,
        certificateRef: "CERT-001",
        notes: "Initial issuance (demo)",
      },
    });
  };

  const seedEverything = async () => {
    if (!demoAllowed) {
      toast.error("Demo seeding is only enabled for demo users.");
      return;
    }

    setSeeding(true);
    try {
      const seedId = slugSeed();

      const { companyId, companyName, inc, lastPeriodEnd } = await ensureDemoCompany({ seedId });

      await seedLedgerAndRevenueAndInvoices({ seedId, companyId, companyName });
      await seedFilingsAndRegisters({ seedId, companyId, inc, lastPeriodEnd });

      toast.success(`Demo data created ✅ (seed ${seedId})`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to create demo data");
    } finally {
      setSeeding(false);
    }
  };

  const clearDemoData = async () => {
    if (!demoAllowed) {
      toast.error("Demo clear is only enabled for demo users.");
      return;
    }

    setClearing(true);
    try {
      // We clear ALL demoSeed docs for this user email (safe in demo environment).
      // If you want to clear by seedId only, we can store last seedId in localStorage and use it.
      const batch = writeBatch(db);

      // 1) Companies
      const compSnap = await getDocs(
        query(collection(db, "companies"), where("demoSeed", "==", true), where("userEmail", "==", user.email))
      );

      // For each company, delete its demo subcollection docs we know about
      for (const c of compSnap.docs) {
        const companyId = c.id;

        const txSnap = await getDocs(
          query(collection(db, "companies", companyId, "transactions"), where("demoSeed", "==", true))
        );
        txSnap.docs.forEach((d) => batch.delete(d.ref));

        const revSnap = await getDocs(
          query(collection(db, "companies", companyId, "other_revenue"), where("demoSeed", "==", true))
        );
        revSnap.docs.forEach((d) => batch.delete(d.ref));

        const histSnap = await getDocs(
          query(collection(db, "companies", companyId, "filingHistory"), where("demoSeed", "==", true))
        );
        histSnap.docs.forEach((d) => batch.delete(d.ref));

        const regSnap = await getDocs(
          query(collection(db, "companies", companyId, "registerUpdates"), where("demoSeed", "==", true))
        );
        regSnap.docs.forEach((d) => batch.delete(d.ref));

        // delete company doc last
        batch.delete(c.ref);

        // 2) Invoices tied to companyId
        const invSnap = await getDocs(
          query(collection(db, "invoices"), where("demoSeed", "==", true), where("companyId", "==", companyId))
        );
        invSnap.docs.forEach((d) => batch.delete(d.ref));
      }

      await batch.commit();
      toast.success("Demo data cleared ✅");
    } catch (e) {
      console.error(e);
      toast.error("Failed to clear demo data");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F1A] p-6 md:p-12">
      <div className="max-w-3xl mx-auto bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-2xl p-8">
        <h1 className="text-3xl font-black uppercase italic text-slate-900 dark:text-white">
          Demo Tools
        </h1>
        <p className="text-slate-500 dark:text-slate-400 font-bold mt-2">
          Seed realistic demo data across the entire app (ledger, revenue, filings, registers, invoices).
        </p>

        {!demoAllowed && (
          <div className="mt-6 p-4 rounded-2xl border border-amber-300 bg-amber-50 text-amber-800 font-bold">
            This page is only enabled for demo users.
          </div>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-800">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Years of history
            </label>
            <select
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              className="mt-2 w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-black"
              disabled={!demoAllowed || seeding || clearing}
            >
              <option value={1}>1 year</option>
              <option value={2}>2 years</option>
              <option value={3}>3 years</option>
            </select>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-800">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Scenario
            </label>
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              className="mt-2 w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-black"
              disabled={!demoAllowed || seeding || clearing}
            >
              <option value="UP_TO_DATE">All up to date</option>
              <option value="MISSED_DEADLINES">Some missed deadlines</option>
            </select>
          </div>
        </div>

        <div className="mt-8 flex flex-col md:flex-row gap-3">
          <button
            onClick={() => {
              if (window.confirm("Create demo data? This will add companies, invoices, ledger, filings, and registers.")) {
                seedEverything();
              }
            }}
            disabled={!demoAllowed || seeding || clearing}
            className="w-full md:w-auto px-6 py-4 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] shadow-lg disabled:opacity-60"
          >
            {seeding ? "SEEDING..." : "CREATE DEMO DATA"}
          </button>

          <button
            onClick={() => {
              if (window.confirm("Clear ALL demo data for this demo user?")) clearDemoData();
            }}
            disabled={!demoAllowed || seeding || clearing}
            className="w-full md:w-auto px-6 py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest text-[10px] shadow-lg disabled:opacity-60"
          >
            {clearing ? "CLEARING..." : "CLEAR DEMO DATA"}
          </button>
        </div>
      </div>

      <ToastContainer theme="dark" position="bottom-right" />
    </div>
  );
};

export default DemoTools;