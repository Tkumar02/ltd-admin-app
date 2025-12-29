import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';

const CompanyDashboard = () => {
    const [incDate, setIncDate] = useState("");
    const [tradingDate, setTradingDate] = useState("");
    const [deadlines, setDeadlines] = useState([]);

    useEffect(() => {
        if (!incDate) return;

        const inc = dayjs(incDate);

        // 1. Companies House Deadlines (Always exist)
        const chDeadlines = [
            {
                title: "Confirmation Statement",
                date: inc.add(1, 'year').add(14, 'days'),
                desc: "Annual check-up of company officers and shares.",
                issuer: "Companies House"
            },
            {
                title: "Annual Accounts",
                date: inc.add(21, 'months'),
                desc: "Statutory accounts for the public register.",
                issuer: "Companies House"
            }
        ];

        // 2. HMRC Deadlines (Only if Trading Start Date is set)
        let hmrcDeadlines = [];
        if (tradingDate) {
            const start = dayjs(tradingDate);
            const yearEnd = start.add(1, 'year').subtract(1, 'day');

            hmrcDeadlines = [
                {
                    title: "Register for Corp Tax",
                    date: start.add(3, 'months'),
                    desc: "Deadline to notify HMRC that the company is active.",
                    issuer: "HMRC"
                },
                {
                    title: "Corporation Tax Payment",
                    date: yearEnd.add(9, 'months').add(1, 'day'),
                    desc: "Payment deadline for the first accounting period.",
                    issuer: "HMRC"
                }
            ];
        }

        setDeadlines([...chDeadlines, ...hmrcDeadlines]);
    }, [incDate, tradingDate]);

    const getStatus = (dueDate) => {
        const daysDiff = dueDate.diff(dayjs(), 'day');

        // RED: Overdue or within 30 days
        if (daysDiff <= 30) {
            return {
                color: '#d4351c',
                label: daysDiff < 0 ? 'OVERDUE' : 'DUE SOON',
                bg: '#fff5f5',
                icon: '⚠️'
            };
        }

        // AMBER: Within 90 days (Captures 27th Feb)
        if (daysDiff <= 90) {
            return {
                color: '#f47738',
                label: 'APPROACHING',
                bg: '#fff9f2',
                icon: '⏳'
            };
        }

        // BLUE: No text label as requested
        return {
            color: '#1d70b8',
            label: '',
            bg: '#f0f7ff',
            icon: '✅'
        };
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '2rem auto', fontFamily: 'Arial, sans-serif', padding: '0 20px' }}>
            <header style={{ borderBottom: '3px solid #0b0c0c', marginBottom: '30px', paddingBottom: '10px' }}>
                <h1 style={{ margin: 0, fontSize: '2rem' }}>Company Compliance Dashboard</h1>
            </header>

            {/* Date Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', background: '#f3f2f1', padding: '25px', borderRadius: '4px', marginBottom: '40px' }}>
                <div>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Incorporation Date</label>
                    <input type="date" value={incDate} onChange={(e) => setIncDate(e.target.value)} style={inputStyle} />
                </div>
                <div>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Trading Start Date</label>
                    <input type="date" value={tradingDate} onChange={(e) => setTradingDate(e.target.value)} style={inputStyle} />
                    <p style={{ fontSize: '0.8rem', color: '#505a5f', marginTop: '8px' }}>Leave blank if your company is currently dormant.</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '40px' }}>

                {/* Deadlines Section */}
                <section>
                    <h2 style={{ marginTop: 0, borderBottom: '1px solid #bfc1c3', paddingBottom: '10px' }}>Upcoming Deadlines</h2>
                    {!incDate ? (
                        <div style={{ padding: '40px', border: '2px dashed #bfc1c3', textAlign: 'center', color: '#505a5f', background: '#fdfdfd' }}>
                            Select an incorporation date to see your filing schedule.
                        </div>
                    ) : (
                        deadlines.sort((a, b) => a.date - b.date).map((item, idx) => {
                            const status = getStatus(item.date);
                            return (
                                <div key={idx} style={{ background: status.bg, border: `1px solid ${status.color}`, borderLeft: `12px solid ${status.color}`, padding: '20px', borderRadius: '4px', marginBottom: '15px', position: 'relative' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#505a5f', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.issuer}</span>
                                        {status.label && (
                                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: status.color, background: '#fff', padding: '2px 8px', borderRadius: '4px', border: `1px solid ${status.color}` }}>
                                                {status.icon} {status.label}
                                            </span>
                                        )}
                                    </div>
                                    <h3 style={{ margin: '10px 0 5px 0', fontSize: '1.2rem', color: '#0b0c0c' }}>{item.title}</h3>
                                    <p style={{ margin: '0 0 10px 0', fontSize: '1.3rem', fontWeight: 'bold', color: status.color }}>
                                        {item.date.format('DD MMMM YYYY')}
                                    </p>
                                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#505a5f', lineHeight: '1.5' }}>{item.desc}</p>
                                </div>
                            );
                        })
                    )}
                </section>

                {/* Requirements Checklist */}
                <section>
                    <h2 style={{ marginTop: 0, borderBottom: '1px solid #bfc1c3', paddingBottom: '10px' }}>Credentials</h2>
                    <div style={{ background: '#fff', border: '1px solid #bfc1c3', padding: '25px', borderRadius: '4px' }}>
                        <p style={{ marginTop: 0, fontSize: '0.85rem', color: '#505a5f', marginBottom: '20px' }}>Track the codes and IDs you receive by post:</p>
                        <CheckItem label="CRN (8 Digits)" issuer="Companies House" when="Issued on incorporation" />
                        <CheckItem label="Auth Code (6 Chars)" issuer="Companies House" when="~5 Days (Post)" />
                        <CheckItem label="Company UTR (10 Digits)" issuer="HMRC" when="~14 Days (Post)" />
                        <CheckItem label="HMRC Activation (12 Digits)" issuer="HMRC" when="Request online after UTR" />
                    </div>
                </section>
            </div>
        </div>
    );
};

const CheckItem = ({ label, issuer, when }) => (
    <div style={{ marginBottom: '18px', borderBottom: '1px solid #f3f2f1', paddingBottom: '12px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 'bold', fontSize: '0.95rem', cursor: 'pointer' }}>
            <input type="checkbox" style={{ width: '18px', height: '18px' }} /> {label}
        </label>
        <div style={{ marginLeft: '30px', fontSize: '0.75rem', color: '#505a5f', marginTop: '4px' }}>{issuer} • {when}</div>
    </div>
);

const inputStyle = { width: '100%', padding: '12px', border: '2px solid #0b0c0c', borderRadius: '0', boxSizing: 'border-box', fontSize: '1rem', background: '#fff' };

export default CompanyDashboard;