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
    name: { type: String, required: [true, 'Territory name is required'], trim: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    boundary: {
      type: { type: String, enum: ['Polygon'], default: 'Polygon' },
      coordinates: { type: [[[Number]]], required: true },
    },
    area: { type: Number, default: 0 },
    capturedByRun: { type: mongoose.Schema.Types.ObjectId, ref: 'Run' },
    capturedAt: { type: Date, default: Date.now },
    defenseScore: { type: Number, default: 1 },
    color: { type: String, default: '#3b82f6' },
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

territorySchema.index({ boundary: '2dsphere' });
territorySchema.index({ owner: 1 });

const Territory = mongoose.model('Territory', territorySchema);

export default Territory;