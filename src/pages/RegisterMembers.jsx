import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

const toISO = (v) => {
  if (!v) return null;
  // Firestore Timestamp
  if (typeof v === "object" && typeof v.toDate === "function") {
    return dayjs(v.toDate()).format("YYYY-MM-DD");
  }
  // string date
  return String(v);
};

const pretty = (iso) => (iso ? dayjs(iso).format("DD MMM YYYY") : "—");

const normalizeName = (s) => (s || "").trim();

const extractEffectiveDate = (d) =>
  toISO(d?.data?.effectiveDate) ||
  toISO(d?.submissionDetails?.effectiveDate) ||
  toISO(d?.effectiveDate) ||
  toISO(d?.createdAt) ||
  null;

const extractChangeType = (d) =>
  d?.data?.changeType ||
  d?.submissionDetails?.changeType ||
  d?.changeType ||
  "UPDATE";

const extractShareClass = (d) =>
  d?.data?.shareClass ||
  d?.submissionDetails?.shareClass ||
  d?.shareClass ||
  "Ordinary";

const extractSharesChange = (d) => {
  const raw =
    d?.data?.sharesChange ??
    d?.submissionDetails?.sharesChange ??
    d?.sharesChange ??
    null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
};

const extractToMember = (d) =>
  normalizeName(
    d?.data?.toMemberName ||
      d?.submissionDetails?.toMemberName ||
      d?.toMemberName ||
      ""
  );

const extractFromMember = (d) =>
  normalizeName(
    d?.data?.fromMemberName ||
      d?.submissionDetails?.fromMemberName ||
      d?.fromMemberName ||
      ""
  );

const extractMemberAddress = (d) =>
  (d?.data?.memberAddress ||
    d?.submissionDetails?.memberAddress ||
    d?.memberAddress ||
    "")?.trim();

const extractCertificateRef = (d) =>
  (d?.data?.certificateRef ||
    d?.submissionDetails?.certificateRef ||
    d?.certificateRef ||
    "")?.trim();

const extractCertificateId = (d) =>
  d?.data?.certificateId ||
  d?.submissionDetails?.certificateId ||
  d?.certificateId ||
  "";

const extractNotes = (d) =>
  (d?.data?.notes || d?.submissionDetails?.notes || d?.notes || "")?.trim();

/**
 * Expected registerUpdates event shape (you can keep your own keys — we try multiple):
 * {
 *   createdAt,
 *   data: {
 *     effectiveDate: "YYYY-MM-DD",
 *     changeType: "ISSUE_SHARES" | "TRANSFER_SHARES" | "CANCEL_SHARES" | "CORRECTION",
 *     toMemberName,
 *     fromMemberName,
 *     memberAddress,
 *     shareClass,
 *     sharesChange: number,  // + for issue/receive, - for transfer out/cancel
 *     certificateRef,
 *     notes
 *   }
 * }
 */

