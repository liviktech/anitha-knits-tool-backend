import { Router } from 'express';
import { distributeMarketValueHandler, getPayrollSummaryHandler, grantSalaryAdvanceHandler, updateSalaryAdvanceHandler, deleteSalaryAdvanceHandler, grantMarketValueDeductionHandler, grantOtherDeductionHandler, savePayrollRecordsHandler, updatePayrollRecordHandler, deletePayrollRecordHandler, getSavedPayrollRecordsHandler, getMarketValueAllocationsHandler, getSalaryAdvancesHandler } from '../controllers/payrollController.js';

const router = Router();

router.get('/summary', getPayrollSummaryHandler);
router.post('/market-value', distributeMarketValueHandler);
router.get('/market-value', getMarketValueAllocationsHandler);
router.post('/market-value-deduction', grantMarketValueDeductionHandler);
router.post('/other-deduction', grantOtherDeductionHandler);
router.post('/advance', grantSalaryAdvanceHandler);
router.get('/advance', getSalaryAdvancesHandler);
router.patch('/advance/:id', updateSalaryAdvanceHandler);
router.delete('/advance/:id', deleteSalaryAdvanceHandler);
router.post('/records', savePayrollRecordsHandler);
router.get('/records', getSavedPayrollRecordsHandler);
router.patch('/records/:employeeId', updatePayrollRecordHandler);
router.delete('/records/:employeeId', deletePayrollRecordHandler);

export default router;
