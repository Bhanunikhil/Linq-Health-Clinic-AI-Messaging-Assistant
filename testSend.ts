import linqClient from './linqClient';
import * as dotenv from 'dotenv';

dotenv.config();

const recipient = process.env.LINQ_SANDBOX_NUMBER || '+14153598688';

async function test() {
    console.log('Sending test message to:', recipient);
    try {
        const response = await linqClient.startChat(recipient, 'Hello from your TypeScript Linq Project! 🚀');
        console.log('Success!', response);
    } catch (error) {
        console.error('Test failed.');
    }
}

test();
