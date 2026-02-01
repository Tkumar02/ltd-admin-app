import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase/firebaseConfig";
import getCompaniesByEmail from "../utils/getCompaniesByEmail";
import useCurrentUser from "../utils/getCurrentUser";

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

    // Logic to extract the most urgent filing for each company
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
        
        // REFINED THEME LOGIC:
        // style: [Text Color, Border Color, Background Color]
        let status = { 
            label: "IN PROGRESS", 
            style: "text-gray-500 border-gray-200 bg-gray-50 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-400" 
        };
        
        if (daysLeft < 0) {
            status = { 
                label: "OVERDUE", 
                style: "text-red-600 border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400" 
            };
        } else if (daysLeft <= 30) {
            status = { 
                label: "DUE SOON", 
                style: "text-orange-600 border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-400" 
            };
        } else if (today.isAfter(windowOpens) || today.isSame(windowOpens, 'day')) {
            status = { 
                label: "READY TO FILE", 
                style: "text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400" 
            };
        }

        return { accountsDeadline, daysLeft, status };
    };

    if (loading) return <div className="p-10 text-center animate-pulse dark:text-white">Loading Portfolio...</div>;

    const urgentCompanies = companies.filter(c => getCompanySummary(c).status.label !== "IN PROGRESS");
    const healthyCompanies = companies.filter(c => getCompanySummary(c).status.label === "IN PROGRESS");

return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 transition-colors duration-300">
            <div className="max-w-6xl mx-auto">
                <header className="mb-10">
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">DASHBOARD</h1>
                    <p className="text-gray-500 dark:text-gray-400 font-medium tracking-tight">Portfolio-wide filing status</p>
                </header>

                <section className="mb-12">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 mb-6">Action Required</h2>
                    {urgentCompanies.length > 0 ? (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {urgentCompanies.map(company => {
                                const summary = getCompanySummary(company);
                                return (
                                    <div key={company.id} 
                                         onClick={() => navigate(`/filings/${company.id}`)}
                                         className={`group p-6 rounded-[2rem] border-2 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 ${summary.status.style}`}>
                                        
                                        <div className="flex justify-between items-start mb-4">
                                            <span className="text-[10px] font-black px-2 py-1 rounded-lg border border-current uppercase tracking-widest">
                                                {summary.status.label}
                                            </span>
                                        </div>

                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1 truncate group-hover:underline">
                                            {company.name}
                                        </h3>
                                        
                                        <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-6 uppercase">
                                            Deadline: {summary.accountsDeadline.format("DD MMM YYYY")}
                                        </p>

                                        <div className="py-3 px-4 bg-white/40 dark:bg-black/20 rounded-2xl text-center">
                                            <span className="text-lg font-black text-gray-900 dark:text-white">
                                                {summary.daysLeft < 0 ? `${Math.abs(summary.daysLeft)} Days Late` : `${summary.daysLeft} Days Left`}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="p-16 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-[3rem] text-center">
                            <p className="text-gray-400 font-bold italic">Zero urgent filings. You're all caught up!</p>
                        </div>
                    )}
                </section>

                <section>
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 mb-6">Portfolio Overview</h2>
                    <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl shadow-black/5 border border-gray-100 dark:border-gray-800 overflow-hidden">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                                    <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Company Name</th>
                                    <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest hidden md:table-cell">Reg. Number</th>
                                    <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Next Deadline</th>
                                    <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                {companies.map(company => {
                                    const summary = getCompanySummary(company);
                                    return (
                                        <tr key={company.id} className="group hover:bg-gray-50 dark:hover:bg-blue-900/10 transition-colors">
                                            <td className="p-6 font-bold text-gray-900 dark:text-gray-100">{company.name}</td>
                                            <td className="p-6 text-sm font-bold text-gray-600 dark:text-gray-400">{summary.accountsDeadline.format("DD MMM YYYY")}</td>
                                            <td className="p-4 text-right">
                                                {/* QUICK ACTION BUTTONS */}
                                                <div className="flex justify-end gap-2">
                                                    {/* VIEW LEDGER / HISTORY */}
        <button 
            onClick={() => navigate(`/transactions/${company.id}`)}
            title="View Ledger"
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-purple-600 hover:text-white transition shadow-sm"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
        </button>
                                                    <button 
                                                        onClick={() => navigate(`/record-expense/${company.id}`)}
                                                        title="Log Expense"
                                                        className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-blue-600 hover:text-white transition shadow-sm"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                                        </svg>
                                                    </button>
                                                    <button 
                                                        onClick={() => navigate(`/filings/${company.id}`)}
                                                        title="View Filings"
                                                        className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-green-600 hover:text-white transition shadow-sm"
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
                </section>
            </div>
        </div>
    );
};

export default Dashboard;