import { Router, Request, Response } from 'express';
import { getAllAppointments, getStats } from '../services/appointmentService';

const router = Router();

/**
 * GET /
 * Health check endpoint.
 */
router.get('/', (req: Request, res: Response) => {
    res.send('Linq Health Clinic AI Assistant is running!');
});

/**
 * GET /api/appointments
 * Returns all appointments for the admin dashboard.
 */
router.get('/api/appointments', (req: Request, res: Response) => {
    res.json(getAllAppointments());
});

/**
 * GET /api/stats
 * Returns summary statistics for the admin dashboard.
 */
router.get('/api/stats', (req: Request, res: Response) => {
    res.json(getStats());
});

export default router;
