// ─────────────────────────────────────────────────────────
// Appointment Types
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

// ─────────────────────────────────────────────────────────
// Linq API Types
// ─────────────────────────────────────────────────────────

export interface MessagePart {
    type: 'text' | 'media';
    value?: string;
    url?: string;
}

export interface SendMessagePayload {
    message: {
        parts: MessagePart[];
    };
}

export interface StartChatPayload extends SendMessagePayload {
    recipient: string;
}
