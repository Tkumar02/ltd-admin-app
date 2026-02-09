import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import { useNavigate } from "react-router-dom";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import getCompaniesByEmail from "../utils/getCompaniesByEmail";
import useCurrentUser from "../utils/getCurrentUser";

dayjs.extend(isBetween);

// --- SUB-COMPONENT: LIVE P&L CALCULATOR ---
const CompanyLiveStats = ({ company, period }) => {
    const [stats, setStats] = useState({ profit: 0, loading: true });

    useEffect(() => {
        if (!company || !period) return;

        // Listen to Expenses & Revenue sub-collections
        const qExp = query(collection(db, "companies", company.id, "transactions"));
        const qRev = query(collection(db, "companies", company.id, "other_revenue"));

        const unsubExp = onSnapshot(qExp, (expSnap) => {
            const unsubRev = onSnapshot(qRev, (revSnap) => {
                const totalExp = expSnap.docs
                    .map(d => d.data())
                    .filter(d => dayjs(d.date).isBetween(period.start, period.end, null, '[]'))
                    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

                const totalRev = revSnap.docs
                    .map(d => d.data())
                    .filter(d => dayjs(d.date).isBetween(period.start, period.end, null, '[]'))
                    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

                setStats({ profit: totalRev - totalExp, loading: false });
            });
            return () => unsubRev();
        });
        return () => unsubExp();
    }, [company, period]);

    if (stats.loading) return <div className="h-6 w-24 bg-gray-200 dark:bg-gray-800 animate-pulse rounded-full" />;

    const isProfit = stats.profit >= 0;

    return (
        <div className={`px-4 py-1.5 rounded-2xl font-black text-[10px] flex items-center gap-2 border-2 transition-all ${
            isProfit 
            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shadow-sm" 
            : "bg-rose-500/10 text-rose-600 border-rose-500/20 shadow-sm"
        }`}>
            <span className={`w-2 h-2 rounded-full ${isProfit ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
            £{Math.abs(stats.profit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            <span className="opacity-60 hidden sm:inline">{isProfit ? 'PROFIT' : 'LOSS'}</span>
        </div>
    );
};

const Dashboard = () => {
    const navigate = useNavigate();
    const user = useCurrentUser();
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAllData = async () => {
            if (!user) return;
            setLoading(true);
            const data = await getCompaniesByEmail(user.email);
            setCompanies(data);
            setLoading(false);
        };
        fetchAllData();
    }, [user]);

    // Same period logic as Revenue/Ledger pages
    const getPeriods = (company) => {
        if (!company) return [];
        let ard = company.nextAccountsDate ? dayjs(company.nextAccountsDate) : dayjs(company.incorporationDate).add(1, 'year');
        while (dayjs().isAfter(ard)) { ard = ard.add(1, 'year'); }
        const end = ard;
        const start = end.subtract(1, 'year').add(1, 'day');
        return [{ start, end }]; // Return current period for stats
    };

    const getCompanySummary = (company) => {
        const { incorporationDate, lastAccountsDate, isFirstYear } = company;
        const today = dayjs();
        let accountsDeadline;
        let windowOpens;

        if (isFirstYear) {
            accountsDeadline = dayjs(incorporationDate).add(21, "months");
            windowOpens = dayjs(incorporationDate).add(1, "year").add(1, "day");
        } else {
            const currentYearEnd = dayjs(lastAccountsDate).add(1, "year");
            accountsDeadline = currentYearEnd.add(9, "months");
            windowOpens = currentYearEnd.add(1, "day");
        }

        const daysLeft = accountsDeadline.diff(today, "day");
        let status = { label: "IN PROGRESS", style: "text-slate-500 border-slate-200 bg-slate-50 dark:bg-slate-900/40 dark:border-slate-800 dark:text-slate-400" };
        
        if (daysLeft < 0) {
            status = { label: "OVERDUE", style: "text-rose-600 border-rose-200 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-400" };
        } else if (daysLeft <= 30) {
            status = { label: "DUE SOON", style: "text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400" };
        } else if (today.isAfter(windowOpens) || today.isSame(windowOpens, 'day')) {
            status = { label: "READY TO FILE", style: "text-indigo-600 border-indigo-200 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-400" };
        }

        return { accountsDeadline, daysLeft, status };
    };

    if (loading) return <div className="p-10 text-center animate-pulse font-black dark:text-white">SCANNING PORTFOLIO...</div>;

    const urgentCompanies = companies.filter(c => getCompanySummary(c).status.label !== "IN PROGRESS");

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F1A] p-4 md:p-10 transition-colors duration-500">
            <div className="max-w-6xl mx-auto">
                
                <header className="mb-12">
                    <h1 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter italic uppercase">Portfolio</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1">Companies Snapshot</p>
                </header>

                {/* --- ACTION REQUIRED SECTION --- */}
                <section className="mb-16">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-6">Critical Alerts</h2>
                    {urgentCompanies.length > 0 ? (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {urgentCompanies.map(company => {
                                const summary = getCompanySummary(company);
                                return (
                                    <div key={company.id} 
                                         onClick={() => navigate(`/filings/${company.id}`)}
                                         className={`group p-8 rounded-[2.5rem] border-2 cursor-pointer transition-all hover:shadow-2xl hover:-translate-y-2 ${summary.status.style}`}>
                                        <span className="text-[10px] font-black px-3 py-1 rounded-full border border-current uppercase tracking-tighter mb-4 inline-block">
                                            {summary.status.label}
                                        </span>
                                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-1 truncate">{company.name}</h3>
                                        <p className="text-[10px] font-bold opacity-60 mb-8 uppercase">Deadline: {summary.accountsDeadline.format("D MMM YYYY")}</p>
                                        <div className="py-4 px-6 bg-white/50 dark:bg-black/30 rounded-3xl text-center shadow-inner">
                                            <span className="text-xl font-black">{summary.daysLeft < 0 ? `${Math.abs(summary.daysLeft)} Days Overdue` : `${summary.daysLeft} Days Remaining`}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="p-8 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-xl">✓</div>
                            <div>
                                <p className="text-slate-900 dark:text-white font-black uppercase text-xs">Portfolio Healthy</p>
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-tight">All companies are current with HMRC & Companies House.</p>
                            </div>
                        </div>
                    )}
                </section>

                {/* --- PORTFOLIO TABLE SECTION --- */}
                <section>
                    <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-6">Company Performance</h2>
                    <div className="bg-white dark:bg-[#121826] rounded-[3rem] shadow-2xl shadow-black/5 border border-slate-100 dark:border-slate-800 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                                        <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Company</th>
                                        <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Live P&L</th>
                                        <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                    {companies.map(company => {
                                        const summary = getCompanySummary(company);
                                        const period = getPeriods(company)[0];
                                        return (
                                            <tr key={company.id} className="group hover:bg-slate-50 dark:hover:bg-indigo-900/10 transition-all">
                                                <td className="p-8">
                                                    <div className="flex flex-col gap-1">
                                                        <p className="text-lg font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">{company.name}</p>
                                                        <div className={`w-fit px-2 py-0.5 rounded-lg text-[8px] font-black border uppercase tracking-tighter ${summary.status.style}`}>
                                                            {summary.status.label}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-8">
                                                    <div className="flex justify-center">
                                                        <CompanyLiveStats company={company} period={period} />
                                                    </div>
                                                </td>
                                                <td className="p-8">
                                                    <div className="flex justify-end gap-3">
                                                        <button 
                                                            onClick={() => navigate(`/transactions/${company.id}`)}
                                                            className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-indigo-600 hover:text-white transition shadow-sm"
                                                            title="Ledger"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                                            </svg>
                                                        </button>
                                                        <button 
                                                            onClick={() => navigate(`/filings/${company.id}`)}
                                                            className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-purple-600 hover:text-white transition shadow-sm"
                                                            title="Filings"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Dashboard;