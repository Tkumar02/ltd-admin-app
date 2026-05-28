import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import { db } from "../firebase/firebaseConfig";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

const changeLabel = (t) => {
  if (t === "APPOINT") return "Appointed";
  if (t === "RESIGN") return "Resigned";
  if (t === "CHANGE_DETAILS") return "Details changed";
  return t || "Update";
};

const safe = (v) => (v == null ? "" : String(v));

export default function RegisterDirectors() {
  const { companyId } = useParams();
  const navigate = useNavigate();

  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;

    const ref = collection(db, "companies", companyId, "directorUpdates");
    const q1 = query(ref, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q1,
      (snap) => {
        setUpdates(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })));
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [companyId]);

  // Build a "current directors" view by replaying updates oldest->newest
  const currentDirectors = useMemo(() => {
    const sorted = updates
      .slice()
      .sort((a, b) => {
        const ad = a?.data?.effectiveDate || "";
        const bd = b?.data?.effectiveDate || "";
        return dayjs(ad).valueOf() - dayjs(bd).valueOf();
      });

    const map = new Map(); // key: normalized name

    for (const u of sorted) {
      const d = u?.data || {};
      const name = safe(d.fullName).trim();
      if (!name) continue;

      const key = name.toLowerCase();
      const changeType = d.changeType;

      if (changeType === "RESIGN") {
        const existing = map.get(key) || { fullName: name };
        map.set(key, { ...existing, ...d, fullName: name, isActive: false });
      } else if (changeType === "APPOINT") {
        map.set(key, { ...d, fullName: name, isActive: true });
      } else if (changeType === "CHANGE_DETAILS") {
        const existing = map.get(key) || { fullName: name, isActive: true };
        map.set(key, { ...existing, ...d, fullName: name });
      } else {
        // unknown type: keep it as info without breaking
        const existing = map.get(key) || { fullName: name, isActive: true };
        map.set(key, { ...existing, ...d, fullName: name });
      }
    }

    return Array.from(map.values())
      .filter((x) => x.isActive !== false)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [updates]);

  return (
      <div className="min-h-screen p-4 md:p-10 transition-colors">
          <div className="max-w-5xl mx-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="text-gray-400 hover:text-black dark:hover:text-white transition mb-3"
            >
              ← Back
            </button>
            <h1 className="text-4xl font-black tracking-tighter uppercase italic text-gray-900 dark:text-white">
              Register of Directors
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-2">
              Company books • directors appointments & resignations
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/record-filing/${companyId}/Register of Directors`)}
              className="px-6 py-3 rounded-2xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition"
            >
              + Log update
            </button>
          </div>
        </header>

        {/* Guidance / forms */}
        <div className="bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-[2rem] p-6 md:p-8 shadow-sm mb-8">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
            Companies House forms (common)
          </h2>
          <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
            <div className="text-sm text-slate-600 dark:text-slate-300 font-medium">
              Use these when appointing/removing directors (often filed online; these are the form references).
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest"
                href="https://www.gov.uk/government/publications/appoint-a-director-ap01"
                target="_blank"
                rel="noreferrer"
              >
                AP01 ↗
              </a>
              <a
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest"
                href="https://www.gov.uk/government/publications/terminate-an-appointment-of-a-director-tm01"
                target="_blank"
                rel="noreferrer"
              >
                TM01 ↗
              </a>
              <a
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-slate-200 text-[10px] font-black uppercase tracking-widest"
                href="https://www.gov.uk/government/publications/change-details-of-a-director-ch01"
                target="_blank"
                rel="noreferrer"
              >
                CH01 ↗
              </a>
            </div>
          </div>
        </div>

        {/* Current directors */}
        <div className="grid gap-6 md:grid-cols-2 mb-10">
          <div className="bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-[2rem] p-6 md:p-8 shadow-sm">
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-4">
              Current directors
            </h2>

            {loading ? (
              <div className="text-slate-400 font-black uppercase tracking-widest text-xs animate-pulse">
                Loading…
              </div>
            ) : currentDirectors.length === 0 ? (
              <div className="text-slate-500 dark:text-slate-400">
                No directors recorded yet. Use <b>Log update</b> to add the first appointment.
              </div>
            ) : (
              <div className="space-y-3">
                {currentDirectors.map((d) => (
                  <div
                    key={d.fullName}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-gray-800/40 border border-slate-100 dark:border-gray-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight italic">
                          {d.fullName}
                        </div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
                          Service address
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-300">
                          {safe(d.serviceAddress) || "—"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                          Active
                        </div>
                        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
                          {d.appointmentDate ? `Appointed: ${dayjs(d.appointmentDate).format("DD MMM YYYY")}` : ""}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400 font-bold">
                      <div>Nationality: {safe(d.nationality) || "—"}</div>
                      <div>Residence: {safe(d.countryOfResidence) || "—"}</div>
                      <div>Occupation: {safe(d.occupation) || "—"}</div>
                      <div>DOB: {d.dob ? dayjs(d.dob).format("MMM YYYY") : "—"}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* History */}
          <div className="bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-[2rem] p-6 md:p-8 shadow-sm">
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-4">
              Update log
            </h2>

            {loading ? (
              <div className="text-slate-400 font-black uppercase tracking-widest text-xs animate-pulse">
                Loading…
              </div>
            ) : updates.length === 0 ? (
              <div className="text-slate-500 dark:text-slate-400">No updates logged yet.</div>
            ) : (
              <div className="space-y-2">
                {updates.slice(0, 12).map((u) => {
                  const d = u.data || {};
                  return (
                    <div
                      key={u.id}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-gray-800/40 border border-slate-100 dark:border-gray-800"
                    >
                      <div className="flex justify-between gap-3">
                        <div className="font-black text-slate-900 dark:text-white">
                          {changeLabel(d.changeType)}: {safe(d.fullName) || "—"}
                        </div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          {d.effectiveDate ? dayjs(d.effectiveDate).format("DD MMM YYYY") : "—"}
                        </div>
                      </div>
                      {d.notes ? (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">{d.notes}</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}