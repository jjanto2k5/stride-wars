import mongoose from 'mongoose';

// Leaderboard is recomputed periodically (or on-demand) and cached here
const leaderboardEntrySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    rank: { type: Number },
    totalDistance: { type: Number, default: 0 },
    totalDuration: { type: Number, default: 0 },
    areaConquered: { type: Number, default: 0 },
    territoriesOwned: { type: Number, default: 0 },
    battlesWon: { type: Number, default: 0 },
    score: { type: Number, default: 0 }, // composite score
  },
  { _id: false }
);

const leaderboardSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['global', 'regional'],
      default: 'global',
    },
    region: {
      // for regional boards — store a bounding box or city name
      name: String,
      bbox: [Number], // [minLng, minLat, maxLng, maxLat]
    },
    period: {
      type: String,
      enum: ['alltime', 'weekly', 'monthly'],
      default: 'alltime',
    },
    entries: [leaderboardEntrySchema],
    computedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Leaderboard = mongoose.model('Leaderboard', leaderboardSchema);
export default Leaderboard;