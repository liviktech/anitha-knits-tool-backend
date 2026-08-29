declare global {
  namespace Express {
    namespace Multer {
      interface File {
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
    }

    interface Request {
      files?:
        | { [fieldname: string]: Express.Multer.File[] }
        | Express.Multer.File[];
    }
  }
}

export {};
