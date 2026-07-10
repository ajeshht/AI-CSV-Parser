import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import importRouter from './routes/import.routes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for our frontend
app.use(cors({
  origin: '*', // In production, restrict this to the frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Generous payload limit to handle large CSV-to-JSON transfers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Register routes
app.use('/api/import', importRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', provider: process.env.LLM_PROVIDER || 'gemini' });
});

// Start server
app.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(`GrowEasy CSV Importer Backend Running!`);
  console.log(`Port: ${PORT}`);
  console.log(`LLM Provider Configured: ${process.env.LLM_PROVIDER || 'gemini'}`);
  console.log(`=============================================`);
});
