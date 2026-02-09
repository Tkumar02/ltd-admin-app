import React, { useState, useEffect } from "react";
import { db } from "../firebase/firebaseConfig";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import getCompaniesByEmail from "../utils/getCompaniesByEmail";
import useCurrentUser from "../utils/getCurrentUser";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import { useNavigate } from "react-router-dom";

dayjs.extend(isBetween);

const ExpenseLedger = () => {
    const user = useCurrentUser();
    const navigate = useNavigate();
    const [companies, setCompanies] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetching, setFetching] = useState(false);
    const [activePeriodIdx, setActivePeriodIdx] = useState(0);

    // 1. Fetch Companies
    useEffect(() => {
        const fetchCompanies = async () => {
            if (!user?.email) return;
            const data = await getCompaniesByEmail(user.email);
            setCompanies(data);
            setLoading(false);
        };
        fetchCompanies();
    }, [user]);

// 2. Real-time Transaction Listener (Sub-collection Logic)
useEffect(() => {
    if (!selectedCompany) {
        setExpenses([]);
        return;
    }

    setFetching(true);

    // Path: companies -> [companyId] -> transactions
    const q = query(
        collection(db, "companies", selectedCompany.id, "transactions"),
        orderBy("date", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
        }));
        
        // We filter by user email if your transactions don't already 
        // imply ownership by being under the company doc
        setExpenses(data);
        setFetching(false);
    }, (error) => {
        console.error("Firestore Sub-collection Error:", error);
        setFetching(false);
    });

    return unsubscribe;
}, [selectedCompany]);

    // 3. Accounting Period Logic (Mirrored from Revenue)
    const getPeriods = (company) => {
        if (!company) return [];
        let ard = company.nextAccountsDate ? dayjs(company.nextAccountsDate) : dayjs(company.incorporationDate).add(1, 'year');
        while (dayjs().isAfter(ard)) { ard = ard.add(1, 'year'); }

        const periods = [];
        let i = 0;
        let keepGoing = true;
        const incDate = dayjs(company.incorporationDate);

        while (keepGoing) {
            const end = ard.subtract(i, 'year');
            let start = end.subtract(1, 'year').add(1, 'day');
            if (start.isBefore(incDate)) { start = incDate; keepGoing = false; }
            if (end.diff(start, 'day') < 2) break;
            if (end.isBefore(incDate)) break;

            periods.push({
                label: `${start.format('YYYY')}-${end.format('YY')}`,
                start, end,
                display: `${start.format('D MMM YYYY')} - ${end.format('D MMM YYYY')}`
            });
            i++;
            if (i > 50) break;
        }
        return periods;
    };

    const periods = getPeriods(selectedCompany);

    // 4. Filter & Totaling
    const filteredExpenses = expenses.filter(exp => {
        if (!periods[activePeriodIdx]) return false;
        return dayjs(exp.date).isBetween(periods[activePeriodIdx].start, periods[activePeriodIdx].end, null, '[]');
    });

    const periodTotal = filteredExpenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

    if (loading) return <div className="p-10 text-center font-black animate-pulse dark:text-white">LOADING EXPENDITURE...</div>;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
            <div className="max-w-6xl mx-auto">
                
                <header className="mb-10 flex justify-between items-end">
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter italic uppercase">Expense Ledger</h1>
                        <p className="text-gray-500 dark:text-gray-400 font-medium">Tracking outflows for {selectedCompany?.name || 'your entities'}.</p>
                    </div>
                </header>

                {/* COMPANY GRID */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                    {companies.map(company => (
                        <button
                            key={company.id}
                            onClick={() => { setSelectedCompany(company); setActivePeriodIdx(0); }}
                            className={`p-5 rounded-[2rem] border-2 transition-all text-left ${
                                selectedCompany?.id === company.id 
                                ? "border-red-500 bg-red-50 dark:bg-red-900/10 shadow-lg shadow-red-500/10" 
                                : "border-transparent bg-white dark:bg-gray-900 hover:border-gray-200"
                            }`}
                        >
                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Select Company</p>
                            <h3 className="text-sm font-bold dark:text-white mt-1 truncate">{company.name}</h3>
                        </button>
                    ))}
                </div>

                {selectedCompany ? (
                    <>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 items-start">
                            <div className="lg:col-span-2 space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Accounting Periods</label>
                                <div className="flex gap-3 overflow-x-auto pb-6 no-scrollbar scroll-smooth">
                                    {periods.map((p, idx) => {
                                        const isActive = activePeriodIdx === idx;
                                        const isFirst = idx === 0;
                                        return (
                                            <button
                                                key={p.label}
                                                onClick={() => setActivePeriodIdx(idx)}
                                                className={`flex-shrink-0 min-w-[180px] px-6 py-4 rounded-3xl transition-all flex flex-col border-2 ${
                                                    isActive 
                                                        ? isFirst ? "bg-emerald-600 border-emerald-600 text-white" : "bg-slate-600 border-slate-600 text-white"
                                                        : isFirst ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 text-emerald-700" : "bg-white dark:bg-gray-900 text-gray-500"
                                                }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-black uppercase tracking-tighter">{p.label}</span>
                                                    {isFirst && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>}
                                                </div>
                                                <span className="text-[9px] opacity-70 font-bold mt-1">{isFirst ? 'LIVE PERIOD' : p.display}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            {/* TOTAL EXPENSE CARD */}
                            <div className={`p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden transition-all duration-500 ${
                                activePeriodIdx === 0 ? "bg-gradient-to-br from-emerald-600 to-teal-700" : "bg-gradient-to-br from-slate-600 to-gray-700"
                            }`}>
                                <div className="relative z-10">
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Total Expenditure</p>
                                    <h2 className="text-4xl font-black leading-none italic">
                                        £{periodTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </h2>
                                    <p className="mt-2 text-[10px] font-bold uppercase opacity-60">
                                        {activePeriodIdx === 0 ? "Year to Date" : "Finalized Period"}
                                    </p>
                                </div>
                                <div className="absolute -right-4 -bottom-4 text-white/10 text-8xl font-black italic">OUT</div>
                            </div>
                        </div>

                        <div className="flex gap-4 mb-8">
                            <button 
                                onClick={() => navigate(`/record-expense/${selectedCompany.id}`)}
                                className="px-8 py-4 bg-black dark:bg-white text-white dark:text-black rounded-3xl font-black uppercase tracking-widest hover:opacity-90 transition shadow-xl"
                            >
                                + Log Expense
                            </button>
                        </div>

                        {/* TABLE */}
                        <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                            {fetching ? (
                                <div className="p-20 text-center text-gray-400 italic font-medium animate-pulse">Syncing ledgers...</div>
                            ) : filteredExpenses.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50/50 dark:bg-gray-800/50 border-b dark:border-gray-800">
                                            <tr>
                                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Supplier / Item</th>
                                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Category</th>
                                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                            {filteredExpenses.map((exp) => (
                                                <tr key={exp.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                                                    <td className="p-6 text-sm font-bold dark:text-gray-200">{dayjs(exp.date).format("DD MMM YYYY")}</td>
                                                    <td className="p-6">
                                                        <p className="text-sm font-bold dark:text-white">{exp.supplier || exp.description}</p>
                                                        <p className="text-[10px] text-gray-400 font-medium">Ref: {exp.id.slice(0,8).toUpperCase()}</p>
                                                    </td>
                                                    <td className="p-6 text-center">
                                                        <span className="text-[9px] font-black px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 uppercase">
                                                            {exp.category || "General"}
                                                        </span>
                                                    </td>
                                                    <td className="p-6 text-right font-black text-lg dark:text-white">
                                                        £{Number(exp.amount).toFixed(2)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-20 text-center text-gray-400 font-bold italic">No expenses recorded for this period.</div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="p-20 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-[3rem]">
                        <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">Select Company</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExpenseLedger;