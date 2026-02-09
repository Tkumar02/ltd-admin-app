import React, { useState, useEffect } from "react";
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
    const [companies, setCompanies] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchingRevenue, setFetchingRevenue] = useState(false);
    const [activePeriodIdx, setActivePeriodIdx] = useState(0);
    const navigate = useNavigate();



    // 1. Initial Fetch: Get all companies for the user
    useEffect(() => {
        const fetchCompanies = async () => {
            if (!user?.email) return;
            const data = await getCompaniesByEmail(user.email);
            setCompanies(data);
            setLoading(false);
        };
        fetchCompanies();
    }, [user]);

    // 2. Real-time Listen: Get invoices for the selected company - Replace your existing invoice useEffect with this dual-stream version
    useEffect(() => {
        if (!selectedCompany || !user?.email) {
            setInvoices([]);
            return;
        }

        setFetchingRevenue(true);

        // Stream 1: Global Invoices (Sales)
        const qInvoices = query(
            collection(db, "invoices"),
            where("userEmail", "==", user.email),
            where("businessName", "==", selectedCompany.name.trim()),
            orderBy("date", "desc")
        );

        // Stream 2: Manual Revenue (Interest, Loans, etc.)
        const qManual = query(
            collection(db, "companies", selectedCompany.id, "other_revenue"),
            orderBy("date", "desc")
        );

        const unsubInvoices = onSnapshot(qInvoices, (snap1) => {
            const salesData = snap1.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data(), 
                type: 'SALE' // Label for filtering/styling
            }));

            const unsubManual = onSnapshot(qManual, (snap2) => {
                const manualData = snap2.docs.map(doc => ({ 
                    id: doc.id, 
                    ...doc.data(), 
                    type: 'OTHER',
                    clientName: doc.data().source // Mapping 'source' to 'clientName' for table consistency
                }));

                // Combine and Sort by Date
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

    // 3. Logic: Calculate Accounting Periods based on Company Filings
    const getPeriods = (company) => {
        if (!company) return [];
        
        // 1. Anchor the year end
        let ard = company.nextAccountsDate ? dayjs(company.nextAccountsDate) : dayjs(company.incorporationDate).add(1, 'year');
        
        // 2. Fast-forward to the upcoming year end
        while (dayjs().isAfter(ard)) {
            ard = ard.add(1, 'year');
        }

        const periods = [];
        let i = 0;
        let keepGoing = true;
        const incDate = dayjs(company.incorporationDate);

        while (keepGoing) {
            const end = ard.subtract(i, 'year');
            let start = end.subtract(1, 'year').add(1, 'day');
            
            // 1. If the calculated start is before incorporation, snap it
            if (start.isBefore(incDate)) {
                start = incDate;
                keepGoing = false; // This is the final year, stop after this
            }

            // 2. THE FIX: Check the gap between start and end.
            // If the gap is less than 2 days, it's a "ghost period" from the calculation.
            if (end.diff(start, 'day') < 2) {
                break; 
            }

            // 3. Guard: If the end date itself is before incorporation, don't even add it.
            if (end.isBefore(incDate)) break;

            periods.push({
                label: `${start.format('YYYY')}-${end.format('YY')}`,
                start,
                end,
                display: `${start.format('D MMM YYYY')} - ${end.format('D MMM YYYY')}`,
                isCurrent: i === 0
            });

            i++;
            if (i > 50) break; 
        }
        
        return periods;
};

    const periods = getPeriods(selectedCompany);

    // 4. Filter invoices by the active period
    const filteredInvoices = invoices.filter(inv => {
        if (!periods[activePeriodIdx]) return false;
        const invDate = dayjs(inv.date);
        return invDate.isBetween(periods[activePeriodIdx].start, periods[activePeriodIdx].end, null, '[]');
    });

    const taxableRevenue = filteredInvoices
    .filter(inv => inv.category !== "Director's Loan (In)" && inv.category !== "Tax Refund (VAT/Corp Tax)")
    .reduce((sum, inv) => sum + (Number(inv.total || inv.amount) || 0), 0);

    const nonTaxableRevenue = filteredInvoices
        .filter(inv => inv.category === "Director's Loan (In)" || inv.category === "Tax Refund (VAT/Corp Tax)")
        .reduce((sum, inv) => sum + (Number(inv.total || inv.amount) || 0), 0);
    
    // This is your "Total Cash In" regardless of tax
    const totalCashIn = taxableRevenue + nonTaxableRevenue;

    if (loading) return <div className="p-10 text-center dark:text-white font-black animate-pulse">LOADING PORTFOLIO...</div>;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 transition-colors duration-300">
            <div className="max-w-6xl mx-auto">
                
                <header className="mb-10 flex justify-between items-end">
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter italic uppercase">Revenue Ledger</h1>
                        <p className="text-gray-500 dark:text-gray-400 font-medium">Smart filtering based on your official filing dates.</p>
                    </div>
                    {selectedCompany && (
                        <div className="hidden md:block text-right">
                            <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-3 py-1 rounded-full">Active</span>
                            <h2 className="text-xl font-bold dark:text-white">{selectedCompany.name}</h2>
                        </div>
                    )}
                </header>

                {/* COMPANY GRID */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                    {companies.map(company => (
                        <button
                            key={company.id}
                            onClick={() => { setSelectedCompany(company); setActivePeriodIdx(0); }}
                            className={`p-5 rounded-[2rem] border-2 transition-all text-left group ${
                                selectedCompany?.id === company.id 
                                ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20 shadow-lg shadow-blue-500/10" 
                                : "border-transparent bg-white dark:bg-gray-900 hover:border-gray-200 dark:hover:border-gray-800"
                            }`}
                        >
                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 group-hover:text-blue-500 transition-colors">Select Buesiness</p>
                            <h3 className="text-sm font-bold dark:text-white mt-1 truncate">{company.name}</h3>
                        </button>
                    ))}
                </div>

                {selectedCompany ? (
                    <>
                        {/* PERIOD SELECTOR & STATS */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 items-start">
                            <div className="lg:col-span-2 space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Accounting Periods</label>
<div className="flex gap-3 overflow-x-auto pb-6 no-scrollbar scroll-smooth">{/* THE PERIOD BUTTONS */}
{periods.map((p, idx) => {
    const isActive = activePeriodIdx === idx;
    const isFirst = idx === 0; // The "Current" year by default

    return (
        <button
            key={p.label}
            onClick={() => setActivePeriodIdx(idx)}
            className={`px-6 py-4 rounded-3xl transition-all flex flex-col min-w-[160px] border-2 ${
                isActive 
                    ? isFirst 
                        ? "bg-emerald-600 border-emerald-600 text-white" // Current & Selected
                        : "bg-black dark:bg-white text-white dark:text-black border-black" // Past & Selected
                    : isFirst
                        ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 text-emerald-700" // Current NOT Selected
                        : "bg-white dark:bg-gray-900 text-gray-500 border-gray-100 dark:border-gray-800" // Past NOT Selected
            }`}
        >
            <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-tighter">{p.label}</span>
                {isFirst && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>}
            </div>
            <span className="text-[9px] opacity-70 font-bold mt-1">
                {isFirst ? 'CURRENT PERIOD' : p.display}
            </span>
        </button>
    );
})}
                                </div>
                            </div>
                            
<div className={`p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden transition-all duration-500 ${
    activePeriodIdx === 0 
    ? "bg-gradient-to-br from-emerald-600 to-teal-700 shadow-emerald-500/20" 
    : "bg-gradient-to-br from-slate-600 to-gray-700 shadow-gray-500/10"
}`}>
    <div className="relative z-10">
        <div className="flex items-center gap-2 mb-1">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">
                {activePeriodIdx === 0 ? "Live Taxable Turnover" : "Final Taxable Turnover"}
            </p>
            {activePeriodIdx === 0 && (
                <span className="px-2 py-0.5 bg-white/20 rounded-full text-[8px] font-bold animate-pulse uppercase">Active</span>
            )}
            {activePeriodIdx !== 0 && (
                <span className="px-2 py-0.5 bg-black/20 rounded-full text-[8px] font-bold uppercase opacity-60">Closed</span>
            )}
        </div>
        
        <h2 className="text-4xl font-black leading-none italic">
            £{taxableRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </h2>
        
        {nonTaxableRevenue > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-[9px] font-bold uppercase opacity-60">Other Injections (Non-Taxable)</p>
                <p className="text-lg font-bold">£{nonTaxableRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
        )}
    </div>
    
    {/* Large background icon changes based on state */}
    <div className="absolute -right-4 -bottom-4 text-white/10 text-8xl font-black italic">
        {activePeriodIdx === 0 ? "£" : "✓"}
    </div>
</div>
                        </div>

                        <div className="flex flex-wrap gap-4 mb-8">
    {/* PRIMARY ACTION: Manual Log */}
    <button 
        onClick={() => navigate(`/record-revenue/${selectedCompany?.id}`)}
        disabled={!selectedCompany}
        className="flex items-center gap-3 px-8 py-4 bg-black dark:bg-white text-white dark:text-black rounded-3xl font-black uppercase tracking-widest hover:opacity-90 transition shadow-xl disabled:opacity-30"
    >
        <span className="text-xl">+</span>
        Log Other Income
    </button>

    {/* SECONDARY ACTION: View/Create Invoices */}
    {/* <button 
        onClick={() => navigate('/invoices')} 
        className="flex items-center gap-3 px-8 py-4 bg-white dark:bg-gray-900 text-gray-900 dark:text-white border-2 border-gray-100 dark:border-gray-800 rounded-3xl font-black uppercase tracking-widest hover:bg-gray-50 transition"
    >
        Manage Invoices
    </button> */}
</div>

                        {/* TABLE */}
                        <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                            {fetchingRevenue ? (
                                <div className="p-20 text-center text-gray-400 italic font-medium animate-pulse">Syncing with ledger...</div>
                            ) : filteredInvoices.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50/50 dark:bg-gray-800/50 border-b dark:border-gray-800">
                                            <tr>
                                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Client / Source</th>
                                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
                                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                            {filteredInvoices.map((inv) => (
                                                <tr key={inv.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                                                    <td className="p-6 text-sm font-bold dark:text-gray-200">
                                                        {dayjs(inv.date).format("DD MMM YYYY")}
                                                    </td>
                                                    <td className="p-6">
                                                        <div className="flex items-center gap-2">
                                                            {/* Visual indicator for income type */}
                                                            <span className={`w-2 h-2 rounded-full ${inv.type === 'SALE' ? 'bg-blue-500' : 'bg-purple-500'}`}></span>
                                                            <p className="text-sm font-bold dark:text-white">{inv.clientName || inv.source}</p>
                                                        </div>
                                                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">
                                                            {inv.category || "Invoice Sale"}
                                                        </p>
                                                    </td>
                                                    <td className="p-6 text-center">
                                                        <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-tighter ${
                                                            inv.paid || inv.type === 'OTHER' 
                                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                                            : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                                                            {inv.paid || inv.type === 'OTHER' ? "SETTLED" : "OUTSTANDING"}
                                                        </span>
                                                    </td>
                                                    <td className="p-6 text-right font-black text-lg dark:text-white">
                                                        £{Number(inv.total || inv.amount).toFixed(2)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-20 text-center">
                                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <span className="text-2xl">📁</span>
                                    </div>
                                    <p className="text-gray-400 font-bold italic mb-1">No ledger entries found for this period.</p>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Selected Period: {periods[activePeriodIdx]?.display}</p>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="p-20 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-[3rem]">
                        <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">Select an entity from the grid above to load accounting periods</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RevenueLedger;