import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { listJobs, createJob, getJob, updateJob, cancelJob } from '../controllers/jobs.controller';

const router = Router();

router.get('/',        listJobs);
router.post('/',       requireAuth, requireRole('CLINIC', 'ADMIN'), createJob);
router.get('/:jobId',  getJob);
router.put('/:jobId',  requireAuth, updateJob);
router.delete('/:jobId', requireAuth, cancelJob);

export default router;
