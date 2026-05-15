import { Router, Request, Response } from 'express';
import { MessagePart } from '../types';
import { generateAIResponse } from '../services/aiService';
import { createAppointment, cancelAppointment, scheduleReminder } from '../services/appointmentService';
import linqClient from '../services/linqClient';

const router = Router();

/**
 * POST /webhook
 * Receives incoming messages from the Linq Partner API,
 * processes them through Gemini AI (Caroline), and
 * extracts booking/cancellation actions from the response.
 */
router.post('/webhook', async (req: Request, res: Response) => {
    const payload = req.body;
    console.log('Received Webhook:', JSON.stringify(payload, null, 2));

    if (payload.event_type === 'message.received' && payload.data) {
        const chatId = payload.data.chat.id;
        const sender = payload.data.sender_handle.handle;

        // Ignore messages sent by our own bot
        if (sender === process.env.LINQ_SANDBOX_NUMBER) {
            return res.status(200).send('Ignored self message');
        }

        const incomingText = payload.data.parts.find((p: MessagePart) => p.type === 'text')?.value;
        console.log(`Received message from ${sender} in chat ${chatId}: ${incomingText}`);

        try {
            let responseText = "I received your message!";

            if (incomingText) {
                // Generate AI response with conversation memory
                responseText = await generateAIResponse(chatId, incomingText);

                // ── ACTION EXTRACTION: BOOKING ──
                const bookingMatch = responseText.match(/\[SYSTEM_BOOKING:\s*(.*?)\]/);
                if (bookingMatch) {
                    const appointment = createAppointment(sender, chatId, bookingMatch[1]);

                    console.log(`\n======================================================`);
                    console.log(`🔥 [ACTION TRIGGERED]: Saving to Database...`);
                    console.log(`✅ APPOINTMENT BOOKED: ${appointment.service}`);
                    console.log(`📋 Appointment ID: ${appointment.id}`);
                    console.log(`👤 Patient: ${appointment.patientName} (${appointment.age}, ${appointment.gender})`);
                    console.log(`📱 Phone: ${sender}`);
                    console.log(`📍 Address: ${appointment.address}`);
                    console.log(`📅 Schedule: ${appointment.day} at ${appointment.time}`);
                    console.log(`======================================================\n`);

                    scheduleReminder(chatId, appointment);
                    responseText = responseText.replace(/\[SYSTEM_BOOKING:\s*(.*?)\]/, '').trim();
                }

                // ── ACTION EXTRACTION: CANCELLATION ──
                const cancelMatch = responseText.match(/\[SYSTEM_CANCEL:\s*(.*?)\]/);
                if (cancelMatch) {
                    const cancelledService = cancelMatch[1].trim();
                    const cancelled = cancelAppointment(sender);

                    if (cancelled) {
                        console.log(`\n======================================================`);
                        console.log(`🚫 [ACTION TRIGGERED]: Cancelling Appointment...`);
                        console.log(`❌ CANCELLED: ${cancelledService} (ID: ${cancelled.id})`);
                        console.log(`📱 Patient: ${sender}`);
                        console.log(`======================================================\n`);
                    }

                    responseText = responseText.replace(/\[SYSTEM_CANCEL:\s*(.*?)\]/, '').trim();
                }

            } else if (payload.data.parts.some((p: MessagePart) => p.type === 'media')) {
                responseText = "Thanks for the image! I've added this to your medical file. How else can I assist you today? 📸";
            }

            // Send AI response back to the patient via Linq
            await linqClient.sendMessage(chatId, responseText);

        } catch (error: any) {
            console.error('Failed to generate or send AI response:', error.message);
            await linqClient.sendMessage(
                chatId,
                "Sorry, I'm having a little trouble thinking right now. Could you try again? 🤖"
            );
        }
    }

    res.status(200).send('OK');
});

export default router;
