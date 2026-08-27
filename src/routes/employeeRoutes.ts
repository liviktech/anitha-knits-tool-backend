import { Router } from 'express';
import {
    createEmployeeHandler,
    deleteEmployeeHandler,
    getEmployeeHandler,
    listEmployeesHandler,
    updateEmployeeHandler,
} from '../controllers/employeeController.js';

const router = Router();

router.post('/', createEmployeeHandler);
router.get('/', listEmployeesHandler);
router.get('/:id', getEmployeeHandler);
router.patch('/:id', updateEmployeeHandler);
router.delete('/:id', deleteEmployeeHandler);

export default router;
