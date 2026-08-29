import { Router } from 'express';
import { distributeMarketValueHandler, getPayrollSummaryHandler, grantSalaryAdvanceHandler, savePayrollRecordsHandler, getSavedPayrollRecordsHandler, getMarketValueAllocationsHandler, getSalaryAdvancesHandler } from '../controllers/payrollController.js';

const router = Router();

router.get('/summary', getPayrollSummaryHandler);
router.post('/market-value', distributeMarketValueHandler);
router.get('/market-value', getMarketValueAllocationsHandler);
router.post('/advance', grantSalaryAdvanceHandler);
router.get('/advance', getSalaryAdvancesHandler);
router.post('/records', savePayrollRecordsHandler);
router.get('/records', getSavedPayrollRecordsHandler);

export default router;
