/**
 * Linq Health Assistant — Backend Entry Point
 */
import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';

import apiRoutes from './routes/api';
import webhookRoutes from './routes/webhook';

dotenv.config();

// ─────────────────────────────────────────────────────────
// Express Application Setup
// ─────────────────────────────────────────────────────────

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ── Routes ──
app.use(apiRoutes);
app.use(webhookRoutes);

// ── Start Server ──
app.listen(port, () => {
    console.log(`\n🏥 Linq Health Clinic Backend running at http://localhost:${port}`);
    console.log(`📡 Webhook endpoint: /webhook`);
    console.log(`📊 Dashboard API: /api/appointments & /api/stats\n`);
});
