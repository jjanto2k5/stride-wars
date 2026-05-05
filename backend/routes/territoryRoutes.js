import express from 'express';
import { captureTerritory, conquerTerritory, defendTerritory, getAllTerritories, getMyTerritories, getTerritoryById } from '../controllers/territoryController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to all territory routes
router.use(protect);

router.route('/').get(getAllTerritories);
router.post('/capture', captureTerritory);
router.get('/mine', getMyTerritories);
router.route('/:id').get(getTerritoryById);
router.post('/:id/conquer', conquerTerritory);
router.put('/:id/defend', defendTerritory);

export default router;