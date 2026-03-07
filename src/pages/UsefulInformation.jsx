import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";

const LS = {
  incDate: "quick_incDate",
  tradingDate: "quick_tradingDate",
  lastPeriodEnd: "quick_lastAccountsPeriodEnd",
  checkedItems: "quick_checkedItems",
};

const CompanyDashboard = () => {
  const navigate = useNavigate();

  // Inputs (standalone — no Firestore)
  const [incDate, setIncDate] = useState(() => localStorage.getItem(LS.incDate) || "");
  const [tradingDate, setTradingDate] = useState(() => localStorage.getItem(LS.tradingDate) || "");
  const [lastAccountsPeriodEnd, setLastAccountsPeriodEnd] = useState(
    () => localStorage.getItem(LS.lastPeriodEnd) || ""
  );

  const [checkedItems, setCheckedItems] = useState(() => {
    const saved = localStorage.getItem(LS.checkedItems);
    return saved ? JSON.parse(saved) : {};
  });

  // Persist
  useEffect(() => {
    localStorage.setItem(LS.incDate, incDate);
    localStorage.setItem(LS.tradingDate, tradingDate);
    localStorage.setItem(LS.lastPeriodEnd, lastAccountsPeriodEnd);
    localStorage.setItem(LS.checkedItems, JSON.stringify(checkedItems));
  }, [incDate, tradingDate, lastAccountsPeriodEnd, checkedItems]);

  const today = dayjs();

  const tradingStarted = useMemo(() => {
    return !!(tradingDate && dayjs(tradingDate).isBefore(today, "day"));
  }, [tradingDate, today]);

  const hasPeriodEnd = useMemo(() => !!lastAccountsPeriodEnd, [lastAccountsPeriodEnd]);

  const shouldOpenDeadlinesInfo = useMemo(() => {
    if (!incDate) return true;
    if (tradingStarted && !hasPeriodEnd) return true;
    return false;
  }, [incDate, tradingStarted, hasPeriodEnd]);

  const resetQuickView = () => {
    const ok = window.confirm("Reset this quick view? This clears your saved dates and checklist on this device.");
    if (!ok) return;

    localStorage.removeItem(LS.incDate);
    localStorage.removeItem(LS.tradingDate);
    localStorage.removeItem(LS.lastPeriodEnd);
    localStorage.removeItem(LS.checkedItems);

    setIncDate("");
    setTradingDate("");
    setLastAccountsPeriodEnd("");
    setCheckedItems({});
  };

  // Deadlines (anchor model)
  const deadlines = useMemo(() => {
    if (!incDate) return [];

    const inc = dayjs(incDate);
    const trading = tradingDate ? dayjs(tradingDate) : null;

    // Confirmation Statement (anniversary + 14 days)
    const anniversary = inc.year(today.year());
    let confDeadline = anniversary.add(14, "day");

    // If the deadline for THIS year has already passed, show NEXT year's
    if (confDeadline.isBefore(today, "day")) {
      confDeadline = anniversary.add(1, "year").add(14, "day");
    }

    // Accounts anchor
    const periodEndAnchor = hasPeriodEnd 
      ? dayjs(lastAccountsPeriodEnd) 
      : (trading ? trading.add(1, "year") : null);

    // Accounts deadline:
    // - First accounts: 21 months from incorporation
    // - Established: (lastPeriodEnd + 1 year) + 9 months
    let accountsDeadline = null;
    let nextPeriodEnd = null;

    if (!hasPeriodEnd) {
      accountsDeadline = inc.add(21, "month");
      // For estimation purposes in the UI if trading is set
      nextPeriodEnd = periodEndAnchor;
    } else {
      nextPeriodEnd = periodEndAnchor.add(1, "year");
      accountsDeadline = nextPeriodEnd.add(9, "month");
    }

    const items = [
      {
        id: "ch_conf",
        title: "Confirmation Statement (CS01)",
        date: confDeadline,
        desc: "Annual snapshot of company details (directors, PSC, share structure).",
        issuer: "Companies House",
        link: "https://www.gov.uk/file-your-confirmation-statement-with-companies-house",
      },
      {
        id: "ch_acc",
        title: "Annual Accounts",
        date: accountsDeadline,
        desc: !hasPeriodEnd
          ? `First accounts deadline (21 months from incorporation).${nextPeriodEnd ? ` Estimated period end: ${nextPeriodEnd.format("DD MMM YYYY")}` : ""}`
          : `Accounts for period ending ${nextPeriodEnd.format("DD MMM YYYY")}.`,
        issuer: "Companies House",
        link: "https://www.gov.uk/file-your-company-annual-accounts",
      },
    ];

    // HMRC: show only if trading started
    if (tradingStarted) {
      // Register for Corporation Tax (quick-view reminder) - hide if they've already set an ARD
      if (!hasPeriodEnd) {
        items.push({
          id: "hmrc_reg",
          title: "Register for Corporation Tax",
          date: dayjs(tradingDate).add(3, "month"),
          desc: "Typical guidance: tell HMRC within 3 months of starting to trade.",
          issuer: "HMRC",
          link: "https://www.gov.uk/limited-company-formation/add-corporation-tax-services-to-business-tax-account",
        });
      }

      if (nextPeriodEnd) {
        items.push(
          {
            id: "hmrc_pay",
            title: "Corporation Tax Payment",
            date: nextPeriodEnd.add(9, "month").add(1, "day"),
            desc: `Corporation Tax due (9 months + 1 day after ${hasPeriodEnd ? "" : "estimated "}period end ${nextPeriodEnd.format("DD MMM YYYY")}).`,
            issuer: "HMRC",
            link: "https://www.gov.uk/pay-corporation-tax",
          },
          {
            id: "hmrc_ct600",
            title: "Submit CT600 (Company Tax Return)",
            date: nextPeriodEnd.add(12, "month"),
            desc: `Company Tax Return due (12 months after ${hasPeriodEnd ? "" : "estimated "}period end ${nextPeriodEnd.format("DD MMM YYYY")}).`,
            issuer: "HMRC",
            link: "https://www.gov.uk/file-your-company-accounts-and-tax-return",
          }
        );
      } else {
        items.push(
          {
            id: "hmrc_pay",
            title: "Corporation Tax Payment",
            date: null,
            desc: "Add your last Accounts Period End to calculate this deadline.",
            issuer: "HMRC",
            link: "https://www.gov.uk/pay-corporation-tax",
          },
          {
            id: "hmrc_ct600",
            title: "Submit CT600 (Company Tax Return)",
            date: null,
            desc: "Add your last Accounts Period End to calculate this deadline.",
            issuer: "HMRC",
            link: "https://www.gov.uk/file-your-company-accounts-and-tax-return",
          }
        );
      }
    }

    return items.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.valueOf() - b.date.valueOf();
    });
  }, [incDate, tradingDate, lastAccountsPeriodEnd, hasPeriodEnd, tradingStarted, today]);

  const getStatus = (dueDate) => {
    if (!dueDate) return { color: "#1890ff", label: "NEEDS SETUP", icon: "🧩" };
    const daysDiff = dueDate.diff(dayjs(), "day");
    if (daysDiff <= 30) return { color: "#ff4d4f", label: daysDiff < 0 ? "OVERDUE" : "DUE SOON", icon: "⚠️" };
    if (daysDiff <= 90) return { color: "#faad14", label: "APPROACHING", icon: "⏳" };
    return { color: "#1890ff", label: "", icon: "" };
  };

  const handleCheck = (id) => setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));

  const showSetupNeededTag = tradingStarted && !hasPeriodEnd;

  const assumedPeriodEnd = useMemo(() => {
    if (tradingDate && !hasPeriodEnd) {
      return dayjs(tradingDate).add(1, "year").format("DD MMM YYYY");
    }
    return null;
  }, [tradingDate, hasPeriodEnd]);

  // --- Companies House API Lookup ---
  const [chNumber, setChNumber] = useState("");
  const [fetchingCH, setFetchingCH] = useState(false);

  const fetchCHData = async () => {
    if (!chNumber || chNumber.length < 8) {
      alert("Please enter a valid 8-digit Company Number.");
      return;
    }

    setFetchingCH(true);
    try {
      const apiKey = "a5c51b89-ed23-4bcd-aa7c-d4644d54dc0e";
      const encodedKey = btoa(apiKey + ":");

      const response = await fetch(`/api-ch/company/${chNumber}`, {
        headers: {
          "Authorization": `Basic ${encodedKey}`
        }
      });
      if (!response.ok) throw new Error("Company not found or API error.");

      const data = await response.json();
      
      if (data.date_of_creation) setIncDate(data.date_of_creation);
      
      if (data.accounts?.last_accounts?.made_up_to) {
        setLastAccountsPeriodEnd(data.accounts.last_accounts.made_up_to);
      } else if (data.accounts?.next_accounts?.period_end_on) {
        const nextEnd = dayjs(data.accounts.next_accounts.period_end_on);
        setLastAccountsPeriodEnd(nextEnd.subtract(1, "year").format("YYYY-MM-DD"));
      }

      alert(`Fetched data for ${data.company_name}. Dates updated!`);
    } catch (err) {
      console.error(err);
      alert("Failed to fetch data from Companies House. Check the number or API key.");
    } finally {
      setFetchingCH(false);
    }
  };

  return (
    <div className="container">
      <style>{`
        :root {
          --bg: #ffffff; --text: #0b0c0c; --card-bg: #ffffff;
          --input-bg: #ffffff; --section-bg: #f3f2f1; --border: #bfc1c3;
          --muted-text: #505a5f; --accent-blue: #1d70b8;
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --bg: #121212; --text: #f5f5f5; --card-bg: #1e1e1e;
            --input-bg: #2d2d2d; --section-bg: #252525; --border: #444;
            --muted-text: #a0a0a0; --accent-blue: #4da3ff;
          }
        }

        .container { 
          max-width: 1000px; margin: 0 auto; padding: 20px; 
          background: var(--bg); color: var(--text);
          font-family: -apple-system, sans-serif; min-height: 100vh;
        }

        .topBar {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          border-bottom: 2px solid var(--border);
          margin-bottom: 20px;
          padding-bottom: 10px;
        }
        .topBarRight {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid var(--border);
          color: var(--muted-text);
          font-size: 0.75rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          white-space: nowrap;
        }
        .pillWarn { border-color: #faad14; color: #faad14; }

        .ghostBtn {
          border: 1px solid var(--border);
          background: transparent;
          color: var(--muted-text);
          padding: 8px 10px;
          border-radius: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-size: 0.7rem;
          cursor: pointer;
        }
        .ghostBtn:hover { opacity: 0.85; }

        .input-grid { 
          display: grid; grid-template-columns: 1fr; gap: 15px; 
          background: var(--section-bg); padding: 20px; border-radius: 12px; margin-bottom: 30px; 
        }
        @media (min-width: 768px) { .input-grid { grid-template-columns: 1fr 1fr; } }
        
        .main-layout { display: grid; grid-template-columns: 1fr; gap: 30px; }
        @media (min-width: 900px) { .main-layout { grid-template-columns: 1.5fr 1fr; } }

        .card { 
          background: var(--card-bg); border: 1px solid var(--border); 
          border-left: 10px solid; padding: 16px; border-radius: 10px; 
          margin-bottom: 16px;
        }

        input[type="date"] { 
          width: 100%; padding: 12px; border: 2px solid var(--border); 
          background: var(--input-bg); color: var(--text); border-radius: 8px; font-size: 16px;
        }

        .link { color: var(--accent-blue); text-decoration: none; font-weight: 900; font-size: 0.9rem; }
        .link:hover { text-decoration: underline; }
        .hint { font-size: 0.8rem; color: var(--muted-text); margin-top: 6px; }

        /* Guide panel styles */
        .infoCard {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px;
        }
        .badgeRow {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 10px;
          margin-bottom: 6px;
        }
        .badge {
          font-size: 0.7rem;
          font-weight: 900;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid var(--border);
          color: var(--muted-text);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .infoCard details {
          border-top: 1px solid var(--border);
          padding-top: 10px;
          margin-top: 10px;
        }
        .infoCard details:first-of-type {
          border-top: none;
          padding-top: 0;
          margin-top: 0;
        }
        .infoCard summary {
          cursor: pointer;
          font-weight: 950;
          font-size: 0.95rem;
          list-style: none;
        }
        .infoCard summary::-webkit-details-marker { display: none; }
        .infoCard summary:before {
          content: "▸";
          display: inline-block;
          margin-right: 10px;
          transform: translateY(-1px);
          opacity: 0.7;
        }
        .infoCard details[open] summary:before { content: "▾"; }

        .infoP {
          margin: 10px 0 0 0;
          color: var(--muted-text);
          font-size: 0.9rem;
          line-height: 1.45;
        }
        .infoList {
          margin: 10px 0 0 18px;
          color: var(--muted-text);
          font-size: 0.9rem;
          line-height: 1.5;
        }
        .moreLinks {
          margin-top: 10px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .primaryBtn {
          width: 100%;
          margin-top: 14px;
          background: var(--accent-blue);
          color: #fff;
          border: none;
          padding: 12px 14px;
          border-radius: 10px;
          font-weight: 950;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          font-size: 0.75rem;
          cursor: pointer;
        }
        .primaryBtn:hover { opacity: 0.92; }

        .miniCallout {
          margin-top: 12px;
          padding: 12px;
          border-radius: 10px;
          border: 1px dashed var(--border);
          background: var(--section-bg);
          color: var(--muted-text);
          font-size: 0.85rem;
          line-height: 1.4;
        }

        /* CH Lookup Styles */
        .chLookup {
          background: #000;
          color: #fff;
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 30px;
          display: flex;
          flex-direction: column;
          gap: 15px;
        }
        @media (min-width: 600px) {
          .chLookup {
            flex-direction: row;
            align-items: flex-end;
          }
        }
        .chLookup input {
          flex: 1;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #333;
          background: #111;
          color: #fff;
          font-weight: bold;
          text-transform: uppercase;
        }
        .chLookup button {
          background: #fff;
          color: #000;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: 900;
          text-transform: uppercase;
          cursor: pointer;
          transition: transform 0.1s;
        }
        .chLookup button:active { transform: scale(0.98); }
        .chLookup button:disabled { opacity: 0.5; }
      `}</style>

      <header className="topBar">
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>Compliance Tracker</h1>

        <div className="topBarRight">
          {showSetupNeededTag && <span className="pill pillWarn">🧩 Setup needed</span>}
          <button className="ghostBtn" onClick={resetQuickView}>
            Reset quick view
          </button>
        </div>
      </header>

      {/* NEW: CH API Lookup */}
      <section className="chLookup">
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: "0.7rem", fontWeight: 900, textTransform: "uppercase", marginBottom: "8px", display: "block", color: "#aaa" }}>
            Companies House Sync
          </label>
          <input 
            placeholder="Company number" 
            value={chNumber}
            onChange={(e) => setChNumber(e.target.value)}
          />
        </div>
        <button onClick={fetchCHData} disabled={fetchingCH}>
          {fetchingCH ? "Syncing..." : "Fetch Details"}
        </button>
      </section>

      <div className="input-grid">
        <div>
          <label style={{ fontWeight: 700, fontSize: "0.9rem", display: "block", marginBottom: "5px" }}>
            Incorporation Date
          </label>
          <input type="date" value={incDate} onChange={(e) => setIncDate(e.target.value)} />
          <div className="hint">Used for Confirmation Statement + first accounts rule.</div>
        </div>

        <div>
          <label style={{ fontWeight: 700, fontSize: "0.9rem", display: "block", marginBottom: "5px" }}>
            Trading Start Date (optional)
          </label>
          <input type="date" value={tradingDate} onChange={(e) => setTradingDate(e.target.value)} />
          <div className="hint">If set and in the past, HMRC deadlines appear.</div>
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ fontWeight: 700, fontSize: "0.9rem", display: "block", marginBottom: "5px" }}>
            Last Accounts Period End / “Made up to” (optional)
          </label>
          <input type="date" value={lastAccountsPeriodEnd} onChange={(e) => setLastAccountsPeriodEnd(e.target.value)} />
          <div className="hint">
            If you’ve filed accounts before, add the period end date so CT600 and Corporation Tax dates can be calculated.
          </div>
        </div>
      </div>

      <div className="main-layout">
        {/* LEFT: deadlines */}
        <section>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <h2 style={{ fontSize: "1.2rem" }}>Upcoming Deadlines</h2>
            {tradingStarted && !hasPeriodEnd && <span className="pill">Using estimated period end</span>}
          </div>

          {assumedPeriodEnd && (
            <div style={{ 
                marginBottom: "20px", 
                padding: "12px 16px", 
                backgroundColor: "rgba(29, 112, 184, 0.1)", 
                border: "1px solid var(--accent-blue)", 
                borderRadius: "10px",
                fontSize: "0.85rem",
                fontWeight: "600",
                color: "var(--accent-blue)"
            }}>
                💡 Assuming accounts period end is: 12 months + {assumedPeriodEnd} (based on trading start)
            </div>
          )}

          {!incDate ? (
            <p style={{ color: "var(--muted-text)", textAlign: "center", padding: "20px" }}>
              Enter an incorporation date to see deadlines.
            </p>
          ) : (
            deadlines.map((item) => {
              const status = getStatus(item.date);
              return (
                <div key={item.id} className="card" style={{ borderLeftColor: status.color }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", gap: 12 }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 900, color: "var(--muted-text)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      {item.issuer}
                    </span>
                    {status.label && (
                      <span style={{ color: status.color, fontWeight: 900, fontSize: "0.8rem" }}>
                        {status.icon} {status.label}
                      </span>
                    )}
                  </div>

                  <h3 style={{ margin: "0 0 4px 0", fontSize: "1.1rem", fontWeight: 950 }}>{item.title}</h3>

                  <p style={{ margin: "0 0 8px 0", fontSize: "1.2rem", fontWeight: 950, color: status.color }}>
                    {item.date ? item.date.format("DD MMM YYYY") : "—"}
                  </p>

                  <p style={{ fontSize: "0.85rem", color: "var(--muted-text)", marginBottom: "12px" }}>
                    {item.desc}
                  </p>

                  <a href={item.link} target="_blank" rel="noreferrer" className="link">
                    Open official guidance →
                  </a>
                </div>
              );
            })
          )}
        </section>

        {/* RIGHT: required codes + guide */}
        <section>
          <h2 style={{ fontSize: "1.2rem" }}>Required Codes</h2>
          <div style={{ background: "var(--section-bg)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border)" }}>
            <CheckItem id="crn" label="CRN (8 Digits)" issuer="Companies House" checked={!!checkedItems.crn} onCheck={handleCheck} />
            <CheckItem id="auth" label="Auth Code (6 Chars)" issuer="Companies House" checked={!!checkedItems.auth} onCheck={handleCheck} />
            <CheckItem id="utr" label="Company UTR (10 Digits)" issuer="HMRC" checked={!!checkedItems.utr} onCheck={handleCheck} />
            <CheckItem id="act" label="Activation Code (12 Digits)" issuer="HMRC" checked={!!checkedItems.act} onCheck={handleCheck} />
          </div>

          <div className="miniCallout">
            Tip: If HMRC deadlines show “Needs setup”, add the <b>last accounts period end</b> (your “made up to” date).
          </div>

          {/* New Owner Guide */}
          <div style={{ marginTop: 20 }}>
            <h2 style={{ fontSize: "1.2rem" }}>New Owner Guide</h2>

            <div className="infoCard">
              <div style={{ fontWeight: 950, fontSize: "1rem" }}>What you file, what it means, and where to learn more</div>
              <div className="hint">High-level guidance — use links for official details.</div>

              <div className="badgeRow">
                <span className="badge">Companies House</span>
                <span className="badge">HMRC</span>
                <span className="badge">Accounts</span>
                <span className="badge">Tax</span>
              </div>

              <details>
                <summary>How a Ltd company works (quickly)</summary>
                <p className="infoP">
                  A limited company is its own legal entity. It earns income, pays costs, and pays tax. As a director/shareholder,
                  you can take money out (salary/dividends/expenses), but the company’s finances are separate from your personal finances.
                </p>
                <div className="moreLinks">
                  <a className="link" href="https://www.gov.uk/limited-company-formation" target="_blank" rel="noreferrer">
                    Gov.uk: Limited companies →
                  </a>
                </div>
              </details>

              <details>
                <summary>Confirmation Statement (CS01): what it entails</summary>
                <ul className="infoList">
                  <li>Confirms your company’s key details on the public register.</li>
                  <li>Common items: registered office, directors, PSC, share structure.</li>
                  <li>It’s a “snapshot” — you still update changes as they happen, then confirm annually.</li>
                </ul>
                <div className="moreLinks">
                  <a className="link" href="https://www.gov.uk/file-your-confirmation-statement-with-companies-house" target="_blank" rel="noreferrer">
                    File a confirmation statement →
                  </a>
                </div>
              </details>

              <details>
                <summary>Annual Accounts: what they are</summary>
                <ul className="infoList">
                  <li>Financial statements for an accounting period (your company’s performance + position).</li>
                  <li>Filed to Companies House; some info becomes publicly visible.</li>
                  <li>Many small companies file “micro-entity” or “small company” accounts (depends on eligibility).</li>
                </ul>
                <div className="moreLinks">
                  <a className="link" href="https://www.gov.uk/file-your-company-annual-accounts" target="_blank" rel="noreferrer">
                    File annual accounts →
                  </a>
                  <a className="link" href="https://www.gov.uk/annual-accounts" target="_blank" rel="noreferrer">
                    Accounts overview →
                  </a>
                </div>
              </details>

              <details open={shouldOpenDeadlinesInfo}>
                <summary>Corporation Tax: payment vs CT600 (what’s the difference?)</summary>
                <ul className="infoList">
                  <li><b>Corporation Tax payment</b> is when you actually pay HMRC the tax due.</li>
                  <li><b>CT600</b> is the company’s tax return showing profit, adjustments, and tax calculation.</li>
                  <li>They have different deadlines (payment is typically earlier than CT600).</li>
                </ul>
                <div className="moreLinks">
                  <a className="link" href="https://www.gov.uk/pay-corporation-tax" target="_blank" rel="noreferrer">
                    Pay Corporation Tax →
                  </a>
                  <a className="link" href="https://www.gov.uk/file-your-company-accounts-and-tax-return" target="_blank" rel="noreferrer">
                    File CT600 + accounts to HMRC →
                  </a>
                </div>
              </details>

              <details>
                <summary>Register for Corporation Tax: when & why</summary>
                <ul className="infoList">
                  <li>HMRC expects you to tell them when your company starts trading.</li>
                  <li>This enables Corporation Tax services and sets up your tax record.</li>
                </ul>
                <div className="moreLinks">
                  <a className="link" href="https://www.gov.uk/limited-company-formation/add-corporation-tax-services-to-business-tax-account" target="_blank" rel="noreferrer">
                    Add Corporation Tax to your business tax account →
                  </a>
                </div>
              </details>

              <details>
                <summary>VAT: separate system (only if registered)</summary>
                <p className="infoP">
                  VAT is separate from Corporation Tax. If you’re VAT registered, you file VAT returns (often quarterly) and pay/claim VAT.
                  Whether you must register depends on turnover rules and business type.
                </p>
                <div className="moreLinks">
                  <a className="link" href="https://www.gov.uk/vat-registration" target="_blank" rel="noreferrer">
                    VAT registration →
                  </a>
                  <a className="link" href="https://www.gov.uk/vat-returns" target="_blank" rel="noreferrer">
                    VAT returns →
                  </a>
                </div>
              </details>

              <details>
                <summary>Penalties: what to expect (high level)</summary>
                <ul className="infoList">
                  <li>Companies House accounts penalties usually apply automatically and increase the longer you’re late.</li>
                  <li>HMRC can charge interest/penalties for late tax payment and late returns.</li>
                  <li>Treat “Due soon” and “Overdue” as urgent: fix inputs → file → keep proof.</li>
                </ul>
              </details>

              <button className="primaryBtn" onClick={() => navigate("/company-settings")}>
                Go to Company Settings
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

const CheckItem = ({ id, label, issuer, checked, onCheck }) => (
  <div style={{ marginBottom: "15px", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
    <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={() => onCheck(id)} style={{ width: "20px", height: "20px" }} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontWeight: 900, fontSize: "0.95rem", textDecoration: checked ? "line-through" : "none", opacity: checked ? 0.6 : 1 }}>
          {label}
        </span>
        <span style={{ fontSize: "0.75rem", color: "var(--muted-text)" }}>{issuer}</span>
      </div>
    </label>
  </div>
);

export default CompanyDashboard;