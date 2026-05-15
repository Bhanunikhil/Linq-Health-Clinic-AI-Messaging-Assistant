import axios, { AxiosInstance } from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

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

class LinqClient {
    private apiKey: string;
    private baseUrl: string;
    private client: AxiosInstance;

    constructor() {
        this.apiKey = process.env.LINQ_API_KEY || '';
        this.baseUrl = 'https://api.linqapp.com/api/partner';
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
    }

    /**
     * Start a new chat or send a message to a phone number.
     * @param recipientNumber - The recipient's phone number in E.164 format.
     * @param text - The text message to send.
     */
    async startChat(recipientNumber: string, text: string): Promise<any> {
        try {
            const payload: StartChatPayload = {
                recipient: recipientNumber,
                message: {
                    parts: [
                        {
                            type: 'text',
                            value: text
                        }
                    ]
                }
            };
            const response = await this.client.post('/v3/chats', payload);
            return response.data;
        } catch (error: any) {
            console.error('Error starting chat:', error.response ? error.response.data : error.message);
            throw error;
        }
    }

    /**
     * Send a message to an existing chat.
     * @param chatId - The ID of the chat.
     * @param text - The text message to send.
     */
    async sendMessage(chatId: string, text: string): Promise<any> {
        try {
            const payload: SendMessagePayload = {
                message: {
                    parts: [
                        {
                            type: 'text',
                            value: text
                        }
                    ]
                }
            };
            const response = await this.client.post(`/v3/chats/${chatId}/messages`, payload);
            return response.data;
        } catch (error: any) {
            console.error('Error sending message:', error.response ? error.response.data : error.message);
            throw error;
        }
    }

    /**
     * Send an image to an existing chat.
     * @param chatId - The ID of the chat.
     * @param imageUrl - The URL of the image.
     */
    async sendImage(chatId: string, imageUrl: string): Promise<any> {
        try {
            const payload: SendMessagePayload = {
                message: {
                    parts: [
                        {
                            type: 'media',
                            url: imageUrl
                        }
                    ]
                }
            };
            const response = await this.client.post(`/v3/chats/${chatId}/messages`, payload);
            return response.data;
        } catch (error: any) {
            console.error('Error sending image:', error.response ? error.response.data : error.message);
            throw error;
        }
    }
}

export default new LinqClient();
