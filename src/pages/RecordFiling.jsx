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

dayjs.extend(isBetween);

const RecordFiling = () => {
  const { companyId, filingType } = useParams();
  const navigate = useNavigate();
  const hasToasted = useRef(false);

  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [filingDate, setFilingDate] = useState(dayjs().format("YYYY-MM-DD"));

  const [formData, setFormData] = useState({
    // Confirmation Statement
    directors: "",
    sicCode: "",
    shareCapital: "",
    shareholders: "",

    // Accounts / Tax Return
    periodStart: "",
    periodEnd: "",
    turnover: "",
    profit: "",
    taxLiability: "",

    // Payment
    taxPaid: "",
    transactionRef: "",

    // Register of Members
    effectiveDate: dayjs().format("YYYY-MM-DD"),
    changeType: "ISSUE_SHARES", // ISSUE_SHARES | TRANSFER_SHARES | CANCEL_SHARES | CORRECTION
    toMemberName: "",
    fromMemberName: "",
    memberAddress: "",
    shareClass: "Ordinary",
    sharesChange: "",
    certificateRef: "",
    notes: "",

    // Register of Directors
    directorEffectiveDate: dayjs().format("YYYY-MM-DD"),
    directorChangeType: "APPOINT", // APPOINT | RESIGN | CHANGE_DETAILS
    directorName: "",
    directorServiceAddress: "",
    directorNationality: "",
    directorCountryOfResidence: "",
    directorOccupation: "",
    directorDob: "",
    directorNotes: "",
  });

  const updateField = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }));

  const showAccounts = filingType?.includes("Accounts") || filingType?.includes("Tax Return");
  const showTaxReturn = filingType?.includes("Tax Return");
  const showConfirmation = filingType?.includes("Confirmation");
  const showPayment = filingType?.includes("Payment");
  const showRegisterMembers = filingType?.includes("Register of Members");
  const showRegisterDirectors = filingType?.includes("Register of Directors");

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

        // ===== A) Financial filings (Accounts / Tax Return) =====
        if (showAccounts) {
          const anchor = company.lastAccountsPeriodEnd || company.incorporationDate;
          const anchorDate = dayjs(anchor);

          const periodEnd = anchorDate.add(1, "year");
          const periodStart = anchorDate.add(1, "day");

          setFormData((prev) => ({
            ...prev,
            periodStart: periodStart.format("YYYY-MM-DD"),
            periodEnd: periodEnd.format("YYYY-MM-DD"),
          }));

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

          // Manual “other revenue” in the company subcollection
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

  // ---------- Submission details (minimal, per type) ----------
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
      // 0) Validate register actions before writing anything
      if (showRegisterMembers) {
        const err = validateRegisterMembers();
        if (err) {
          toast.error(err);
          setLoading(false);
          return;
        }
      }
      if (showRegisterDirectors) {
        const err = validateRegisterDirectors();
        if (err) {
          toast.error(err);
          setLoading(false);
          return;
        }
      }

      // 1) Always log filing history (timeline)
      await addDoc(collection(db, "companies", companyId, "filingHistory"), {
        filingType,
        dateFiled: filingDate,
        submissionDetails: buildSubmissionDetails(),
        createdAt: new Date(),
      });

      // 2) Update anchors / registers
      const companyRef = doc(db, "companies", companyId);

      if (filingType.includes("Accounts")) {
        if (!formData.periodEnd) {
          toast.error("Missing accounts period end. Please refresh and try again.");
          setLoading(false);
          return;
        }
        await updateDoc(companyRef, {
          lastAccountsPeriodEnd: formData.periodEnd,
          isFirstYear: false,
        });
      }

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
            fullName: formData.directorName.trim(), // must match RegisterDirectors.jsx
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 p-4 md:p-10 transition-colors">
      <div className="max-w-2xl mx-auto bg-white dark:bg-gray-900 p-8 md:p-12 rounded-[3rem] shadow-2xl border border-slate-100 dark:border-gray-800">
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

          {/* ACCOUNTS / TAX RETURN PERIOD (auto) */}
          {showAccounts && (
            <div className="p-6 rounded-[2rem] bg-slate-50 dark:bg-gray-800/40 border border-slate-100 dark:border-gray-800">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                    Accounting Period (auto)
                  </div>
                  <div className="text-sm font-bold text-gray-700 dark:text-gray-200 mt-1">
                    {formData.periodStart && formData.periodEnd
                      ? `${dayjs(formData.periodStart).format("DD MMM YYYY")} → ${dayjs(formData.periodEnd).format(
                          "DD MMM YYYY"
                        )}`
                      : "Calculating..."}
                  </div>
                </div>
                {calculating && (
                  <span className="text-[9px] font-black animate-pulse text-emerald-500 uppercase">
                    Syncing…
                  </span>
                )}
              </div>
            </div>
          )}

          {/* REGISTER OF DIRECTORS */}
          {showRegisterDirectors && (
            <div className="space-y-5">
              <label className="block text-[10px] font-black uppercase tracking-widest text-indigo-500">
                Register of Directors Update
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Effective date</span>
                  <input
                    type="date"
                    className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 font-bold transition"
                    value={formData.directorEffectiveDate}
                    onChange={(e) => updateField("directorEffectiveDate", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Change type</span>
                  <select
                    className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 font-black transition"
                    value={formData.directorChangeType}
                    onChange={(e) => updateField("directorChangeType", e.target.value)}
                    required
                  >
                    <option value="APPOINT">Appoint (AP01)</option>
                    <option value="RESIGN">Resign (TM01)</option>
                    <option value="CHANGE_DETAILS">Change details (CH01)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Full name</span>
                  <input
                    placeholder="e.g. Alex Demo"
                    className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 font-bold transition"
                    value={formData.directorName}
                    onChange={(e) => updateField("directorName", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Service address (optional)</span>
                  <input
                    placeholder="e.g. 1 Demo Street, London"
                    className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 font-bold transition"
                    value={formData.directorServiceAddress}
                    onChange={(e) => updateField("directorServiceAddress", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  placeholder="Nationality (optional)"
                  className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 font-bold transition"
                  value={formData.directorNationality}
                  onChange={(e) => updateField("directorNationality", e.target.value)}
                />
                <input
                  placeholder="Country of residence (optional)"
                  className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 font-bold transition"
                  value={formData.directorCountryOfResidence}
                  onChange={(e) => updateField("directorCountryOfResidence", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  placeholder="Occupation (optional)"
                  className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 font-bold transition"
                  value={formData.directorOccupation}
                  onChange={(e) => updateField("directorOccupation", e.target.value)}
                />
                <input
                  type="date"
                  className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 font-bold transition"
                  value={formData.directorDob}
                  onChange={(e) => updateField("directorDob", e.target.value)}
                  title="Optional: store internally; Companies House generally displays month/year publicly."
                />
              </div>

              <textarea
                rows={2}
                placeholder="Notes (optional)"
                className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 transition"
                value={formData.directorNotes}
                onChange={(e) => updateField("directorNotes", e.target.value)}
              />

              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                Form refs:{" "}
                <a className="underline" href="https://www.gov.uk/government/publications/appoint-a-director-ap01" target="_blank" rel="noreferrer">
                  AP01
                </a>{" "}
                •{" "}
                <a className="underline" href="https://www.gov.uk/government/publications/terminate-an-appointment-of-a-director-tm01" target="_blank" rel="noreferrer">
                  TM01
                </a>{" "}
                •{" "}
                <a className="underline" href="https://www.gov.uk/government/publications/change-details-of-a-director-ch01" target="_blank" rel="noreferrer">
                  CH01
                </a>
              </div>
            </div>
          )}

          {/* REGISTER OF MEMBERS SECTION */}
          {showRegisterMembers && (
            <div className="space-y-5">
              <label className="block text-[10px] font-black uppercase tracking-widest text-indigo-500">
                Register of Members Update
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Effective date</span>
                  <input
                    type="date"
                    className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 font-bold transition"
                    value={formData.effectiveDate}
                    onChange={(e) => updateField("effectiveDate", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Change type</span>
                  <select
                    className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 font-black transition"
                    value={formData.changeType}
                    onChange={(e) => updateField("changeType", e.target.value)}
                    required
                  >
                    <option value="ISSUE_SHARES">Issue shares</option>
                    <option value="TRANSFER_SHARES">Transfer shares</option>
                    <option value="CANCEL_SHARES">Cancel / buyback shares</option>
                    <option value="CORRECTION">Correction</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Member (to)</span>
                  <input
                    placeholder="Member name"
                    className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 font-bold transition"
                    value={formData.toMemberName}
                    onChange={(e) => updateField("toMemberName", e.target.value)}
                    required
                  />
                </div>

                {formData.changeType === "TRANSFER_SHARES" && (
                  <div className="space-y-2">
                    <span className="text-[9px] font-bold text-gray-400 ml-2 uppercase">From member</span>
                    <input
                      placeholder="From member name"
                      className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 font-bold transition"
                      value={formData.fromMemberName}
                      onChange={(e) => updateField("fromMemberName", e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <span className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Member address</span>
                <textarea
                  rows={2}
                  placeholder="Address for the statutory register"
                  className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 transition"
                  value={formData.memberAddress}
                  onChange={(e) => updateField("memberAddress", e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Share class</span>
                  <input
                    placeholder="e.g. Ordinary"
                    className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 font-bold transition"
                    value={formData.shareClass}
                    onChange={(e) => updateField("shareClass", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Shares change (+ / -)</span>
                  <input
                    type="number"
                    step="1"
                    placeholder="e.g. 100"
                    className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 font-black transition"
                    value={formData.sharesChange}
                    onChange={(e) => updateField("sharesChange", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  placeholder="Certificate reference (optional)"
                  className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 font-bold transition"
                  value={formData.certificateRef}
                  onChange={(e) => updateField("certificateRef", e.target.value)}
                />
                <input
                  placeholder="Notes (optional)"
                  className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 font-bold transition"
                  value={formData.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                />
              </div>
            </div>
          )}

          {/* CONFIRMATION STATEMENT SECTION */}
          {showConfirmation && (
            <div className="space-y-5">
              <label className="block text-[10px] font-black uppercase tracking-widest text-indigo-500">
                Statutory Snapshot
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <textarea
                  placeholder="Current Directors"
                  className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 outline-none transition"
                  value={formData.directors}
                  onChange={(e) => updateField("directors", e.target.value)}
                  required
                />
                <input
                  placeholder="SIC Code"
                  className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 font-bold transition"
                  value={formData.sicCode}
                  onChange={(e) => updateField("sicCode", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-4">
                <input
                  placeholder="Statement of Capital"
                  className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 font-bold transition"
                  value={formData.shareCapital}
                  onChange={(e) => updateField("shareCapital", e.target.value)}
                  required
                />
                <textarea
                  placeholder="Shareholder Details"
                  className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 transition"
                  value={formData.shareholders}
                  onChange={(e) => updateField("shareholders", e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          {/* ACCOUNTS / TAX RETURN SECTION */}
          {showAccounts && (
            <div className="space-y-5">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-black uppercase tracking-widest text-emerald-500">
                  {showTaxReturn ? "HMRC Tax Computation" : "Financial Performance"}
                </label>
                {calculating && (
                  <span className="text-[9px] font-black animate-pulse text-emerald-500 uppercase">
                    Syncing Ledger...
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Turnover (£)</span>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 font-black text-xl transition"
                    value={formData.turnover}
                    onChange={(e) => updateField("turnover", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Net Profit (£)</span>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 font-black text-xl transition"
                    value={formData.profit}
                    onChange={(e) => updateField("profit", e.target.value)}
                    required
                  />
                </div>

                {showTaxReturn && (
                  <div className="md:col-span-2 space-y-5 mt-6">
                    <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 dark:border-gray-800 rounded-[2.5rem] bg-slate-50/50 dark:bg-white/5">
                      <div className="text-center mb-6">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 mb-1 block">
                          HMRC Liability Calculator
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Estimate Corporation Tax based on current profit.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={estimateTax}
                        className="group relative flex items-center justify-center gap-3 py-4 px-10 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all hover:scale-105 active:scale-95 shadow-lg shadow-orange-500/20"
                      >
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                        </span>
                        {formData.taxLiability ? "RE-CALCULATE TAX" : "GENERATE SMART ESTIMATE"}
                      </button>

                      {formData.taxLiability && (
                        <div className="w-full mt-8">
                          <div className="relative">
                            <div className="absolute -top-3 left-6 px-2 bg-white dark:bg-gray-900 text-[9px] font-black text-orange-500 uppercase tracking-widest">
                              Estimated Tax Due
                            </div>
                            <input
                              type="number"
                              step="0.01"
                              className="w-full p-6 rounded-3xl bg-white dark:bg-gray-950 border-2 border-orange-500 text-center font-black text-4xl text-orange-500 transition shadow-2xl outline-none"
                              value={formData.taxLiability}
                              onChange={(e) => updateField("taxLiability", e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PAYMENT SECTION */}
          {showPayment && (
            <div className="space-y-5">
              <label className="block text-[10px] font-black uppercase tracking-widest text-orange-500">
                HMRC Payment Info
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="Amount Paid (£)"
                className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 font-black text-xl transition"
                value={formData.taxPaid}
                onChange={(e) => updateField("taxPaid", e.target.value)}
                required
              />
              <input
                placeholder="HMRC Transaction Reference"
                className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 font-bold transition"
                value={formData.transactionRef}
                onChange={(e) => updateField("transactionRef", e.target.value)}
                required
              />
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