import { SendMessagesCommand } from '@aws-sdk/client-pinpoint';
import { pinpointClient } from '../config/pinpoint.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type { OtpPurpose } from '../types/enums.js';

const TEMPLATE_NAME_BY_PURPOSE: Record<OtpPurpose, string> = {
    LOGIN: env.PINPOINT_SMS_TEMPLATE_LOGIN,
    RESET_PASSWORD: env.PINPOINT_SMS_TEMPLATE_RESET,
};

/**
 * Numbers are stored as 10-15 plain digits (see authValidation's mobile regex); Pinpoint requires
 * E.164 (leading "+"). No country-code convention exists elsewhere in this codebase yet — this
 * assumes the stored digits already include the country code and just prefixes "+".
 */
function toE164(mobile: string): string {
    return mobile.startsWith('+') ? mobile : `+${mobile}`;
}

/**
 * Sends a one-time-password SMS through AWS Pinpoint, using a pre-created SMS template selected
 * by `purpose` (PINPOINT_SMS_TEMPLATE_LOGIN / PINPOINT_SMS_TEMPLATE_RESET). The template's
 * {{OTPCode}}/{{TTLMinutes}} placeholders are filled via the message's Substitutions. Time: O(1)
 * network call; Space: O(1).
 */
export async function sendOtpSms({
    mobile,
    purpose,
    otp,
    ttlMinutes,
}: {
    mobile: string;
    purpose: OtpPurpose;
    otp: string;
    ttlMinutes: number;
}): Promise<void> {
    const address = toE164(mobile);

    const command = new SendMessagesCommand({
        ApplicationId: env.PINPOINT_APPLICATION_ID,
        MessageRequest: {
            Addresses: {
                [address]: { ChannelType: 'SMS' },
            },
            MessageConfiguration: {
                SMSMessage: {
                    MessageType: 'TRANSACTIONAL',
                    ...(env.PINPOINT_ORIGINATION_NUMBER ? { OriginationNumber: env.PINPOINT_ORIGINATION_NUMBER } : {}),
                    Substitutions: {
                        OTPCode: [otp],
                        TTLMinutes: [String(ttlMinutes)],
                    },
                },
            },
            TemplateConfiguration: {
                SMSTemplate: { Name: TEMPLATE_NAME_BY_PURPOSE[purpose] },
            },
        },
    });

    const response = await pinpointClient.send(command);
    const result = response.MessageResponse?.Result?.[address];
    if (result && result.DeliveryStatus !== 'SUCCESSFUL') {
        // Pinpoint's HTTP call succeeded but the per-address delivery attempt failed
        // (e.g. THROTTLED, PERMANENT_FAILURE) — log for diagnosis without leaking the OTP itself.
        logger.error('Pinpoint SMS delivery not successful', {
            purpose,
            deliveryStatus: result.DeliveryStatus,
            statusMessage: result.StatusMessage,
        });
    }
}
