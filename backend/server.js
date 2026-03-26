import express from 'express';
import cors from 'cors';

import enrollmentRouter from './enrollment/index.js';
import pointsRouter from './points/index.js';
import patientsRouter from './patients/index.js';
import clinicsRouter from './clinics/index.js';
import billingRouter from './billing/index.js';

const app = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(cors({
  origin: [
    process.env.WEBSITE_URL || 'http://localhost:3000',
    /\.vercel\.app$/,
  ],
  credentials: true,
}));

// Raw body needed for Stripe webhook signature verification — mount before json()
app.use('/billing/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────

app.use('/enrollment', enrollmentRouter);
app.use('/points',     pointsRouter);
app.use('/patients',   patientsRouter);
app.use('/clinics',    clinicsRouter);
app.use('/billing',    billingRouter);

app.get('/health', (_, res) => res.json({ ok: true }));

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`DentaPass backend running on http://localhost:${PORT}`);
});
