import express from 'express';
import { getLeaderboard, getGlobalStats } from '../controllers/leaderboardController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', getLeaderboard);
router.get('/stats', getGlobalStats);

export default router;