import multer, { type FileFilterCallback } from 'multer';
import type { ErrorRequestHandler, Request } from 'express';
import { ValidationError } from '../utils/errors.js';

const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024;

class UnsupportedFileTypeError extends Error {}

function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
    const isImage = file.mimetype.startsWith('image/');
    const allowed = file.fieldname === 'photo' ? isImage : isImage || file.mimetype === 'application/pdf';
    if (!allowed) {
        cb(new UnsupportedFileTypeError(`Unsupported file type for ${file.fieldname}`));
        return;
    }
    cb(null, true);
}

const employeeFilesUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 2 },
    fileFilter,
});

/** Parses `photo` and `aadhaarFile` from a multipart/form-data employee create/update request. */
export const uploadEmployeeFiles = employeeFilesUpload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'aadhaarFile', maxCount: 1 },
]);

/** Converts multer/file-filter failures into the standard ValidationError envelope instead of falling through to a generic 500. */
export const handleUploadErrors: ErrorRequestHandler = (err, _req, _res, next) => {
    if (err instanceof multer.MulterError) {
        const message = err.code === 'LIMIT_FILE_SIZE' ? 'File exceeds the 3MB size limit' : err.message;
        next(new ValidationError(message, 'INVALID_FILE_UPLOAD'));
        return;
    }
    if (err instanceof UnsupportedFileTypeError) {
        next(new ValidationError(err.message, 'INVALID_FILE_UPLOAD'));
        return;
    }
    next(err);
};
