import React, { useState, useEffect } from "react";
import { db } from "../firebase/firebaseConfig";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import getCompaniesByEmail from "../utils/getCompaniesByEmail";
import useCurrentUser from "../utils/getCurrentUser";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";

dayjs.extend(isBetween);

const RevenueLedger = () => {
    const user = useCurrentUser();
    const [companies, setCompanies] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchingRevenue, setFetchingRevenue] = useState(false);
    const [activePeriodIdx, setActivePeriodIdx] = useState(0);

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

    // 2. Real-time Listen: Get invoices for the selected company
    useEffect(() => {
        if (!selectedCompany || !user?.email) {
            setInvoices([]);
            return;
        }

        setFetchingRevenue(true);
        const q = query(
            collection(db, "invoices"),
            where("userEmail", "==", user.email),
            where("businessName", "==", selectedCompany.name.trim()),
            orderBy("date", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setInvoices(data);
            setFetchingRevenue(false);
        }, (error) => {
            console.error("Firestore Error:", error);
            setFetchingRevenue(false);
        });

        return () => unsubscribe();
    }, [selectedCompany, user]);

    // 3. Logic: Calculate Accounting Periods based on Company Filings
    const getPeriods = (company) => {
        if (!company) return [];
        
        // Use nextAccountsDate (ARD) or fallback to Incorporation + 1 year
        const ard = company.nextAccountsDate ? dayjs(company.nextAccountsDate) : dayjs(company.incorporationDate).add(1, 'year');
        const periods = [];

        // Generate the last 3 accounting years for selection
        for (let i = 0; i < 3; i++) {
            const end = ard.subtract(i, 'year');
            const start = end.subtract(1, 'year').add(1, 'day');
            periods.push({
                label: `${start.format('YYYY')}-${end.format('YY')}`,
                start,
                end,
                display: `${start.format('D MMM YYYY')} - ${end.format('D MMM YYYY')}`
            });
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

    const yearlyTotal = filteredInvoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);

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
                            <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-3 py-1 rounded-full">Active Entity</span>
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
                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 group-hover:text-blue-500 transition-colors">Select Entity</p>
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
                                <div className="flex gap-3 overflow-x-auto pb-2">
                                    {periods.map((p, idx) => (
                                        <button
                                            key={p.label}
                                            onClick={() => setActivePeriodIdx(idx)}
                                            className={`px-6 py-4 rounded-3xl whitespace-nowrap transition-all flex flex-col min-w-[160px] ${
                                                activePeriodIdx === idx 
                                                ? "bg-black dark:bg-white text-white dark:text-black shadow-xl" 
                                                : "bg-white dark:bg-gray-900 text-gray-500 border border-gray-100 dark:border-gray-800"
                                            }`}
                                        >
                                            <span className="text-xs font-black uppercase tracking-tighter">{p.label}</span>
                                            <span className="text-[9px] opacity-60 font-bold mt-1">{p.display}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
                                <div className="relative z-10">
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Period Total</p>
                                    <h2 className="text-4xl font-black leading-none">
                                        £{yearlyTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </h2>
                                </div>
                                <div className="absolute -right-4 -bottom-4 text-white/10 text-8xl font-black italic">£</div>
                            </div>
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
                                                        <p className="text-sm font-bold dark:text-white">{inv.clientName}</p>
                                                        <p className="text-[10px] text-gray-400 font-medium">ID: {inv.invoiceID}</p>
                                                    </td>
                                                    <td className="p-6 text-center">
                                                        <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-tighter ${
                                                            inv.paid ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                                            : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                                                            {inv.paid ? "SETTLED" : "OUTSTANDING"}
                                                        </span>
                                                    </td>
                                                    <td className="p-6 text-right font-black text-lg dark:text-white">
                                                        £{Number(inv.total).toFixed(2)}
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