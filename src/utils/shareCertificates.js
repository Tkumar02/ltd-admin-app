import dayjs from "dayjs";
import { db } from "../firebase/firebaseConfig";
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

const pad = (n, len = 5) => String(n).padStart(len, "0");

const safeStr = (v) => (v == null ? "" : String(v)).trim();

export async function generateShareCertificate({
  companyId,
  companyName,
  companyNumber,
  issueDate, // "YYYY-MM-DD"
  memberName,
  memberAddress,
  shareClass,
  shares,
  notes,
  registerUpdateId, // optional link-back
  demoSeed = false,
}) {
  if (!companyId) throw new Error("Missing companyId");
  if (!safeStr(memberName)) throw new Error("Member name is required");
  const nShares = Number(shares);
  if (!Number.isFinite(nShares) || nShares <= 0) throw new Error("Shares must be a positive number");

  const companyRef = doc(db, "companies", companyId);
  const certsRef = collection(db, "companies", companyId, "shareCertificates");

  const res = await runTransaction(db, async (tx) => {
    const companySnap = await tx.get(companyRef);
    if (!companySnap.exists()) throw new Error("Company not found");

    const company = companySnap.data() || {};
    const nextNo = Number(company.nextShareCertNo || 1);

    const year = dayjs(issueDate || dayjs().format("YYYY-MM-DD")).format("YYYY");
    const numberPart = companyNumber ? safeStr(companyNumber) : companyId.slice(0, 6).toUpperCase();
    const certificateNumber = `CERT-${numberPart}-${year}-${pad(nextNo)}`;

    const certDoc = doc(certsRef); // auto id
    tx.set(certDoc, {
      demoSeed: !!demoSeed,
      createdAt: serverTimestamp(),
      companyId,
      companyName: safeStr(companyName || company.name || ""),
      companyNumber: safeStr(companyNumber || company.number || ""),
      certificateNumber,
      issueDate: issueDate || dayjs().format("YYYY-MM-DD"),

      memberName: safeStr(memberName),
      memberAddress: safeStr(memberAddress),
      shareClass: safeStr(shareClass || "Ordinary"),
      shares: nShares,

      notes: safeStr(notes),
      registerUpdateId: safeStr(registerUpdateId),
      status: "ISSUED", // could later support VOIDED / REISSUED etc.
    });

    tx.update(companyRef, {
      nextShareCertNo: nextNo + 1,
      updatedAt: serverTimestamp(),
    });

    return { certificateId: certDoc.id, certificateNumber };
  });

  return res;
}