// Filings.jsx
import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../firebase/firebaseConfig";
import getCompaniesByEmail from "../utils/getCompaniesByEmail";
import useCurrentUser from "../utils/getCurrentUser";

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";

// ---------- helpers ----------
const safeDate = (v) => {
  if (!v) return null;
  if (typeof v === "object" && typeof v.toDate === "function") {
    return dayjs(v.toDate()).format("YYYY-MM-DD");
  }
  return v;
};

const asDayjs = (v) => {
  const s = safeDate(v);
  if (!s) return null;
  const d = dayjs(s);
  return d.isValid() ? d : null;
};

const fmt = (d) => (d ? dayjs(d).format("DD MMM YYYY") : "—");

// Styling helpers
const STYLE = {
  progress:
    "border-indigo-300 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300",
  blue: "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  orange:
    "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400",
  red: "border-red-500 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  neutral:
    "border-slate-200 bg-white text-slate-700 dark:bg-gray-900 dark:text-slate-200 dark:border-gray-800",
};

// ---------- period math ----------
const computeBaseStart = (company) => {
  const inc = asDayjs(company?.incorporationDate);
  const accStart = asDayjs(company?.accountingStart);
  return accStart || inc;
};

const getLegacyPeriodEnd = (company) => asDayjs(company?.lastAccountsPeriodEnd);

// Anchor fields (new)
const getLastCHPeriodEnd = (company) => asDayjs(company?.lastCHPeriodEnd) || getLegacyPeriodEnd(company);
const getLastCTPeriodEnd = (company) => asDayjs(company?.lastCTPeriodEnd) || getLegacyPeriodEnd(company);

// The “active period end” shown on the card:
// - if we have a last filed end => next end is +1 year
// - else => estimate baseStart + 1 year
const computeActivePeriodEnd = (lastFiledEnd, baseStart) => {
  if (lastFiledEnd) return lastFiledEnd.add(1, "year");
  if (baseStart) return baseStart.add(1, "year");
  return null;
};

// ---------- statuses ----------
const getDeadlineStatus = ({ deadline, windowOpens }) => {
  const today = dayjs();
  if (!deadline || !windowOpens) return { label: "NEEDS SETUP", style: STYLE.orange };

  const daysToDeadline = dayjs(deadline).diff(today, "day");
  const isReady = today.isAfter(windowOpens) || today.isSame(windowOpens, "day");

  if (daysToDeadline < 0) return { label: "OVERDUE", style: STYLE.red };
  if (daysToDeadline <= 30) return { label: "DUE SOON", style: STYLE.orange };
  if (isReady) return { label: "READY TO FILE", style: STYLE.blue };

  return { label: "IN PROGRESS", style: STYLE.progress };
};

