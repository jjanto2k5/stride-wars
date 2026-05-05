import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js';
import errorHandler from './middleware/error.js';

// Route imports
import authRoutes from './routes/authRoutes.js';
import runRoutes from './routes/runRoutes.js';
import territoryRoutes from './routes/territoryRoutes.js';
import leaderboardRoutes from './routes/leaderboardRoutes.js';

// Load env vars & connect to DB
dotenv.config();
console.log("MONGO_URI:", process.env.MONGO_URI);
connectDB();

const app = express();

// Body parser & CORS
app.use(express.json());
app.use(cors());

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/runs', runRoutes);
app.use('/api/territories', territoryRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Custom Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Stride Wars Server running on port ${PORT}`);
});