import Run from '../models/Run.js';
import User from '../models/User.js';
import Territory from '../models/Territory.js';
import { runIntersectsTerritory, computeBbox, haversineDistance } from '../utils/geo.js';

// @route  POST /api/runs/start
// @access Private
export const startRun = async (req, res, next) => {
  try {
    const { startCoordinates } = req.body; // [lng, lat]

    if (!startCoordinates || startCoordinates.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 'startCoordinates [lng, lat] required',
      });
    }

    // Cancel any existing active run
    await Run.updateMany(
      { user: req.user._id, status: 'active' },
      { status: 'cancelled' }
    );

    const run = await Run.create({
      user: req.user._id,
      route: { type: 'LineString', coordinates: [] },
      trackPoints: [
        {
          coordinates: startCoordinates,
          timestamp: new Date(),
        },
      ],
      distance: 0,
      startTime: new Date(),
      status: 'active',
    });

    res.status(201).json({ success: true, run });
  } catch (err) {
    next(err);
  }
};

// @route  PUT /api/runs/:id/point
// @access Private
export const addTrackPoint = async (req, res, next) => {
  try {
    const { coordinates, altitude, speed } = req.body;

    if (!coordinates || coordinates.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 'coordinates [lng, lat] required',
      });
    }

    const run = await Run.findOne({
      _id: req.params.id,
      user: req.user._id,
      status: 'active',
    });

    if (!run) {
      return res.status(404).json({
        success: false,
        message: 'Active run not found',
      });
    }

    const points = run.trackPoints;

    // Incremental distance
    if (points.length > 0) {
      const last = points[points.length - 1].coordinates;
      run.distance += haversineDistance(
        last[1],
        last[0],
        coordinates[1],
        coordinates[0]
      );
    }

    run.trackPoints.push({
      coordinates,
      altitude,
      speed,
      timestamp: new Date(),
    });

    await run.save();

    res.status(200).json({
      success: true,
      distance: run.distance,
      points: run.trackPoints.length,
    });
  } catch (err) {
    next(err);
  }
};

// @route  PUT /api/runs/:id/end
// @access Private
export const endRun = async (req, res, next) => {
  try {
    const run = await Run.findOne({
      _id: req.params.id,
      user: req.user._id,
      status: 'active',
    });

    if (!run) {
      return res.status(404).json({
        success: false,
        message: 'Active run not found',
      });
    }

    if (run.trackPoints.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Not enough points to form a valid run',
      });
    }

    // Build route
    run.route.coordinates = run.trackPoints.map((p) => p.coordinates);

    run.endTime = new Date();
    run.duration = Math.floor((run.endTime - run.startTime) / 1000);

    run.avgSpeed = run.duration > 0 ? run.distance / run.duration : 0;
    run.maxSpeed = Math.max(...run.trackPoints.map((p) => p.speed || 0));

    run.calories = Math.round(run.distance * 0.06);

    run.bbox = computeBbox(run.route.coordinates);

    run.status = 'completed';

    // --- SIMPLE TERRITORY CAPTURE LOGIC ---
    const territories = await Territory.find({ isActive: true });

    const captured = [];

    for (const t of territories) {
      const polygon = t.boundary.coordinates[0];

      if (runIntersectsTerritory(run.route.coordinates, polygon)) {
        const isOwner =
          t.owner && t.owner.toString() === req.user._id.toString();

        if (!t.owner) {
          // Unclaimed → capture
          t.owner = req.user._id;
          t.defenseScore = 1;
        } else if (isOwner) {
          // Already yours → reinforce
          t.defenseScore = Math.min((t.defenseScore || 1) + 1, 10);
        } else {
          // Enemy → overwrite (simple mode)
          t.previousOwners.push({
            user: t.owner,
            lostAt: new Date(),
          });

          console.log("PreviousOwners AFTER PUSH:", t.previousOwners);

          t.owner = req.user._id;
          t.defenseScore = 1;
          t.color = req.user.color;
          t.capturedAt = new Date();
        }

        await t.save();
        captured.push(t._id);
      }
    }

    run.territoriesCaptured = captured;
    // --- END TERRITORY LOGIC ---

    await run.save();

    // Update user stats
    await User.findByIdAndUpdate(req.user._id, {
      $inc: {
        'stats.totalDistance': run.distance,
        'stats.totalDuration': run.duration,
        'stats.totalRuns': 1,
      },
    });

    res.status(200).json({ success: true, run });
  } catch (err) {
    next(err);
  }
};

// @route  GET /api/runs
// @access Private
export const getMyRuns = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const runs = await Run.find({
      user: req.user._id,
      status: 'completed',
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-trackPoints');

    const total = await Run.countDocuments({
      user: req.user._id,
      status: 'completed',
    });

    res.status(200).json({
      success: true,
      count: runs.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      runs,
    });
  } catch (err) {
    next(err);
  }
};

// @route  GET /api/runs/:id
// @access Private
export const getRunById = async (req, res, next) => {
  try {
    const run = await Run.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!run) {
      return res.status(404).json({
        success: false,
        message: 'Run not found',
      });
    }

    res.status(200).json({ success: true, run });
  } catch (err) {
    next(err);
  }
};