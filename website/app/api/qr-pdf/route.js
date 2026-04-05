import React from 'react';
import { NextResponse } from 'next/server';
import { renderToBuffer, Document, Page, View, Text, Image, Svg, Polyline } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { createSupabaseServerClient } from '../../../lib/supabase-server';

export const runtime = 'nodejs';

// ── DentaPass brand colours (fixed — not the clinic's brand colour) ───────────
const DP_TEAL   = '#3bbfb9';
const DP_DARK   = '#0d9488'; // slightly darker teal for gradient feel
const DP_FG     = '#ffffff'; // white text on teal
const DP_FG_MUT = 'rgba(255,255,255,0.55)';

function rgba(hex, a) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = n >> 16, g = (n >> 8) & 0xff, b = n & 0xff;
  return `rgba(${r},${g},${b},${a})`;
}

// ── PDF document ──────────────────────────────────────────────────────────────
// A5 landscape: 595pt × 420pt  (210mm × 148mm)

function EnrollmentPDF({ clinic, qrDataUrl }) {
  const label      = clinic.points_label || 'Points';
  const isDiscount = clinic.rewards_mode === 'discounts';

  const perks = isDiscount
    ? [`Earn ${label} at every visit`, `Redeem ${label} for real dollar discounts`, 'Checkup reminders on your phone', 'Refer friends & earn bonus points']
    : [`Earn ${label} at every visit`, 'Unlock Bronze, Silver & Gold status', 'Checkup reminders on your phone', 'Refer friends & earn bonus points'];

  const s = {
    page:      { flexDirection: 'row', backgroundColor: '#ffffff', fontFamily: 'Helvetica' },

    // Left brand panel — DentaPass teal
    left:      { width: 160, backgroundColor: DP_TEAL, padding: 28, justifyContent: 'space-between' },
    logoBox:   { width: 40, height: 40, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden', marginBottom: 14, alignItems: 'center', justifyContent: 'center' },
    logoImg:   { width: 32, height: 32, objectFit: 'contain' },
    eyebrow:   { fontSize: 7, color: DP_FG_MUT, letterSpacing: 1.5, marginBottom: 6 },
    clinicName:{ fontSize: 17, fontFamily: 'Helvetica-Bold', color: DP_FG, lineHeight: 1.2 },
    dpBrand:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
    dpText:    { fontSize: 8, color: DP_FG_MUT, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },

    // Middle content panel
    mid:       { flex: 1, paddingHorizontal: 28, paddingVertical: 28, justifyContent: 'center' },
    badge:     { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    badgeDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: DP_TEAL, marginRight: 6 },
    badgeText: { fontSize: 7.5, color: DP_TEAL, fontFamily: 'Helvetica-Bold', letterSpacing: 1.8 },
    h1line1:   { fontSize: 24, fontFamily: 'Helvetica-Bold', color: '#111827', lineHeight: 1.1 },
    h1line2:   { fontSize: 24, fontFamily: 'Helvetica-Bold', color: DP_TEAL, lineHeight: 1.1, marginBottom: 10 },
    subtitle:  { fontSize: 9.5, color: '#6b7280', lineHeight: 1.55, marginBottom: 18 },
    divider:   { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    divLine:   { width: 18, height: 1.5, backgroundColor: DP_TEAL, borderRadius: 1, marginRight: 8 },
    divLabel:  { fontSize: 7.5, color: '#9ca3af', letterSpacing: 1.5 },
    perksGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    perkItem:  { width: '50%', flexDirection: 'row', alignItems: 'flex-start', marginBottom: 9, paddingRight: 6 },
    perkCheck: { width: 14, height: 14, borderRadius: 4, backgroundColor: rgba(DP_TEAL, 0.12), marginRight: 7, alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 },
    perkText:  { fontSize: 9, color: '#374151', fontFamily: 'Helvetica-Bold', flex: 1, lineHeight: 1.4 },
    wallets:   { flexDirection: 'row', marginTop: 10, gap: 6 },
    walletPill:{ backgroundColor: '#f0fdfa', borderRadius: 20, paddingVertical: 3, paddingHorizontal: 10 },
    walletText:{ fontSize: 8, color: DP_DARK, fontFamily: 'Helvetica-Bold' },

    // Right QR panel
    right:     { width: 192, backgroundColor: rgba(DP_TEAL, 0.05), alignItems: 'center', justifyContent: 'center', paddingVertical: 24, paddingHorizontal: 20, borderLeftWidth: 1, borderLeftColor: rgba(DP_TEAL, 0.15), borderLeftStyle: 'solid' },
    qrCard:    { backgroundColor: '#ffffff', borderRadius: 14, padding: 10, marginBottom: 14 },
    qrImg:     { width: 138, height: 138 },
    scanPill:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12, borderWidth: 1, borderColor: rgba(DP_TEAL, 0.25), borderStyle: 'solid' },
    scanText:  { fontSize: 9, color: '#374151', fontFamily: 'Helvetica-Bold' },
  };

  return (
    <Document>
      <Page size={[595, 420]} style={s.page}>

        {/* ── LEFT: brand ── */}
        <View style={s.left}>
          <View>
            {clinic.logo_url && (
              <View style={s.logoBox}>
                <Image src={clinic.logo_url} style={s.logoImg} />
              </View>
            )}
            <Text style={s.eyebrow}>LOYALTY PROGRAM</Text>
            <Text style={s.clinicName}>{clinic.name}</Text>
          </View>

          {/* DentaPass branding */}
          <View style={s.dpBrand}>
            <Svg width={10} height={10} viewBox="0 0 24 24">
              <Polyline
                points="12,2 4,5 4,12 12,23 20,12 20,5 12,2"
                fill={DP_FG}
                fillOpacity={0.5}
                stroke="none"
              />
            </Svg>
            <Text style={s.dpText}>DentaPass</Text>
          </View>
        </View>

        {/* ── MIDDLE: content ── */}
        <View style={s.mid}>
          {/* Badge */}
          <View style={s.badge}>
            <View style={s.badgeDot} />
            <Text style={s.badgeText}>FREE TO JOIN</Text>
          </View>

          {/* Headline */}
          <Text style={s.h1line1}>Your smile</Text>
          <Text style={s.h1line2}>earns rewards</Text>
          <Text style={s.subtitle}>
            Scan the code to add your free loyalty card to Apple or Google Wallet — no app needed.
          </Text>

          {/* Divider */}
          <View style={s.divider}>
            <View style={s.divLine} />
            <Text style={s.divLabel}>WHAT YOU GET</Text>
          </View>

          {/* Perks 2×2 */}
          <View style={s.perksGrid}>
            {perks.map((perk) => (
              <View key={perk} style={s.perkItem}>
                <View style={s.perkCheck}>
                  <Svg width={8} height={8} viewBox="0 0 24 24">
                    <Polyline points="20,6 9,17 4,12" stroke={DP_TEAL} strokeWidth={3} strokeLinecap="round" fill="none" />
                  </Svg>
                </View>
                <Text style={s.perkText}>{perk}</Text>
              </View>
            ))}
          </View>

          {/* Wallet pills */}
          <View style={s.wallets}>
            <View style={s.walletPill}><Text style={s.walletText}>Apple Wallet</Text></View>
            <View style={s.walletPill}><Text style={s.walletText}>Google Wallet</Text></View>
          </View>
        </View>

        {/* ── RIGHT: QR ── */}
        <View style={s.right}>
          <View style={s.qrCard}>
            <Image src={qrDataUrl} style={s.qrImg} />
          </View>
          <View style={s.scanPill}>
            <Text style={s.scanText}>Scan to join — it's free</Text>
          </View>
        </View>

      </Page>
    </Document>
  );
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: clinic } = await supabase
      .from('clinics')
      .select('id, name, slug, logo_url, rewards_mode, points_label')
      .eq('owner_email', user.email)
      .maybeSingle();

    if (!clinic) return NextResponse.json({ error: 'Clinic not found' }, { status: 404 });

    const appUrl    = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const enrollUrl = `${appUrl}/join/${clinic.slug}`;

    const qrDataUrl = await QRCode.toDataURL(enrollUrl, {
      width: 500,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: { dark: '#111827', light: '#ffffff' },
    });

    const pdfBuffer = await renderToBuffer(
      React.createElement(EnrollmentPDF, { clinic, qrDataUrl })
    );

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${clinic.slug}-enrollment-card.pdf"`,
        'Cache-Control':       'no-store',
      },
    });
  } catch (err) {
    console.error('[qr-pdf] Error:', err);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
