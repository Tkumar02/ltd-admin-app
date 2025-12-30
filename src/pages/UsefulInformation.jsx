import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';

const CompanyDashboard = () => {
    // Load initial state from localStorage if it exists
    const [incDate, setIncDate] = useState(() => localStorage.getItem('incDate') || "");
    const [tradingDate, setTradingDate] = useState(() => localStorage.getItem('tradingDate') || "");
    const [checkedItems, setCheckedItems] = useState(() => {
        const saved = localStorage.getItem('checkedItems');
        return saved ? JSON.parse(saved) : {};
    });

    const [deadlines, setDeadlines] = useState([]);

    // Save to localStorage whenever values change
    useEffect(() => {
        localStorage.setItem('incDate', incDate);
        localStorage.setItem('tradingDate', tradingDate);
        localStorage.setItem('checkedItems', JSON.stringify(checkedItems));
    }, [incDate, tradingDate, checkedItems]);

    useEffect(() => {
        if (!incDate) return;
        const inc = dayjs(incDate);

        const chDeadlines = [
            {
                id: 'ch_conf',
                title: "Confirmation Statement (CS01)",
                date: inc.add(1, 'year').add(14, 'days'),
                desc: "Annual check-up of company officers and shares.",
                issuer: "Companies House",
                link: "https://www.gov.uk/file-your-confirmation-statement-with-companies-house"
            },
            {
                id: 'ch_acc',
                title: "Annual Accounts",
                date: inc.add(21, 'months'),
                desc: "Statutory accounts for the public register.",
                issuer: "Companies House",
                link: "https://www.gov.uk/file-your-company-annual-accounts"
            }
        ];

        let hmrcDeadlines = [];
        if (tradingDate) {
            const start = dayjs(tradingDate);
            const yearEnd = start.add(1, 'year').subtract(1, 'day');
            hmrcDeadlines = [
                {
                    id: 'hmrc_reg',
                    title: "Register for Corp Tax",
                    date: start.add(3, 'months'),
                    desc: "Notify HMRC that the company is active.",
                    issuer: "HMRC",
                    link: "https://www.gov.uk/limited-company-formation/add-corporation-tax-services-to-business-tax-account"
                },
                {
                    id: 'hmrc_pay',
                    title: "Corporation Tax Payment",
                    date: yearEnd.add(9, 'months').add(1, 'day'),
                    desc: "Payment deadline for the first period.",
                    issuer: "HMRC",
                    link: "https://www.gov.uk/pay-corporation-tax"
                },
                {
                    id: 'hmrc_file',
                    title: "Corporation Tax Filling",
                    date: yearEnd.add(12, 'months'),
                    desc: "Filing deadline for the first period.",
                    issuer: "HMRC",
                    link: "https://www.gov.uk/file-your-company-accounts-and-tax-return"
                },
            ];
        }
        setDeadlines([...chDeadlines, ...hmrcDeadlines]);
    }, [incDate, tradingDate]);

    const getStatus = (dueDate) => {
        const daysDiff = dueDate.diff(dayjs(), 'day');
        // RED: Overdue or within 30 days
        if (daysDiff <= 30) return { color: '#ff4d4f', label: daysDiff < 0 ? 'OVERDUE' : 'DUE SOON', icon: '⚠️' };
        // AMBER: Within 90 days
        if (daysDiff <= 90) return { color: '#faad14', label: 'APPROACHING', icon: '⏳' };
        // BLUE: Safe (No icon, no label)
        return { color: '#1890ff', label: '', icon: '' };
    };

    const handleCheck = (id) => {
        setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
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
        .input-grid { 
          display: grid; grid-template-columns: 1fr; gap: 15px; 
          background: var(--section-bg); padding: 20px; border-radius: 12px; margin-bottom: 30px; 
        }
        @media (min-width: 768px) { .input-grid { grid-template-columns: 1fr 1fr; } }
        
        .main-layout { display: grid; grid-template-columns: 1fr; gap: 30px; }
        @media (min-width: 900px) { .main-layout { grid-template-columns: 1.5fr 1fr; } }

        .card { 
          background: var(--card-bg); border: 1px solid var(--border); 
          border-left: 10px solid; padding: 16px; border-radius: 8px; 
          margin-bottom: 16px; transition: transform 0.2s;
        }
        input[type="date"] { 
          width: 100%; padding: 12px; border: 2px solid var(--border); 
          background: var(--input-bg); color: var(--text); border-radius: 8px; font-size: 16px;
        }
        .link { color: var(--accent-blue); text-decoration: none; font-weight: bold; font-size: 0.9rem; }
      `}</style>

            <header style={{ borderBottom: '2px solid var(--border)', marginBottom: '20px', paddingBottom: '10px' }}>
                <h1 style={{ fontSize: '1.4rem', margin: 0 }}>Compliance Tracker</h1>
            </header>

            <div className="input-grid">
                <div>
                    <label style={{ fontWeight: '600', fontSize: '0.9rem', display: 'block', marginBottom: '5px' }}>Incorporation Date</label>
                    <input type="date" value={incDate} onChange={(e) => setIncDate(e.target.value)} />
                </div>
                <div>
                    <label style={{ fontWeight: '600', fontSize: '0.9rem', display: 'block', marginBottom: '5px' }}>Trading Start Date</label>
                    <input type="date" value={tradingDate} onChange={(e) => setTradingDate(e.target.value)} />
                </div>
            </div>

            <div className="main-layout">
                <section>
                    <h2 style={{ fontSize: '1.2rem' }}>Deadlines</h2>
                    {!incDate ? (
                        <p style={{ color: 'var(--muted-text)', textAlign: 'center', padding: '20px' }}>Enter dates above to see your schedule.</p>
                    ) : (
                        deadlines.sort((a, b) => a.date - b.date).map((item) => {
                            const status = getStatus(item.date);
                            return (
                                <div key={item.id} className="card" style={{ borderLeftColor: status.color }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--muted-text)' }}>{item.issuer}</span>
                                        {status.label && <span style={{ color: status.color, fontWeight: 'bold', fontSize: '0.8rem' }}>{status.icon} {status.label}</span>}
                                    </div>
                                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem' }}>{item.title}</h3>
                                    <p style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 'bold', color: status.color }}>{item.date.format('DD MMM YYYY')}</p>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--muted-text)', marginBottom: '12px' }}>{item.desc}</p>
                                    <a href={item.link} target="_blank" rel="noreferrer" className="link">Open Portal →</a>
                                </div>
                            );
                        })
                    )}
                </section>

                <section>
                    <h2 style={{ fontSize: '1.2rem' }}>Required Codes</h2>
                    <div style={{ background: 'var(--section-bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <CheckItem id="crn" label="CRN (8 Digits)" issuer="Companies House" checked={!!checkedItems['crn']} onCheck={handleCheck} />
                        <CheckItem id="auth" label="Auth Code (6 Chars)" issuer="Companies House" checked={!!checkedItems['auth']} onCheck={handleCheck} />
                        <CheckItem id="utr" label="Company UTR (10 Digits)" issuer="HMRC" checked={!!checkedItems['utr']} onCheck={handleCheck} />
                        <CheckItem id="act" label="Activation Code (12 Digits)" issuer="HMRC" checked={!!checkedItems['act']} onCheck={handleCheck} />
                    </div>
                </section>
            </div>
        </div>
    );
};

const CheckItem = ({ id, label, issuer, checked, onCheck }) => (
    <div style={{ marginBottom: '15px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
            <input type="checkbox" checked={checked} onChange={() => onCheck(id)} style={{ width: '20px', height: '20px' }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 'bold', fontSize: '0.95rem', textDecoration: checked ? 'line-through' : 'none', opacity: checked ? 0.6 : 1 }}>{label}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted-text)' }}>{issuer}</span>
            </div>
        </label>
    </div>
);

export default CompanyDashboard;