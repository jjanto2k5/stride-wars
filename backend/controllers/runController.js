import Run from '../models/Run.js';
import User from '../models/User.js';
import Territory from '../models/Territory.js';

import {
  runIntersectsTerritory,
  computeBbox,
  haversineDistance,
} from '../utils/geo.js';

// ======================================================
// START RUN
// @route  POST /api/runs/start
// @access Private
// ======================================================

export const startRun = async (req, res, next) => {
  try {
    const { startCoordinates } = req.body; // [lng, lat]

    if (!startCoordinates || startCoordinates.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 'startCoordinates [lng, lat] required',
      });
    }

    // Cancel any existing active runs
    await Run.updateMany(
      {
        user: req.user._id,
        status: 'active',
      },
      {
        status: 'cancelled',
      }
    );

    const run = await Run.create({
      user: req.user._id,

      route: {
        type: 'LineString',

        /**
         * IMPORTANT:
         * Keep route + trackPoints synchronized
         * from the beginning.
         */
        coordinates: [startCoordinates],
      },

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

    res.status(201).json({
      success: true,
      run,
    });
  } catch (err) {
    next(err);
  }
};

// ======================================================
// SINGLE TRACK POINT
// @route  PUT /api/runs/:id/point
// @access Private
// ======================================================

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

    const lastCoordinate =
      run.route.coordinates[
        run.route.coordinates.length - 1
      ];

    // ======================================================
    // INCREMENTAL DISTANCE
    // ======================================================

    if (lastCoordinate) {
      run.distance += haversineDistance(
        lastCoordinate[1],
        lastCoordinate[0],
        coordinates[1],
        coordinates[0]
      );
    }

    // ======================================================
    // ROUTE
    // ======================================================

    run.route.coordinates.push(coordinates);

    // ======================================================
    // TRACK POINTS
    // ======================================================

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

// ======================================================
// BATCH TRACK POINTS
// @route  PUT /api/runs/:id/batch-points
// @access Private
// ======================================================

export const addBatchTrackPoints = async (
  req,
  res,
  next
) => {
  try {
    const { points } = req.body;

    // ======================================================
    // EMPTY BATCH
    // ======================================================

    if (!points || points.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No points to add',
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

    // ======================================================
    // PROCESS BATCH
    // ======================================================

    points.forEach((p) => {
      // ------------------------------------------
      // VALIDATE POINT
      // ------------------------------------------

      if (
        !p.coordinates ||
        p.coordinates.length !== 2
      ) {
        return;
      }

      const coords = run.route.coordinates;

      const previous =
        coords.length > 0
          ? coords[coords.length - 1]
          : null;

      // ------------------------------------------
      // ROUTE
      // ------------------------------------------

      coords.push(p.coordinates);

      // ------------------------------------------
      // TRACK POINT
      // ------------------------------------------

      run.trackPoints.push({
        coordinates: p.coordinates,

        speed: p.speed || 0,

        altitude: p.altitude || 0,

        timestamp: p.timestamp
          ? new Date(p.timestamp)
          : new Date(),
      });

      // ------------------------------------------
      // INCREMENTAL DISTANCE
      // ------------------------------------------

      /**
       * IMPORTANT:
       * Backend calculates ALL official distance.
       *
       * Frontend NEVER calculates distance because:
       * - prevents cheating
       * - avoids GPS drift inconsistencies
       * - keeps leaderboard fair
       * - ensures territory calculations are authoritative
       */

      if (previous) {
        run.distance += haversineDistance(
          previous[1],
          previous[0],
          p.coordinates[1],
          p.coordinates[0]
        );
      }
    });

    // ======================================================
    // SAVE
    // ======================================================

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

// ======================================================
// END RUN
// @route  PUT /api/runs/:id/end
// @access Private
// ======================================================

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
        message:
          'Not enough points to form a valid run',
      });
    }

    run.endTime = new Date();

    run.duration = Math.floor(
      (run.endTime - run.startTime) / 1000
    );

    run.avgSpeed =
      run.duration > 0
        ? run.distance / run.duration
        : 0;

    run.maxSpeed = Math.max(
      ...run.trackPoints.map((p) => p.speed || 0)
    );

    run.calories = Math.round(
      run.distance * 0.06
    );

    run.bbox = computeBbox(
      run.route.coordinates
    );

    run.status = 'completed';

    // ======================================================
    // TERRITORY CAPTURE LOGIC
    // ======================================================

    const territories = await Territory.find({
      isActive: true,
    });

    const captured = [];

    for (const t of territories) {
      const polygon =
        t.boundary.coordinates[0];

      if (
        runIntersectsTerritory(
          run.route.coordinates,
          polygon
        )
      ) {
        const isOwner =
          t.owner &&
          t.owner.toString() ===
            req.user._id.toString();

        // ------------------------------------------
        // UNCLAIMED
        // ------------------------------------------

        if (!t.owner) {
          t.owner = req.user._id;

          t.defenseScore = 1;

          t.color = req.user.color;

          t.capturedAt = new Date();
        }

        // ------------------------------------------
        // REINFORCE
        // ------------------------------------------

        else if (isOwner) {
          t.defenseScore = Math.min(
            (t.defenseScore || 1) + 1,
            10
          );
        }

        // ------------------------------------------
        // CAPTURE ENEMY
        // ------------------------------------------

        else {
          t.previousOwners.push({
            user: t.owner,
            lostAt: new Date(),
          });

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

    await run.save();

    // ======================================================
    // UPDATE USER STATS
    // ======================================================

    await User.findByIdAndUpdate(
      req.user._id,
      {
        $inc: {
          'stats.totalDistance': run.distance,

          'stats.totalDuration': run.duration,

          'stats.totalRuns': 1,
        },
      }
    );

    res.status(200).json({
      success: true,
      run,
    });
  } catch (err) {
    next(err);
  }
};

// ======================================================
// GET MY RUNS
// @route  GET /api/runs
// @access Private
// ======================================================

export const getMyRuns = async (
  req,
  res,
  next
) => {
  try {
    const page =
      parseInt(req.query.page) || 1;

    const limit =
      parseInt(req.query.limit) || 10;

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

// ======================================================
// GET RUN BY ID
// @route  GET /api/runs/:id
// @access Private
// ======================================================

export const getRunById = async (
  req,
  res,
  next
) => {
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

    res.status(200).json({
      success: true,
      run,
    });
  } catch (err) {
    next(err);
  }
};