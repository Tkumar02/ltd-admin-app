import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase/firebaseConfig";
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from "firebase/firestore";
import useCurrentUser from "../utils/getCurrentUser";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import dayjs from "dayjs";

const COLORS = [
  "#EF4444", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", 
  "#EC4899", "#06B6D4", "#F97316", "#14B8A6", "#6366F1"
];

const toDayjs = (v) => {
  if (!v) return null;
  if (typeof v === "object" && typeof v.toDate === "function") return dayjs(v.toDate());
  const d = dayjs(v);
  return d.isValid() ? d : null;
};

const Analytics = () => {
  const { companyId, type } = useParams();
  const navigate = useNavigate();
  const user = useCurrentUser();
  
  const [company, setCompany] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch company details
  useEffect(() => {
    const fetchCompany = async () => {
      if (!companyId) return;
      const docRef = doc(db, "companies", companyId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setCompany({ id: docSnap.id, ...docSnap.data() });
      }
    };
    fetchCompany();
  }, [companyId]);

  // Fetch transactions/revenue
  useEffect(() => {
    if (!company || !user?.email) return;

    let unsubscribers = [];

    if (type === "expense") {
      const q = query(
        collection(db, "companies", companyId, "transactions"),
        orderBy("date", "desc")
      );
      const unsub = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setData(items);
        setLoading(false);
      });
      unsubscribers.push(unsub);
    } else if (type === "revenue") {
      const qInvoices = query(
        collection(db, "invoices"),
        where("userEmail", "==", user.email),
        where("businessName", "==", company.name.trim()),
        orderBy("date", "desc")
      );
      const qManual = query(
        collection(db, "companies", companyId, "other_revenue"),
        orderBy("date", "desc")
      );

      let salesData = [];
      let manualData = [];

      const updateData = () => {
        setData([...salesData, ...manualData]);
        setLoading(false);
      };

      const unsubInvoices = onSnapshot(qInvoices, (snap1) => {
        salesData = snap1.docs.map(d => ({
          ...d.data(),
          amount: d.data().total || d.data().amount,
          category: "Invoice"
        }));
        updateData();
      }, (err) => {
        console.error("Invoice fetch error:", err);
        setLoading(false);
      });

      const unsubManual = onSnapshot(qManual, (snap2) => {
        manualData = snap2.docs.map(d => ({
          ...d.data(),
          category: d.data().category || "Other"
        }));
        updateData();
      }, (err) => {
        console.error("Manual revenue fetch error:", err);
        setLoading(false);
      });

      unsubscribers.push(unsubInvoices, unsubManual);
    }

    return () => unsubscribers.forEach(unsub => unsub());
  }, [company, user, type, companyId]);

  const chartData = useMemo(() => {
    const categories = {};
    data.forEach(item => {
      const cat = item.category || (type === "expense" ? "General" : "Other");
      const amount = Number(item.amount) || 0;
      categories[cat] = (categories[cat] || 0) + amount;
    });

    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [data, type]);

  const total = useMemo(() => chartData.reduce((sum, item) => sum + item.value, 0), [chartData]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center transition-colors duration-500">
      <div className="text-center font-black animate-pulse dark:text-white uppercase tracking-widest">
        Analyzing Data...
      </div>
    </div>
  );

  return (
    <div className="min-h-screen p-4 md:p-10 transition-colors duration-500">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12 flex justify-between items-center">
          <div>
            <button 
              onClick={() => navigate(-1)}
              className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </button>
            <h1 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter italic uppercase leading-tight">
              {type === "expense" ? "Expense" : "Revenue"} Analytics
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-2">
              {company?.name}
            </p>
          </div>
        </header>

        <div className="space-y-12">
          {data.length > 0 ? (
            <>
              {/* Summary Section - Integrated */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-12 bg-slate-50/20 dark:bg-slate-800/20 p-8 md:p-12 rounded-[3rem] border border-slate-100 dark:border-slate-800/50">
                <div className="w-full h-64 md:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={isMobile ? 60 : 80}
                        outerRadius={isMobile ? 90 : 120}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1e293b', 
                          border: 'none', 
                          borderRadius: '12px',
                          color: '#fff',
                          fontWeight: 'bold',
                          fontSize: '12px'
                        }}
                        itemStyle={{ color: '#fff' }}
                        formatter={(value) => `£${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="w-full md:w-1/2">
                  <div className="mb-8 text-center md:text-left">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-2">Total {type === "expense" ? "Spend" : "Income"}</p>
                    <h2 className={`text-5xl md:text-6xl font-black italic tracking-tighter ${type === "expense" ? "text-red-500" : "text-emerald-500"}`}>
                      £{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </h2>
                  </div>

                  <div className="space-y-4 max-h-60 overflow-y-auto pr-4 no-scrollbar">
                    {chartData.map((item, index) => (
                      <div key={item.name} className="flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{item.name}</span>
                        </div>
                        <span className="text-xs font-black dark:text-white italic">
                          {((item.value / total) * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Detailed Breakdown */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Category Breakdown</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{chartData.length} Categories</p>
                </div>
                
                <div className="bg-transparent rounded-[2.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                  <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                      {chartData.map((item, index) => (
                        <div key={item.name} className="p-5 md:p-6 flex items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-black text-xs md:text-base shadow-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }}>
                              {item.name.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs md:text-sm font-black text-slate-900 dark:text-white uppercase italic truncate">
                                {item.name}
                              </p>
                              <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">
                                {type === "expense" ? "Expenditure" : "Revenue Source"}
                              </p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm md:text-lg font-black text-slate-900 dark:text-white italic whitespace-nowrap">
                              £{item.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                            <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                              {((item.value / total) * 100).toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-32 text-center border-4 border-dashed border-slate-100 dark:border-slate-800/50 rounded-[4rem]">
               <p className="text-slate-400 font-black uppercase tracking-[0.4em] text-xs">No data available for analysis</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analytics;
