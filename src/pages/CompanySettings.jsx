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

  // Optional / operational anchors
  const [accountingStart, setAccountingStart] = useState("");
  // ✅ IMPORTANT: this is the anchor your filings should use (period end / made up to)
  const [lastAccountsPeriodEnd, setLastAccountsPeriodEnd] = useState("");

  const derivedIsFirstYear = useMemo(() => {
    // “First year” means: we don’t yet have a known period end from previously filed accounts
    return !lastAccountsPeriodEnd;
  }, [lastAccountsPeriodEnd]);

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
    setLastAccountsPeriodEnd("");
    setView("list");
  };

  const handleEditClick = (company) => {
    setSelectedId(company.id);
    setName(company.name || "");
    setNumber(company.number || "");
    setAddress(company.address || "");
    setIncorporationDate(company.incorporationDate || "");
    setAccountingStart(company.accountingStart || "");
    setLastAccountsPeriodEnd(company.lastAccountsPeriodEnd || "");
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

      // Match by companyId first
      let index = currentBusinesses.findIndex((b) => b.companyId === companyId);

      // Fallback by name for legacy
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

    // If user provides lastAccountsPeriodEnd, it must be on/after incorporation
    if (lastAccountsPeriodEnd) {
      const inc = dayjs(incorporationDate);
      const end = dayjs(lastAccountsPeriodEnd);
      if (end.isBefore(inc, "day")) return "Last accounts period end cannot be before incorporation date.";
    }

    // accountingStart (if provided) should not be before incorporation
    if (accountingStart) {
      const inc = dayjs(incorporationDate);
      const start = dayjs(accountingStart);
      if (start.isBefore(inc, "day")) return "Trading start cannot be before incorporation date.";
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
      const companyData = {
        name: name.trim(),
        number: number.trim(),
        address: address.trim(),
        incorporationDate,
        accountingStart: accountingStart || null,

        // ✅ correct anchor field
        lastAccountsPeriodEnd: lastAccountsPeriodEnd || null,

        // Keep boolean if you want it in the UI; it can also be derived everywhere.
        isFirstYear: !lastAccountsPeriodEnd,

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

  // Derived display label (don’t rely on the old 18-month heuristic)
  const statusLabel = derivedIsFirstYear ? "Year 1" : "Established";

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#FDFCF8] dark:bg-[#0A0D14] transition-colors duration-700">
      <div className="absolute top-[-5%] left-[-5%] w-[50%] h-[50%] rounded-full bg-indigo-400/5 dark:bg-indigo-500/10 blur-[120px]" />
      <div className="absolute bottom-[-5%] right-[-5%] w-[40%] h-[40%] rounded-full bg-amber-400/5 dark:bg-blue-600/5 blur-[120px]" />

      <div className="relative z-10 p-6 md:p-12 max-w-5xl mx-auto">
        <header className="flex justify-between items-end mb-12">
          <div>
            <h1 className="text-5xl font-black italic tracking-tighter uppercase text-slate-900 dark:text-white">
              Companies
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-indigo-400/80 mt-2">
              {companies.length} Companies
            </p>
          </div>

          {view === "list" && (
            <button
              onClick={() => setView("add")}
              className="hidden md:block bg-indigo-600 dark:bg-indigo-500 text-white px-8 py-3 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-indigo-700 transition-all"
            >
              + New Company
            </button>
          )}
        </header>

        {view === "list" ? (
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            {loading ? (
              <div className="col-span-full py-20 text-center font-black text-slate-400 italic animate-pulse tracking-widest uppercase">
                Fetching Portfolio...
              </div>
            ) : (
              companies.map((c) => (
                <div
                  key={c.id}
                  className="group relative bg-white dark:bg-[#121721] p-8 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none hover:shadow-indigo-500/10 transition-all"
                >
                  <div className="absolute top-6 right-8 flex gap-2">
                    <button
                      onClick={() => handleEditClick(c)}
                      className="p-2 text-slate-300 hover:text-indigo-500 transition-colors"
                      aria-label="Edit company"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(c.id, c.name)}
                      className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                      aria-label="Delete company"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

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
                        {c.lastAccountsPeriodEnd ? "Established" : "Year 1"}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <form
            onSubmit={handleSave}
            className="bg-white dark:bg-[#121721] p-8 md:p-12 rounded-[3rem] border border-slate-200/60 dark:border-slate-800 shadow-2xl space-y-8 animate-in slide-in-from-bottom-8 duration-500"
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
                  className="w-full p-4 bg-slate-50 dark:bg-[#1A1F2B] border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 ring-indigo-500 transition-all outline-none text-slate-900 dark:text-white"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                  CRN Number
                </label>
                <input
                  className="w-full p-4 bg-slate-50 dark:bg-[#1A1F2B] border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 ring-indigo-500 transition-all outline-none text-slate-900 dark:text-white"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                Incorporation Date
              </label>
              <input
                type="date"
                className="w-full p-4 bg-slate-50 dark:bg-[#1A1F2B] border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 ring-indigo-500 transition-all outline-none text-slate-900 dark:text-white"
                value={incorporationDate}
                onChange={(e) => setIncorporationDate(e.target.value)}
                required
              />
            </div>

            {/* Optional: trading start */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                Trading Start Date (optional)
              </label>
              <input
                type="date"
                className="w-full p-4 bg-slate-50 dark:bg-[#1A1F2B] border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 ring-indigo-500 transition-all outline-none text-slate-900 dark:text-white"
                value={accountingStart}
                onChange={(e) => setAccountingStart(e.target.value)}
              />
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Used to decide whether HMRC deadlines should show in your filings view.
              </p>
            </div>

            {/* ✅ Key field: period end anchor */}
            <div className="p-8 bg-indigo-50/50 dark:bg-indigo-900/10 border-l-4 border-indigo-500 rounded-r-3xl space-y-2">
              <label className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest">
                Last Accounts Period End (Made up to) — optional
              </label>
              <input
                type="date"
                className="w-full mt-2 p-4 bg-white dark:bg-[#1A1F2B] rounded-xl border-none outline-none text-slate-900 dark:text-white"
                value={lastAccountsPeriodEnd}
                onChange={(e) => setLastAccountsPeriodEnd(e.target.value)}
              />
              <p className="text-xs text-indigo-700/70 dark:text-indigo-200/70">
                If you’ve already filed accounts before using this app, enter the <b>accounts period end</b> date here.
                If you’re brand new and haven’t filed accounts yet, leave blank — we’ll treat this as <b>Year 1</b>.
              </p>

              <div className="pt-3 text-[10px] font-black uppercase tracking-[0.25em] text-indigo-700/70 dark:text-indigo-200/70">
                Status: {statusLabel}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                Office Address
              </label>
              <textarea
                className="w-full p-4 bg-slate-50 dark:bg-[#1A1F2B] border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 ring-indigo-500 transition-all outline-none text-slate-900 dark:text-white"
                rows="2"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-6 bg-indigo-600 text-white rounded-[2rem] font-black uppercase tracking-[0.3em] text-xs hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20"
            >
              {view === "edit" ? "Update Company" : "Finalize Onboarding"}
            </button>
          </form>
        )}

        {/* Mobile FAB */}
        {view === "list" && (
          <button
            onClick={() => setView("add")}
            className="fixed bottom-10 right-8 md:hidden w-16 h-16 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full shadow-2xl flex items-center justify-center z-50 transition-transform active:scale-90"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}

        <ToastContainer theme="dark" />
      </div>
    </div>
  );
};

export default CompanyScreen;