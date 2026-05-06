import express from 'express';

import {
  startRun,
  addTrackPoint,
  addBatchTrackPoints,
  endRun,
  getMyRuns,
  getRunById,
} from '../controllers/runController.js';

import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.route('/').get(getMyRuns);

router.post('/start', startRun);

router.route('/:id').get(getRunById);

router.put('/:id/point', addTrackPoint);

router.put('/:id/batch-points', addBatchTrackPoints);

router.put('/:id/end', endRun);

export default router;