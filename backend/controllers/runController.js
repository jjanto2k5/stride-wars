import Run from '../models/Run.js';
import User from '../models/User.js';
import { computeBbox, haversineDistance } from '../utils/geo.js';

// @route  POST /api/runs/start
// @access Private
export const startRun = async (req, res, next) => {
  try {
    const { startCoordinates } = req.body; // [lng, lat]

    if (!startCoordinates || startCoordinates.length !== 2) {
      return res.status(400).json({ success: false, message: 'startCoordinates [lng, lat] required' });
    }

    // Cancel any existing active run for this user
    await Run.updateMany(
      { user: req.user._id, status: 'active' },
      { status: 'cancelled' }
    );

    const run = await Run.create({
      user: req.user._id,
      route: { type: 'LineString', coordinates: [startCoordinates] },
      trackPoints: [{ coordinates: startCoordinates, timestamp: new Date() }],
      startTime: new Date(),
      status: 'active',
    });

    res.status(201).json({ success: true, run });
  } catch (err) {
    next(err);
  }
};

// @route  PUT /api/runs/:id/point
// @access Private — called frequently from frontend (every ~3 seconds)
export const addTrackPoint = async (req, res, next) => {
  try {
    const { coordinates, altitude, speed } = req.body; // [lng, lat]

    const run = await Run.findOne({ _id: req.params.id, user: req.user._id, status: 'active' });
    if (!run) {
      return res.status(404).json({ success: false, message: 'Active run not found' });
    }

    // Append to LineString
    run.route.coordinates.push(coordinates);
    run.trackPoints.push({ coordinates, altitude, speed, timestamp: new Date() });

    // Incrementally update distance
    const coords = run.route.coordinates;
    if (coords.length >= 2) {
      const last = coords[coords.length - 2];
      const curr = coords[coords.length - 1];
      run.distance += haversineDistance(last[1], last[0], curr[1], curr[0]);
    }

    await run.save();
    res.status(200).json({ success: true, distance: run.distance });
  } catch (err) {
    next(err);
  }
};

// @route  PUT /api/runs/:id/end
// @access Private
export const endRun = async (req, res, next) => {
  try {
    const run = await Run.findOne({ _id: req.params.id, user: req.user._id, status: 'active' });
    if (!run) {
      return res.status(404).json({ success: false, message: 'Active run not found' });
    }

    run.endTime = new Date();
    run.duration = Math.floor((run.endTime - run.startTime) / 1000);
    run.avgSpeed = run.duration > 0 ? run.distance / run.duration : 0;
    run.maxSpeed = Math.max(...run.trackPoints.map((p) => p.speed || 0));
    run.calories = Math.round(run.distance * 0.06); // rough estimate
    run.bbox = computeBbox(run.route.coordinates);
    run.status = 'completed';

    await run.save();

    // Update user aggregate stats
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

    const runs = await Run.find({ user: req.user._id, status: 'completed' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-trackPoints'); // omit heavy point data in list view

    const total = await Run.countDocuments({ user: req.user._id, status: 'completed' });

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
    const run = await Run.findOne({ _id: req.params.id, user: req.user._id });
    if (!run) return res.status(404).json({ success: false, message: 'Run not found' });
    res.status(200).json({ success: true, run });
  } catch (err) {
    next(err);
  }
};