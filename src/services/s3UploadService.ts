import crypto from 'crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../config/env.js';
import { s3Client } from '../config/s3.js';

export interface UploadEmployeeFileInput {
    buffer: Buffer;
    mimetype: string;
    originalName: string;
    companyId: string;
    prefix: string;
}

/** Uploads a buffer to S3 under `${prefix}${companyId}/...` and returns its public URL. No ACL is set — the bucket must already have a public-read bucket policy (buckets created after ~Apr 2023 default to ACLs disabled). */
export async function uploadEmployeeFile(input: UploadEmployeeFileInput): Promise<string> {
    const sanitizedName = input.originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${input.prefix}${input.companyId}/${crypto.randomUUID()}-${sanitizedName}`;

    await s3Client.send(
        new PutObjectCommand({
            Bucket: env.AWS_S3_BUCKET_NAME,
            Key: key,
            Body: input.buffer,
            ContentType: input.mimetype,
        }),
    );

    return `https://${env.AWS_S3_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
}
