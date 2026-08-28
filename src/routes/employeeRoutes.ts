import { Router } from 'express';
import {
    createEmployeeHandler,
    deleteEmployeeHandler,
    getEmployeeHandler,
    listEmployeesHandler,
    updateEmployeeHandler,
} from '../controllers/employeeController.js';
import { handleUploadErrors, uploadEmployeeFiles } from '../middlewares/uploadEmployeeFiles.js';

const router = Router();

router.post('/', uploadEmployeeFiles, handleUploadErrors, createEmployeeHandler);
router.get('/', listEmployeesHandler);
router.get('/:id', getEmployeeHandler);
router.patch('/:id', uploadEmployeeFiles, handleUploadErrors, updateEmployeeHandler);
router.delete('/:id', deleteEmployeeHandler);

export default router;
