import express from 'express';
import { startRun, addTrackPoint, endRun, getMyRuns, getRunById } from '../controllers/runController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to all run routes
router.use(protect); 

router.route('/').get(getMyRuns);
router.post('/start', startRun);
router.route('/:id').get(getRunById);
router.put('/:id/point', addTrackPoint);
router.put('/:id/end', endRun);

export default router;