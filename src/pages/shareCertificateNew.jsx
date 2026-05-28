import React, { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { generateShareCertificate } from "../utils/shareCertificates";

export default function ShareCertificateNew() {
  const { companyId } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();

  const initial = useMemo(() => {
    return {
      issueDate: sp.get("issueDate") || dayjs().format("YYYY-MM-DD"),
      memberName: sp.get("memberName") || "",
      memberAddress: sp.get("memberAddress") || "",
      shareClass: sp.get("shareClass") || "Ordinary",
      shares: sp.get("shares") || "",
      notes: sp.get("notes") || "",
      companyName: sp.get("companyName") || "",
      companyNumber: sp.get("companyNumber") || "",
      demoSeed: sp.get("demoSeed") === "true",
    };
  }, [sp]);

  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const onCreate = async () => {
    setSaving(true);
    try {
      const res = await generateShareCertificate({
        companyId,
        companyName: form.companyName,
        companyNumber: form.companyNumber,
        issueDate: form.issueDate,
        memberName: form.memberName,
        memberAddress: form.memberAddress,
        shareClass: form.shareClass,
        shares: form.shares,
        notes: form.notes,
        demoSeed: form.demoSeed,
      });

      toast.success(`Created ${res.certificateNumber}`);
      navigate(`/companies/${companyId}/certificates/${res.certificateId}`);
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Failed to create certificate");
    } finally {
      setSaving(false);
    }
  };

  return (
  <div className="min-h-screen p-4 md:p-10 transition-colors duration-500">
    <ToastContainer theme="dark" position="bottom-right" />
    <div className="max-w-2xl mx-auto bg-transparent rounded-[3rem] p-8 md:p-12 border border-slate-100 dark:border-gray-800 shadow-2xl">        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-black dark:hover:text-white transition mb-4"
        >
          ← Back
        </button>

        <h1 className="text-4xl font-black tracking-tighter uppercase italic text-gray-900 dark:text-white">
          New Share Certificate
        </h1>

        <div className="mt-8 space-y-4">
          <input
            type="date"
            className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-gray-800 font-bold"
            value={form.issueDate}
            onChange={(e) => update("issueDate", e.target.value)}
          />

          <input
            placeholder="Member name"
            className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-gray-800 font-bold"
            value={form.memberName}
            onChange={(e) => update("memberName", e.target.value)}
          />

          <textarea
            rows={3}
            placeholder="Member address"
            className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-gray-800 font-bold"
            value={form.memberAddress}
            onChange={(e) => update("memberAddress", e.target.value)}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              placeholder="Share class (e.g. Ordinary)"
              className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-gray-800 font-bold"
              value={form.shareClass}
              onChange={(e) => update("shareClass", e.target.value)}
            />
            <input
              type="number"
              step="1"
              placeholder="Shares"
              className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-gray-800 font-black"
              value={form.shares}
              onChange={(e) => update("shares", e.target.value)}
            />
          </div>

          <textarea
            rows={3}
            placeholder="Notes (optional)"
            className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-gray-800 font-bold"
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
          />

          <button
            onClick={onCreate}
            disabled={saving}
            className="w-full py-5 rounded-[2rem] bg-indigo-600 text-white font-black uppercase tracking-[0.3em] text-xs shadow-xl disabled:opacity-60 active:scale-95 transition"
          >
            {saving ? "CREATING..." : "CREATE CERTIFICATE"}
          </button>
        </div>
      </div>
    </div>
  );
}