const Filings = () => {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const user = useCurrentUser();

  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [cards, setCards] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  // History preview
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Register meta/status
  const [registerMeta, setRegisterMeta] = useState({
    loading: false,
    lastCS01FiledOn: null,
    lastRegisterEffectiveDate: null,
    label: "IN PROGRESS",
    style: STYLE.progress,
    desc: "Select a company to view register status.",
  });

  // 1) Fetch companies + auto-select when only one
  useEffect(() => {
    const fetchCompanies = async () => {
      if (!user?.email) return;
      setLoadingCompanies(true);
      const data = await getCompaniesByEmail(user.email);
      setCompanies(data);
      setLoadingCompanies(false);

      if (companyId) return;

      if (data.length === 1) {
        setSelectedCompanyId(data[0].id);
        navigate(`/filings/${data[0].id}`, { replace: true });
        return;
      }

      if (data.length === 0) setSelectedCompanyId("");
    };

    fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, companyId]);

  // 2) Sync selectedCompanyId with URL param (source of truth)
  useEffect(() => {
    if (companyId) setSelectedCompanyId(companyId);
    else setSelectedCompanyId((prev) => prev || "");
  }, [companyId]);

  // 3) History preview (last 10)
  useEffect(() => {
    if (!selectedCompanyId) {
      setHistory([]);
      return;
    }

    setLoadingHistory(true);
    const historyRef = collection(db, "companies", selectedCompanyId, "filingHistory");
    const q1 = query(historyRef, orderBy("createdAt", "desc"), limit(10));

    const unsub = onSnapshot(
      q1,
      (snap) => {
        setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoadingHistory(false);
      },
      () => setLoadingHistory(false)
    );

    return () => unsub();
  }, [selectedCompanyId]);

  const company = useMemo(
    () => companies.find((c) => c.id === selectedCompanyId) || null,
    [companies, selectedCompanyId]
  );

  // ---------- Build cards (roll-forward by anchor) ----------
  useEffect(() => {
    if (!company) {
      setCards([]);
      return;
    }

    const today = dayjs();
    const inc = asDayjs(company.incorporationDate);
    const baseStart = computeBaseStart(company);

    // ===== CH Accounts (separate anchor) =====
    const lastCHFiledEnd = getLastCHPeriodEnd(company);
    const chActivePeriodEnd = computeActivePeriodEnd(lastCHFiledEnd, baseStart);
    const chIsFirst = !lastCHFiledEnd;

    let accountsDeadline = null;
    let accountsWindowOpens = null;
    let accountsDesc = "Annual accounts.";
    if (inc && chActivePeriodEnd) {
      // NOTE: CH first accounts statutory deadline uses incorporation date (21 months)
      accountsDeadline = chIsFirst ? inc.add(21, "month") : chActivePeriodEnd.add(9, "month");
      accountsWindowOpens = chActivePeriodEnd.add(1, "day");
      accountsDesc = `${chIsFirst ? "First" : "Next"} accounts for period ending ${chActivePeriodEnd.format(
        "DD MMM YYYY"
      )}.`;
    }

    // ===== Confirmation Statement =====
    let confDeadline = null;
    let confWindowOpens = null;
    if (inc) {
      const anniversary = inc.year(today.year());
      confDeadline = anniversary.isBefore(today.subtract(1, "day"))
        ? anniversary.add(1, "year").add(14, "day")
        : anniversary.add(14, "day");
      confWindowOpens = dayjs(confDeadline).subtract(14, "day");
    }

    // ===== HMRC CT (separate anchor) =====
    const lastCTFiledEnd = getLastCTPeriodEnd(company);
    const ctActivePeriodEnd = computeActivePeriodEnd(lastCTFiledEnd, baseStart);
    const canComputeHMRC = !!ctActivePeriodEnd;

    const ctPaymentDeadline = canComputeHMRC ? ctActivePeriodEnd.add(9, "month").add(1, "day") : null;
    const ctReturnDeadline = canComputeHMRC ? ctActivePeriodEnd.add(12, "month") : null;
    const ctWindowOpens = canComputeHMRC ? ctActivePeriodEnd.add(1, "day") : null;

    const baseFilings = [
      {
        kind: "FILING",
        key: "CS01",
        title: "Confirmation Statement",
        deadline: confDeadline,
        windowOpens: confWindowOpens,
        desc: "Annual check of company details (CS01).",
        govLink: "https://www.gov.uk/file-your-confirmation-statement-with-companies-house",
        lastFiledOn: asDayjs(company.lastCS01FiledOn),
        lastFiledPeriodEnd: null,
      },
      {
        kind: "FILING",
        key: "CH_ACCOUNTS",
        title: "Annual Accounts",
        deadline: accountsDeadline,
        windowOpens: accountsWindowOpens,
        desc: accountsDesc,
        govLink: "https://www.gov.uk/file-your-company-accounts-and-tax-return",
        lastFiledOn: asDayjs(company.lastCHFiledOn),
        lastFiledPeriodEnd: lastCHFiledEnd,
        activePeriodEnd: chActivePeriodEnd,
      },
    ];

    const hmrcCards = [
      {
        kind: "FILING",
        key: "CT_PAYMENT",
        title: "Corporation Tax Payment",
        deadline: ctPaymentDeadline,
        windowOpens: ctWindowOpens,
        desc: canComputeHMRC
          ? `Tax due (9 months + 1 day after CT period end ${ctActivePeriodEnd.format("DD MMM YYYY")}).`
          : "Needs setup: add incorporation date / trading start.",
        govLink: "https://www.gov.uk/pay-corporation-tax",
        lastFiledOn: asDayjs(company.lastCTPaymentFiledOn),
        lastFiledPeriodEnd: asDayjs(company.lastCTPaymentForPeriodEnd) || null,
        activePeriodEnd: ctActivePeriodEnd,
      },
      {
        kind: "FILING",
        key: "CT600",
        title: "Company Tax Return (CT600)",
        deadline: ctReturnDeadline,
        windowOpens: ctWindowOpens,
        desc: canComputeHMRC
          ? `CT600 due 12 months after CT period end (${ctActivePeriodEnd.format("DD MMM YYYY")}).`
          : "Needs setup: add incorporation date / trading start.",
        govLink: "https://www.gov.uk/company-tax-returns",
        lastFiledOn: asDayjs(company.lastCT600FiledOn),
        lastFiledPeriodEnd: lastCTFiledEnd,
        activePeriodEnd: ctActivePeriodEnd,
      },
    ];

    const registerCard = {
      kind: "REGISTER",
      title: "Company Books: Register of Members",
      desc: registerMeta.desc,
    };

    setCards([registerCard, ...baseFilings, ...(canComputeHMRC ? hmrcCards : [])]);
  }, [company, registerMeta.desc]);

  // ---------- Fetch register status meta ----------
  useEffect(() => {
    const run = async () => {
      if (!selectedCompanyId) {
        setRegisterMeta({
          loading: false,
          lastCS01FiledOn: null,
          lastRegisterEffectiveDate: null,
          label: "IN PROGRESS",
          style: STYLE.progress,
          desc:
            companies.length === 0
              ? "Add a company to start using the Filing Center."
              : "Select a company to view register status.",
        });
        return;
      }

      setRegisterMeta((m) => ({ ...m, loading: true }));

      try {
        const filingRef = collection(db, "companies", selectedCompanyId, "filingHistory");

        // CS01 latest
        const cs01Q = query(
          filingRef,
          where("filingType", "==", "Confirmation Statement"),
          orderBy("createdAt", "desc"),
          limit(1)
        );
        const cs01Snap = await getDocs(cs01Q);

        let lastCS01 = null;
        if (!cs01Snap.empty) {
          const d = cs01Snap.docs[0].data();
          lastCS01 = safeDate(d?.dateFiled) || safeDate(d?.filedOn) || safeDate(d?.createdAt) || null;
        }

        // Latest Register Update
        const regRef = collection(db, "companies", selectedCompanyId, "registerUpdates");
        const regQ = query(regRef, orderBy("createdAt", "desc"), limit(1));
        const regSnap = await getDocs(regQ);

        let lastReg = null;
        if (!regSnap.empty) {
          const d = regSnap.docs[0].data();
          lastReg =
            safeDate(d?.data?.effectiveDate) ||
            safeDate(d?.submissionDetails?.effectiveDate) ||
            safeDate(d?.effectiveDate) ||
            safeDate(d?.createdAt) ||
            null;
        }

        let label = "UP TO DATE";
        let style = STYLE.blue;
        let desc = "Register of Members looks consistent with your last logged CS01.";

        if (!lastReg) {
          label = "NEEDS SETUP";
          style = STYLE.red;
          desc = "No Register of Members updates recorded yet. Add your first shareholder entry.";
        } else if (!lastCS01) {
          label = "NO CS01 ON FILE";
          style = STYLE.orange;
          desc = "Register updates exist, but no Confirmation Statement has been logged yet.";
        } else {
          const regDate = dayjs(lastReg);
          const cs01Date = dayjs(lastCS01);
          if (regDate.isAfter(cs01Date, "day")) {
            label = "CHANGED SINCE LAST CS01";
            style = STYLE.orange;
            desc = `Register updated on ${regDate.format("DD MMM YYYY")} after CS01 (${cs01Date.format(
              "DD MMM YYYY"
            )}). Review before your next CS01.`;
          }
        }

        setRegisterMeta({
          loading: false,
          lastCS01FiledOn: lastCS01,
          lastRegisterEffectiveDate: lastReg,
          label,
          style,
          desc,
        });
      } catch (e) {
        setRegisterMeta({
          loading: false,
          lastCS01FiledOn: null,
          lastRegisterEffectiveDate: null,
          label: "IN PROGRESS",
          style: STYLE.progress,
          desc: "Could not load register status.",
        });
      }
    };

    run();
  }, [selectedCompanyId, companies.length]);

  const handleSelectChange = (e) => {
    const id = e.target.value;
    setSelectedCompanyId(id);
    navigate(`/filings/${id}`);
  };

  const showCompanyPicker = companies.length > 1;
  const hasNoCompanies = !loadingCompanies && companies.length === 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 transition-colors duration-300">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">
              Filing Center
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Manage statutory deadlines and company books.
            </p>
          </div>
        </header>

        {hasNoCompanies ? (
          <div
            onClick={() => navigate("/company-settings")}
            className="p-10 md:p-12 bg-amber-500/5 border-2 border-dashed border-amber-500/30 rounded-[2.5rem] flex flex-col items-center text-center cursor-pointer hover:bg-amber-500/10 transition-all"
          >
            <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-600 flex items-center justify-center text-2xl mb-4">
              🏢
            </div>
            <p className="text-slate-900 dark:text-white font-black uppercase text-sm">
              No companies found
            </p>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1 mb-4">
              Add a company to start using the Filing Center.
            </p>
            <button className="bg-amber-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">
              Add Company
            </button>
          </div>
        ) : (
          <>
            {showCompanyPicker && (
              <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-xl shadow-black/5 border border-gray-100 dark:border-gray-800 mb-8">
                <label className="block text-xs font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 mb-3">
                  Select Company
                </label>
                <select
                  className="w-full p-4 rounded-2xl border-2 border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-600 transition outline-none text-lg font-bold"
                  onChange={handleSelectChange}
                  value={selectedCompanyId}
                  disabled={loadingCompanies}
                >
                  <option value="">Choose from portfolio...</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {companies.length > 1 && !selectedCompanyId ? (
              <div className="p-20 text-center border-4 border-dashed border-slate-100 dark:border-slate-800/50 rounded-[3rem]">
                <p className="text-slate-400 font-black uppercase tracking-[0.4em] text-xs">
                  Select a company to view filings
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-6 md:grid-cols-2">
                  {cards.map((item, idx) => {
                    if (item.kind === "REGISTER") {
                      const status = {
                        label: registerMeta.loading ? "LOADING" : registerMeta.label,
                        style: registerMeta.style,
                      };

                      return (
                        <div
                          key={`reg-${idx}`}
                          className={`relative p-6 md:p-8 rounded-[2rem] border-l-[16px] shadow-sm flex flex-col justify-between transition-all hover:translate-y-[-4px] ${status.style}`}
                        >
                          <div className="mb-6">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
                              <div className="w-fit">
                                <span className="text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full border border-current inline-block">
                                  {status.label}
                                </span>
                              </div>

                              {registerMeta.lastRegisterEffectiveDate && (
                                <span className="text-[10px] font-bold opacity-80 uppercase tracking-tighter sm:text-right">
                                  Last update: {dayjs(registerMeta.lastRegisterEffectiveDate).format("DD MMM YYYY")}
                                </span>
                              )}
                            </div>

                            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                              {item.title}
                            </h3>
                            <p className="text-3xl md:text-4xl font-black text-gray-950 dark:text-white tracking-tighter mb-3">
                              Maintain
                            </p>
                            <p className="text-sm font-medium leading-relaxed opacity-70 text-gray-800 dark:text-gray-300">
                              {item.desc}
                            </p>
                          </div>

                          <div className="flex flex-col lg:flex-row items-stretch gap-2 pt-6 border-t border-black/5 dark:border-white/5">
                            <button
                              className="w-full py-3.5 px-4 bg-white/60 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40 text-gray-900 dark:text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-sm transition active:scale-95"
                              onClick={() =>
                                navigate(`/record-filing/${selectedCompanyId}/Register of Members`)
                              }
                              disabled={!selectedCompanyId}
                            >
                              Log Update
                            </button>

                            <div className="flex flex-col gap-2 w-full lg:w-auto">
                              <button
                                className="w-full lg:w-auto px-5 py-3.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-2xl font-black text-xs uppercase tracking-widest transition flex items-center justify-center whitespace-nowrap"
                                onClick={() => navigate(`/registers/${selectedCompanyId}/members`)}
                              >
                                Members ↗
                              </button>

                              <button
                                className="w-full lg:w-auto px-5 py-3.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded-2xl font-black text-xs uppercase tracking-widest transition flex items-center justify-center whitespace-nowrap"
                                onClick={() => navigate(`/registers/${selectedCompanyId}/directors`)}
                              >
                                Directors ↗
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const status = getDeadlineStatus({
                      deadline: item.deadline,
                      windowOpens: item.windowOpens,
                    });

                    const today = dayjs();
                    const daysRemaining = item.deadline ? dayjs(item.deadline).diff(today, "day") : null;

                    return (
                      <div
                        key={`fil-${idx}`}
                        className={`relative p-6 md:p-8 rounded-[2rem] border-l-[16px] shadow-sm flex flex-col justify-between transition-all hover:translate-y-[-4px] ${status.style}`}
                      >
                        <div className="mb-6">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
                            <div className="w-fit">
                              <span className="text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full border border-current inline-block">
                                {status.label}
                              </span>
                            </div>

                            {item.deadline && status.label !== "IN PROGRESS" && (
                              <span className="text-[10px] font-bold opacity-80 uppercase tracking-tighter sm:text-right">
                                {daysRemaining < 0
                                  ? `${Math.abs(daysRemaining)} days overdue`
                                  : `${daysRemaining} days left`}
                              </span>
                            )}
                          </div>

                          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                            {item.title}
                          </h3>

                          <p className="text-3xl md:text-4xl font-black text-gray-950 dark:text-white tracking-tighter mb-2">
                            {item.deadline ? dayjs(item.deadline).format("DD MMM YYYY") : "—"}
                          </p>

                          {/* NEW: show "last filed" context so users can see it's been completed previously */}
                          {(item.lastFiledOn || item.lastFiledPeriodEnd) && (
                            <div className="text-[10px] font-black uppercase tracking-widest opacity-75 mb-3">
                              Last filed{item.lastFiledPeriodEnd ? ` (period end ${fmt(item.lastFiledPeriodEnd)})` : ""}:{" "}
                              {fmt(item.lastFiledOn)}
                            </div>
                          )}

                          <p className="text-sm font-medium leading-relaxed opacity-70 text-gray-800 dark:text-gray-300">
                            {item.desc}
                          </p>
                        </div>

                        <div className="flex flex-col lg:flex-row items-stretch gap-2 pt-6 border-t border-black/5 dark:border-white/5">
                          <button
                            className="w-full py-3.5 px-4 bg-white/60 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40 text-gray-900 dark:text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-sm transition active:scale-95"
                            onClick={() =>
                              navigate(`/record-filing/${selectedCompanyId}/${item.title}`)
                            }
                            disabled={!selectedCompanyId}
                          >
                            Log Submission
                          </button>

                          {item.govLink ? (
                            <a
                              href={item.govLink}
                              target="_blank"
                              rel="noreferrer"
                              className="w-full lg:w-auto px-5 py-3.5 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-2xl font-bold text-xs transition text-center flex items-center justify-center whitespace-nowrap"
                            >
                              Gov.uk ↗
                            </a>
                          ) : (
                            <span className="w-full lg:w-auto px-5 py-3.5 bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 rounded-2xl font-bold text-xs flex items-center justify-center whitespace-nowrap">
                              No link
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Filing History (Preview) */}
                {selectedCompanyId && (
                  <div className="mt-10">
                    <div className="flex items-end justify-between gap-4 mb-4">
                      <div>
                        <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">
                          Previously Filed
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                          Last 10 submissions logged for this company.
                        </p>
                      </div>

                      <button
                        onClick={() => navigate(`/filings/${selectedCompanyId}/history`)}
                        className="px-6 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition"
                      >
                        View all →
                      </button>
                    </div>

                    <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-gray-800 overflow-hidden">
                      {loadingHistory ? (
                        <div className="p-10 text-center font-black uppercase tracking-widest text-xs text-slate-400 animate-pulse">
                          Loading History...
                        </div>
                      ) : history.length === 0 ? (
                        <div className="p-10 text-center text-slate-400 dark:text-slate-500">
                          <p className="font-black uppercase tracking-widest text-xs">
                            No submissions logged yet.
                          </p>
                          <p className="text-sm mt-2">Use “Log Submission” on a card above.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                  Date Filed
                                </th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                  Type
                                </th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:table-cell">
                                  Quick Note
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                              {history.map((h) => {
                                const sd = h.submissionDetails || {};
                                const note =
                                  sd.periodEnd
                                    ? `Period end: ${dayjs(sd.periodEnd).format("DD MMM YYYY")}`
                                    : sd.effectiveDate
                                    ? `Effective: ${dayjs(sd.effectiveDate).format("DD MMM YYYY")}`
                                    : "";

                                return (
                                  <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition">
                                    <td className="p-6 font-black text-slate-900 dark:text-white">
                                      {h.dateFiled ? dayjs(h.dateFiled).format("DD MMM YYYY") : "—"}
                                    </td>
                                    <td className="p-6">
                                      <div className="font-black text-slate-900 dark:text-white">
                                        {h.filingType || h.type || "—"}
                                      </div>
                                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
                                        {h.createdAt?.toDate
                                          ? dayjs(h.createdAt.toDate()).format("DD MMM YYYY HH:mm")
                                          : ""}
                                      </div>
                                    </td>
                                    <td className="p-6 hidden md:table-cell text-slate-500 dark:text-slate-400 font-bold">
                                      {note || "—"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Filings;