import { PinpointClient } from '@aws-sdk/client-pinpoint';
import { env } from './env.js';

export const pinpointClient = new PinpointClient({
    region: env.AWS_REGION,
    credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
});
