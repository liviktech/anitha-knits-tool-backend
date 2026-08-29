declare module 'multer' {
  import type { RequestHandler } from 'express';

  export type FileFilterCallback = (
    error?: Error | null,
    acceptFile?: boolean,
  ) => void;

  export class MulterError extends Error {
    code: string;
    field?: string;
  }

  export interface File {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size?: number;
    buffer?: Buffer;
    destination?: string;
    filename?: string;
    path?: string;
    stream?: NodeJS.ReadableStream;
  }

  export function memoryStorage(): any;
  export function fields(
    fields: Array<{ name: string; maxCount?: number }>,
  ): RequestHandler;

  const multer: any;
  export default multer;
}
