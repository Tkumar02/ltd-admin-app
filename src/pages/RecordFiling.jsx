// RecordFiling.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { db } from "../firebase/firebaseConfig";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { generateShareCertificate } from "../utils/shareCertificates";

dayjs.extend(isBetween);

const ymd = (d) => (d ? dayjs(d).format("YYYY-MM-DD") : "");

const safeDate = (v) => {
  if (!v) return null;
  if (typeof v === "object" && typeof v.toDate === "function") return ymd(v.toDate());
  return v;
};

const asDayjs = (v) => {
  const s = safeDate(v);
  if (!s) return null;
  const d = dayjs(s);
  return d.isValid() ? d : null;
};

const computeBaseStart = (company) => {
  const inc = asDayjs(company?.incorporationDate);
  const accStart = asDayjs(company?.accountingStart);
  return accStart || inc;
};

const getLegacyPeriodEnd = (company) => asDayjs(company?.lastAccountsPeriodEnd);

const getLastCHPeriodEnd = (company) => asDayjs(company?.lastCHPeriodEnd) || getLegacyPeriodEnd(company);
const getLastCTPeriodEnd = (company) => asDayjs(company?.lastCTPeriodEnd) || getLegacyPeriodEnd(company);

// Returns the *active period* the user is working towards (next period if something already filed)
const computeSuggestedPeriod = (company, mode) => {
  const baseStart = computeBaseStart(company);
  const lastEnd = mode === "HMRC" ? getLastCTPeriodEnd(company) : getLastCHPeriodEnd(company);

  if (lastEnd) {
    return {
      periodStart: ymd(lastEnd.add(1, "day")),
      periodEnd: ymd(lastEnd.add(1, "year")),
      source: mode === "HMRC" ? "LAST_CT_END" : "LAST_CH_END",
    };
  }
  if (baseStart) {
    return {
      periodStart: ymd(baseStart),
      periodEnd: ymd(baseStart.add(1, "year")),
      source: "BASE_START",
    };
  }
  return { periodStart: "", periodEnd: "", source: "MISSING" };
};

