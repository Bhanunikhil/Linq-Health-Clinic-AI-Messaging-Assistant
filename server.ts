import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import linqClient, { MessagePart } from './linqClient';
import * as dotenv from 'dotenv';
import { GoogleGenerativeAI, ChatSession } from '@google/generative-ai';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// ─────────────────────────────────────────────────────────
// APPOINTMENT DATA STORE
// ─────────────────────────────────────────────────────────

export interface Appointment {
    id: string;
    patientPhone: string;
    chatId: string;
    patientName: string;
    age: string;
    gender: string;
    address: string;
    service: string;
    day: string;
    time: string;
    status: 'confirmed' | 'cancelled';
    bookedAt: string;
}

const appointments: Appointment[] = [];

function generateId(): string {
    return Math.random().toString(36).substring(2, 10);
}

// ─────────────────────────────────────────────────────────
// GEMINI AI CONFIGURATION
// ─────────────────────────────────────────────────────────

const clinicPrompt = `You are Caroline, a friendly and professional receptionist for "Linq Health Clinic". 
Your goal is to help patients schedule appointments, answer basic questions, and provide a welcoming experience over text message.

Clinic Information:
- Hours: Monday to Friday, 8:00 AM to 5:00 PM.
- Services: General Checkups, Teeth Cleanings, Flu Shots, Bloodwork, Consultations.
- Insurance: We accept Blue Cross, Aetna, Cigna, and Medicare.

Booking Instructions:
- Keep your responses concise (SMS friendly) and empathetic.
- When a user asks for an appointment, you MUST collect ALL of the following details before confirming:
  1. Service (what they need)
  2. Preferred day and time (must be during clinic hours Mon-Fri, 8 AM - 5 PM)
  3. Full Name
  4. Age
  5. Gender
  6. Address
- Ask for these details naturally in the conversation. You can ask for multiple details at once to keep it concise.
- If they request a time outside of hours, politely inform them of the hours and ask for another time.
- Once ALL details are collected (service, day, time, name, age, gender, address), confirm the appointment.
- VERY IMPORTANT: When you confirm an appointment, you MUST append this exact phrase to the very end of your response:
  [SYSTEM_BOOKING: <Day> | <Time> | <Service> | <FullName> | <Age> | <Gender> | <Address>]
  Example: [SYSTEM_BOOKING: Tuesday | 10:00 AM | Flu Shot | John Smith | 32 | Male | 123 Main St, Buffalo NY]

Cancellation Instructions:
- If a user asks to cancel their appointment, confirm the cancellation politely.
- VERY IMPORTANT: When you confirm a cancellation, you MUST append this exact phrase to the very end of your response: [SYSTEM_CANCEL: <Service>] (e.g., [SYSTEM_CANCEL: Flu Shot]).
- After cancelling, ask if they would like to reschedule or if there is anything else you can help with.

Out of bounds handling: If a user asks you to do something unrelated to the clinic (like writing code or a poem), politely refuse and steer the conversation back to their health needs.`;

const genAI = new GoogleGenerativeAI(process.env.LLM_API_KEY || '');
const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    systemInstruction: clinicPrompt
});

// ─────────────────────────────────────────────────────────
// CONVERSATION HISTORY (per chat)
// ─────────────────────────────────────────────────────────

const chatSessions = new Map<string, ChatSession>();

function getOrCreateChatSession(chatId: string): ChatSession {
    if (!chatSessions.has(chatId)) {
        const session = model.startChat({ history: [] });
        chatSessions.set(chatId, session);
        console.log(`📝 New chat session created for: ${chatId}`);
    }
    return chatSessions.get(chatId)!;
}

// ─────────────────────────────────────────────────────────
// REMINDER SCHEDULER
// ─────────────────────────────────────────────────────────

