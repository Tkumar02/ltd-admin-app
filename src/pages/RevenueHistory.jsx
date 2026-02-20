import React, { useState, useEffect, useMemo } from "react";
import { db } from "../firebase/firebaseConfig";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import getCompaniesByEmail from "../utils/getCompaniesByEmail";
import useCurrentUser from "../utils/getCurrentUser";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import { useNavigate } from "react-router-dom";

dayjs.extend(isBetween);

const RevenueLedger = () => {
    const user = useCurrentUser();
    const navigate = useNavigate();
    const [companies, setCompanies] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchingRevenue, setFetchingRevenue] = useState(false);
    const [activePeriodIdx, setActivePeriodIdx] = useState(0);

    // NEW: Filter State
    const [selectedCategory, setSelectedCategory] = useState("ALL");

    useEffect(() => {
        const fetchCompanies = async () => {
            if (!user?.email) return;
            const data = await getCompaniesByEmail(user.email);
            setCompanies(data);
            if (data.length === 1) setSelectedCompany(data[0]);
            setLoading(false);
        };
        fetchCompanies();
    }, [user]);

    useEffect(() => {
        if (!selectedCompany || !user?.email) {
            setInvoices([]);
            return;
        }

        setFetchingRevenue(true);

        const qInvoices = query(
            collection(db, "invoices"),
            where("userEmail", "==", user.email),
            where("businessName", "==", selectedCompany.name.trim()),
            orderBy("date", "desc")
        );

        const qManual = query(
            collection(db, "companies", selectedCompany.id, "other_revenue"),
            orderBy("date", "desc")
        );

        const unsubInvoices = onSnapshot(qInvoices, (snap1) => {
            const salesData = snap1.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data(), 
                sourceType: 'INVOICE',
                displayCategory: 'Invoice' 
            }));

            const unsubManual = onSnapshot(qManual, (snap2) => {
                const manualData = snap2.docs.map(doc => ({ 
                    id: doc.id, 
                    ...doc.data(), 
                    sourceType: 'OTHER',
                    clientName: doc.data().source,
                    displayCategory: doc.data().category || 'Other'
                }));

                const combined = [...salesData, ...manualData].sort((a, b) => 
                    dayjs(b.date).unix() - dayjs(a.date).unix()
                );

                setInvoices(combined);
                setFetchingRevenue(false);
            });
            return () => unsubManual();
        });
        return () => unsubInvoices();
    }, [selectedCompany, user]);

    const getPeriods = (company) => {
        if (!company) return [];
        let ard = company.nextAccountsDate ? dayjs(company.nextAccountsDate) : dayjs(company.incorporationDate).add(1, 'year');
        while (dayjs().isAfter(ard)) { ard = ard.add(1, 'year'); }
        const periods = [];
        let i = 0;
        const incDate = dayjs(company.incorporationDate);

        while (true) {
            const end = ard.subtract(i, 'year');
            let start = end.subtract(1, 'year').add(1, 'day');
            if (start.isBefore(incDate)) { start = incDate; };
            if (end.diff(start, 'day') < 2) break;
            if (end.isBefore(incDate)) break;
            periods.push({
                label: `${start.format('YYYY')}-${end.format('YY')}`,
                start, end,
                display: `${start.format('D MMM YYYY')} - ${end.format('D MMM YYYY')}`
            });
            if (start.isSame(incDate)) break;
            i++;
            if (i > 50) break; 
        }
        return periods;
    };

    const periods = getPeriods(selectedCompany);

    // 1. DYNAMIC CATEGORIES FOR FILTER
    const categories = useMemo(() => {
        const cats = new Set(invoices.map(inv => inv.displayCategory));
        return ["ALL", ...Array.from(cats)];
    }, [invoices]);

    // 2. FILTERED LIST LOGIC
    const filteredInvoices = invoices.filter(inv => {
        if (!periods[activePeriodIdx]) return false;
        const inPeriod = dayjs(inv.date).isBetween(periods[activePeriodIdx].start, periods[activePeriodIdx].end, null, '[]');
        const matchesCat = selectedCategory === "ALL" || inv.displayCategory === selectedCategory;
        return inPeriod && matchesCat;
    });

    const taxableRevenue = filteredInvoices
        .filter(inv => inv.displayCategory !== "Director's Loan (In)" && inv.displayCategory !== "Tax Refund (VAT/Corp Tax)")
        .reduce((sum, inv) => sum + (Number(inv.total || inv.amount) || 0), 0);

    const nonTaxableRevenue = filteredInvoices
        .filter(inv => inv.displayCategory === "Director's Loan (In)" || inv.displayCategory === "Tax Refund (VAT/Corp Tax)")
        .reduce((sum, inv) => sum + (Number(inv.total || inv.amount) || 0), 0);
    
    // 3. EDIT HANDLER
    const handleEdit = (item) => {
        if (item.sourceType === 'INVOICE') {
            // Redirect to your invoice management site or edit route
            window.location.href = `https://finnexa-invoices.web.app/edit/${item.id}`;
        } else {
            // Navigate to internal Record Revenue page with edit ID
            navigate(`/record-revenue/${selectedCompany.id}?edit=${item.id}`);
        }
    };

    const handleDelete = async (item) => {
    if (item.sourceType === 'INVOICE') {
        alert("Please manage invoice deletions through the Invoice App to maintain record integrity.");
        return;
    }

    if (window.confirm("Are you sure you want to delete this entry? This cannot be undone.")) {
        try {
            await deleteDoc(doc(db, "companies", selectedCompany.id, "other_revenue", item.id));
            toast.success("Entry deleted");
        } catch (error) {
            console.error("Delete error:", error);
            toast.error("Failed to delete entry");
        }
    }
};

    if (loading) return <div className="p-10 text-center dark:text-white font-black uppercase tracking-[0.3em] text-xs">Loading Revenue...</div>;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0B0F1A] p-6 md:p-10 transition-colors duration-500">
            <div className="max-w-6xl mx-auto">
                
                <header className="mb-10 flex justify-between items-end">
                    <div>
                        <h1 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter italic uppercase">Revenue Ledger</h1>
                        <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-2">
                            {selectedCompany ? selectedCompany.name : "Portfolio Overview"}
                        </p>
                    </div>
                </header>

                {/* COMPANY SELECTION GRID */}
                {companies.length > 1 && (
                    <section className="mb-12">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {companies.map(company => (
                                <button
                                    key={company.id}
                                    onClick={() => { setSelectedCompany(company); setActivePeriodIdx(0); setSelectedCategory("ALL"); }}
                                    className={`p-6 rounded-[2rem] border-2 transition-all text-left ${
                                        selectedCompany?.id === company.id 
                                        ? "border-blue-600 bg-blue-50/50 dark:bg-blue-600/10 shadow-xl" 
                                        : "border-slate-100 dark:border-slate-800 bg-white dark:bg-[#121826] hover:border-slate-300"
                                    }`}
                                >
                                    <h3 className="text-sm font-black dark:text-white truncate uppercase italic">{company.name}</h3>
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                {selectedCompany ? (
                    <>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10 items-start">
                            <div className="lg:col-span-2 space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 ml-1">Accounting Periods</label>
                                <div className="flex gap-3 overflow-x-auto pb-6 no-scrollbar">
                                    {periods.map((p, idx) => (
                                        <button
                                            key={p.label}
                                            onClick={() => setActivePeriodIdx(idx)}
                                            className={`flex-shrink-0 min-w-[190px] px-6 py-5 rounded-[2rem] transition-all flex flex-col border-2 ${
                                                activePeriodIdx === idx 
                                                    ? idx === 0 ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-500/10" : "bg-slate-800 border-slate-800 text-white"
                                                    : "bg-white dark:bg-[#121826] text-slate-500 border-slate-100 dark:border-slate-800 shadow-sm"
                                            }`}
                                        >
                                            <span className="text-xs font-black uppercase tracking-widest">{p.label}</span>
                                            <span className="text-[9px] opacity-70 font-bold mt-1 uppercase tracking-tighter">{p.display}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            <div className={`p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden transition-all duration-700 ${
                                activePeriodIdx === 0 ? "bg-gradient-to-br from-emerald-600 to-teal-700" : "bg-gradient-to-br from-slate-700 to-slate-900"
                            }`}>
                                <div className="relative z-10">
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Turnover</p>
                                    <h2 className="text-5xl font-black leading-none italic tracking-tighter">
                                        £{taxableRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </h2>
                                    {nonTaxableRevenue > 0 && (
                                        <div className="mt-4 pt-4 border-t border-white/10">
                                            <p className="text-[8px] font-black uppercase opacity-60">Other Injections</p>
                                            <p className="text-sm font-bold">£{nonTaxableRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                        </div>
                                    )}
                                </div>
                                <div className="absolute -right-6 -bottom-6 text-white/5 text-9xl font-black italic">IN</div>
                            </div>
                        </div>

                        {/* CATEGORY FILTERS */}
                        <div className="mb-8">
                            <label className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 ml-1 mb-3 block">Filter by Category</label>
                            <div className="flex flex-wrap gap-2">
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border-2 ${
                                            selectedCategory === cat 
                                            ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20" 
                                            : "bg-white dark:bg-[#121826] border-slate-100 dark:border-slate-800 text-slate-400 hover:border-slate-300"
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 ml-1">History</h2>
                            <div className="flex gap-4">
                                <button 
                                    onClick={() => navigate(`/record-revenue/${selectedCompany.id}`)}
                                    className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/20"
                                >
                                    + Log Income
                                </button>
                                <button 
                                    onClick={() => window.location.href = 'https://finnexa-invoices.web.app'}
                                    className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em]"
                                >
                                    Manage invoices
                                </button>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-[#121826] rounded-[3rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                                            <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                                            <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Source</th>
                                            <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                            <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                                            <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                        {filteredInvoices.map((inv) => (
                                            <tr key={inv.id} className="group hover:bg-slate-50 dark:hover:bg-blue-500/5 transition-all">
                                                <td className="p-8 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase">
                                                    {dayjs(inv.date).format("DD MMM YYYY")}
                                                </td>
                                                <td className="p-8">
                                                    <p className="text-[15px] font-black text-slate-900 dark:text-white uppercase tracking-tight italic">
                                                        {inv.clientName || inv.source}
                                                    </p>
                                                    <p className={`text-[9px] font-bold uppercase mt-1 tracking-widest ${inv.sourceType === 'INVOICE' ? 'text-blue-500' : 'text-purple-500'}`}>
                                                        {inv.displayCategory}
                                                    </p>
                                                </td>
                                                <td className="p-8 text-center">
                                                    <span className={`text-[9px] font-black px-4 py-1.5 rounded-xl uppercase tracking-widest border ${
                                                        inv.paid || inv.sourceType === 'OTHER' 
                                                        ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/50' 
                                                        : 'bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-900/50'}`}>
                                                        {inv.paid || inv.sourceType === 'OTHER' ? "SETTLED" : "DUE"}
                                                    </span>
                                                </td>
                                                <td className="p-8 text-right font-black text-lg dark:text-white italic">
                                                    £{Number(inv.total || inv.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
<td className="p-4 text-right">
    <div className="flex justify-end gap-2">
        {/* EDIT BUTTON - Always visible on mobile */}
        <button 
            onClick={() => handleEdit(inv)}
            className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl active:bg-indigo-600 active:text-white transition-all"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
        </button>

        {/* DELETE BUTTON - Only for manual 'Other' revenue */}
        {inv.sourceType === 'OTHER' && (
            <button 
                onClick={() => handleDelete(inv)}
                className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl active:bg-red-600 active:text-white transition-all"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>
        )}
    </div>
</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="p-32 text-center border-4 border-dashed border-slate-100 dark:border-slate-800/50 rounded-[4rem]">
                        <p className="text-slate-400 font-black uppercase tracking-[0.4em] text-xs">Waiting for Entity Selection</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RevenueLedger;