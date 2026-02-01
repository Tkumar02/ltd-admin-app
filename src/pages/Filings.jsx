import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../firebase/firebaseConfig";
import getCompaniesByEmail from "../utils/getCompaniesByEmail";
import useCurrentUser from "../utils/getCurrentUser";

const Filings = () => {
    const { companyId } = useParams(); // Retrieves ID from URL if coming from CompanyScreen
    const navigate = useNavigate();
    const user = useCurrentUser();

    const [companies, setCompanies] = useState([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState("");
    const [deadlines, setDeadlines] = useState([]);
    const [loadingCompanies, setLoadingCompanies] = useState(true);

    // 1. Fetch all companies for the dropdown
    useEffect(() => {
        const fetchCompanies = async () => {
            if (!user) return;
            setLoadingCompanies(true);
            const data = await getCompaniesByEmail(user.email);
            setCompanies(data);
            setLoadingCompanies(false);
        };
        fetchCompanies();
    }, [user]);

    // 2. Sync selectedCompanyId with URL parameter
    useEffect(() => {
        if (companyId) {
            setSelectedCompanyId(companyId);
        } else {
            setSelectedCompanyId("");
        }
    }, [companyId]);

    // 3. Calculate all logic when selection changes
    useEffect(() => {
        const company = companies.find(c => c.id === selectedCompanyId);
        if (!company) {
            setDeadlines([]);
            return;
        }

        const { incorporationDate, lastAccountsDate, isFirstYear, accountingStart } = company;
        const today = dayjs();
        
        let currentYearEnd;
        let accountsDeadline;

        // Logic for Accounts Cycle
        if (isFirstYear) {
            // New Company: 21 months from incorporation
            accountsDeadline = dayjs(incorporationDate).add(21, "months");
            currentYearEnd = dayjs(incorporationDate).add(1, "year").endOf("month");
        } else {
            // Established: 9 months from the year-end following the last filed date
            currentYearEnd = dayjs(lastAccountsDate).add(1, "year");
            accountsDeadline = currentYearEnd.add(9, "months");
        }

        // Confirmation Statement (Anniversary Logic)
        const anniversary = dayjs(incorporationDate).year(today.year());
        const confDeadline = anniversary.isBefore(today.subtract(1, 'day')) 
            ? anniversary.add(1, 'year').add(14, 'days') 
            : anniversary.add(14, 'days');

        const items = [
            {
                title: "Confirmation Statement",
                deadline: confDeadline,
                windowOpens: confDeadline.subtract(14, 'days'),
                desc: "Annual check of officers and persons of significant control.",
                govLink: "https://www.gov.uk/file-your-confirmation-statement"
            },
            {
                title: "Annual Accounts",
                deadline: accountsDeadline,
                windowOpens: currentYearEnd.add(1, 'day'),
                desc: `Accounts for period ending ${currentYearEnd.format("DD MMM YYYY")}.`,
                govLink: "https://www.gov.uk/file-your-company-accounts-and-tax-return"
            }
        ];

        // HMRC specific dates (only if trading start date exists)
        if (accountingStart && dayjs(accountingStart).isBefore(today)) {
            items.push({
                title: "Corporation Tax Payment",
                deadline: currentYearEnd.add(9, "months").add(1, "day"),
                windowOpens: currentYearEnd.add(1, 'day'),
                desc: "Tax due to HMRC (9 months + 1 day after year end).",
                govLink: "https://www.gov.uk/pay-corporation-tax"
            });
            items.push({
                title: "Company Tax Return (CT600)",
                deadline: currentYearEnd.add(12, "months"),
                windowOpens: currentYearEnd.add(1, 'day'),
                desc: "Detailed tax return submission to HMRC.",
                govLink: "https://www.gov.uk/file-your-company-accounts-and-tax-return"
            });
        }

        setDeadlines(items);
    }, [selectedCompanyId, companies]);

    const handleSelectChange = (e) => {
        const id = e.target.value;
        setSelectedCompanyId(id);
        navigate(`/filings/${id}`); // Updates URL for back-button support
    };

    const getStatus = (deadline, windowOpens) => {
        const today = dayjs();
        const daysToDeadline = deadline.diff(today, "day");

        if (daysToDeadline < 0) return { label: "OVERDUE", style: "border-red-500 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400" };
        if (daysToDeadline <= 30) return { label: "DUE SOON", style: "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400" };
        if (today.isAfter(windowOpens) || today.isSame(windowOpens, 'day')) {
            return { label: "READY TO FILE", style: "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400" };
        }
        return { label: "IN PROGRESS", style: "border-gray-300 bg-gray-50 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400" };
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 transition-colors duration-300">
            <div className="max-w-4xl mx-auto">
                <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">Filing Center</h1>
                        <p className="text-gray-500 dark:text-gray-400">Manage statutory deadlines and tax compliance.</p>
                    </div>
                </header>

                <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-xl shadow-black/5 border border-gray-100 dark:border-gray-800 mb-8">
                    <label className="block text-xs font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 mb-3">
                        Select Company
                    </label>
                    <select 
                        className="w-full p-4 rounded-2xl border-2 border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-600 transition outline-none text-lg font-bold"
                        onChange={handleSelectChange}
                        value={selectedCompanyId}
                    >
                        <option value="">Choose from portfolio...</option>
                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    {deadlines.map((item, idx) => {
                        const status = getStatus(item.deadline, item.windowOpens);
                        return (
                            <div key={idx} className={`relative p-8 rounded-[2rem] border-l-[16px] shadow-sm flex flex-col justify-between transition-all hover:translate-y-[-4px] ${status.style}`}>
                                <div className="mb-8">
                                    <div className="flex justify-between items-start mb-4">
                                        <span className="text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full border border-current">
                                            {status.label}
                                        </span>
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{item.title}</h3>
                                    <p className="text-4xl font-black text-gray-950 dark:text-white tracking-tighter mb-3">
                                        {item.deadline.format("DD MMM YYYY")}
                                    </p>
                                    <p className="text-sm font-medium leading-relaxed opacity-70 text-gray-800 dark:text-gray-300">
                                        {item.desc}
                                    </p>
                                </div>

                                <div className="flex items-center gap-3 pt-6 border-t border-black/5 dark:border-white/5">
                                    <button 
                                        className="flex-1 py-3.5 px-4 bg-white/60 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40 text-gray-900 dark:text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-sm transition active:scale-95"
                                        onClick={() => navigate(`/record-filing/${selectedCompanyId}/${item.title}`)}
                                    >
                                        Log Submission
                                    </button>
                                    <a 
                                        href={item.govLink} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="px-5 py-3.5 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-2xl font-bold text-xs transition"
                                    >
                                        Gov.uk ↗
                                    </a>
                                </div>
                            </div>
                        );
                    })}
                </div>
                
                {selectedCompanyId && deadlines.length === 0 && (
                    <div className="text-center py-24 text-gray-400 dark:text-gray-600 border-4 border-dashed border-gray-100 dark:border-gray-900 rounded-[3rem]">
                        <p className="font-bold text-lg italic">No trading history detected.</p>
                        <p className="text-sm">HMRC deadlines are hidden for dormant entities.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Filings;