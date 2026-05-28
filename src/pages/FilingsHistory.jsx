import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../firebase/firebaseConfig";
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import dayjs from "dayjs";

const PAGE_SIZE = 25;

const FilingsHistory = () => {
  const { companyId } = useParams();
  const navigate = useNavigate();

  const [companyName, setCompanyName] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const run = async () => {
      if (!companyId) return;

      setLoading(true);
      try {
        // Fetch company name (nice for UI)
        const companySnap = await getDoc(doc(db, "companies", companyId));
        if (companySnap.exists()) setCompanyName(companySnap.data()?.name || "");

        const historyRef = collection(db, "companies", companyId, "filingHistory");
        const q1 = query(historyRef, orderBy("createdAt", "desc"), limit(PAGE_SIZE));
        const snap = await getDocs(q1);

        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRows(items);

        const last = snap.docs[snap.docs.length - 1] || null;
        setLastDoc(last);
        setHasMore(snap.docs.length === PAGE_SIZE);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [companyId]);

  const loadMore = async () => {
    if (!companyId || !hasMore || !lastDoc) return;
    setLoadingMore(true);

    try {
      const historyRef = collection(db, "companies", companyId, "filingHistory");
      const q2 = query(
        historyRef,
        orderBy("createdAt", "desc"),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      );

      const snap = await getDocs(q2);
      const more = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      setRows((prev) => [...prev, ...more]);

      const last = snap.docs[snap.docs.length - 1] || null;
      setLastDoc(last);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  };

  const formatDate = (d) => (d ? dayjs(d).format("DD MMM YYYY") : "—");

  const prettyRows = useMemo(() => {
    return rows.map((r) => ({
      ...r,
      _createdAt: r.createdAt?.toDate ? r.createdAt.toDate() : r.createdAt,
    }));
  }, [rows]);

  if (loading) {
    return (
      <div className="min-h-screen p-6 transition-colors duration-500">
        <div className="max-w-5xl mx-auto text-center font-black uppercase tracking-[0.3em] text-xs text-gray-400 animate-pulse">
          Loading Filing History...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 transition-colors duration-500">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => navigate(-1)}
                className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition font-bold"
              >
                ← Back
              </button>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">
                Full History
              </span>
            </div>
            <h1 className="text-4xl font-black tracking-tighter text-gray-900 dark:text-white uppercase italic">
              Filing History
            </h1>
            {companyName && (
              <p className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-[10px] mt-2">
                {companyName}
              </p>
            )}
          </div>

          <button
            onClick={() => navigate(`/filings/${companyId}`)}
            className="px-6 py-3 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black uppercase tracking-widest text-[10px] shadow"
          >
            Back to Filling Center
          </button>
        </header>

        {prettyRows.length === 0 ? (
          <div className="p-10 rounded-[2.5rem] border-4 border-dashed border-gray-200 dark:border-gray-800 text-center text-gray-500 dark:text-gray-400">
            <p className="font-black uppercase tracking-widest text-xs">No filings logged yet</p>
            <p className="text-xs mt-2">Use “Log Submission” on the Filings page to create entries.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/60 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800">
                    <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Filed</th>
                    <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                    <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest hidden md:table-cell">
                      Created
                    </th>
                    <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
                  {prettyRows.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition">
                      <td className="p-6 font-black text-sm text-gray-900 dark:text-white">
                        {formatDate(r.dateFiled)}
                      </td>
                      <td className="p-6">
                        <div className="font-black text-gray-900 dark:text-white">{r.filingType}</div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-1">
                          {r.submissionDetails?.periodEnd
                            ? `Period end: ${formatDate(r.submissionDetails.periodEnd)}`
                            : r.submissionDetails?.effectiveDate
                              ? `Effective: ${formatDate(r.submissionDetails.effectiveDate)}`
                              : "—"}
                        </div>
                      </td>
                      <td className="p-6 hidden md:table-cell text-gray-500 dark:text-gray-400 font-bold">
                        {r._createdAt ? dayjs(r._createdAt).format("DD MMM YYYY HH:mm") : "—"}
                      </td>
                      <td className="p-6 text-right">
                        <pre className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-950/40 border border-gray-100 dark:border-gray-800 rounded-xl p-3 inline-block max-w-[420px] overflow-x-auto">
{JSON.stringify(r.submissionDetails || {}, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hasMore && (
              <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-8 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[10px] shadow disabled:opacity-60"
                >
                  {loadingMore ? "Loading..." : "Load More"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FilingsHistory;