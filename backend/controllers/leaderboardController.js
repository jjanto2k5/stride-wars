import User from '../models/User.js';
import Territory from '../models/Territory.js';

const computeScore = (stats, territoriesOwned) => {
  return Math.round(
    stats.totalDistance * 0.01 +
    stats.areaConquered * 0.001 +
    territoriesOwned * 500 +
    stats.battlesWon * 200
  );
};

// @route  GET /api/leaderboard
export const getLeaderboard = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const territoryCounts = await Territory.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$owner', count: { $sum: 1 }, totalArea: { $sum: '$area' } } },
    ]);

    const territoryMap = {};
    territoryCounts.forEach((t) => {
      territoryMap[t._id.toString()] = { count: t.count, totalArea: t.totalArea };
    });

    const users = await User.find({ isActive: true, role: 'user' })
      .select('name avatar color stats createdAt')
      .lean();

    const entries = users.map((u) => {
      const owned = territoryMap[u._id.toString()] || { count: 0, totalArea: 0 };
      return {
        user: { _id: u._id, name: u.name, avatar: u.avatar, color: u.color },
        totalDistance: u.stats.totalDistance,
        totalDuration: u.stats.totalDuration,
        areaConquered: owned.totalArea,
        territoriesOwned: owned.count,
        battlesWon: u.stats.battlesWon,
        score: computeScore(u.stats, owned.count),
      };
    });

    entries.sort((a, b) => b.score - a.score);

    const ranked = entries.slice(0, limit).map((e, i) => ({ ...e, rank: i + 1 }));
    const myRank = entries.findIndex((e) => e.user._id.toString() === req.user._id.toString()) + 1;

    res.status(200).json({ success: true, leaderboard: ranked, myRank, total: entries.length });
  } catch (err) {
    next(err);
  }
};

// @route  GET /api/leaderboard/stats
export const getGlobalStats = async (req, res, next) => {
  try {
    const [userCount, territoryCount, distanceAgg] = await Promise.all([
      User.countDocuments({ isActive: true, role: 'user' }),
      Territory.countDocuments({ isActive: true }),
      User.aggregate([{ $group: { _id: null, total: { $sum: '$stats.totalDistance' } } }]),
    ]);

    res.status(200).json({
      success: true,
      stats: {
        totalPlayers: userCount,
        totalTerritories: territoryCount,
        totalDistanceCovered: distanceAgg[0]?.total || 0,
      },
    });
  } catch (err) {
    next(err);
  }
};