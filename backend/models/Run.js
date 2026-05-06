import mongoose from 'mongoose';

// A single GPS point: [longitude, latitude] (GeoJSON order)
const gpsPointSchema = new mongoose.Schema(
  {
    coordinates: {
      type: [Number], // [lng, lat]
      required: true,
    },
    altitude: Number,
    speed: Number,       // m/s
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const runSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // The full GPS track as a GeoJSON LineString for spatial queries
    route: {
      type: {
        type: String,
        enum: ['LineString'],
        default: 'LineString',
      },
      coordinates: {
        type: [[Number]],
        default: [], // ✅ allow empty initially
      },
    },

    // Raw timestamped GPS points for playback
    trackPoints: [gpsPointSchema],

    // Run metadata
    distance: { type: Number, default: 0 },     // meters
    duration: { type: Number, default: 0 },     // seconds
    avgSpeed: { type: Number, default: 0 },     // m/s
    maxSpeed: { type: Number, default: 0 },     // m/s
    calories: { type: Number, default: 0 },

    startTime: { type: Date },
    endTime: { type: Date },

    // Bounding box [minLng, minLat, maxLng, maxLat]
    bbox: { type: [Number], default: [] },

    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled'],
      default: 'active',
    },

    // Territories captured/affected in this run
    territoriesCaptured: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'Territory' },
    ],
  },
  { timestamps: true }
);

// Index for geospatial queries
runSchema.index(
  { route: '2dsphere' },
  {
    partialFilterExpression: {
      'route.coordinates.1': { $exists: true }, // at least 2 points
    },
  }
);
runSchema.index({ user: 1, createdAt: -1 });

const Run = mongoose.model('Run', runSchema);
export default Run;