import { Appointment } from '../types';
import linqClient from './linqClient';

// ─────────────────────────────────────────────────────────
// In-Memory Appointment Store
// ─────────────────────────────────────────────────────────

const appointments: Appointment[] = [];

function generateId(): string {
    return Math.random().toString(36).substring(2, 10);
}

// ─────────────────────────────────────────────────────────
// CRUD Operations
// ─────────────────────────────────────────────────────────

/**
 * Returns all appointments sorted by most recent first.
 */
export function getAllAppointments(): Appointment[] {
    return [...appointments].sort(
        (a, b) => new Date(b.bookedAt).getTime() - new Date(a.bookedAt).getTime()
    );
}

/**
 * Returns summary statistics for the admin dashboard.
 */
export function getStats() {
    const total = appointments.length;
    const confirmed = appointments.filter(a => a.status === 'confirmed').length;
    const cancelled = appointments.filter(a => a.status === 'cancelled').length;

    const byService: Record<string, number> = {};
    appointments.filter(a => a.status === 'confirmed').forEach(a => {
        byService[a.service] = (byService[a.service] || 0) + 1;
    });

    return { total, confirmed, cancelled, byService };
}

/**
 * Creates a new appointment from the parsed AI booking data.
 */
export function createAppointment(
    sender: string,
    chatId: string,
    bookingDetails: string
): Appointment {
    // Parse "Tuesday | 10:00 AM | Flu Shot | John Smith | 32 | Male | 123 Main St"
    const parts = bookingDetails.split('|').map((s: string) => s.trim());

    const appointment: Appointment = {
        id: generateId(),
        patientPhone: sender,
        chatId: chatId,
        day: parts[0] || 'TBD',
        time: parts[1] || 'TBD',
        service: parts[2] || 'General',
        patientName: parts[3] || 'Unknown',
        age: parts[4] || 'N/A',
        gender: parts[5] || 'N/A',
        address: parts[6] || 'N/A',
        status: 'confirmed',
        bookedAt: new Date().toISOString()
    };

    appointments.push(appointment);
    return appointment;
}

/**
 * Cancels the most recent confirmed appointment for a patient.
 * Returns the cancelled appointment, or null if none found.
 */
export function cancelAppointment(sender: string): Appointment | null {
    const appointmentToCancel = appointments
        .filter(a => a.patientPhone === sender && a.status === 'confirmed')
        .sort((a, b) => new Date(b.bookedAt).getTime() - new Date(a.bookedAt).getTime())
        [0];

    if (appointmentToCancel) {
        appointmentToCancel.status = 'cancelled';
        return appointmentToCancel;
    }
    return null;
}

// ─────────────────────────────────────────────────────────
// Reminder Scheduler
// ─────────────────────────────────────────────────────────

const REMINDER_DELAY_MS = 60 * 1000; // 60 seconds for demo

/**
 * Schedules a follow-up reminder SMS after an appointment is booked.
 * Skips the reminder if the appointment is cancelled before the timer fires.
 */
export function scheduleReminder(chatId: string, appointment: Appointment) {
    console.log(`⏰ Reminder scheduled for ${appointment.patientPhone} in 60 seconds...`);

    setTimeout(async () => {
        const current = appointments.find(a => a.id === appointment.id);
        if (current && current.status === 'confirmed') {
            const reminderText = `⏰ Reminder from Linq Health Clinic: You have a ${appointment.service} appointment on ${appointment.day} at ${appointment.time}. Please arrive 10 minutes early. Reply CANCEL to cancel.`;

            try {
                await linqClient.sendMessage(chatId, reminderText);
                console.log(`✅ Reminder sent to ${appointment.patientPhone}`);
            } catch (error: any) {
                console.error(`❌ Failed to send reminder: ${error.message}`);
            }
        } else {
            console.log(`⏭️ Reminder skipped (appointment was cancelled)`);
        }
    }, REMINDER_DELAY_MS);
}
