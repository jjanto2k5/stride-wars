import mongoose from 'mongoose';

const battleHistorySchema = new mongoose.Schema(
  {
    challenger: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    defender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    runId: { type: mongoose.Schema.Types.ObjectId, ref: 'Run' },
    battleDate: { type: Date, default: Date.now },
  },
  { _id: false }
);

const territorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Territory name is required'],
      trim: true,
    },

    // Current owner
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // GeoJSON Polygon — the area boundary
    boundary: {
      type: {
        type: String,
        enum: ['Polygon'],
        default: 'Polygon',
      },
      coordinates: {
        // Array of rings; first ring = outer boundary [[lng,lat],...]
        type: [[[Number]]],
        required: true,
      },
    },

    // Area in square meters (computed on capture)
    area: { type: Number, default: 0 },

    // The run that originally captured this territory
    capturedByRun: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Run',
    },

    capturedAt: { type: Date, default: Date.now },

    // Defense score — increases each time owner re-runs through it
    defenseScore: { type: Number, default: 1 },

    // Color inherited from owner at capture time (for fast rendering)
    color: { type: String, default: '#3b82f6' },

    // Conquest history
    previousOwners: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        lostAt: Date,
      },
    ],

    battleHistory: [battleHistorySchema],

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Geospatial index for overlap queries
territorySchema.index({ boundary: '2dsphere' });
territorySchema.index({ owner: 1 });

const Territory = mongoose.model('Territory', territorySchema);
export default Territory;