import { Router } from 'express';
import { distributeMarketValueHandler, getPayrollSummaryHandler, grantSalaryAdvanceHandler, grantMarketValueDeductionHandler, savePayrollRecordsHandler, updatePayrollRecordHandler, deletePayrollRecordHandler, getSavedPayrollRecordsHandler, getMarketValueAllocationsHandler, getSalaryAdvancesHandler } from '../controllers/payrollController.js';

const router = Router();

router.get('/summary', getPayrollSummaryHandler);
router.post('/market-value', distributeMarketValueHandler);
router.get('/market-value', getMarketValueAllocationsHandler);
router.post('/market-value-deduction', grantMarketValueDeductionHandler);
router.post('/advance', grantSalaryAdvanceHandler);
router.get('/advance', getSalaryAdvancesHandler);
router.post('/records', savePayrollRecordsHandler);
router.get('/records', getSavedPayrollRecordsHandler);
router.patch('/records/:employeeId', updatePayrollRecordHandler);
router.delete('/records/:employeeId', deletePayrollRecordHandler);

export default router;
