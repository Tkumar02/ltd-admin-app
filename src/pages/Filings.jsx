import React, { useEffect, useState } from "react";
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

// ---------- helpers (schema tolerant) ----------
const safeDate = (v) => {
  if (!v) return null;
  if (typeof v === "object" && typeof v.toDate === "function") {
    return dayjs(v.toDate()).format("YYYY-MM-DD");
  }
  return v;
};

const extractFiledOn = (docData) =>
  safeDate(docData?.filedOn) || safeDate(docData?.dateFiled) || null;

const extractEffectiveDate = (docData) => {
  const d =
    docData?.data?.effectiveDate ||
    docData?.submissionDetails?.effectiveDate ||
    docData?.effectiveDate ||
    null;

  return safeDate(d) || safeDate(docData?.createdAt) || null;
};

// Styling helpers
const STYLE = {
  gray: "border-gray-300 bg-gray-50 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400",
  blue: "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  orange:
    "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400",
  red: "border-red-500 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
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
    style: STYLE.gray,
    desc: "Select a company to view register status.",
  });

  // 1) Fetch companies
  useEffect(() => {
    const fetchCompanies = async () => {
      if (!user?.email) return;
      setLoadingCompanies(true);
      const data = await getCompaniesByEmail(user.email);
      setCompanies(data);
      setLoadingCompanies(false);
    };
    fetchCompanies();
  }, [user]);

  // 2) Sync selectedCompanyId with URL param
  useEffect(() => {
    if (companyId) setSelectedCompanyId(companyId);
    else setSelectedCompanyId("");
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

  // ---------- Status label for deadline-based cards ----------
  const getDeadlineStatus = (deadline, windowOpens) => {
    const today = dayjs();
    if (!deadline) return { label: "NEEDS SETUP", style: STYLE.orange };
    const daysToDeadline = dayjs(deadline).diff(today, "day");

    if (daysToDeadline < 0) return { label: "OVERDUE", style: STYLE.red };
    if (daysToDeadline <= 30) return { label: "DUE SOON", style: STYLE.orange };
    if (windowOpens && (today.isAfter(windowOpens) || today.isSame(windowOpens, "day")))
      return { label: "READY TO FILE", style: STYLE.blue };
    return { label: "IN PROGRESS", style: STYLE.gray };
  };

  // ---------- Build cards (period-end aware) ----------
  useEffect(() => {
    const company = companies.find((c) => c.id === selectedCompanyId);
    if (!company) {
      setCards([]);
      return;
    }

    const today = dayjs();
    const incorporationDate = company.incorporationDate ? dayjs(company.incorporationDate) : null;

    const lastAccountsPeriodEnd = company.lastAccountsPeriodEnd
      ? dayjs(company.lastAccountsPeriodEnd)
      : null;

    const isFirstYear = !lastAccountsPeriodEnd;

    // Annual Accounts
    let accountsDeadline = null;
    let accountsWindowOpens = null;
    let accountsDesc = "Annual accounts.";

    if (incorporationDate && isFirstYear) {
      accountsDeadline = incorporationDate.add(21, "month");
      accountsDesc = "First accounts filing deadline (21 months from incorporation).";
      accountsWindowOpens = incorporationDate;
    }

    let nextPeriodEnd = null;
    if (lastAccountsPeriodEnd && !isFirstYear) {
      nextPeriodEnd = lastAccountsPeriodEnd.add(1, "year");
      accountsDeadline = nextPeriodEnd.add(9, "month");
      accountsWindowOpens = nextPeriodEnd.add(1, "day");
      accountsDesc = `Accounts for period ending ${nextPeriodEnd.format("DD MMM YYYY")}.`;
    }

    // Confirmation Statement
    let confDeadline = null;
    let confWindowOpens = null;

    if (incorporationDate) {
      const anniversary = incorporationDate.year(today.year());
      confDeadline = anniversary.isBefore(today.subtract(1, "day"))
        ? anniversary.add(1, "year").add(14, "day")
        : anniversary.add(14, "day");
      confWindowOpens = dayjs(confDeadline).subtract(14, "day");
    }

    const baseFilings = [
      {
        kind: "FILING",
        title: "Confirmation Statement",
        deadline: confDeadline,
        windowOpens: confWindowOpens,
        desc: "Annual check of company details (CS01).",
        govLink: "https://www.gov.uk/file-your-confirmation-statement-with-companies-house",
      },
      {
        kind: "FILING",
        title: "Annual Accounts",
        deadline: accountsDeadline,
        windowOpens: accountsWindowOpens,
        desc: accountsDesc,
        govLink: "https://www.gov.uk/file-your-company-accounts-and-tax-return",
      },
    ];

    const tradingStarted =
      company.accountingStart && dayjs(company.accountingStart).isBefore(today, "day");

    const hmrcPeriodEnd = nextPeriodEnd || null;
    const canComputeHMRC = tradingStarted && !!hmrcPeriodEnd;

    const hmrcCards = [
      {
        kind: "FILING",
        title: "Corporation Tax Payment",
        deadline: canComputeHMRC ? hmrcPeriodEnd.add(9, "month").add(1, "day") : null,
        windowOpens: canComputeHMRC ? hmrcPeriodEnd.add(1, "day") : null,
        desc: canComputeHMRC
          ? "Tax due to HMRC (9 months + 1 day after period end)."
          : isFirstYear
            ? "Needs setup: log your first accounts period end before HMRC deadlines can be calculated."
            : "Needs setup: missing period end.",
        govLink: "https://www.gov.uk/pay-corporation-tax",
      },
      {
        kind: "FILING",
        title: "Company Tax Return (CT600)",
        deadline: canComputeHMRC ? hmrcPeriodEnd.add(12, "month") : null,
        windowOpens: canComputeHMRC ? hmrcPeriodEnd.add(1, "day") : null,
        desc: canComputeHMRC
          ? "Company tax return due to HMRC (12 months after period end)."
          : isFirstYear
            ? "Needs setup: log your first accounts period end before HMRC deadlines can be calculated."
            : "Needs setup: missing period end.",
        govLink: "https://www.gov.uk/file-your-company-accounts-and-tax-return",
      },
    ];

    const registerCard = {
      kind: "REGISTER",
      title: "Company Books: Register of Members",
      desc: registerMeta.desc,
    };

    const showHmrc = tradingStarted || !isFirstYear;
    setCards([registerCard, ...baseFilings, ...(showHmrc ? hmrcCards : [])]);
  }, [selectedCompanyId, companies, registerMeta.desc]);

  // ---------- Fetch register status meta ----------
  useEffect(() => {
    const run = async () => {
      if (!selectedCompanyId) {
        setRegisterMeta({
          loading: false,
          lastCS01FiledOn: null,
          lastRegisterEffectiveDate: null,
          label: "IN PROGRESS",
          style: STYLE.gray,
          desc: "Select a company to view register status.",
        });
        return;
      }

      setRegisterMeta((m) => ({ ...m, loading: true }));

      try {
        const filingRef = collection(db, "companies", selectedCompanyId, "filingHistory");

        // CS01 (primary: filingType, fallback: type)
        const cs01Q = query(
          filingRef,
          where("filingType", "==", "Confirmation Statement"),
          orderBy("createdAt", "desc"),
          limit(1)
        );
        const cs01Snap = await getDocs(cs01Q);

        let lastCS01 = null;
        if (!cs01Snap.empty) {
          lastCS01 = extractFiledOn(cs01Snap.docs[0].data());
        } else {
          const cs01AltQ = query(
            filingRef,
            where("type", "==", "Confirmation Statement"),
            orderBy("createdAt", "desc"),
            limit(1)
          );
          const cs01AltSnap = await getDocs(cs01AltQ);
          if (!cs01AltSnap.empty) lastCS01 = extractFiledOn(cs01AltSnap.docs[0].data());
        }

        // Latest Register Update
        const regRef = collection(db, "companies", selectedCompanyId, "registerUpdates");
        const regQ = query(regRef, orderBy("createdAt", "desc"), limit(1));
        const regSnap = await getDocs(regQ);

        let lastReg = null;
        if (!regSnap.empty) lastReg = extractEffectiveDate(regSnap.docs[0].data());

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
          style: STYLE.gray,
          desc: "Could not load register status.",
        });
      }
    };

    run();
  }, [selectedCompanyId]);

  const handleSelectChange = (e) => {
    const id = e.target.value;
    setSelectedCompanyId(id);
    navigate(`/filings/${id}`);
  };

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
                          Last update:{" "}
                          {dayjs(registerMeta.lastRegisterEffectiveDate).format("DD MMM YYYY")}
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

                    <button
                      className="w-full lg:w-auto px-5 py-3.5 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-2xl font-bold text-xs transition text-center flex items-center justify-center whitespace-nowrap"
                      onClick={() => navigate(`/registers/${selectedCompanyId}/members`)}
                      disabled={!selectedCompanyId}
                    >
                      View Register ↗
                    </button>
                  </div>
                </div>
              );
            }

            const status = getDeadlineStatus(item.deadline, item.windowOpens);
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

                  <p className="text-3xl md:text-4xl font-black text-gray-950 dark:text-white tracking-tighter mb-3">
                    {item.deadline ? dayjs(item.deadline).format("DD MMM YYYY") : "—"}
                  </p>

                  <p className="text-sm font-medium leading-relaxed opacity-70 text-gray-800 dark:text-gray-300">
                    {item.desc}
                  </p>
                </div>

                <div className="flex flex-col lg:flex-row items-stretch gap-2 pt-6 border-t border-black/5 dark:border-white/5">
                  <button
                    className="w-full py-3.5 px-4 bg-white/60 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40 text-gray-900 dark:text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-sm transition active:scale-95"
                    onClick={() => navigate(`/record-filing/${selectedCompanyId}/${item.title}`)}
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
                  <p className="font-black uppercase tracking-widest text-xs">No submissions logged yet.</p>
                  <p className="text-sm mt-2">Use “Log Submission” on a card above.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date Filed</th>
                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
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
                              <div className="font-black text-slate-900 dark:text-white">{h.filingType || h.type || "—"}</div>
                              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
                                {h.createdAt?.toDate ? dayjs(h.createdAt.toDate()).format("DD MMM YYYY HH:mm") : ""}
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
      </div>
    </div>
  );
};

export default Filings;