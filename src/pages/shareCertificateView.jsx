import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import { db } from "../firebase/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

const safe = (v) => (v == null ? "" : String(v));

export default function ShareCertificateView() {
  const { companyId, certificateId } = useParams();
  const navigate = useNavigate();

  const [cert, setCert] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      if (!companyId || !certificateId) return;
      setLoading(true);
      try {
        const ref = doc(db, "companies", companyId, "shareCertificates", certificateId);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setCert(null);
        } else {
          setCert({ id: snap.id, ...snap.data() });
        }
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [companyId, certificateId]);

  if (loading) {
    return (
      <div className="p-10 text-center font-black uppercase tracking-widest text-slate-400">
        Loading certificate…
      </div>
    );
  }

  if (!cert) {
    return (
      <div className="p-10 text-center">
        <div className="font-black text-slate-900 dark:text-white">Certificate not found</div>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-6 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xs uppercase tracking-widest"
        >
          Back
        </button>
      </div>
    );
  }

  const issueDate = cert.issueDate ? dayjs(cert.issueDate).format("DD MMM YYYY") : "";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 p-4 md:p-10">
      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-page {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
          }
        }
      `}</style>

      <div className="max-w-3xl mx-auto">
        <div className="no-print flex items-center justify-between mb-6 gap-3">
          <button
            onClick={() => navigate(-1)}
            className="px-5 py-3 rounded-2xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 text-slate-700 dark:text-slate-200 font-black text-[10px] uppercase tracking-widest"
          >
            ← Back
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="px-6 py-3 rounded-2xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition"
              title="Opens print dialog — choose 'Save as PDF'"
            >
              Download PDF
            </button>
          </div>
        </div>

        <div className="print-page bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-[2rem] p-8 md:p-12 shadow-xl">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-400">
                Share Certificate
              </div>
              <div className="text-3xl md:text-4xl font-black tracking-tighter italic text-slate-900 dark:text-white mt-2">
                {safe(cert.companyName) || "—"}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400 font-bold mt-1">
                Company No: {safe(cert.companyNumber) || "—"}
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Certificate No
              </div>
              <div className="text-lg font-black text-slate-900 dark:text-white">
                {safe(cert.certificateNumber)}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-2">
                Issue date
              </div>
              <div className="text-sm font-black text-slate-900 dark:text-white">{issueDate}</div>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-gray-800">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Member
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-2">
                {safe(cert.memberName) || "—"}
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-4">
                Address
              </div>
              <div className="text-sm font-bold text-slate-700 dark:text-slate-200 mt-1 whitespace-pre-wrap">
                {safe(cert.memberAddress) || "—"}
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-gray-800">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Shares
              </div>
              <div className="text-4xl font-black italic text-slate-900 dark:text-white mt-2">
                {Number(cert.shares || 0).toLocaleString()}
              </div>

              <div className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Class
              </div>
              <div className="text-sm font-black text-slate-900 dark:text-white mt-1">
                {safe(cert.shareClass) || "Ordinary"}
              </div>
            </div>
          </div>

          <div className="mt-10 p-6 rounded-2xl border border-slate-200 dark:border-gray-800">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Notes
            </div>
            <div className="text-sm text-slate-700 dark:text-slate-200 font-bold mt-2 whitespace-pre-wrap">
              {safe(cert.notes) || "—"}
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-10">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Director / Secretary Signature
              </div>
              <div className="mt-10 border-b border-slate-300 dark:border-gray-700" />
              <div className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-2">
                Name / Title
              </div>
            </div>

            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Date
              </div>
              <div className="mt-10 border-b border-slate-300 dark:border-gray-700" />
              <div className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-2">
                Signed on behalf of the company
              </div>
            </div>
          </div>

          <div className="mt-10 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            Generated by FinNexa • This certificate supports (but does not replace) the statutory Register of Members.
          </div>
        </div>
      </div>
    </div>
  );
}