import React, { useState, useEffect } from "react";
import { db } from "../firebase/firebaseConfig";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
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

    // 1. Fetch Companies & Handle Auto-Selection
    useEffect(() => {
        const fetchCompanies = async () => {
            if (!user?.email) return;
            const data = await getCompaniesByEmail(user.email);
            setCompanies(data);
            
            // AUTO-SELECT LOGIC:
            // If there's exactly one company, skip the selection screen
            if (data.length === 1) {
                setSelectedCompany(data[0]);
            }
            
            setLoading(false);
        };
        fetchCompanies();
    }, [user]);

    // 2. Real-time Transaction Listener
    useEffect(() => {
        if (!selectedCompany) {
            setExpenses([]);
            return;
        }

        setFetching(true);
        const q = query(
            collection(db, "companies", selectedCompany.id, "transactions"),
            orderBy("date", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data() 
            }));
            setExpenses(data);
            setFetching(false);
        }, (error) => {
            console.error("Firestore Sub-collection Error:", error);
            setFetching(false);
        });

        return unsubscribe;
    }, [selectedCompany]);

    // 3. Accounting Period Logic
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

    const filteredExpenses = expenses.filter(exp => {
        if (!periods[activePeriodIdx]) return false;
        return dayjs(exp.date).isBetween(periods[activePeriodIdx].start, periods[activePeriodIdx].end, null, '[]');
    });

    const periodTotal = filteredExpenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

    if (loading) return <div className="p-10 text-center font-black animate-pulse dark:text-white">LOADING EXPENDITURE...</div>;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0B0F1A] p-6 md:p-10 transition-colors duration-500">
            <div className="max-w-6xl mx-auto">
                
                <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter italic uppercase">Expense Ledger</h1>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                {selectedCompany ? `Analysing ${selectedCompany.name}` : "Awaiting Selection"}
                            </p>
                        </div>
                    </div>
                </header>

                {/* COMPANY GRID: Only show if there's more than one company */}
                {companies.length > 1 && (
                    <section className="mb-12">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-4 ml-1">Select Entity</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {companies.map(company => (
                                <button
                                    key={company.id}
                                    onClick={() => { setSelectedCompany(company); setActivePeriodIdx(0); }}
                                    className={`p-6 rounded-[2rem] border-2 transition-all text-left ${
                                        selectedCompany?.id === company.id 
                                        ? "border-red-500 bg-red-50/50 dark:bg-red-500/10 shadow-xl shadow-red-500/5" 
                                        : "border-slate-100 dark:border-slate-800 bg-white dark:bg-[#121826] hover:border-slate-300 dark:hover:border-slate-600"
                                    }`}
                                >
                                    <h3 className="text-sm font-black dark:text-white truncate uppercase italic">{company.name}</h3>
                                    <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">View Ledger →</p>
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
                                    {periods.map((p, idx) => {
                                        const isActive = activePeriodIdx === idx;
                                        const isFirst = idx === 0;
                                        return (
                                            <button
                                                key={p.label}
                                                onClick={() => setActivePeriodIdx(idx)}
                                                className={`flex-shrink-0 min-w-[190px] px-6 py-5 rounded-[2rem] transition-all flex flex-col border-2 ${
                                                    isActive 
                                                        ? isFirst ? "bg-red-600 border-red-600 text-white shadow-lg shadow-red-500/20" : "bg-slate-800 border-slate-800 text-white"
                                                        : isFirst ? "bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 text-red-700" : "bg-white dark:bg-[#121826] text-slate-500 border-slate-100 dark:border-slate-800"
                                                }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-black uppercase tracking-widest">{p.label}</span>
                                                    {isFirst && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>}
                                                </div>
                                                <span className="text-[9px] opacity-70 font-bold mt-1 uppercase tracking-tighter">{p.display}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            {/* TOTAL CARD */}
                            <div className={`p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden transition-all duration-700 group ${
                                activePeriodIdx === 0 ? "bg-gradient-to-br from-red-600 to-rose-700" : "bg-gradient-to-br from-slate-700 to-slate-900"
                            }`}>
                                <div className="relative z-10">
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Period Expenditure</p>
                                    <h2 className="text-5xl font-black leading-none italic tracking-tighter">
                                        £{periodTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </h2>
                                    <div className="mt-4 flex items-center gap-2">
                                        <div className="px-2 py-0.5 rounded-md bg-white/20 text-[8px] font-black uppercase">GBP</div>
                                        <p className="text-[9px] font-bold uppercase opacity-60">
                                            {activePeriodIdx === 0 ? "Live Tracking" : "Historical Data"}
                                        </p>
                                    </div>
                                </div>
                                <div className="absolute -right-6 -bottom-6 text-white/5 text-9xl font-black italic group-hover:scale-110 transition-transform">OUT</div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 ml-1">Transaction History</h2>
                            <button 
                                onClick={() => navigate(`/record-expense/${selectedCompany.id}`)}
                                className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-xl"
                            >
                                + Log Expense
                            </button>
                        </div>

                        <div className="bg-white dark:bg-[#121826] rounded-[3rem] shadow-2xl shadow-black/5 border border-slate-100 dark:border-slate-800 overflow-hidden">
                            {fetching ? (
                                <div className="p-20 text-center text-slate-400 italic font-black uppercase tracking-widest animate-pulse text-xs">Syncing Transactions...</div>
                            ) : filteredExpenses.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                                                <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                                                <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                                                <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Description</th>
                                                <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                            {filteredExpenses.map((exp) => (
                                                <tr key={exp.id} className="group hover:bg-slate-50 dark:hover:bg-red-500/5 transition-all">
                                                    <td className="p-8 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase">
                                                        {dayjs(exp.date).format("DD MMM YYYY")}
                                                    </td>
                                                    <td className="p-8">
                                                        <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight italic">
                                                            {exp.supplier || exp.description}
                                                        </p>
                                                        <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">{exp.category}</p>
                                                    </td>
                                                    <td className="p-8">
                                                        <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight italic">
                                                            {exp.supplier || exp.description}
                                                        </p>
                                                        <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">{exp.notes}</p>
                                                    </td>
                                                    {/* <td className="p-8 text-center">
                                                        <span className="text-[9px] font-black px-4 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-widest border border-slate-200 dark:border-slate-700">
                                                            {exp.category || "General"}
                                                        </span>
                                                    </td> */}
                                                    <td className="p-8 text-right font-black text-lg dark:text-white italic">
                                                        £{Number(exp.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-20 text-center flex flex-col items-center">
                                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-4">?</div>
                                    <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">No records found for this period</p>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="p-32 text-center border-4 border-dashed border-slate-100 dark:border-slate-800/50 rounded-[4rem] flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full animate-bounce mb-6" />
                        <p className="text-slate-400 font-black uppercase tracking-[0.4em] text-xs">Waiting for Entity Selection</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExpenseLedger;