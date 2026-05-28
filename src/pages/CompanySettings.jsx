// CompanySettings.jsx
import React, { useState, useEffect, useMemo } from "react";
import { auth, db } from "../firebase/firebaseConfig";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { ToastContainer, toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import "react-toastify/dist/ReactToastify.css";
import { fetchCompaniesHouseProfile, extractCHMarkers } from "../utils/companiesHouse";

const CompanyScreen = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [view, setView] = useState("list");

  // Form State
  const [selectedId, setSelectedId] = useState(null);
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [address, setAddress] = useState("");
  const [incorporationDate, setIncorporationDate] = useState("");

  // Optional: trading start (baseStart for Year 1 estimates)
  const [accountingStart, setAccountingStart] = useState("");

  // ✅ Manual toggle
  const [hasFiledBefore, setHasFiledBefore] = useState(false);
  const [isDormant, setIsDormant] = useState(false);
// ✅ Single anchor: ARD (Accounts made up to / period end)
const [accountsPeriodEndARD, setAccountsPeriodEndARD] = useState("");

const [syncing, setSyncing] = useState(false);

const statusLabel = useMemo(() => (hasFiledBefore ? "Established" : "Year 1"), [hasFiledBefore]);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user?.email) {
        setCompanies([]);
        return;
      }
      const q = query(collection(db, "companies"), where("email", "==", user.email));
      const snap = await getDocs(q);
      setCompanies(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      toast.error("Could not load companies.");
    } finally {
      setLoading(false);
    }
  };

  const handleCHSync = async () => {
  if (!number || number.length < 8) {
    toast.warn("Please enter a valid 8-digit Company Number first.");
    return;
  }

  setSyncing(true);
  try {
    const profile = await fetchCompaniesHouseProfile(number);
    if (!profile) {
      toast.error("Company not found or API error.");
      return;
    }

    const markers = extractCHMarkers(profile);

    if (markers.companyName) setName(markers.companyName);
    if (markers.incorporationDate) setIncorporationDate(markers.incorporationDate);

    // Attempt to format address from CH
    if (profile.registered_office_address) {
      const addr = profile.registered_office_address;
      const parts = [
        addr.address_line_1,
        addr.address_line_2,
        addr.locality,
        addr.postal_code
      ].filter(Boolean);
      setAddress(parts.join(", "));
    }

    // If they have established accounts, auto-set ARD
    if (markers.lastAccountsEnd) {
      setHasFiledBefore(true);
      setAccountsPeriodEndARD(markers.lastAccountsEnd);
    }

    toast.success("Synced with Companies House!");
  } catch (error) {
    console.error(error);
    toast.error("Sync failed.");
  } finally {
    setSyncing(false);
  }
  };

  useEffect(() => {
  fetchCompanies();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const resetForm = () => {
    setSelectedId(null);
    setName("");
    setNumber("");
    setAddress("");
    setIncorporationDate("");
    setAccountingStart("");
    setHasFiledBefore(false);
    setAccountsPeriodEndARD("");
    setView("list");
  };

  const handleEditClick = (company) => {
    setSelectedId(company.id);
    setName(company.name || "");
    setNumber(company.number || "");
    setAddress(company.address || "");
    setIncorporationDate(company.incorporationDate || "");
    setAccountingStart(company.accountingStart || "");
    setIsDormant(!!company.isDormant);

    // Try to infer existing ARD from whatever you have stored (new or legacy)
    const existingARD =
      company.lastCHPeriodEnd ||
      company.lastAccountsPeriodEnd ||
      company.lastCTPeriodEnd ||
      "";

    // Manual toggle: prefer stored hasFiledBefore, else infer from having an ARD
    const existingHasFiledBefore =
      typeof company.hasFiledBefore === "boolean" ? company.hasFiledBefore : !!existingARD;

    setHasFiledBefore(existingHasFiledBefore);
    setAccountsPeriodEndARD(existingARD);

    setView("edit");
  };

  const handleDelete = async (id, companyName) => {
    if (window.confirm(`Permanently remove ${companyName}?`)) {
      try {
        await deleteDoc(doc(db, "companies", id));
        toast.success("Company deleted");
        fetchCompanies();
      } catch (error) {
        toast.error("Delete failed.");
      }
    }
  };

  const syncCompanyToProfile = async (companyId, companyData) => {
    const profilesRef = collection(db, "profiles");
    const q = query(profilesRef, where("email", "==", companyData.email));
    const snap = await getDocs(q);

    const businessEntry = {
      businessName: companyData.name,
      businessAddress: companyData.address,
      businessType: "Ltd Company",
      companyId,
      updatedAt: new Date(),
    };

    if (!snap.empty) {
      const profileDoc = snap.docs[0];
      const profileData = profileDoc.data();
      const currentBusinesses = profileData.businesses || [];

      let index = currentBusinesses.findIndex((b) => b.companyId === companyId);
      if (index === -1) {
        index = currentBusinesses.findIndex(
          (b) => b.businessName === companyData.name && !b.companyId
        );
      }

      if (index !== -1) currentBusinesses[index] = businessEntry;
      else currentBusinesses.push(businessEntry);

      await updateDoc(profileDoc.ref, { businesses: currentBusinesses });
    } else {
      await addDoc(profilesRef, { email: companyData.email, businesses: [businessEntry] });
    }
  };

  const validate = () => {
    if (!name?.trim()) return "Company name is required.";
    if (!number?.trim()) return "CRN number is required.";
    if (!incorporationDate) return "Incorporation date is required.";
    if (!address?.trim()) return "Office address is required.";

    const inc = dayjs(incorporationDate);
    if (!inc.isValid()) return "Incorporation date is invalid.";

    if (accountingStart) {
      const start = dayjs(accountingStart);
      if (!start.isValid()) return "Trading start is invalid.";
      if (start.isBefore(inc, "day")) return "Trading start cannot be before incorporation date.";
    }

    // If they say they've filed before, ARD should be present + valid
    if (hasFiledBefore) {
      if (!accountsPeriodEndARD) return "Enter the Accounts Reference Date (ARD) or untick ‘filed before’.";
      const end = dayjs(accountsPeriodEndARD);
      if (!end.isValid()) return "Accounts Reference Date (ARD) is invalid.";
      if (end.isBefore(inc, "day")) return "ARD cannot be before incorporation date.";
    }

    // If ARD provided (even if toggle off), still validate it
    if (!hasFiledBefore && accountsPeriodEndARD) {
      const end = dayjs(accountsPeriodEndARD);
      if (!end.isValid()) return "Accounts Reference Date (ARD) is invalid.";
      if (end.isBefore(inc, "day")) return "ARD cannot be before incorporation date.";
    }

    return null;
  };

  const handleSave = async (e) => {
    e.preventDefault();

    const user = auth.currentUser;
    if (!user?.email) {
      toast.error("You must be logged in.");
      return;
    }

    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }

    try {
      // If they haven't filed before, we store null ARD (clean Year 1 state)
      const ard = hasFiledBefore ? (accountsPeriodEndARD || null) : null;

      const companyData = {
        name: name.trim(),
        number: number.trim(),
        address: address.trim(),
        incorporationDate,
        accountingStart: accountingStart || null,

        // ✅ manual toggle persisted
        hasFiledBefore,
        isDormant,

        // ✅ single anchor saved everywhere (keeps CH + HMRC aligned)
        lastAccountsPeriodEnd: ard, // legacy back-compat
        lastCHPeriodEnd: ard,
        lastCTPeriodEnd: ard,

        email: user.email,
        updatedAt: new Date(),
      };

      if (view === "edit") {
        const companyRef = doc(db, "companies", selectedId);
        await updateDoc(companyRef, companyData);
        await syncCompanyToProfile(selectedId, companyData);
        toast.success("Company updated");
      } else {
        const companyRef = await addDoc(collection(db, "companies"), {
          ...companyData,
          createdAt: new Date(),
        });
        await syncCompanyToProfile(companyRef.id, companyData);
        toast.success("Company added");
      }

      resetForm();
      fetchCompanies();
    } catch (error) {
      console.error(error);
      toast.error("Save error.");
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden transition-colors duration-700">
      <div className="relative z-10 p-6 md:p-12 max-w-5xl mx-auto">
        <header className="flex flex-col mb-12 gap-6">
          <div className="min-w-0">
            <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter uppercase text-slate-900 dark:text-white leading-none">
              Companies
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-indigo-400/80 mt-3 truncate">
              {companies.length} Registered Entities
            </p>
          </div>

          {view === "list" && (
            <div>
              <button
                onClick={() => setView("add")}
                className="bg-indigo-600 dark:bg-indigo-500 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-indigo-700 transition-all flex items-center gap-3 w-fit"
              >
                <span>+ Log New Company</span>
              </button>
            </div>
          )}
        </header>

        {view === "list" ? (
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            {loading ? (
              <div className="col-span-full py-20 text-center font-black text-slate-400 italic animate-pulse tracking-widest uppercase text-xs">
                Fetching Portfolio...
              </div>
            ) : (
              companies.map((c) => {
                const established =
                  typeof c.hasFiledBefore === "boolean"
                    ? c.hasFiledBefore
                    : !!(c.lastCHPeriodEnd || c.lastAccountsPeriodEnd || c.lastCTPeriodEnd);

                return (
                  <div
                    key={c.id}
                    className="group relative bg-transparent p-8 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800 shadow-xl shadow-slate-200/20 dark:shadow-none hover:border-indigo-500/50 transition-all"
                  >
                    <div className="mb-10">
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-tight mb-1 truncate pr-16 uppercase tracking-tighter">
                        {c.name}
                      </h3>
                      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                        Reg No: {c.number}
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-4">
                        <button
                          onClick={() => navigate(`/filings/${c.id}`)}
                          className="bg-slate-900 dark:bg-purple-200 text-white dark:text-slate-900 px-6 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                        >
                          Filings
                        </button>
                        <button
                          onClick={() => navigate(`/transactions/${c.id}`)}
                          className="bg-slate-900 dark:bg-emerald-200 text-white dark:text-slate-900 px-6 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                        >
                          Transactions
                        </button>
                      </div>

                      <div className="text-right">
                        <p className="text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">
                          Status
                        </p>
                        <p className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter">
                          {established ? "Established" : "Year 1"}
                        </p>
                      </div>
                    </div>

                    <div className="absolute top-6 right-8 flex gap-2">
                      <button
                        onClick={() => handleEditClick(c)}
                        className="p-2 text-slate-300 hover:text-indigo-500 transition-colors"
                        aria-label="Edit company"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => handleDelete(c.id, c.name)}
                        className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                        aria-label="Delete company"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <form
            onSubmit={handleSave}
            className="bg-transparent p-8 md:p-12 rounded-[3rem] border border-slate-200/60 dark:border-slate-800 shadow-2xl space-y-8"
          >
            <div className="flex justify-between items-center pb-6 border-b border-slate-100 dark:border-slate-800/50">
              <h2 className="text-3xl font-black text-slate-900 dark:text-white italic tracking-tighter uppercase">
                {view === "edit" ? "Modify" : "Onboard"}
              </h2>
              <button
                type="button"
                onClick={resetForm}
                className="text-slate-400 hover:text-indigo-500 font-black text-[10px] uppercase tracking-widest transition-colors"
              >
                Discard
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                  Company Name
                </label>
                <input
                  className="w-full p-4 bg-slate-50 dark:bg-[#1A1F2B] border border-slate-200 dark:border-slate-800 rounded-2xl outline-none text-slate-900 dark:text-white"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                  CRN Number
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    className="flex-1 p-4 bg-slate-50 dark:bg-[#1A1F2B] border border-slate-200 dark:border-slate-800 rounded-2xl outline-none text-slate-900 dark:text-white"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={handleCHSync}
                    disabled={syncing}
                    className="px-6 py-4 sm:py-0 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:opacity-80 transition-all disabled:opacity-50 whitespace-nowrap"
                  >
                    {syncing ? "Syncing..." : "Sync"}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                Incorporation Date
              </label>
              <input
                type="date"
                className="w-full p-4 bg-slate-50 dark:bg-[#1A1F2B] border border-slate-200 dark:border-slate-800 rounded-2xl outline-none text-slate-900 dark:text-white"
                value={incorporationDate}
                onChange={(e) => setIncorporationDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                Trading Start Date (optional)
              </label>
              <input
                type="date"
                className="w-full p-4 bg-slate-50 dark:bg-[#1A1F2B] border border-slate-200 dark:border-slate-800 rounded-2xl outline-none text-slate-900 dark:text-white"
                value={accountingStart}
                onChange={(e) => setAccountingStart(e.target.value)}
              />
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Used as the base start when estimating Year 1 periods.
              </p>
            </div>

            {/* ✅ Manual toggle */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-[2rem] bg-transparent border border-slate-200/60 dark:border-slate-800">
                <label className="flex items-center gap-3 select-none cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={hasFiledBefore}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setHasFiledBefore(next);
                      if (!next) setAccountsPeriodEndARD(""); // keep clean Year 1 state
                    }}
                  />
                  <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">
                    Established
                  </span>
                </label>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 uppercase font-bold">
                  This company has filed before.
                </p>
              </div>

              <div className="p-6 rounded-[2rem] bg-transparent border border-slate-200/60 dark:border-slate-800">
                <label className="flex items-center gap-3 select-none cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={isDormant}
                    onChange={(e) => setIsDormant(e.target.checked)}
                  />
                  <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                    Dormant Mode
                  </span>
                </label>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 uppercase font-bold">
                  Company is not trading.
                </p>
              </div>
            </div>

            {/* ✅ ARD input revealed by toggle */}
            {hasFiledBefore && (
              <div className="p-8 bg-indigo-50/50 dark:bg-indigo-900/10 border-l-4 border-indigo-500 rounded-r-3xl space-y-2">
                <label className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest">
                  Accounts Reference Date (ARD) — “Accounts made up to”
                </label>
                <input
                  type="date"
                  className="w-full mt-2 p-4 bg-white dark:bg-[#1A1F2B] rounded-xl border-none outline-none text-slate-900 dark:text-white"
                  value={accountsPeriodEndARD}
                  onChange={(e) => setAccountsPeriodEndARD(e.target.value)}
                  required
                />
                <p className="text-xs text-indigo-700/70 dark:text-indigo-200/70">
                  This is the period end you’re aligning everything to (accounts + CT).
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                Office Address
              </label>
              <textarea
                className="w-full p-4 bg-slate-50 dark:bg-[#1A1F2B] border border-slate-200 dark:border-slate-800 rounded-2xl outline-none text-slate-900 dark:text-white"
                rows="2"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-6 bg-indigo-600 text-white rounded-[2rem] font-black uppercase tracking-[0.3em] text-xs hover:bg-indigo-700 transition-all"
            >
              {view === "edit" ? "Update Company" : "Finalize Onboarding"}
            </button>
          </form>
        )}

        <ToastContainer theme="dark" />
      </div>
    </div>
  );
};

export default CompanyScreen;