import { GoogleGenerativeAI, ChatSession } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import { CLINIC_SYSTEM_PROMPT } from '../config/prompts';

dotenv.config();

// ─────────────────────────────────────────────────────────
// Gemini AI Model Initialization
// ─────────────────────────────────────────────────────────

const genAI = new GoogleGenerativeAI(process.env.LLM_API_KEY || '');

const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: CLINIC_SYSTEM_PROMPT
});

// ─────────────────────────────────────────────────────────
// Chat Session Manager (per-conversation memory)
// ─────────────────────────────────────────────────────────

const chatSessions = new Map<string, ChatSession>();

/**
 * Get an existing chat session or create a new one.
 * Each chat ID gets its own session with full conversation history.
 */
export function getOrCreateChatSession(chatId: string): ChatSession {
    if (!chatSessions.has(chatId)) {
        const session = model.startChat({ history: [] });
        chatSessions.set(chatId, session);
        console.log(`📝 New chat session created for: ${chatId}`);
    }
    return chatSessions.get(chatId)!;
}

/**
 * Send a patient message to the AI and get Caroline's response.
 */
export async function generateAIResponse(chatId: string, userMessage: string): Promise<string> {
    const chatSession = getOrCreateChatSession(chatId);
    const result = await chatSession.sendMessage(userMessage);
    return result.response.text();
}
