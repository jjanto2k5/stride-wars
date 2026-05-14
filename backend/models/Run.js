import mongoose from 'mongoose';

const gpsPointSchema = new mongoose.Schema(
  {
    coordinates: { type: [Number], required: true }, // [lng, lat]
    altitude: Number,
    speed: Number,
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const runSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    route: {
      type: { type: String, enum: ['LineString'], default: 'LineString' },
      coordinates: { type: [[Number]], default: [] },
    },
    trackPoints: [gpsPointSchema],
    distance: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
    avgSpeed: { type: Number, default: 0 },
    maxSpeed: { type: Number, default: 0 },
    calories: { type: Number, default: 0 },
    startTime: { type: Date },
    endTime: { type: Date },
    bbox: { type: [Number], default: [] },
    status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
    territoriesCaptured: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Territory' }],
  },
  { timestamps: true }
);

// 2dsphere index requires at least 2 points (a valid LineString)
runSchema.index(
  { route: '2dsphere' },
  { partialFilterExpression: { 'route.coordinates.1': { $exists: true } } }
);
runSchema.index({ user: 1, createdAt: -1 });

const Run = mongoose.model('Run', runSchema);

export default Run;