function scheduleReminder(chatId: string, appointment: Appointment) {
    const REMINDER_DELAY_MS = 60 * 1000; // 60 seconds for demo purposes

    console.log(`⏰ Reminder scheduled for ${appointment.patientPhone} in 60 seconds...`);

    setTimeout(async () => {
        // Only send reminder if the appointment hasn't been cancelled
        const currentAppointment = appointments.find(a => a.id === appointment.id);
        if (currentAppointment && currentAppointment.status === 'confirmed') {
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

// ─────────────────────────────────────────────────────────
// EXPRESS MIDDLEWARE
// ─────────────────────────────────────────────────────────

app.use(cors());
app.use(bodyParser.json());

// ─────────────────────────────────────────────────────────
// REST API ENDPOINTS (for the Admin Dashboard)
// ─────────────────────────────────────────────────────────

// Root endpoint
app.get('/', (req: Request, res: Response) => {
    res.send('Linq Health Clinic AI Concierge is running in TypeScript!');
});

/**
 * GET /api/appointments
 * Returns all appointments for the admin dashboard.
 */
app.get('/api/appointments', (req: Request, res: Response) => {
    // Return appointments sorted by most recent first
    const sorted = [...appointments].sort((a, b) => 
        new Date(b.bookedAt).getTime() - new Date(a.bookedAt).getTime()
    );
    res.json(sorted);
});

/**
 * GET /api/stats
 * Returns summary statistics for the admin dashboard.
 */
app.get('/api/stats', (req: Request, res: Response) => {
    const total = appointments.length;
    const confirmed = appointments.filter(a => a.status === 'confirmed').length;
    const cancelled = appointments.filter(a => a.status === 'cancelled').length;

    // Count by service
    const byService: Record<string, number> = {};
    appointments.filter(a => a.status === 'confirmed').forEach(a => {
        byService[a.service] = (byService[a.service] || 0) + 1;
    });

    res.json({
        total,
        confirmed,
        cancelled,
        byService
    });
});

// ─────────────────────────────────────────────────────────
// WEBHOOK ENDPOINT (receives messages from Linq)
// ─────────────────────────────────────────────────────────

app.post('/webhook', async (req: Request, res: Response) => {
    const payload = req.body;
    console.log('Received Webhook:', JSON.stringify(payload, null, 2));

    if (payload.event_type === 'message.received' && payload.data) {
        const chatId = payload.data.chat.id;
        const sender = payload.data.sender_handle.handle;

        if (sender === process.env.LINQ_SANDBOX_NUMBER) {
            return res.status(200).send('Ignored self message');
        }

        const incomingText = payload.data.parts.find((p: MessagePart) => p.type === 'text')?.value;
        console.log(`Received message from ${sender} in chat ${chatId}: ${incomingText}`);

        try {
            let responseText = "I received your message!";

            if (incomingText) {
                // Get or create a chat session for this conversation
                const chatSession = getOrCreateChatSession(chatId);

                // Send the message within the session context (AI remembers history!)
                const result = await chatSession.sendMessage(incomingText);
                responseText = result.response.text();

                // ── ACTION EXTRACTION: BOOKING ──
                const bookingMatch = responseText.match(/\[SYSTEM_BOOKING:\s*(.*?)\]/);
                if (bookingMatch) {
                    const bookingDetails = bookingMatch[1];
                    
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

                    console.log(`\n======================================================`);
                    console.log(`🔥 [ACTION TRIGGERED]: Saving to Database...`);
                    console.log(`✅ APPOINTMENT BOOKED: ${appointment.service}`);
                    console.log(`📋 Appointment ID: ${appointment.id}`);
                    console.log(`👤 Patient: ${appointment.patientName} (${appointment.age}, ${appointment.gender})`);
                    console.log(`📱 Phone: ${sender}`);
                    console.log(`📍 Address: ${appointment.address}`);
                    console.log(`📅 Schedule: ${appointment.day} at ${appointment.time}`);
                    console.log(`======================================================\n`);
                    
                    // Schedule a reminder SMS in 60 seconds
                    scheduleReminder(chatId, appointment);

                    // Remove the system tag from the text sent back to the user
                    responseText = responseText.replace(/\[SYSTEM_BOOKING:\s*(.*?)\]/, '').trim();
                }

                // ── ACTION EXTRACTION: CANCELLATION ──
                const cancelMatch = responseText.match(/\[SYSTEM_CANCEL:\s*(.*?)\]/);
                if (cancelMatch) {
                    const cancelledService = cancelMatch[1].trim();
                    
                    // Find the most recent confirmed appointment for this patient
                    const appointmentToCancel = appointments
                        .filter(a => a.patientPhone === sender && a.status === 'confirmed')
                        .sort((a, b) => new Date(b.bookedAt).getTime() - new Date(a.bookedAt).getTime())
                        [0];

                    if (appointmentToCancel) {
                        appointmentToCancel.status = 'cancelled';

                        console.log(`\n======================================================`);
                        console.log(`🚫 [ACTION TRIGGERED]: Cancelling Appointment...`);
                        console.log(`❌ CANCELLED: ${cancelledService} (ID: ${appointmentToCancel.id})`);
                        console.log(`📱 Patient: ${sender}`);
                        console.log(`======================================================\n`);
                    }

                    // Remove the system tag from the text sent back to the user
                    responseText = responseText.replace(/\[SYSTEM_CANCEL:\s*(.*?)\]/, '').trim();
                }

            } else if (payload.data.parts.some((p: MessagePart) => p.type === 'media')) {
                responseText = "Thanks for the image! I've added this to your medical file. How else can I assist you today? 📸";
            }

            // Send AI response via Linq
            await linqClient.sendMessage(chatId, responseText);
        } catch (error: any) {
            console.error('Failed to generate or send AI response:', error.message);
            // Fallback response
            await linqClient.sendMessage(chatId, "Sorry, I'm having a little trouble thinking right now. Could you try again? 🤖");
        }
    }

    res.status(200).send('OK');
});

app.listen(port, () => {
    console.log(`\n🏥 Linq Health Clinic Backend running at http://localhost:${port}`);
    console.log(`📡 Webhook endpoint: /webhook`);
    console.log(`📊 Dashboard API: /api/appointments & /api/stats\n`);
});