const RegisterMembers = () => {
  const { companyId } = useParams();
  const navigate = useNavigate();

  const [company, setCompany] = useState(null);
  const [loadingCompany, setLoadingCompany] = useState(true);

  const [updates, setUpdates] = useState([]);
  const [loadingUpdates, setLoadingUpdates] = useState(true);

  // Load company (for header)
  useEffect(() => {
    const run = async () => {
      if (!companyId) return;
      setLoadingCompany(true);
      try {
        const snap = await getDoc(doc(db, "companies", companyId));
        setCompany(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      } finally {
        setLoadingCompany(false);
      }
    };
    run();
  }, [companyId]);

  // Subscribe to registerUpdates
  useEffect(() => {
    if (!companyId) return;

    setLoadingUpdates(true);
    const ref = collection(db, "companies", companyId, "registerUpdates");
    const qy = query(ref, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setUpdates(rows);
        setLoadingUpdates(false);
      },
      () => setLoadingUpdates(false)
    );

    return () => unsub();
  }, [companyId]);

  /**
   * Build a “statutory-register style” current view:
   * - holdings by member+class
   * - became member date = first date holdings went from 0 to >0
   * - ceased member date = date holdings hit 0 (latest time it became 0), else null
   * - address = last known address from events
   */
  const register = useMemo(() => {
    // Map keyed by `${member}||${class}`
    const map = new Map();

    const getKey = (member, shareClass) => `${member}||${shareClass}`;

    const ensure = (member, shareClass) => {
      const key = getKey(member, shareClass);
      if (!map.has(key)) {
        map.set(key, {
          memberName: member,
          shareClass,
          shares: 0,
          becameMemberOn: null,
          ceasedMemberOn: null,
          address: "",
          certificateRefs: new Set(),
          certificateIds: new Map(), // map ref -> id
          lastEventOn: null,
        });
      }
      return map.get(key);
    };

    // We’ll process in chronological order (already ordered asc by createdAt; we also use effectiveDate when present)
    const events = updates
      .map((u) => {
        const effectiveDate = extractEffectiveDate(u);
        return {
          id: u.id,
          effectiveDate,
          changeType: extractChangeType(u),
          shareClass: extractShareClass(u),
          sharesChange: extractSharesChange(u),
          toMember: extractToMember(u),
          fromMember: extractFromMember(u),
          address: extractMemberAddress(u),
          certificateRef: extractCertificateRef(u),
          certificateId: extractCertificateId(u),
          notes: extractNotes(u),
          createdAtISO: toISO(u.createdAt),
        };
      })
      .sort((a, b) => {
        const da = a.effectiveDate || a.createdAtISO || "";
        const db = b.effectiveDate || b.createdAtISO || "";
        if (da < db) return -1;
        if (da > db) return 1;
        return 0;
      });

    for (const e of events) {
      const when = e.effectiveDate || e.createdAtISO || null;

      // Issue / receive shares -> toMember + sharesChange (usually +)
      if (e.toMember) {
        const row = ensure(e.toMember, e.shareClass);
        const before = row.shares;
        row.shares += e.sharesChange;

        // address: keep last known non-empty
        if (e.address) row.address = e.address;

        if (e.certificateRef) {
          row.certificateRefs.add(e.certificateRef);
          if (e.certificateId) row.certificateIds.set(e.certificateRef, e.certificateId);
        }

        // became member: first transition from 0 to >0
        if (!row.becameMemberOn && before <= 0 && row.shares > 0) {
          row.becameMemberOn = when;
        }

        // ceased member: if holdings reach 0 or below, set ceased date (and clamp to 0)
        if (row.shares <= 0) {
          row.shares = 0;
          row.ceasedMemberOn = when;
        } else {
          // if they have shares again, they are not ceased currently
          row.ceasedMemberOn = null;
        }

        row.lastEventOn = when;
      }

      // Transfer out / cancel shares from fromMember (if present)
      // If your events represent transfer-out via fromMember + sharesChange (positive),
      // you can adapt. Here we assume sharesChange is the delta applied to "toMember".
      // So for fromMember, we infer the opposite delta when changeType indicates transfer.
      if (e.fromMember && e.changeType === "TRANSFER_SHARES") {
        const row = ensure(e.fromMember, e.shareClass);
        const before = row.shares;

        // If sharesChange was applied to "toMember" as +N, then fromMember is -N.
        // If your form stores a negative sharesChange already, this still behaves sensibly.
        const delta = -Math.abs(e.sharesChange);
        row.shares += delta;

        if (e.address) row.address = e.address;
        if (e.certificateRef) {
          row.certificateRefs.add(e.certificateRef);
          if (e.certificateId) row.certificateIds.set(e.certificateRef, e.certificateId);
        }

        if (!row.becameMemberOn && before <= 0 && row.shares > 0) {
          row.becameMemberOn = when;
        }

        if (row.shares <= 0) {
          row.shares = 0;
          row.ceasedMemberOn = when;
        } else {
          row.ceasedMemberOn = null;
        }

        row.lastEventOn = when;
      }
    }

    // Convert to array; include only rows that either currently hold shares OR have history
    const rows = Array.from(map.values())
      .filter((r) => r.becameMemberOn || r.shares > 0 || r.ceasedMemberOn)
      .map((r) => ({
        ...r,
        certificateRefs: Array.from(r.certificateRefs),
        certificateIds: Object.fromEntries(r.certificateIds),
      }))
      .sort((a, b) => (a.memberName || "").localeCompare(b.memberName || ""));

    const currentRows = rows.filter((r) => r.shares > 0);
    const formerRows = rows.filter((r) => r.shares === 0 && r.ceasedMemberOn);

    return { rows, currentRows, formerRows, events };
  }, [updates]);

  const empty = !loadingUpdates && register.events.length === 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F1A] p-4 md:p-10 transition-colors duration-500">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => navigate(-1)}
              className="text-gray-400 hover:text-black dark:hover:text-white transition"
            >
              ← Back
            </button>
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">
              Company Books
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-black tracking-tighter italic uppercase text-slate-900 dark:text-white">
            Register of Members
          </h1>

          <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-2">
            {loadingCompany ? "Loading company…" : (company?.name || "—")}
          </p>
        </header>

        {/* Top actions */}
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-8">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">
            This view is generated from your register update log. Keep it current whenever shares are issued/transferred/cancelled.
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate(`/record-filing/${companyId}/Register of Members`)}
              className="px-6 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition"
            >
              Log Update
            </button>
            <button
              onClick={() => navigate(`/filings/${companyId}`)}
              className="px-6 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-black uppercase text-[10px] tracking-widest shadow-sm active:scale-95 transition"
            >
              Back to Filings
            </button>
          </div>
        </div>

        {/* Empty state */}
        {empty && (
          <div className="p-10 bg-white dark:bg-[#121826] rounded-[2.5rem] border border-slate-100 dark:border-slate-800 text-center">
            <div className="text-2xl mb-2">🧾</div>
            <div className="text-slate-900 dark:text-white font-black uppercase">
              No register entries yet
            </div>
            <div className="text-slate-500 dark:text-slate-400 text-sm mt-2">
              Add your first shareholder entry to start maintaining the statutory register.
            </div>
            <button
              onClick={() => navigate(`/record-filing/${companyId}/Register of Members`)}
              className="mt-6 px-7 py-3 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition"
            >
              Add First Entry
            </button>
          </div>
        )}

        {!empty && (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Current register table */}
            <div className="lg:col-span-2 bg-white dark:bg-[#121826] rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl shadow-black/5 overflow-hidden">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">
                      Current Register
                    </div>
                    <div className="text-xl font-black text-slate-900 dark:text-white mt-2">
                      Members holding shares now
                    </div>
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {register.currentRows.length} active
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                      <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Member</th>
                      <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Address</th>
                      <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Class</th>
                      <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Shares</th>
                      <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Became</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {register.currentRows.map((r) => (
                      <tr key={`${r.memberName}-${r.shareClass}`} className="hover:bg-slate-50 dark:hover:bg-indigo-900/10 transition">
                        <td className="p-6">
                          <div className="font-black text-slate-900 dark:text-white">{r.memberName}</div>
                          {!!r.certificateRefs?.length && (
                            <div className="flex flex-wrap gap-2 mt-1">
                              {r.certificateRefs.map((ref) => {
                                const id = r.certificateIds[ref];
                                if (!id) {
                                  return (
                                    <span key={ref} className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                      Cert: {ref}
                                    </span>
                                  );
                                }
                                return (
                                  <button
                                    key={ref}
                                    onClick={() => navigate(`/companies/${companyId}/certificates/${id}`)}
                                    className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:underline"
                                  >
                                    📜 {ref}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </td>
                        <td className="p-6 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">
                          {r.address || "—"}
                        </td>
                        <td className="p-6 text-center font-black text-slate-700 dark:text-slate-200">
                          {r.shareClass}
                        </td>
                        <td className="p-6 text-center font-black text-slate-900 dark:text-white">
                          {r.shares}
                        </td>
                        <td className="p-6 text-right text-sm font-bold text-slate-600 dark:text-slate-300">
                          {pretty(r.becameMemberOn)}
                        </td>
                      </tr>
                    ))}

                    {register.currentRows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-10 text-center text-slate-400 font-black uppercase text-xs">
                          No active members — add an entry.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Former members */}
              <div className="p-8 border-t border-slate-100 dark:border-slate-800">
                <div className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-4">
                  Former Members (optional display)
                </div>
                {register.formerRows.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    None recorded.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {register.formerRows.map((r) => (
                      <div
                        key={`${r.memberName}-${r.shareClass}-former`}
                        className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="font-black text-slate-900 dark:text-white">
                              {r.memberName} <span className="opacity-50">({r.shareClass})</span>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              Became: {pretty(r.becameMemberOn)} • Ceased: {pretty(r.ceasedMemberOn)}
                            </div>
                          </div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            0 shares
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Audit trail */}
            <div className="bg-white dark:bg-[#121826] rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl shadow-black/5 overflow-hidden">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800">
                <div className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">
                  Audit Trail
                </div>
                <div className="text-xl font-black text-slate-900 dark:text-white mt-2">
                  Register updates
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Keep this as your “minutes book” style evidence of share changes.
                </div>
              </div>

              <div className="max-h-[650px] overflow-auto">
                {loadingUpdates ? (
                  <div className="p-8 text-slate-400 font-black uppercase text-xs animate-pulse">
                    Loading updates…
                  </div>
                ) : (
                  <div className="p-6 space-y-4">
                    {register.events
                      .slice()
                      .reverse()
                      .map((e) => (
                        <div
                          key={e.id}
                          className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                              {e.changeType}
                            </div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              {pretty(e.effectiveDate || e.createdAtISO)}
                            </div>
                          </div>

                          <div className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
                            {e.fromMember && e.toMember
                              ? `${e.fromMember} → ${e.toMember}`
                              : e.toMember
                                ? e.toMember
                                : e.fromMember
                                  ? e.fromMember
                                  : "—"}
                          </div>

                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Class: <span className="font-bold">{e.shareClass}</span> • Change:{" "}
                            <span className="font-black">{e.sharesChange}</span>
                            {e.certificateRef ? ` • Ref: ${e.certificateRef}` : ""}
                            {e.certificateId && (
                              <button
                                onClick={() =>
                                  navigate(`/companies/${companyId}/certificates/${e.certificateId}`)
                                }
                                className="ml-2 text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                              >
                                View Cert 📜
                              </button>
                            )}
                          </div>

                          {e.notes && (
                            <div className="mt-3 text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line">
                              {e.notes}
                            </div>
                          )}
                        </div>
                      ))}

                    {register.events.length === 0 && (
                      <div className="p-8 text-center text-slate-400 font-black uppercase text-xs">
                        No updates found.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => navigate(`/record-filing/${companyId}/Register of Members`)}
                  className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition"
                >
                  Add Another Update
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegisterMembers;