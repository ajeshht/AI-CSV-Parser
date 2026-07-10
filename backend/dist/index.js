"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const import_routes_1 = __importDefault(require("./routes/import.routes"));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Enable CORS for our frontend
app.use((0, cors_1.default)({
    origin: '*', // In production, restrict this to the frontend URL
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
// Generous payload limit to handle large CSV-to-JSON transfers
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ limit: '50mb', extended: true }));
// Register routes
app.use('/api/import', import_routes_1.default);
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
