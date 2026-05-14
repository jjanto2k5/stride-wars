import Territory from '../models/Territory.js';
import Run from '../models/Run.js';
import User from '../models/User.js';
import { polygonArea, runIntersectsTerritory } from '../utils/geo.js';

// @route  POST /api/territories/capture
export const captureTerritory = async (req, res, next) => {
  try {
    const { runId, name, polygon } = req.body;

    if (!polygon || polygon.length < 3) {
      return res.status(400).json({ success: false, message: 'polygon must have at least 3 points' });
    }

    const coords = [...polygon];
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      coords.push(first);
    }

    const overlapping = await Territory.find({
      boundary: { $geoIntersects: { $geometry: { type: 'Polygon', coordinates: [coords] } } },
      isActive: true,
    }).populate('owner', 'name color');

    const contested = overlapping.filter((t) => t.owner._id.toString() !== req.user._id.toString());

    if (contested.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Territory overlaps with others — initiate a battle first',
        contested: contested.map((t) => ({ _id: t._id, name: t.name, owner: t.owner })),
      });
    }

    const area = polygonArea(coords);
    const territory = await Territory.create({
      name: name || `${req.user.name}'s Zone`,
      owner: req.user._id,
      boundary: { type: 'Polygon', coordinates: [coords] },
      area,
      capturedByRun: runId,
      color: req.user.color,
    });

    if (runId) {
      await Run.findByIdAndUpdate(runId, { $push: { territoriesCaptured: territory._id } });
    }

    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 'stats.territoriesCaptured': 1, 'stats.areaConquered': area },
    });

    res.status(201).json({ success: true, territory });
  } catch (err) {
    next(err);
  }
};

// @route  POST /api/territories/:id/conquer
export const conquerTerritory = async (req, res, next) => {
  try {
    const { runId } = req.body;
    const territory = await Territory.findById(req.params.id).populate('owner', 'name color');

    if (!territory || !territory.isActive) {
      return res.status(404).json({ success: false, message: 'Territory not found' });
    }

    if (territory.owner._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You already own this territory' });
    }

    if (runId) {
      const run = await Run.findById(runId);
      if (!run || !runIntersectsTerritory(run.route.coordinates, territory.boundary.coordinates[0])) {
        return res.status(400).json({ success: false, message: 'Your run does not intersect this territory' });
      }
    }

    const previousOwner = territory.owner._id;
    const challengerWins = territory.defenseScore < 3;

    const battleEntry = {
      challenger: req.user._id,
      defender: previousOwner,
      winner: challengerWins ? req.user._id : previousOwner,
      runId,
      battleDate: new Date(),
    };

    if (challengerWins) {
      territory.previousOwners.push({ user: previousOwner, lostAt: new Date() });
      territory.owner = req.user._id;
      territory.color = req.user.color;
      territory.defenseScore = 1;
      territory.capturedAt = new Date();

      await User.findByIdAndUpdate(req.user._id, { $inc: { 'stats.territoriesCaptured': 1, 'stats.battlesWon': 1 } });
      await User.findByIdAndUpdate(previousOwner, { $inc: { 'stats.territoriesLost': 1, 'stats.battlesLost': 1 } });
    } else {
      territory.defenseScore += 1;
      await User.findByIdAndUpdate(req.user._id, { $inc: { 'stats.battlesLost': 1 } });
      await User.findByIdAndUpdate(previousOwner, { $inc: { 'stats.battlesWon': 1 } });
    }

    territory.battleHistory.push(battleEntry);
    await territory.save();

    res.status(200).json({ success: true, result: challengerWins ? 'conquered' : 'defended', territory });
  } catch (err) {
    next(err);
  }
};

// @route  PUT /api/territories/:id/defend
export const defendTerritory = async (req, res, next) => {
  try {
    const territory = await Territory.findOne({ _id: req.params.id, owner: req.user._id });

    if (!territory) {
      return res.status(404).json({ success: false, message: 'Territory not found or not yours' });
    }

    territory.defenseScore = Math.min(territory.defenseScore + 1, 10);
    await territory.save();

    res.status(200).json({ success: true, territory });
  } catch (err) {
    next(err);
  }
};

// @route  GET /api/territories
export const getAllTerritories = async (req, res, next) => {
  try {
    let query = { isActive: true };

    if (req.query.bbox) {
      const [minLng, minLat, maxLng, maxLat] = req.query.bbox.split(',').map(Number);
      query.boundary = {
        $geoIntersects: {
          $geometry: {
            type: 'Polygon',
            coordinates: [[
              [minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat], [minLng, minLat]
            ]],
          },
        },
      };
    }

    const territories = await Territory.find(query)
      .populate('owner', 'name color avatar')
      .select('-battleHistory -previousOwners');

    res.status(200).json({ success: true, count: territories.length, territories });
  } catch (err) {
    next(err);
  }
};

// @route  GET /api/territories/mine
export const getMyTerritories = async (req, res, next) => {
  try {
    const territories = await Territory.find({ owner: req.user._id, isActive: true }).sort({ capturedAt: -1 });
    res.status(200).json({ success: true, count: territories.length, territories });
  } catch (err) {
    next(err);
  }
};

// @route  GET /api/territories/:id
export const getTerritoryById = async (req, res, next) => {
  try {
    const territory = await Territory.findById(req.params.id)
      .populate('owner', 'name color avatar')
      .populate('battleHistory.challenger', 'name')
      .populate('battleHistory.defender', 'name')
      .populate('previousOwners.user', 'name color');

    if (!territory) return res.status(404).json({ success: false, message: 'Territory not found' });
    
    res.status(200).json({ success: true, territory });
  } catch (err) {
    next(err);
  }
};