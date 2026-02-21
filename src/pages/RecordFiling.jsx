import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase/firebaseConfig";
import { collection, addDoc, doc, updateDoc, getDocs, query, where, getDoc, orderBy, limit } from "firebase/firestore";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import { toast, ToastContainer } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';

dayjs.extend(isBetween);

const RecordFiling = () => {
    const { companyId, filingType } = useParams();
    const navigate = useNavigate();
    const hasToasted = useRef(false);

    // Form States
    const [loading, setLoading] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [filingDate, setFilingDate] = useState(dayjs().format("YYYY-MM-DD"));
    const [formData, setFormData] = useState({
        directors: "", 
        sicCode: "",          
        shareCapital: "",      
        shareholders: "",      
        turnover: "", 
        profit: "", 
        taxPaid: "",
        taxLiability: "", // Added for Smart Estimate
        utrNumber: "", 
        transactionRef: "",    
    });

    const updateField = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

    // --- AUTO-CALCULATION LOGIC ---
    useEffect(() => {
        const fetchAndCalculate = async () => {
            if (!companyId || !filingType) return;
            
            setCalculating(true);
            try {
                const companyRef = doc(db, "companies", companyId);
                const companySnap = await getDoc(companyRef);
                if (!companySnap.exists()) return;
                const company = companySnap.data();

                // PATH A: FINANCIAL FILINGS
                if (filingType.includes("Accounts") || filingType.includes("Tax Return")) {
                    const end = dayjs(company.lastAccountsDate || company.incorporationDate).add(1, 'year');
                    const start = end.subtract(1, 'year').add(1, 'day');

                    const expSnap = await getDocs(collection(db, "companies", companyId, "transactions"));
                    const totalExp = expSnap.docs
                        .map(d => d.data())
                        .filter(d => dayjs(d.date).isBetween(start, end, null, '[]'))
                        .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

                    const invSnap = await getDocs(query(collection(db, "invoices"), where("paid", "==", true)));
                    const totalRev = invSnap.docs
                        .map(d => d.data())
                        .filter(d => d.businessName === company.name && dayjs(d.date).isBetween(start, end, null, '[]'))
                        .reduce((sum, d) => sum + (Number(d.total) || 0), 0);

                    setFormData(prev => ({
                        ...prev,
                        turnover: totalRev.toFixed(2),
                        profit: (totalRev - totalExp).toFixed(2)
                    }));
                    if (!hasToasted.current) {
                        toast.info(`Ledger figures synced for ${end.format("YYYY")}`);
                        hasToasted.current = true;
                    }              
                }

                // PATH B: STATUTORY FILINGS
                if (filingType.includes("Confirmation")) {
                    const historyRef = collection(db, "companies", companyId, "filingHistory");
                    const q = query(historyRef, where("filingType", "==", "Confirmation Statement"), orderBy("createdAt", "desc"), limit(1));
                    const historySnap = await getDocs(q);
                    
                    if (!historySnap.empty) {
                        const lastData = historySnap.docs[0].data().submissionDetails;
                        setFormData(prev => ({
                            ...prev,
                            directors: lastData.directors || "",
                            sicCode: lastData.sicCode || "",
                            shareCapital: lastData.shareCapital || "",
                            shareholders: lastData.shareholders || ""
                        }));
                        if (!hasToasted.current) {
                            toast.info("Carried forward details from last filing");
                            hasToasted.current = true;
                        }                    
                    }
                }
            } catch (err) {
                console.error("Fetch Error:", err);
                toast.error("Error auto-filling form details.");
            } finally {
                setCalculating(false);
            }
        };

        fetchAndCalculate();
    }, [companyId, filingType]);

    // Smart Estimator Logic
    const estimateTax = () => {
        const profit = parseFloat(formData.profit);
        if (isNaN(profit) || profit <= 0) {
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
        updateField('taxLiability', taxAmount.toFixed(2));
        toast.success(`Estimated at ${effectiveRate}`, { icon: "⚖️" });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await addDoc(collection(db, "companies", companyId, "filingHistory"), {
                filingType,
                dateFiled: filingDate,
                submissionDetails: formData,
                createdAt: new Date()
            });
            const companyRef = doc(db, "companies", companyId);
            if (filingType.includes("Accounts")) {
                await updateDoc(companyRef, { lastAccountsDate: filingDate, isFirstYear: false });
            }
            toast.success(`${filingType} recorded!`);
            setTimeout(() => navigate("/dashboard"), 1500);
        } catch (error) {
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
                        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-black dark:hover:text-white transition">← Back</button>
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">Compliance Archive</span>
                    </div>
                    <h1 className="text-4xl font-black tracking-tighter uppercase italic text-gray-900 dark:text-white">{filingType}</h1>
                </header>

                <form onSubmit={handleSubmit} className="space-y-8">
                    <section>
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 block mb-3">Date of Submission</label>
                        <input type="date" className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-gray-800 font-bold transition" value={filingDate} onChange={(e) => setFilingDate(e.target.value)} required />
                    </section>

                    <hr className="opacity-10" />

                    {/* CONFIRMATION STATEMENT SECTION */}
                    {filingType?.includes("Confirmation") && (
                        <div className="space-y-5">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-indigo-500">Statutory Snapshot</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <textarea placeholder="Current Directors" className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 outline-none transition" value={formData.directors} onChange={e => updateField('directors', e.target.value)} required />
                                <input placeholder="SIC Code" className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 font-bold transition" value={formData.sicCode} onChange={e => updateField('sicCode', e.target.value)} required />
                            </div>
                            <div className="space-y-4">
                                <input placeholder="Statement of Capital" className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 font-bold transition" value={formData.shareCapital} onChange={e => updateField('shareCapital', e.target.value)} required />
                                <textarea placeholder="Shareholder Details" className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 transition" value={formData.shareholders} onChange={e => updateField('shareholders', e.target.value)} required />
                            </div>
                        </div>
                    )}

                    {/* ACCOUNTS / TAX RETURN SECTION */}
                    {(filingType?.includes("Accounts") || filingType?.includes("Tax Return")) && (
                        <div className="space-y-5 animate__animated animate__fadeIn">
                            <div className="flex justify-between items-center">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-emerald-500">
                                    {filingType.includes("Tax") ? "HMRC Tax Computation" : "Financial Performance"}
                                </label>
                                {calculating && <span className="text-[9px] font-black animate-pulse text-emerald-500 uppercase">Syncing Ledger...</span>}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <span className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Turnover (£)</span>
                                    <input type="number" step="0.01" className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 font-black text-xl transition" value={formData.turnover} onChange={e => updateField('turnover', e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <span className="text-[9px] font-bold text-gray-400 ml-2 uppercase">Net Profit (£)</span>
                                    <input type="number" step="0.01" className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 font-black text-xl transition" value={formData.profit} onChange={e => updateField('profit', e.target.value)} required />
                                </div>

                                {filingType.includes("Tax Return") && (
                                    <div className="md:col-span-2 space-y-5 mt-6">
                                        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 dark:border-gray-800 rounded-[2.5rem] bg-slate-50/50 dark:bg-white/5">
                                            
                                            <div className="text-center mb-6">
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 mb-1 block">
                                                    HMRC Liability Calculator
                                                </span>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    Use our smart engine to estimate your Corporation Tax based on current profit.
                                                </p>
                                            </div>

                                            {/* ENHANCED SMART ESTIMATE BUTTON */}
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

                                            {/* REVEALED INPUT AREA */}
                                            {formData.taxLiability && (
                                                <div className="w-full mt-8 animate__animated animate__fadeInUp">
                                                    <div className="relative">
                                                        <div className="absolute -top-3 left-6 px-2 bg-white dark:bg-gray-900 text-[9px] font-black text-orange-500 uppercase tracking-widest">
                                                            Estimated Tax Due
                                                        </div>
                                                        <input 
                                                            type="number" 
                                                            step="0.01" 
                                                            className="w-full p-6 rounded-3xl bg-white dark:bg-gray-950 border-2 border-orange-500 text-center font-black text-4xl text-orange-500 transition shadow-2xl outline-none" 
                                                            value={formData.taxLiability} 
                                                            onChange={e => updateField('taxLiability', e.target.value)} 
                                                        />
                                                    </div>
                                                    <p className="text-[10px] text-center text-gray-400 mt-4 font-medium uppercase tracking-tighter">
                                                        Calculated using UK {
                                                            parseFloat(formData.profit) <= 50000 
                                                                ? "19% Small Profits Rate" 
                                                                : parseFloat(formData.profit) > 250000 
                                                                    ? "25% Main Rate" 
                                                                    : "Marginal Relief Rates"
                                                        }
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* PAYMENT SECTION */}
                    {filingType?.includes("Payment") && (
                        <div className="space-y-5">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-orange-500">HMRC Payment Info</label>
                            <input type="number" step="0.01" placeholder="Amount Paid (£)" className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 font-black text-xl transition" value={formData.taxPaid} onChange={e => updateField('taxPaid', e.target.value)} required />
                            <input placeholder="HMRC Transaction Reference" className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-gray-800 font-bold transition" value={formData.transactionRef} onChange={e => updateField('transactionRef', e.target.value)} required />
                        </div>
                    )}

                    <button disabled={loading || calculating} className="group w-full py-6 bg-gray-900 dark:bg-white text-white dark:text-gray-950 rounded-[2rem] font-black uppercase tracking-[0.3em] text-xs hover:scale-[1.02] transition-all shadow-xl disabled:opacity-50">
                        {loading ? "ARCHIVING DATA..." : "CONFIRM & LOG FILING"}
                    </button>
                </form>
            </div>
            <ToastContainer position="bottom-right" theme="dark" />
        </div>
    );
};

export default RecordFiling;