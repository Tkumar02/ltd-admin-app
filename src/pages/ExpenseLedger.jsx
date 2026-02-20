import React, { useState, useEffect, useMemo } from "react";
import { db } from "../firebase/firebaseConfig";
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import getCompaniesByEmail from "../utils/getCompaniesByEmail";
import useCurrentUser from "../utils/getCurrentUser";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

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
        const cats = new Set(expenses.map(exp => exp.category || "General"));
        return ["ALL", ...Array.from(cats)];
    }, [expenses]);

    // 2. FILTERED LIST LOGIC
    const filteredExpenses = expenses.filter(exp => {
        if (!periods[activePeriodIdx]) return false;
        const inPeriod = dayjs(exp.date).isBetween(periods[activePeriodIdx].start, periods[activePeriodIdx].end, null, '[]');
        const matchesCat = selectedCategory === "ALL" || exp.category === selectedCategory;
        return inPeriod && matchesCat;
    });

    const periodTotal = filteredExpenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

    // 3. ACTION HANDLERS
    const handleEdit = (exp) => {
        navigate(`/record-expense/${selectedCompany.id}?edit=${exp.id}`);
    };

    const handleDelete = async (exp) => {
        if (window.confirm("Are you sure you want to delete this expense? This cannot be undone.")) {
            try {
                await deleteDoc(doc(db, "companies", selectedCompany.id, "transactions", exp.id));
                toast.success("Expense deleted");
            } catch (error) {
                toast.error("Error deleting record");
            }
        }
    };

    if (loading) return <div className="p-10 text-center font-black animate-pulse dark:text-white">LOADING EXPENDITURE...</div>;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0B0F1A] p-4 md:p-10 transition-colors duration-500">
            <div className="max-w-6xl mx-auto">
                
                <header className="mb-10 flex justify-between items-start">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter italic uppercase">Expense Ledger</h1>
                        <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-2">
                            {selectedCompany ? selectedCompany.name : "Awaiting Selection"}
                        </p>
                    </div>
                </header>

                {/* COMPANY GRID */}
                {companies.length > 1 && (
                    <section className="mb-8">
                        <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
                            {companies.map(company => (
                                <button
                                    key={company.id}
                                    onClick={() => { setSelectedCompany(company); setActivePeriodIdx(0); setSelectedCategory("ALL"); }}
                                    className={`px-6 py-4 rounded-2xl border-2 flex-shrink-0 transition-all text-left ${
                                        selectedCompany?.id === company.id 
                                        ? "border-red-500 bg-red-50/50 dark:bg-red-500/10" 
                                        : "border-slate-100 dark:border-slate-800 bg-white dark:bg-[#121826]"
                                    }`}
                                >
                                    <h3 className="text-[10px] font-black dark:text-white uppercase italic">{company.name}</h3>
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                {selectedCompany ? (
                    <>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 items-start">
                            <div className="lg:col-span-2">
                                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-3 block">Periods</label>
                                <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                                    {periods.map((p, idx) => (
                                        <button
                                            key={p.label}
                                            onClick={() => setActivePeriodIdx(idx)}
                                            className={`flex-shrink-0 px-6 py-4 rounded-2xl transition-all border-2 ${
                                                activePeriodIdx === idx 
                                                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white"
                                                    : "bg-white dark:bg-[#121826] text-slate-400 border-slate-100 dark:border-slate-800"
                                            }`}
                                        >
                                            <span className="text-[10px] font-black uppercase tracking-widest block">{p.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            <div className={`p-6 rounded-3xl text-white shadow-xl relative overflow-hidden transition-all duration-700 ${
                                activePeriodIdx === 0 ? "bg-red-600" : "bg-slate-800"
                            }`}>
                                <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">Total Expenses</p>
                                <h2 className="text-4xl font-black italic tracking-tighter">
                                    £{periodTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </h2>
                                <div className="absolute -right-4 -bottom-4 text-white/10 text-7xl font-black italic">OUT</div>
                            </div>
                        </div>

                        {/* CATEGORY FILTERS */}
                        <div className="mb-8">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-3 block">Filter Categories</label>
                            <div className="flex flex-wrap gap-2">
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border-2 ${
                                            selectedCategory === cat 
                                            ? "bg-red-600 border-red-600 text-white shadow-lg shadow-red-500/20" 
                                            : "bg-white dark:bg-[#121826] border-slate-100 dark:border-slate-800 text-slate-400"
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Transactions</h2>
                            <button 
                                onClick={() => navigate(`/record-expense/${selectedCompany.id}`)}
                                className="px-6 py-3 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-500/20"
                            >
                                + Log Expense
                            </button>
                        </div>

                        <div className="bg-white dark:bg-[#121826] rounded-[2rem] shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                                        <tr>
                                            <th className="p-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Details</th>
                                            <th className="p-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                                            <th className="p-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                        {filteredExpenses.map((exp) => (
                                            <tr key={exp.id} className="active:bg-slate-50 dark:active:bg-red-500/5 transition-all">
                                                <td className="p-5">
                                                    <p className="text-[9px] font-black text-slate-400 mb-1 uppercase tracking-tighter">
                                                        {dayjs(exp.date).format("DD MMM YYYY")}
                                                    </p>
                                                    <p className="text-sm font-black text-slate-900 dark:text-white uppercase italic truncate max-w-[150px]">
                                                        {exp.supplier || exp.description}
                                                    </p>
                                                    <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest mt-0.5">
                                                        {exp.category}
                                                    </p>
                                                </td>
                                                <td className="p-5 text-right font-black text-md dark:text-white italic">
                                                    £{Number(exp.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="p-5">
                                                    <div className="flex justify-end gap-2">
                                                        <button 
                                                            onClick={() => handleEdit(exp)}
                                                            className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                            </svg>
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDelete(exp)}
                                                            className="p-3 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-xl"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
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
                    <div className="p-20 text-center border-4 border-dashed border-slate-100 dark:border-slate-800/50 rounded-[3rem]">
                        <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Select a Company to begin</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExpenseLedger;