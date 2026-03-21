'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [currentFace, setCurrentFace] = useState('front');
  const [wlSubmitting, setWlSubmitting] = useState(false);
  const [wlSuccess, setWlSuccess] = useState(false);
  const [wlError, setWlError] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('up');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

    const nav = document.querySelector('nav');
    const handleScroll = () => {
      if (nav) {
        nav.style.background =
          window.scrollY > 20
            ? 'rgba(255,255,255,.95)'
            : 'rgba(255,255,255,.86)';
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      io.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  async function handleWL() {
    const fname = document.getElementById('f-fname').value.trim();
    const lname = document.getElementById('f-lname').value.trim();
    const email = document.getElementById('f-email').value.trim();
    const clinic = document.getElementById('f-clinic').value.trim();
    const phone = document.getElementById('f-phone').value.trim();
    const patientCount = document.getElementById('f-size').value;
    const locations = document.getElementById('f-locations').value;
    const challenge = document.getElementById('f-msg').value.trim();
    const emailOk = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const newErrors = {};
    if (!fname) newErrors.fname = true;
    if (!lname) newErrors.lname = true;
    if (!emailOk) newErrors.email = true;
    if (!clinic) newErrors.clinic = true;
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setWlSubmitting(true);
    setWlError('');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: fname,
          lastName: lname,
          email,
          phone,
          clinicName: clinic,
          patientCount,
          locations,
          challenge,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setWlSuccess(true);
      } else {
        setWlError('Something went wrong — please try again.');
        setWlSubmitting(false);
      }
    } catch {
      setWlError('Something went wrong — please try again.');
      setWlSubmitting(false);
    }
  }

  return (
    <>
      {/* NAV */}
      <nav>
        <div className="nav-in">
          <div className="logo">Denta<span>Pass</span></div>
          <button className="nav-cta" onClick={() => scrollTo('waitlist')}>
            Join waitlist
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-in">
          <div>
            <div className="hero-tag reveal">
              <span className="live-dot"></span>Coming soon to Edmonton, AB
            </div>
            <h1 className="reveal d1">
              Your patients leave.<br />Their loyalty <em>shouldn&apos;t.</em>
            </h1>
            <p className="hero-sub reveal d2">
              DentaPass puts a branded loyalty card inside every patient&apos;s Apple
              or Google Wallet. Recall reminders, Google review requests, referral
              programs — all automated. <strong>No app needed.</strong>
            </p>
            <div className="hero-btns reveal d3">
              <button className="btn-primary" onClick={() => scrollTo('waitlist')}>
                Join the waitlist →
              </button>
              <button className="btn-outline" onClick={() => scrollTo('how')}>
                See how it works
              </button>
            </div>
            <div className="hero-proof reveal d4">
              <div className="proof-avatars">
                <div className="av">AB</div>
                <div className="av">CD</div>
                <div className="av">EF</div>
              </div>
              <div className="proof-text">
                Built for independent dental clinics in <strong>Edmonton, AB</strong>
              </div>
            </div>
          </div>
          <div className="phone-wrap reveal d3">
            {/* Side phone: back of card */}
            <div className="phone side">
              <div className="phone-notch"></div>
              <div className="phone-screen">
                <div className="wallet-back">
                  <div className="wb-row">
                    <span className="wb-l">Points balance</span>
                    <span className="wb-v">850 pts</span>
                  </div>
                  <div className="wb-row">
                    <span className="wb-l">Next checkup</span>
                    <span className="wb-v" style={{ color: 'var(--teal)' }}>Sep 6, 2026</span>
                  </div>
                  <div className="wb-row">
                    <span className="wb-l">Book appointment</span>
                    <button className="wb-book-btn">Book now</button>
                  </div>
                  <div className="wb-row">
                    <span className="wb-l">Call us</span>
                    <a className="wb-link">(587) 855-9300</a>
                  </div>
                  {/* Socials */}
                  <div className="wb-social">
                    <span className="wb-l">Follow us</span>
                    <div className="wb-social-icons">
                      <div className="wb-si wb-si-fb">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="white"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>
                      </div>
                      <div className="wb-si wb-si-g">
                        <svg width="9" height="9" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      </div>
                    </div>
                  </div>
                  {/* Reviews */}
                  <div className="wb-review">
                    <div className="wb-review-txt">Love Dr. Maged? Leave a Google review!</div>
                    <div className="wb-review-bottom">
                      <div className="wb-stars">
                        <div className="star"></div>
                        <div className="star"></div>
                        <div className="star"></div>
                        <div className="star"></div>
                        <div className="star"></div>
                      </div>
                      <button className="wb-review-btn">Review ↗</button>
                    </div>
                  </div>
                  {/* Referral */}
                  <div className="wb-ref">
                    <div className="wb-ref-top">
                      <span className="wb-ref-l">Refer a friend</span>
                      <span className="wb-ref-pts">+250 pts</span>
                    </div>
                    <div className="wb-ref-link">dentapass.ca/join/SDA-4821</div>
                    <button className="wb-ref-btn">Share with a friend</button>
                  </div>
                </div>
              </div>
            </div>
            {/* Main phone: card front + notification */}
            <div className="phone main">
              <div className="phone-notch"></div>
              <div className="phone-screen">
                <div className="wallet-front">
                  <div className="wf-top">
                    <div>
                      <div className="wf-brand">Smart Dental Art</div>
                      <div className="wf-sub">Windermere · Edmonton, AB</div>
                    </div>
                    <div className="wf-chip">
                      <div className="wf-chip-line"></div>
                      <div className="wf-chip-line"></div>
                    </div>
                  </div>
                  <div className="wf-mid">
                    <div className="wf-label">Member</div>
                    <div className="wf-name">Sarah Thompson</div>
                    <div className="wf-tier">Gold Member</div>
                  </div>
                  <div className="wf-bot">
                    <div>
                      <div className="wf-pts-val">1,240</div>
                      <div className="wf-pts-label">reward points</div>
                    </div>
                    <div className="wf-appt">
                      <div className="wf-appt-label">Next checkup</div>
                      <div className="wf-appt-date">Sep 6, 2026</div>
                    </div>
                  </div>
                </div>
                <div className="notif">
                  <div className="notif-hdr">
                    <div className="notif-icon"></div>
                    <div className="notif-app">Smart Dental Art</div>
                    <div className="notif-time">now</div>
                  </div>
                  <div className="notif-title">Time for your checkup, Sarah ✦</div>
                  <div className="notif-body">
                    Your 6-month cleaning with Dr. Maged is due. Book now — earn 200
                    bonus points.
                  </div>
                  <div className="notif-actions">
                    <button className="na na-d">Dismiss</button>
                    <button className="na na-b">Book now</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="stats">
        <div className="stats-in">
          <div className="stat reveal">
            <div className="stat-num">38%</div>
            <div className="stat-label">
              <strong>Patients never rebook</strong>Not because they&apos;re unhappy
              — because nobody followed up.
            </div>
          </div>
          <div className="stat reveal d1">
            <div className="stat-num">$650</div>
            <div className="stat-label">
              <strong>Average patient value</strong>Per year in a typical dental
              clinic. Every lapsed patient is real lost revenue.
            </div>
          </div>
          <div className="stat reveal d2">
            <div className="stat-num">5×</div>
            <div className="stat-label">
              <strong>More Google reviews</strong>Clinics using automated post-visit
              requests see 4–6× their previous monthly average.
            </div>
          </div>
          <div className="stat reveal d3">
            <div className="stat-num">22×</div>
            <div className="stat-label">
              <strong>Annual ROI</strong>Combined recall recovery and referral
              revenue routinely returns 20–25× the annual subscription cost.
            </div>
          </div>
        </div>
      </section>

      {/* PAIN POINTS */}
      <section className="sec sec-off">
        <div className="sec-in">
          <span className="eyebrow reveal">The problem</span>
          <h2 className="reveal d1">
            Dental clinics have a <em>retention leak.</em>
          </h2>
          <p className="lead reveal d2">
            Your recall system relies on phone calls, postcards, and hope. Patients
            mean to come back. Life gets busy. Nothing pulls them back.
          </p>
          <div className="pain-grid">
            <div className="pain-card reveal">
              <span className="pain-num">01</span>
              <div className="pain-title">Recall reminders that get ignored</div>
              <p className="pain-body">
                Phone call recall has a sub-20% success rate. Postcards go straight in
                the recycling. Emails land in spam. Your front desk spends hours
                chasing patients who never respond.
              </p>
              <span className="pain-badge pb-bad">⚠ Average recall rate: 62%</span>
            </div>
            <div className="pain-card reveal d1">
              <span className="pain-num">02</span>
              <div className="pain-title">No loyalty program to drive return visits</div>
              <p className="pain-body">
                Every major retailer, coffee shop, and pharmacy has a loyalty card.
                Your patients have 15 of them in their wallets. Your clinic isn&apos;t
                one of them. There&apos;s no incentive to choose you over the dentist
                down the street.
              </p>
              <span className="pain-badge pb-bad">⚠ No loyalty = no habit</span>
            </div>
            <div className="pain-card dark reveal d2">
              <span className="pain-num">03</span>
              <div className="pain-title">Google reviews left to chance</div>
              <p className="pain-body">
                New patients in Edmonton Google you before they call. Your competitors
                have 200 reviews. You have 24. Most happy patients intend to leave a
                review — and forget by the time they get to the car. There&apos;s no
                systematic ask.
              </p>
              <span className="pain-badge pb-bad">
                ⚠ Average local clinic: 3–5 reviews/month
              </span>
            </div>
            <div className="pain-card reveal d3">
              <span className="pain-num">04</span>
              <div className="pain-title">No referral engine in place</div>
              <p className="pain-body">
                Word of mouth is your best patient acquisition channel — but it happens
                by accident. You have no way to incentivize referrals, track who sent
                who, or reward the patients who are already your biggest advocates.
              </p>
              <span className="pain-badge pb-bad">⚠ Referrals: entirely untracked</span>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="sec">
        <div className="sec-in">
          <span className="eyebrow reveal">The solution</span>
          <h2 className="reveal d1">
            One card. Every problem <em>solved.</em>
          </h2>
          <p className="lead reveal d2">
            DentaPass puts a branded loyalty card in every patient&apos;s Apple or
            Google Wallet — permanently on their lock screen. No app download. No
            login. One QR scan at the front desk and they&apos;re enrolled.
          </p>
          <div className="scan-flow">
            <div className="scan-step reveal">
              <div className="ss-arrow">→</div>
              <div className="ss-num">01</div>
              <div className="ss-title">Patient scans at reception</div>
              <p className="ss-body">
                A QR code sits at the front desk. Patients scan with their phone camera
                — no app needed. They fill in name and email in 30 seconds.
              </p>
              <span className="ss-tag">QR code provided</span>
            </div>
            <div className="scan-step reveal d1">
              <div className="ss-arrow">→</div>
              <div className="ss-num">02</div>
              <div className="ss-title">Card added to wallet instantly</div>
              <p className="ss-body">
                Their branded DentaPass card appears in Apple Wallet or Google Wallet
                in seconds. Points balance, next checkup date, booking link — all live.
              </p>
              <span className="ss-tag">Apple &amp; Google Wallet</span>
            </div>
            <div className="scan-step reveal d2">
              <div className="ss-arrow">→</div>
              <div className="ss-num">03</div>
              <div className="ss-title">Automations run themselves</div>
              <p className="ss-body">
                Recall reminders fire at 5 months. Review requests send 2 hours
                post-visit. Referral nudges go out at 7 days. All automatic — nothing
                for staff to remember.
              </p>
              <span className="ss-tag">Fully automated</span>
            </div>
            <div className="scan-step reveal d3">
              <div className="ss-arrow">→</div>
              <div className="ss-num">04</div>
              <div className="ss-title">Patients come back, review, refer</div>
              <p className="ss-body">
                Every action — visit, review, referral — earns points that update live
                on the card. Patients have a real reason to return and bring friends.
              </p>
              <span className="ss-tag">Revenue loop closed</span>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE: RECALL */}
      <section className="sec sec-off">
        <div className="sec-in">
          <div className="feat-layout">
            <div className="feat-visual reveal">
              <div style={{ background: 'var(--white)', borderRadius: 'var(--r-xl)', padding: '32px', border: '.5px solid var(--border)', width: '100%', maxWidth: '400px' }}>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '12px', fontWeight: '700', color: 'var(--muted)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '20px' }}>
                  Automated recall timeline
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', paddingBottom: '24px', position: 'relative' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0', flexShrink: 0 }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--teal-lt)', border: '.5px solid var(--teal-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: 'var(--teal-dk)' }}>✓</div>
                      <div style={{ width: '1px', flex: '1', background: 'var(--border)', marginTop: '4px', minHeight: '32px' }}></div>
                    </div>
                    <div style={{ paddingTop: '6px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--ink)', marginBottom: '3px' }}>Visit completed</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Day 0 — Staff scan awards 100 points instantly</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', paddingBottom: '24px', position: 'relative' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0', flexShrink: 0 }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#fff8e6', border: '.5px solid #f0c040', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>⭐</div>
                      <div style={{ width: '1px', flex: '1', background: 'var(--border)', marginTop: '4px', minHeight: '32px' }}></div>
                    </div>
                    <div style={{ paddingTop: '6px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--ink)', marginBottom: '3px' }}>Review request fires</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>2 hours later — lock screen ping with bonus points offer</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', paddingBottom: '24px', position: 'relative' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0', flexShrink: 0 }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f0f9ff', border: '.5px solid #bae6fd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>🔗</div>
                      <div style={{ width: '1px', flex: '1', background: 'var(--border)', marginTop: '4px', minHeight: '32px' }}></div>
                    </div>
                    <div style={{ paddingTop: '6px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--ink)', marginBottom: '3px' }}>Referral nudge</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>7 days later — &quot;Share your link, earn 250 points&quot;</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', paddingBottom: '24px', position: 'relative' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0', flexShrink: 0 }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--teal-lt)', border: '.5px solid var(--teal-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>📅</div>
                      <div style={{ width: '1px', flex: '1', background: 'var(--border)', marginTop: '4px', minHeight: '32px' }}></div>
                    </div>
                    <div style={{ paddingTop: '6px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--ink)', marginBottom: '3px' }}>Recall reminder fires</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>5 months later — straight to lock screen, one-tap book</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0', flexShrink: 0 }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#fef2f2', border: '.5px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>💤</div>
                    </div>
                    <div style={{ paddingTop: '6px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--ink)', marginBottom: '3px' }}>Lapsed patient re-engagement</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>90 days no visit — automatic &quot;We miss you&quot; with 150 bonus points</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <span className="eyebrow reveal">Automated recall</span>
              <h2 className="reveal d1">
                The reminder that actually <em>lands.</em>
              </h2>
              <p className="lead reveal d2">
                Postcards get recycled. Calls go to voicemail. A push notification on
                the lock screen — from a card patients chose to add — gets seen.
              </p>
              <div className="feat-list" style={{ marginTop: '36px' }}>
                <div className="feat-item reveal d2">
                  <div className="feat-ico">
                    <svg viewBox="0 0 20 20" fill="none">
                      <path d="M10 2a6 6 0 016 6c0 3-1.3 4.7-1.7 6H5.7C5.3 12.7 4 11 4 8a6 6 0 016-6z" stroke="var(--teal)" strokeWidth="1.5" />
                      <path d="M7.5 14c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5" stroke="var(--teal)" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <div className="feat-name">Lock screen delivery</div>
                    <p className="feat-desc">Recall reminders appear directly on the patient&apos;s lock screen — no competing with email inboxes or spam folders. The card update triggers the notification automatically.</p>
                  </div>
                </div>
                <div className="feat-item reveal d3">
                  <div className="feat-ico">
                    <svg viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="7" stroke="var(--teal)" strokeWidth="1.5" />
                      <path d="M10 7v3l2 2" stroke="var(--teal)" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <div className="feat-name">Precision timing</div>
                    <p className="feat-desc">Reminders fire at exactly 5 months — not a blast to your whole list, but a personal ping to each patient based on their last actual visit date. No scheduling required.</p>
                  </div>
                </div>
                <div className="feat-item reveal d4">
                  <div className="feat-ico">
                    <svg viewBox="0 0 20 20" fill="none">
                      <path d="M3 10l5 5L17 5" stroke="var(--teal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <div className="feat-name">One-tap rebooking</div>
                    <p className="feat-desc">The notification has a &quot;Book now&quot; button that goes directly to your booking page. Zero friction between the reminder and the appointment — patients book before they put their phone down.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE: POINTS & SCANNING */}
      <section className="sec">
        <div className="sec-in">
          <span className="eyebrow reveal">Points &amp; scanning</span>
          <h2 className="reveal d1">
            A loyalty loop that <em>runs itself.</em>
          </h2>
          <p className="lead reveal d2">
            Staff scan the patient&apos;s card at checkout. Points update on their
            phone in real time — while they&apos;re still standing at the desk. The
            card turns every visit into a moment.
          </p>
          <div className="pts-table-wrap reveal d2">
            <table className="pts-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>How it&apos;s triggered</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Completed visit</td>
                  <td><span className="trigger-badge t-staff">Staff scans card at front desk</span></td>
                  <td className="pts-val">+100</td>
                </tr>
                <tr>
                  <td>Left Google review</td>
                  <td><span className="trigger-badge t-auto">Auto — tracked review link tap</span></td>
                  <td className="pts-val">+100</td>
                </tr>
                <tr>
                  <td>Referred a friend</td>
                  <td><span className="trigger-badge t-auto">Auto — fires when referral enrolls</span></td>
                  <td className="pts-val">+250</td>
                </tr>
                <tr>
                  <td>Birthday bonus</td>
                  <td><span className="trigger-badge t-system">Auto — cron on patient birthday</span></td>
                  <td className="pts-val">+100</td>
                </tr>
                <tr>
                  <td>Recall reminder tapped</td>
                  <td><span className="trigger-badge t-auto">Auto — link tap tracked</span></td>
                  <td className="pts-val">+50</td>
                </tr>
                <tr>
                  <td>Manual award</td>
                  <td><span className="trigger-badge t-staff">Staff — dashboard, any reason</span></td>
                  <td className="pts-val">Custom</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="tier-grid" style={{ marginTop: '48px' }}>
            <div className="tier-card bronze reveal">
              <span className="tier-icon">
                <svg width="40" height="52" viewBox="0 0 40 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 0h12l4 18H10L14 0z" fill="#c0892c" opacity=".35"/>
                  <path d="M16 0h8l2 10h-12L16 0z" fill="#c0892c" opacity=".55"/>
                  <circle cx="20" cy="38" r="14" fill="#c0892c"/>
                  <circle cx="20" cy="38" r="11" fill="#d4a044"/>
                  <circle cx="20" cy="38" r="8" fill="#c0892c" opacity=".4"/>
                  <text x="20" y="43" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily="serif">B</text>
                </svg>
              </span>
              <div className="tier-name">Bronze</div>
              <div className="tier-range">0 – 499 points</div>
              <ul className="tier-perks">
                <li><span className="tp-dot"></span>Recall reminders &amp; booking links</li>
                <li><span className="tp-dot"></span>Review request notifications</li>
                <li><span className="tp-dot"></span>Referral code on card</li>
              </ul>
            </div>
            <div className="tier-card silver reveal d1">
              <span className="tier-icon">
                <svg width="40" height="52" viewBox="0 0 40 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 0h12l4 18H10L14 0z" fill="#7a9cbf" opacity=".35"/>
                  <path d="M16 0h8l2 10h-12L16 0z" fill="#7a9cbf" opacity=".55"/>
                  <circle cx="20" cy="38" r="14" fill="#7a9cbf"/>
                  <circle cx="20" cy="38" r="11" fill="#aec6de"/>
                  <circle cx="20" cy="38" r="8" fill="#7a9cbf" opacity=".4"/>
                  <text x="20" y="43" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily="serif">S</text>
                </svg>
              </span>
              <div className="tier-name">Silver</div>
              <div className="tier-range">500 – 999 points</div>
              <ul className="tier-perks">
                <li><span className="tp-dot"></span>Everything in Bronze</li>
                <li><span className="tp-dot"></span>Priority scheduling</li>
                <li><span className="tp-dot"></span>10% off teeth whitening</li>
              </ul>
            </div>
            <div className="tier-card gold reveal d2">
              <span className="tier-icon">
                <svg width="40" height="52" viewBox="0 0 40 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 0h12l4 18H10L14 0z" fill="#c9a84c" opacity=".35"/>
                  <path d="M16 0h8l2 10h-12L16 0z" fill="#c9a84c" opacity=".65"/>
                  <circle cx="20" cy="38" r="14" fill="#c9a84c"/>
                  <circle cx="20" cy="38" r="11" fill="#e8c96a"/>
                  <circle cx="20" cy="38" r="8" fill="#c9a84c" opacity=".4"/>
                  <text x="20" y="43" textAnchor="middle" fontSize="11" fontWeight="700" fill="#3a2800" fontFamily="serif">G</text>
                </svg>
              </span>
              <div className="tier-name">Gold</div>
              <div className="tier-range">1,000+ points</div>
              <ul className="tier-perks">
                <li><span className="tp-dot"></span>Everything in Silver</li>
                <li><span className="tp-dot"></span>Whitening consult</li>
                <li><span className="tp-dot"></span>VIP label on patient record</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE: GOOGLE REVIEWS */}
      <section className="sec sec-off">
        <div className="sec-in">
          <div className="feat-layout flip">
            <div>
              <span className="eyebrow reveal">Google reviews</span>
              <h2 className="reveal d1">
                Turn every visit into a <em>5-star moment.</em>
              </h2>
              <p className="lead reveal d2">
                2 hours after a patient&apos;s appointment, a notification fires to
                their lock screen: &quot;How was your visit? Leave a review and earn
                100 bonus points.&quot; One tap goes straight to Google.
              </p>
              <div className="feat-list" style={{ marginTop: '36px' }}>
                <div className="feat-item reveal d2">
                  <div className="feat-ico">
                    <svg viewBox="0 0 20 20" fill="none">
                      <path d="M10 2l2.4 4.8L18 7.6l-4 3.9.95 5.5L10 14.5l-4.95 2.5.95-5.5-4-3.9 5.6-.8L10 2z" stroke="var(--teal)" strokeWidth="1.4" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <div className="feat-name">Perfect timing, every time</div>
                    <p className="feat-desc">The request fires 2 hours post-visit — when the patient is home, relaxed, and still thinking about how great the appointment was. Not while they&apos;re still in the parking lot, not 3 days later when they&apos;ve forgotten.</p>
                  </div>
                </div>
                <div className="feat-item reveal d3">
                  <div className="feat-ico">
                    <svg viewBox="0 0 20 20" fill="none">
                      <path d="M10 3a7 7 0 100 14A7 7 0 0010 3z" stroke="var(--teal)" strokeWidth="1.5" />
                      <path d="M13.5 10H10V6.5" stroke="var(--teal)" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <div className="feat-name">90-day cooldown prevents abuse</div>
                    <p className="feat-desc">The system automatically prevents repeat review requests to the same patient within 90 days — protecting your credibility while keeping the program running cleanly.</p>
                  </div>
                </div>
                <div className="feat-item reveal d4">
                  <div className="feat-ico">
                    <svg viewBox="0 0 20 20" fill="none">
                      <path d="M3 10h14M10 3l7 7-7 7" stroke="var(--teal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <div className="feat-name">Tracked click, instant reward</div>
                    <p className="feat-desc">The review link routes through DentaPass — so when a patient taps it, 100 points are awarded instantly and their card updates. The reward is immediate, making it feel real.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="feat-visual reveal" style={{ justifyContent: 'flex-start' }}>
              <div style={{ width: '100%', maxWidth: '400px' }}>
                <div style={{ background: 'var(--ink)', borderRadius: '20px', padding: '16px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,.4)', textAlign: 'center', marginBottom: '10px' }}>9:41 AM</div>
                  <div style={{ background: 'rgba(255,255,255,.1)', borderRadius: '12px', padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: '#0d3348', flexShrink: 0 }}></div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.45)', flex: '1' }}>Smart Dental Art</div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.3)' }}>2h ago</div>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>How was your visit today? ⭐</div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,.65)', lineHeight: '1.4' }}>Thanks for coming in, Sarah! A quick Google review means the world to Dr. Maged — and earns you 100 bonus points.</div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <button className="np-a np-dismiss">Maybe later</button>
                      <button className="np-a np-cta" style={{ background: 'var(--gold)', color: '#3a2800' }}>Leave a review ↗</button>
                    </div>
                  </div>
                </div>
                <div style={{ background: 'var(--white)', borderRadius: 'var(--r-lg)', padding: '24px', border: '.5px solid var(--border)' }}>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '11px', fontWeight: '700', color: 'var(--muted)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '16px' }}>Review impact — Smart Dental Art</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ background: 'var(--off)', borderRadius: '12px', padding: '14px' }}>
                      <div style={{ fontFamily: "'Instrument Serif',serif", fontSize: '32px', color: 'var(--muted)', lineHeight: '1', marginBottom: '4px' }}>3–5</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>reviews/month without DentaPass</div>
                    </div>
                    <div style={{ background: 'var(--teal-lt)', borderRadius: '12px', padding: '14px', border: '.5px solid var(--teal-mid)' }}>
                      <div style={{ fontFamily: "'Instrument Serif',serif", fontSize: '32px', color: 'var(--teal)', lineHeight: '1', marginBottom: '4px' }}>20+</div>
                      <div style={{ fontSize: '11px', color: 'var(--teal-dk)' }}>reviews/month with automated ask</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE: REFERRALS */}
      <section className="sec">
        <div className="sec-in">
          <div className="feat-layout">
            <div className="feat-visual reveal">
              <div style={{ width: '100%', maxWidth: '400px' }}>
                <div style={{ background: 'var(--off)', borderRadius: 'var(--r-xl)', padding: '28px', border: '.5px solid var(--border)' }}>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '13px', fontWeight: '700', color: 'var(--muted)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '20px' }}>Referral math — 500 patients</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--white)', borderRadius: '12px', padding: '18px 20px', border: '.5px solid var(--border)' }}>
                      <div style={{ fontSize: '16px', color: 'var(--ink)' }}>Patients enrolled</div>
                      <div style={{ fontFamily: "'Instrument Serif',serif", fontSize: '28px', color: 'var(--ink)' }}>500</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--white)', borderRadius: '12px', padding: '18px 20px', border: '.5px solid var(--border)' }}>
                      <div style={{ fontSize: '16px', color: 'var(--ink)' }}>10% refer one friend</div>
                      <div style={{ fontFamily: "'Instrument Serif',serif", fontSize: '28px', color: 'var(--ink)' }}>
                        50 <span style={{ fontSize: '16px', color: 'var(--muted)' }}>new patients</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--teal-lt)', borderRadius: '12px', padding: '18px 20px', border: '.5px solid var(--teal-mid)' }}>
                      <div style={{ fontSize: '16px', color: 'var(--teal-dk)', fontWeight: '500' }}>Annual revenue added</div>
                      <div style={{ fontFamily: "'Instrument Serif',serif", fontSize: '28px', color: 'var(--teal)' }}>$32,500</div>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', paddingTop: '4px' }}>Based on $650 avg patient value/yr</div>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <span className="eyebrow reveal">Referral program</span>
              <h2 className="reveal d1">
                Your happiest patients become your <em>sales team.</em>
              </h2>
              <p className="lead reveal d2">
                Every patient gets a unique referral link on the back of their card.
                When a friend enrolls using their link, 250 points fire instantly —
                while they&apos;re still at dinner together.
              </p>
              <div className="feat-list" style={{ marginTop: '36px' }}>
                <div className="feat-item reveal d2">
                  <div className="feat-ico">
                    <svg viewBox="0 0 20 20" fill="none">
                      <circle cx="8" cy="7" r="3" stroke="var(--teal)" strokeWidth="1.5" />
                      <path d="M2 17c0-3.31 2.69-6 6-6" stroke="var(--teal)" strokeWidth="1.5" strokeLinecap="round" />
                      <circle cx="15" cy="13" r="3" stroke="var(--teal)" strokeWidth="1.5" />
                      <path d="M15 10v3l2 2" stroke="var(--teal)" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <div className="feat-name">Unique link on every card</div>
                    <p className="feat-desc">The back of the card shows each patient&apos;s personal referral link — dentapass.ca/join/SDA-4821. The &quot;Share with a friend&quot; button opens their phone&apos;s native share sheet — iMessage, WhatsApp, wherever they text.</p>
                  </div>
                </div>
                <div className="feat-item reveal d3">
                  <div className="feat-ico">
                    <svg viewBox="0 0 20 20" fill="none">
                      <path d="M10 2l2.4 4.8L18 7.6l-4 3.9.95 5.5L10 14.5l-4.95 2.5.95-5.5-4-3.9 5.6-.8L10 2z" stroke="var(--teal)" strokeWidth="1.4" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <div className="feat-name">Instant points, instant notification</div>
                    <p className="feat-desc">The moment a referred friend completes enrollment, the referrer&apos;s card updates with 250 new points and a push notification fires: &quot;Your friend just joined — 250 points added!&quot;</p>
                  </div>
                </div>
                <div className="feat-item reveal d4">
                  <div className="feat-ico">
                    <svg viewBox="0 0 20 20" fill="none">
                      <rect x="3" y="3" width="14" height="14" rx="3" stroke="var(--teal)" strokeWidth="1.5" />
                      <path d="M7 10h6M10 7v6" stroke="var(--teal)" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <div className="feat-name">Leaderboard in your dashboard</div>
                    <p className="feat-desc">See your top referrers, total referrals this month, and points awarded. Adjust the referral bonus anytime — run a seasonal double-points promotion in minutes.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COMPARE */}
      <section className="sec sec-off">
        <div className="sec-in">
          <span className="eyebrow reveal">The difference</span>
          <h2 className="reveal d1">DentaPass vs. doing nothing.</h2>
          <div className="compare">
            <div className="cmp-card without reveal">
              <div className="cmp-overline">Without DentaPass</div>
              <div className="cmp-title">Flying blind, one patient at a time</div>
              <div className="cmp-list">
                <div className="cmp-item"><span className="ci ci-no"><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M3 3l5 5M8 3l-5 5" stroke="#aeaeb2" strokeWidth="1.4" strokeLinecap="round" /></svg></span>Recall by phone call — sub-20% success rate</div>
                <div className="cmp-item"><span className="ci ci-no"><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M3 3l5 5M8 3l-5 5" stroke="#aeaeb2" strokeWidth="1.4" strokeLinecap="round" /></svg></span>3–5 Google reviews per month at best</div>
                <div className="cmp-item"><span className="ci ci-no"><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M3 3l5 5M8 3l-5 5" stroke="#aeaeb2" strokeWidth="1.4" strokeLinecap="round" /></svg></span>No loyalty program — patients have no reason to choose you</div>
                <div className="cmp-item"><span className="ci ci-no"><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M3 3l5 5M8 3l-5 5" stroke="#aeaeb2" strokeWidth="1.4" strokeLinecap="round" /></svg></span>Referrals happen by accident, if at all</div>
                <div className="cmp-item"><span className="ci ci-no"><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M3 3l5 5M8 3l-5 5" stroke="#aeaeb2" strokeWidth="1.4" strokeLinecap="round" /></svg></span>No visibility into patient retention or engagement</div>
                <div className="cmp-item"><span className="ci ci-no"><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M3 3l5 5M8 3l-5 5" stroke="#aeaeb2" strokeWidth="1.4" strokeLinecap="round" /></svg></span>Front desk spends hours manually chasing patients</div>
              </div>
            </div>
            <div className="cmp-card with reveal d1">
              <div className="cmp-overline">With DentaPass</div>
              <div className="cmp-title">Every patient permanently in your pocket</div>
              <div className="cmp-list">
                <div className="cmp-item yes"><span className="ci ci-yes"><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5l2.5 2.5L9 3" stroke="var(--teal)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg></span>Lock screen recall at exactly 5 months — automated</div>
                <div className="cmp-item yes"><span className="ci ci-yes"><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5l2.5 2.5L9 3" stroke="var(--teal)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg></span>20+ Google reviews per month with post-visit requests</div>
                <div className="cmp-item yes"><span className="ci ci-yes"><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5l2.5 2.5L9 3" stroke="var(--teal)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg></span>Points, tiers, and perks — patients have a real reason to return</div>
                <div className="cmp-item yes"><span className="ci ci-yes"><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5l2.5 2.5L9 3" stroke="var(--teal)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg></span>Referral link on every card — tracked, rewarded, automatic</div>
                <div className="cmp-item yes"><span className="ci ci-yes"><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5l2.5 2.5L9 3" stroke="var(--teal)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg></span>Analytics dashboard — retention, reviews, referrals, revenue</div>
                <div className="cmp-item yes"><span className="ci ci-yes"><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5l2.5 2.5L9 3" stroke="var(--teal)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg></span>Zero front desk effort — everything runs automatically</div>
              </div>
              <div className="cmp-badge">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="6.5" r="5" stroke="var(--teal)" strokeWidth="1.2" />
                  <path d="M4 6.5l1.8 1.8L9 5" stroke="var(--teal)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Live in your clinic within 7 days
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CARD PREVIEW */}
      <section className="sec" id="card-preview">
        <div className="sec-in">
          <span className="eyebrow reveal">Sample card mockup</span>
          <h2 className="reveal d1">
            What your patients will carry — <em>always.</em>
          </h2>
          <p className="lead reveal d2">
            Every card is fully branded to your clinic. Here&apos;s an example of what
            it looks like — front and back. Yours would carry your name, colors, and
            logo.
          </p>
          <div className="card-preview-wrap reveal d2">
            <div className="cp-tabs">
              <button
                className={`cp-tab${currentFace === 'front' ? ' active' : ''}`}
                onClick={() => setCurrentFace('front')}
              >
                <span className="cp-tab-dot"></span>Card front
              </button>
              <button
                className={`cp-tab${currentFace === 'back' ? ' active' : ''}`}
                onClick={() => setCurrentFace('back')}
              >
                <span className="cp-tab-dot"></span>Card back
              </button>
            </div>
            <div className="cp-stage">
              {/* FRONT */}
              <div className="cp-face" style={{ display: currentFace === 'front' ? 'flex' : 'none' }}>
                <div className="cp-phone-frame">
                  <div className="cp-notch"></div>
                  <div className="cp-screen">
                    <div className="cp-wallet-chrome">
                      <span className="cp-wallet-label">Wallet</span>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="6" stroke="rgba(0,0,0,.25)" strokeWidth="1" />
                        <path d="M5 8h6M8 5v6" stroke="rgba(0,0,0,.25)" strokeWidth="1" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div className="cp-card-front">
                      <div className="cpf-top">
                        <div className="cpf-brand-block">
                          <div className="cpf-logo-circle">
                            <svg width="14" height="16" viewBox="0 0 14 16" fill="none">
                              <rect x="1" y="1" width="12" height="14" rx="2" stroke="white" strokeWidth="1.5" />
                              <path d="M4 6h6M4 9h4" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
                            </svg>
                          </div>
                          <div>
                            <div className="cpf-clinic-name">Smart Dental Art</div>
                            <div className="cpf-clinic-sub">Windermere · Edmonton, AB</div>
                          </div>
                        </div>
                        <div className="cpf-wallet-wordmark">WALLET</div>
                      </div>
                      <div className="cpf-mid">
                        <div className="cpf-member-label">Member</div>
                        <div className="cpf-member-name">Sarah Thompson</div>
                        <div className="cpf-tier-pill">✦ Gold Member</div>
                      </div>
                      <div className="cpf-bot">
                        <div>
                          <div className="cpf-pts-num">1,240</div>
                          <div className="cpf-pts-label">reward points</div>
                        </div>
                        <div className="cpf-appt">
                          <div className="cpf-appt-label">Next checkup</div>
                          <div className="cpf-appt-date">Sep 6, 2026</div>
                        </div>
                      </div>
                    </div>
                    <div className="cp-add-bar">
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <rect x="2" y="4" width="14" height="10" rx="2" stroke="#1a1a1a" strokeWidth="1.2" />
                        <path d="M6 4V3a3 3 0 016 0v1" stroke="#1a1a1a" strokeWidth="1.2" />
                        <circle cx="9" cy="9" r="1.5" fill="#1a1a1a" />
                      </svg>
                      <span>Add to Apple Wallet</span>
                    </div>
                  </div>
                </div>
                <div className="cp-callouts cp-callouts-front">
                  <div className="cp-callout cp-callout-tl">
                    <div className="cp-callout-line cp-cl-right"></div>
                    <div className="cp-callout-bubble">Clinic name &amp; location</div>
                  </div>
                  <div className="cp-callout cp-callout-tr">
                    <div className="cp-callout-bubble">Native Wallet integration</div>
                    <div className="cp-callout-line cp-cl-left"></div>
                  </div>
                  <div className="cp-callout cp-callout-ml">
                    <div className="cp-callout-line cp-cl-right"></div>
                    <div className="cp-callout-bubble">Patient name &amp; tier</div>
                  </div>
                  <div className="cp-callout cp-callout-bl">
                    <div className="cp-callout-line cp-cl-right"></div>
                    <div className="cp-callout-bubble">Live points balance</div>
                  </div>
                  <div className="cp-callout cp-callout-br">
                    <div className="cp-callout-bubble">Next checkup date</div>
                    <div className="cp-callout-line cp-cl-left"></div>
                  </div>
                </div>
              </div>

              {/* BACK */}
              <div className="cp-face" style={{ display: currentFace === 'back' ? 'flex' : 'none' }}>
                <div className="cp-phone-frame">
                  <div className="cp-notch"></div>
                  <div className="cp-screen">
                    <div className="cp-wallet-chrome">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M10 4L6 8l4 4" stroke="rgba(0,0,0,.35)" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                      <span className="cp-wallet-label">Smart Dental Art</span>
                    </div>
                    <div className="cp-card-back">
                      <div className="cpb-header">
                        <div>
                          <div className="cpb-clinic">Smart Dental Art</div>
                          <div className="cpb-id">Member #SDA-00247</div>
                        </div>
                        <div className="cpb-qr">
                          <div className="cpb-qr-grid">
                            <div className="qc b"></div><div className="qc b"></div><div className="qc w"></div><div className="qc b"></div><div className="qc b"></div>
                            <div className="qc b"></div><div className="qc w"></div><div className="qc b"></div><div className="qc w"></div><div className="qc b"></div>
                            <div className="qc w"></div><div className="qc b"></div><div className="qc b"></div><div className="qc b"></div><div className="qc w"></div>
                            <div className="qc b"></div><div className="qc w"></div><div className="qc w"></div><div className="qc b"></div><div className="qc b"></div>
                            <div className="qc b"></div><div className="qc b"></div><div className="qc w"></div><div className="qc w"></div><div className="qc b"></div>
                          </div>
                          <div className="cpb-qr-label">Scan at desk</div>
                        </div>
                      </div>
                      <div className="cpb-rows">
                        <div className="cpb-row"><span className="cpb-l">Points balance</span><span className="cpb-v">1,240 pts</span></div>
                        <div className="cpb-row"><span className="cpb-l">Member since</span><span className="cpb-v">Jan 2025</span></div>
                        <div className="cpb-row"><span className="cpb-l">Next checkup</span><span className="cpb-v cpb-teal">Sep 6, 2026</span></div>
                        <div className="cpb-row"><span className="cpb-l">Book appointment</span><button className="cpb-book-btn">Book online →</button></div>
                        <div className="cpb-row"><span className="cpb-l">Call us</span><a className="cpb-link">(587) 855-9300</a></div>
                        <div className="cpb-row"><span className="cpb-l">Get directions</span><a className="cpb-link">Open in Maps</a></div>
                      </div>
                      <div className="cpb-social">
                        <span className="cpb-social-label">Follow us</span>
                        <div className="cpb-social-icons">
                          <div className="cpb-si cpb-si-fb">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                              <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
                            </svg>
                          </div>
                          <div className="cpb-si cpb-si-g">
                            <svg width="12" height="12" viewBox="0 0 24 24">
                              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      <div className="cpb-review">
                        <div className="cpb-review-txt">Loved your visit? Leave Dr. Maged a review!</div>
                        <div className="cpb-review-bottom">
                          <div className="cpb-stars">★★★★★</div>
                          <button className="cpb-review-btn">Review ↗</button>
                        </div>
                      </div>
                      <div className="cpb-ref">
                        <div className="cpb-ref-top">
                          <span className="cpb-ref-label">Refer a friend</span>
                          <span className="cpb-ref-pts">+250 pts</span>
                        </div>
                        <div className="cpb-ref-link">dentapass.ca/join/SDA-4821</div>
                        <button className="cpb-ref-btn">Share with a friend</button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="cp-callouts cp-callouts-back">
                  <div className="cp-callout cp-callout-tl">
                    <div className="cp-callout-line cp-cl-right"></div>
                    <div className="cp-callout-bubble">QR scan for points</div>
                  </div>
                  <div className="cp-callout cp-callout-ml">
                    <div className="cp-callout-line cp-cl-right"></div>
                    <div className="cp-callout-bubble">One-tap booking &amp; call</div>
                  </div>
                  <div className="cp-callout cp-callout-bl">
                    <div className="cp-callout-line cp-cl-right"></div>
                    <div className="cp-callout-bubble">Referral link — unique per patient</div>
                  </div>
                  <div className="cp-callout cp-callout-br">
                    <div className="cp-callout-bubble">Google review prompt</div>
                    <div className="cp-callout-line cp-cl-left"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="cp-pills reveal d3">
              <div className="cp-pill"><span className="cp-pill-dot"></span>Updates live on patient&apos;s phone</div>
              <div className="cp-pill"><span className="cp-pill-dot"></span>Works offline in Wallet</div>
              <div className="cp-pill"><span className="cp-pill-dot"></span>No app download needed</div>
              <div className="cp-pill"><span className="cp-pill-dot"></span>Fully branded to your clinic</div>
              <div className="cp-pill"><span className="cp-pill-dot"></span>Apple &amp; Google Wallet</div>
            </div>
          </div>
        </div>
      </section>

      {/* ROI */}
      <section className="roi-section">
        <div className="roi-in">
          <div className="roi-big reveal">
            <div className="roi-number">22×</div>
            <div className="roi-label">
              annual return on<br />your subscription
            </div>
            <p className="roi-caption">
              A clinic recovering just 5 lapsed patients per month adds ~$39,000 in
              annual patient value. Stack referral revenue on top and you&apos;re
              looking at 20–25× your subscription cost — in year one.
            </p>
          </div>
          <div className="roi-math reveal d1">
            <div className="roi-step">
              <div className="roi-n">Step 1</div>
              <div className="roi-body">
                <div className="roi-title">Recall reminders recover lapsed patients</div>
                <div className="roi-desc">Automated 5-month pings bring back patients who would otherwise fall through the cracks. Each recovered patient is worth $650/year.</div>
                <span className="roi-val">5 recovered patients/month = $39,000/yr in retained patient value</span>
              </div>
            </div>
            <div className="roi-step">
              <div className="roi-n">Step 2</div>
              <div className="roi-body">
                <div className="roi-title">Google reviews drive new patient acquisition</div>
                <div className="roi-desc">4–6× your current review volume compounds your local ranking. New patients find you first in search instead of the clinic down the road.</div>
                <span className="roi-val">Higher ranking = passive new patient flow</span>
              </div>
            </div>
            <div className="roi-step">
              <div className="roi-n">Step 3</div>
              <div className="roi-body">
                <div className="roi-title">Referrals add patients at zero acquisition cost</div>
                <div className="roi-desc">10% of 500 patients referring one friend = 50 new patients. At $650/year, that&apos;s $32,500 in annual revenue from a link on a card.</div>
                <span className="roi-val">$32,500 from referrals alone</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WAITLIST */}
      <section id="waitlist" className="waitlist-section">
        <div className="wl-in">
          <div className="wl-left reveal">
            <span className="eyebrow" style={{ color: 'var(--teal)', marginBottom: '20px', display: 'block' }}>
              Early access
            </span>
            <h2>
              Be the first clinic in Edmonton with <em>DentaPass.</em>
            </h2>
            <p>
              We&apos;re onboarding founding clinics now. Join the waitlist and we&apos;ll
              reach out personally to set up a live demo — no commitment, no credit
              card.
            </p>
            <div className="wl-perks">
              <div className="wl-perk"><span className="wl-perk-dot"></span>Custom card mockup with your clinic&apos;s branding</div>
              <div className="wl-perk"><span className="wl-perk-dot"></span>Priority access for founding clinics</div>
              <div className="wl-perk"><span className="wl-perk-dot"></span>Live in your clinic within 7 days of go-ahead</div>
              <div className="wl-perk"><span className="wl-perk-dot"></span>Locked-in founding pricing — never increases</div>
              <div className="wl-perk"><span className="wl-perk-dot"></span>Personal setup call with the DentaPass team</div>
            </div>
            <div className="wl-count">
              <div className="wl-avatars">
                <div className="wlav">AB</div>
                <div className="wlav">CD</div>
                <div className="wlav">EF</div>
              </div>
              <div className="wl-count-text">
                Be among the <strong>first clinics</strong> in Edmonton to launch
              </div>
            </div>
          </div>
          <div className="reveal d1">
            <div className="wl-form-wrap">
              {!wlSuccess ? (
                <div>
                  <div className="wl-form-title">Request early access</div>
                  <div className="wl-form-sub">We&apos;ll reach out soon.</div>
                  <div className="fg">
                    <div className="f">
                      <label htmlFor="f-fname">First name</label>
                      <input type="text" id="f-fname" placeholder="Sarah" autoComplete="given-name" />
                      <span className="ferr" style={{ display: errors.fname ? 'block' : 'none' }}>Please enter your first name.</span>
                    </div>
                    <div className="f">
                      <label htmlFor="f-lname">Last name</label>
                      <input type="text" id="f-lname" placeholder="Thompson" autoComplete="family-name" />
                      <span className="ferr" style={{ display: errors.lname ? 'block' : 'none' }}>Please enter your last name.</span>
                    </div>
                  </div>
                  <div className="fg full" style={{ marginBottom: '12px' }}>
                    <div className="f">
                      <label htmlFor="f-email">Email address</label>
                      <input type="email" id="f-email" placeholder="you@yourclinic.com" autoComplete="email" />
                      <span className="ferr" style={{ display: errors.email ? 'block' : 'none' }}>Please enter a valid email.</span>
                    </div>
                  </div>
                  <div className="fg full" style={{ marginBottom: '12px' }}>
                    <div className="f">
                      <label htmlFor="f-phone">Phone number</label>
                      <input type="tel" id="f-phone" placeholder="(587) 555-0000" autoComplete="tel" />
                    </div>
                  </div>
                  <div className="fg full" style={{ marginBottom: '12px' }}>
                    <div className="f">
                      <label htmlFor="f-clinic">Clinic name</label>
                      <input type="text" id="f-clinic" placeholder="Smart Dental Art" autoComplete="organization" />
                      <span className="ferr" style={{ display: errors.clinic ? 'block' : 'none' }}>Please enter your clinic name.</span>
                    </div>
                  </div>
                  <div className="fg" style={{ marginBottom: '12px' }}>
                    <div className="f">
                      <label htmlFor="f-size">Number of patients</label>
                      <select id="f-size">
                        <option value="">Select range...</option>
                        <option>Under 500</option>
                        <option>500 – 1,000</option>
                        <option>1,000 – 2,000</option>
                        <option>2,000+</option>
                      </select>
                    </div>
                    <div className="f">
                      <label htmlFor="f-locations">Locations</label>
                      <select id="f-locations">
                        <option value="">Select...</option>
                        <option>1 location</option>
                        <option>2–3 locations</option>
                        <option>4+ locations</option>
                      </select>
                    </div>
                  </div>
                  <div className="fg full" style={{ marginBottom: '16px' }}>
                    <div className="f">
                      <label htmlFor="f-msg">Biggest patient retention challenge (optional)</label>
                      <textarea id="f-msg" placeholder="e.g. patients not rebooking after cleanings, struggling to get Google reviews..."></textarea>
                    </div>
                  </div>
                  {wlError && (
                    <div style={{ fontSize: '13px', color: '#f87171', marginBottom: '8px', textAlign: 'center' }}>
                      {wlError}
                    </div>
                  )}
                  <button className="wl-submit" onClick={handleWL} disabled={wlSubmitting}>
                    {wlSubmitting ? 'Saving your spot…' : 'Request early access →'}
                  </button>
                  <div className="wl-note">No spam. No credit card. Just a personal call from our team.</div>
                </div>
              ) : (
                <div className="wl-success" style={{ display: 'block' }}>
                  <div className="wl-success-icon">✦</div>
                  <div className="wl-success-title">You&apos;re on the list.</div>
                  <p className="wl-success-sub">
                    We&apos;ll be in touch soon to set up your demo and
                    build your clinic&apos;s branded card mockup.
                  </p>
                  <div className="wl-success-num">
                    You&apos;re one of our first founding clinics in Edmonton.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="footer-in">
          <div className="footer-logo">Denta<span>Pass</span></div>
          <p className="footer-copy">© 2026 DentaPass. Built for dental clinics in Edmonton, AB.</p>
        </div>
      </footer>
    </>
  );
}