const RecordFiling = () => {
  const { companyId, filingType } = useParams();
  const navigate = useNavigate();
  const hasToasted = useRef(false);

  // Extract deep-link params
  const queryParams = new URLSearchParams(window.location.search);
  const deepPeriodStart = queryParams.get("periodStart");
  const deepPeriodEnd = queryParams.get("periodEnd");
  const deepFilingDate = queryParams.get("filingDate");

  const [certInfo, setCertInfo] = useState(null);
  const [generatingCert, setGeneratingCert] = useState(false);

  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [filingDate, setFilingDate] = useState(deepFilingDate || dayjs().format("YYYY-MM-DD"));

  const [companyMeta, setCompanyMeta] = useState(null);
  const [periodSource, setPeriodSource] = useState(deepPeriodEnd ? "MANUAL_DEEP_LINK" : "");
  const periodTouchedRef = useRef(!!deepPeriodEnd);

  const [formData, setFormData] = useState({
    // Confirmation Statement
    directors: "",
    sicCode: "",
    shareCapital: "",
    shareholders: "",

    // Accounts / Tax Return
    periodStart: deepPeriodStart || "",
    periodEnd: deepPeriodEnd || "" ,
    turnover: "",
    profit: "",
    taxLiability: "",

    // Payment
    taxPaid: "",
    transactionRef: "",

    // Register of Members
    effectiveDate: dayjs().format("YYYY-MM-DD"),
    changeType: "ISSUE_SHARES",
    toMemberName: "",
    fromMemberName: "",
    memberAddress: "",
    shareClass: "Ordinary",
    sharesChange: "",
    certificateRef: "",
    notes: "",

    // Register of Directors
    directorEffectiveDate: dayjs().format("YYYY-MM-DD"),
    directorChangeType: "APPOINT",
    directorName: "",
    directorServiceAddress: "",
    directorNationality: "",
    directorCountryOfResidence: "",
    directorOccupation: "",
    directorDob: "",
    directorNotes: "",
  });

  const updateField = (field, value) =>
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

  // --- type flags ---
  const isAccountsFiling = filingType?.includes("Annual Accounts") || filingType?.includes("Accounts");
  const isCT600Filing =
    filingType?.includes("CT600") ||
    filingType?.includes("Company Tax Return") ||
    filingType?.includes("Tax Return");

  const isCTPayment = filingType?.includes("Corporation Tax Payment") || filingType?.includes("Payment");

  const showAccounts = isAccountsFiling || isCT600Filing;
  const showTaxReturn = isCT600Filing;
  const showConfirmation = filingType?.includes("Confirmation");
  const showPayment = isCTPayment;

  const showRegisterMembers = filingType?.includes("Register of Members");
  const showRegisterDirectors = filingType?.includes("Register of Directors");

  const mode = isCT600Filing ? "HMRC" : "CH";

  const handleGenerateCertificate = async () => {
    if (!companyId) return;

    if (formData.changeType !== "ISSUE_SHARES") {
      return toast.error("Certificates are only generated for 'Issue shares' (for now).");
    }
    if (certInfo?.certificateId) {
      return toast.info("Certificate already generated. Use View/Download, or refresh to start over.");
    }

    if (!formData.toMemberName?.trim()) return toast.error("Enter member name first");
    if (!formData.memberAddress?.trim()) return toast.error("Enter member address first");
    const n = Number(formData.sharesChange);
    if (!Number.isFinite(n) || n <= 0) return toast.error("Shares must be a positive number");
    if (!formData.shareClass?.trim()) return toast.error("Enter share class first");

    setGeneratingCert(true);
    try {
      const res = await generateShareCertificate({
        companyId,
        companyName: "",
        companyNumber: "",
        issueDate: formData.effectiveDate || dayjs().format("YYYY-MM-DD"),
        memberName: formData.toMemberName,
        memberAddress: formData.memberAddress,
        shareClass: formData.shareClass,
        shares: n,
        notes: formData.notes || "",
      });

      setCertInfo(res);
      updateField("certificateRef", res.certificateNumber);
      toast.success(`Generated ${res.certificateNumber}`);
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Failed to generate certificate");
    } finally {
      setGeneratingCert(false);
    }
  };

  // ---------- Auto-fill helpers ----------
  useEffect(() => {
    const run = async () => {
      if (!companyId || !filingType) return;

      setCalculating(true);
      try {
        const companyRef = doc(db, "companies", companyId);
        const companySnap = await getDoc(companyRef);
        if (!companySnap.exists()) return;

        const company = companySnap.data();
        setCompanyMeta(company);

        // ===== A) Financial filings (Accounts / CT600) =====
        if (showAccounts) {
          const suggested = computeSuggestedPeriod(company, mode);
          
          if (periodSource !== "MANUAL_DEEP_LINK") {
            setPeriodSource(suggested.source);
            if (!periodTouchedRef.current) {
              setFormData((prev) => ({
                ...prev,
                periodStart: suggested.periodStart,
                periodEnd: suggested.periodEnd,
              }));
            }
          }

          const periodStart = dayjs(formData.periodStart || suggested.periodStart);
          const periodEnd = dayjs(formData.periodEnd || suggested.periodEnd);

          if (!periodStart.isValid() || !periodEnd.isValid()) {
            setCalculating(false);
            return;
          }

          // Expenses
          const expSnap = await getDocs(collection(db, "companies", companyId, "transactions"));
          const totalExp = expSnap.docs
            .map((d) => d.data())
            .filter((d) => d?.date && dayjs(d.date).isBetween(periodStart, periodEnd, null, "[]"))
            .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

          // Paid invoices (top-level)
          const invSnap = await getDocs(query(collection(db, "invoices"), where("paid", "==", true)));
          const totalInvRev = invSnap.docs
            .map((d) => d.data())
            .filter(
              (d) =>
                d?.businessName === company.name &&
                d?.date &&
                dayjs(d.date).isBetween(periodStart, periodEnd, null, "[]")
            )
            .reduce((sum, d) => sum + (Number(d.total) || 0), 0);

          // Manual “other revenue”
          const otherSnap = await getDocs(collection(db, "companies", companyId, "other_revenue"));
          const totalOtherRev = otherSnap.docs
            .map((d) => d.data())
            .filter((d) => d?.date && dayjs(d.date).isBetween(periodStart, periodEnd, null, "[]"))
            .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

          const turnover = totalInvRev + totalOtherRev;
          const profit = turnover - totalExp;

          setFormData((prev) => ({
            ...prev,
            turnover: Number(turnover).toFixed(2),
            profit: Number(profit).toFixed(2),
          }));

          if (!hasToasted.current) {
            toast.info(
              `Ledger synced for period ${periodStart.format("DD MMM YYYY")} → ${periodEnd.format("DD MMM YYYY")}`
            );
            hasToasted.current = true;
          }
        }

        // ===== B) Confirmation Statement carry-forward =====
        if (showConfirmation) {
          const historyRef = collection(db, "companies", companyId, "filingHistory");
          const q1 = query(
            historyRef,
            where("filingType", "==", "Confirmation Statement"),
            orderBy("createdAt", "desc"),
            limit(1)
          );
          const historySnap = await getDocs(q1);

          if (!historySnap.empty) {
            const lastData = historySnap.docs[0].data()?.submissionDetails || {};
            setFormData((prev) => ({
              ...prev,
              directors: lastData.directors || "",
              sicCode: lastData.sicCode || "",
              shareCapital: lastData.shareCapital || "",
              shareholders: lastData.shareholders || "",
            }));

            if (!hasToasted.current) {
              toast.info("Carried forward details from last filing");
              hasToasted.current = true;
            }
          }
        }
      } catch (e) {
        console.error(e);
        toast.error("Error auto-filling form details.");
      } finally {
        setCalculating(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, filingType]);

  // ---------- Tax estimator ----------
  const estimateTax = () => {
    const profit = parseFloat(formData.profit);
    if (!Number.isFinite(profit) || profit <= 0) {
      toast.warning("Enter a positive profit to estimate tax.");
      return;
    }

    let taxAmount = 0;
    let effectiveRate = "";

    if (profit <= 50000) {
      taxAmount = profit * 0.19;
      effectiveRate = "19% (Small Profits Rate)";
    } else if (profit > 250000) {
      taxAmount = profit * 0.25;
      effectiveRate = "25% (Main Rate)";
    } else {
      const basicTax = profit * 0.25;
      const relief = (3 / 200) * (250000 - profit);
      taxAmount = basicTax - relief;
      effectiveRate = `${((taxAmount / profit) * 100).toFixed(2)}% (Marginal Relief)`;
    }

    updateField("taxLiability", taxAmount.toFixed(2));
    toast.success(`Estimated at ${effectiveRate}`, { icon: "⚖️" });
  };

  // ---------- Validators ----------
  const validatePeriod = () => {
    if (!formData.periodStart || !formData.periodEnd) return "Period start/end are required.";
    const s = dayjs(formData.periodStart);
    const e = dayjs(formData.periodEnd);
    if (!s.isValid() || !e.isValid()) return "Period start/end are invalid.";
    if (e.isSame(s, "day") || e.isBefore(s, "day")) return "Period end must be after period start.";
    return null;
  };

  const validateRegisterMembers = () => {
    if (!formData.effectiveDate) return "Effective date is required.";
    if (!formData.changeType) return "Change type is required.";
    if (!formData.toMemberName?.trim()) return "Member name is required.";
    if (formData.changeType === "TRANSFER_SHARES" && !formData.fromMemberName?.trim())
      return "From member is required for transfers.";
    if (!formData.memberAddress?.trim()) return "Member address is required.";
    if (!formData.shareClass?.trim()) return "Share class is required.";
    const n = Number(formData.sharesChange);
    if (!Number.isFinite(n) || n === 0) return "Shares change must be a non-zero number.";
    return null;
  };

  const validateRegisterDirectors = () => {
    if (!formData.directorEffectiveDate) return "Effective date is required.";
    if (!formData.directorChangeType) return "Change type is required.";
    if (!formData.directorName?.trim()) return "Director name is required.";
    return null;
  };

  // ---------- Submission details ----------
  const buildSubmissionDetails = () => {
    if (showConfirmation) {
      return {
        directors: formData.directors,
        sicCode: formData.sicCode,
        shareCapital: formData.shareCapital,
        shareholders: formData.shareholders,
      };
    }

    if (showAccounts) {
      const base = {
        periodStart: formData.periodStart,
        periodEnd: formData.periodEnd,
        turnover: formData.turnover,
        profit: formData.profit,
      };
      if (showTaxReturn) base.taxLiability = formData.taxLiability;
      return base;
    }

    if (showPayment) {
      return {
        taxPaid: formData.taxPaid,
        transactionRef: formData.transactionRef,
      };
    }

    if (showRegisterMembers) {
      return {
        effectiveDate: formData.effectiveDate,
        changeType: formData.changeType,
        toMemberName: formData.toMemberName,
        fromMemberName: formData.fromMemberName,
        memberAddress: formData.memberAddress,
        shareClass: formData.shareClass,
        sharesChange: formData.sharesChange,
        certificateRef: formData.certificateRef,
        notes: formData.notes,
      };
    }

    if (showRegisterDirectors) {
      return {
        effectiveDate: formData.directorEffectiveDate,
        changeType: formData.directorChangeType,
        fullName: formData.directorName,
        serviceAddress: formData.directorServiceAddress,
        nationality: formData.directorNationality,
        countryOfResidence: formData.directorCountryOfResidence,
        occupation: formData.directorOccupation,
        dob: formData.directorDob,
        notes: formData.directorNotes,
      };
    }

    return {};
  };

  // ---------- Submit ----------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!companyId || !filingType) return;

    setLoading(true);
    try {
      // validate
      if (showAccounts) {
        const err = validatePeriod();
        if (err) return toast.error(err);
      }
      if (showRegisterMembers) {
        const err = validateRegisterMembers();
        if (err) return toast.error(err);
      }
      if (showRegisterDirectors) {
        const err = validateRegisterDirectors();
        if (err) return toast.error(err);
      }

      // 0) log history
      await addDoc(collection(db, "companies", companyId, "filingHistory"), {
        filingType,
        dateFiled: filingDate,
        submissionDetails: buildSubmissionDetails(),
        createdAt: new Date(),
      });

      const companyRef = doc(db, "companies", companyId);

      // 1) Update anchor fields (THIS is what makes the cards roll forward)
      if (isAccountsFiling) {
        await updateDoc(companyRef, {
          lastCHPeriodStart: formData.periodStart,
          lastCHPeriodEnd: formData.periodEnd,
          lastCHFiledOn: filingDate,
          // keep legacy for compatibility
          lastAccountsPeriodEnd: formData.periodEnd,
          updatedAt: new Date(),
        });
      }

      if (isCT600Filing) {
        await updateDoc(companyRef, {
          lastCTPeriodStart: formData.periodStart,
          lastCTPeriodEnd: formData.periodEnd,
          lastCT600FiledOn: filingDate,
          updatedAt: new Date(),
        });
      }

      if (showConfirmation) {
        await updateDoc(companyRef, {
          lastCS01FiledOn: filingDate,
          updatedAt: new Date(),
        });
      }

      // Payment: no period picker in UI, so we “attach” it to the HMRC active period end
      if (isCTPayment) {
        const snap = await getDoc(companyRef);
        const company = snap.exists() ? snap.data() : null;
        const suggestedHMRC = computeSuggestedPeriod(company, "HMRC");

        await updateDoc(companyRef, {
          lastCTPaymentFiledOn: filingDate,
          lastCTPaymentForPeriodEnd: suggestedHMRC?.periodEnd || null,
          updatedAt: new Date(),
        });
      }

      // 2) Registers
      if (showRegisterMembers) {
        await addDoc(collection(db, "companies", companyId, "registerUpdates"), {
          createdAt: new Date(),
          data: {
            effectiveDate: formData.effectiveDate,
            changeType: formData.changeType,
            toMemberName: formData.toMemberName.trim(),
            fromMemberName: (formData.fromMemberName || "").trim(),
            memberAddress: formData.memberAddress.trim(),
            shareClass: formData.shareClass.trim(),
            sharesChange: Number(formData.sharesChange || 0),
            certificateRef: (formData.certificateRef || "").trim(),
            certificateId: certInfo?.certificateId || "",
            notes: (formData.notes || "").trim(),
          },
        });
      }

      if (showRegisterDirectors) {
        await addDoc(collection(db, "companies", companyId, "directorUpdates"), {
          createdAt: new Date(),
          data: {
            effectiveDate: formData.directorEffectiveDate,
            changeType: formData.directorChangeType,
            fullName: formData.directorName.trim(),
            serviceAddress: (formData.directorServiceAddress || "").trim(),
            nationality: (formData.directorNationality || "").trim(),
            countryOfResidence: (formData.directorCountryOfResidence || "").trim(),
            occupation: (formData.directorOccupation || "").trim(),
            dob: formData.directorDob || "",
            notes: (formData.directorNotes || "").trim(),
            appointmentDate:
              formData.directorChangeType === "APPOINT" ? formData.directorEffectiveDate : "",
          },
        });
      }

      toast.success(`${filingType} recorded!`);
      setTimeout(() => navigate(-1), 900);
    } catch (error) {
      console.error(error);
      toast.error("Error saving record.");
    } finally {
      setLoading(false);
    }
  };

  const periodSourceLabel =
    periodSource === "MANUAL_DEEP_LINK"
      ? "Pre-filled for a specific missing period"
      : periodSource === "LAST_CT_END"
      ? "Auto-filled from last HMRC period end"
      : periodSource === "LAST_CH_END"
      ? "Auto-filled from last Companies House period end"
      : periodSource === "BASE_START"
      ? "Auto-filled from trading start / incorporation"
      : periodSource === "MISSING"
      ? "Missing incorporation/trading start"
      : "";

  return (
    <div className="min-h-screen p-4 md:p-10 transition-colors">
      <div className="max-w-2xl mx-auto bg-transparent p-8 md:p-12 rounded-[3rem] shadow-2xl border border-slate-100 dark:border-gray-800">
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => navigate(-1)}
              className="text-gray-400 hover:text-black dark:hover:text-white transition"
            >
              ← Back
            </button>
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">
              Compliance Archive
            </span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter uppercase italic text-gray-900 dark:text-white">
            {filingType}
          </h1>
        </header>

        <form onSubmit={handleSubmit} className="space-y-8">
          <section>
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 block mb-3">
              Date of Submission
            </label>
            <input
              type="date"
              className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-gray-800 font-bold transition"
              value={filingDate}
              onChange={(e) => setFilingDate(e.target.value)}
              required
            />
          </section>

          <hr className="opacity-10" />

          {/* ACCOUNTS / CT600 PERIOD */}
          {showAccounts && (
            <div className="p-6 rounded-[2rem] bg-slate-50 dark:bg-gray-800/40 border border-slate-100 dark:border-gray-800 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                    {mode === "HMRC" ? "HMRC Corporation Tax Period" : "Companies House Accounts Period"}
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1">
                    {periodSourceLabel || "Auto-filled"} • You can edit these dates if needed
                  </div>
                </div>
                {calculating && (
                  <span className="text-[9px] font-black animate-pulse text-emerald-500 uppercase">
                    Syncing…
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Period start</span>
                  <input
                    type="date"
                    className="w-full p-5 rounded-2xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 font-bold transition"
                    value={formData.periodStart}
                    onChange={(e) => {
                      periodTouchedRef.current = true;
                      updateField("periodStart", e.target.value);
                    }}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Period end</span>
                  <input
                    type="date"
                    className="w-full p-5 rounded-2xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 font-bold transition"
                    value={formData.periodEnd}
                    onChange={(e) => {
                      periodTouchedRef.current = true;
                      updateField("periodEnd", e.target.value);
                    }}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Turnover (£)</span>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full p-5 rounded-2xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 font-bold transition"
                    value={formData.turnover}
                    onChange={(e) => updateField("turnover", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Profit (£)</span>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full p-5 rounded-2xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 font-bold transition"
                    value={formData.profit}
                    onChange={(e) => updateField("profit", e.target.value)}
                    required
                  />
                </div>
              </div>

              {showTaxReturn && (
                <div className="pt-4 border-t border-slate-100 dark:border-gray-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Tax Liability (£)</span>
                    <button
                      type="button"
                      onClick={estimateTax}
                      className="text-[9px] font-black text-indigo-500 uppercase tracking-widest hover:underline"
                    >
                      Estimate Tax ⚖️
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full p-5 rounded-2xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 font-bold transition text-indigo-600 dark:text-indigo-400"
                    value={formData.taxLiability}
                    onChange={(e) => updateField("taxLiability", e.target.value)}
                  />
                </div>
              )}

              {companyMeta?.incorporationDate && (
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  Incorporated: {dayjs(companyMeta.incorporationDate).format("DD MMM YYYY")}
                  {companyMeta?.accountingStart
                    ? ` • Trading start: ${dayjs(companyMeta.accountingStart).format("DD MMM YYYY")}`
                    : ""}
                </div>
              )}
            </div>
          )}

          {/* CONFIRMATION STATEMENT */}
          {showConfirmation && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Current Directors</label>
                <textarea
                  className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 border border-slate-100 dark:border-gray-800 font-bold transition"
                  rows="2"
                  value={formData.directors}
                  onChange={(e) => updateField("directors", e.target.value)}
                  placeholder="Full names of all directors"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-bold text-gray-400 ml-2 uppercase">SIC Code(s)</label>
                <input
                  className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 border border-slate-100 dark:border-gray-800 font-bold transition"
                  value={formData.sicCode}
                  onChange={(e) => updateField("sicCode", e.target.value)}
                  placeholder="e.g. 62012"
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Share Capital (£)</label>
                  <input
                    className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 border border-slate-100 dark:border-gray-800 font-bold transition"
                    value={formData.shareCapital}
                    onChange={(e) => updateField("shareCapital", e.target.value)}
                    placeholder="e.g. £100.00"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Shareholders</label>
                  <input
                    className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 border border-slate-100 dark:border-gray-800 font-bold transition"
                    value={formData.shareholders}
                    onChange={(e) => updateField("shareholders", e.target.value)}
                    placeholder="e.g. 100 Ordinary"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAX PAYMENT */}
          {showPayment && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Tax Amount Paid (£)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 border border-slate-100 dark:border-gray-800 font-bold transition"
                  value={formData.taxPaid}
                  onChange={(e) => updateField("taxPaid", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Transaction Ref</label>
                <input
                  className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 border border-slate-100 dark:border-gray-800 font-bold transition"
                  value={formData.transactionRef}
                  onChange={(e) => updateField("transactionRef", e.target.value)}
                  placeholder="e.g. BANK-12345"
                  required
                />
              </div>
            </div>
          )}

          {/* REGISTER OF MEMBERS */}
          {showRegisterMembers && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Effective Date</label>
                  <input
                    type="date"
                    className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 border border-slate-100 dark:border-gray-800 font-bold transition"
                    value={formData.effectiveDate}
                    onChange={(e) => updateField("effectiveDate", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Change Type</label>
                  <select
                    className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 border border-slate-100 dark:border-gray-800 font-bold transition"
                    value={formData.changeType}
                    onChange={(e) => updateField("changeType", e.target.value)}
                  >
                    <option value="ISSUE_SHARES">Issue Shares</option>
                    <option value="TRANSFER_SHARES">Transfer Shares</option>
                    <option value="CANCEL_SHARES">Cancel/Redeem Shares</option>
                    <option value="CORRECTION">Correction</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Member Name</label>
                  <input
                    className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 border border-slate-100 dark:border-gray-800 font-bold transition"
                    value={formData.toMemberName}
                    onChange={(e) => updateField("toMemberName", e.target.value)}
                    placeholder="Full legal name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-gray-400 ml-2 uppercase">
                    From Member (if transfer)
                  </label>
                  <input
                    className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 border border-slate-100 dark:border-gray-800 font-bold transition"
                    value={formData.fromMemberName}
                    onChange={(e) => updateField("fromMemberName", e.target.value)}
                    disabled={formData.changeType !== "TRANSFER_SHARES"}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Member Address</label>
                <textarea
                  className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 border border-slate-100 dark:border-gray-800 font-bold transition"
                  rows="2"
                  value={formData.memberAddress}
                  onChange={(e) => updateField("memberAddress", e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Share Class</label>
                  <input
                    className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 border border-slate-100 dark:border-gray-800 font-bold transition"
                    value={formData.shareClass}
                    onChange={(e) => updateField("shareClass", e.target.value)}
                    placeholder="e.g. Ordinary"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Shares Change (+/-)</label>
                  <input
                    type="number"
                    className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 border border-slate-100 dark:border-gray-800 font-bold transition"
                    value={formData.sharesChange}
                    onChange={(e) => updateField("sharesChange", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-gray-800 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Certificate Ref</label>
                  {formData.changeType === "ISSUE_SHARES" && (
                    <button
                      type="button"
                      onClick={handleGenerateCertificate}
                      disabled={generatingCert}
                      className="text-[9px] font-black text-emerald-600 uppercase tracking-widest hover:underline disabled:opacity-50"
                    >
                      {generatingCert ? "Generating..." : "Auto-Generate Cert 📜"}
                    </button>
                  )}
                </div>
                <input
                  className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 border border-slate-100 dark:border-gray-800 font-bold transition"
                  value={formData.certificateRef}
                  onChange={(e) => updateField("certificateRef", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Internal Notes</label>
                <textarea
                  className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 border border-slate-100 dark:border-gray-800 font-bold transition"
                  rows="2"
                  value={formData.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                />
              </div>
            </div>
          )}

          {/* REGISTER OF DIRECTORS */}
          {showRegisterDirectors && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Effective Date</label>
                  <input
                    type="date"
                    className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 border border-slate-100 dark:border-gray-800 font-bold transition"
                    value={formData.directorEffectiveDate}
                    onChange={(e) => updateField("directorEffectiveDate", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Change Type</label>
                  <select
                    className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 border border-slate-100 dark:border-gray-800 font-bold transition"
                    value={formData.directorChangeType}
                    onChange={(e) => updateField("directorChangeType", e.target.value)}
                  >
                    <option value="APPOINT">Appoint Director</option>
                    <option value="RESIGN">Resign Director</option>
                    <option value="UPDATE_DETAILS">Update Details</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Full Name</label>
                <input
                  className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 border border-slate-100 dark:border-gray-800 font-bold transition"
                  value={formData.directorName}
                  onChange={(e) => updateField("directorName", e.target.value)}
                  required
                />
              </div>

              {formData.directorChangeType !== "RESIGN" && (
                <>
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Service Address</label>
                    <textarea
                      className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 border border-slate-100 dark:border-gray-800 font-bold transition"
                      rows="2"
                      value={formData.directorServiceAddress}
                      onChange={(e) => updateField("directorServiceAddress", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Nationality</label>
                      <input
                        className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 border border-slate-100 dark:border-gray-800 font-bold transition"
                        value={formData.directorNationality}
                        onChange={(e) => updateField("directorNationality", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Occupation</label>
                      <input
                        className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 border border-slate-100 dark:border-gray-800 font-bold transition"
                        value={formData.directorOccupation}
                        onChange={(e) => updateField("directorOccupation", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-gray-400 ml-2 uppercase">DOB</label>
                      <input
                        type="date"
                        className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 border border-slate-100 dark:border-gray-800 font-bold transition"
                        value={formData.directorDob}
                        onChange={(e) => updateField("directorDob", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Country of Residence</label>
                      <input
                        className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 border border-slate-100 dark:border-gray-800 font-bold transition"
                        value={formData.directorCountryOfResidence}
                        onChange={(e) => updateField("directorCountryOfResidence", e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <label className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Internal Notes</label>
                <textarea
                  className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 border border-slate-100 dark:border-gray-800 font-bold transition"
                  rows="2"
                  value={formData.directorNotes}
                  onChange={(e) => updateField("directorNotes", e.target.value)}
                />
              </div>
            </div>
          )}

          <button
            disabled={loading || calculating}
            className="group w-full py-6 bg-gray-900 dark:bg-white text-white dark:text-gray-950 rounded-[2rem] font-black uppercase tracking-[0.3em] text-xs hover:scale-[1.02] transition-all shadow-xl disabled:opacity-50"
          >
            {loading ? "ARCHIVING DATA..." : "CONFIRM & LOG FILING"}
          </button>
        </form>
      </div>

      <ToastContainer position="bottom-right" theme="dark" />
    </div>
  );
};

export default RecordFiling;