"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ai_service_1 = require("../services/ai.service");
const multer_1 = __importDefault(require("multer"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const stream_1 = require("stream");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit
/**
 * Endpoint 1: Preview CSV Upload
 * Parses the uploaded CSV file and returns the first 10 rows as raw JSON.
 * No AI processing happens here.
 */
router.post('/preview', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }
        const results = [];
        const bufferStream = new stream_1.Readable();
        bufferStream.push(req.file.buffer);
        bufferStream.push(null); // End of stream
        bufferStream
            .pipe((0, csv_parser_1.default)())
            .on('data', (data) => results.push(data))
            .on('end', () => {
            // Return first 20 records for a comprehensive preview
            const previewRows = results.slice(0, 20);
            res.json({
                headers: results.length > 0 ? Object.keys(results[0]) : [],
                totalRows: results.length,
                preview: previewRows
            });
        })
            .on('error', (err) => {
            res.status(500).json({ error: 'Failed to parse CSV file: ' + err.message });
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/**
 * Endpoint 2: Batch Process CSV Records with AI Mapping
 * Accept JSON array of records, processes them in batches, and streams progress using SSE.
 */
router.post('/process', async (req, res) => {
    const { records, batchSize = 10 } = req.body;
    if (!records || !Array.isArray(records)) {
        res.status(400).json({ error: 'Invalid payload: "records" must be a JSON array' });
        return;
    }
    // Setup Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for Nginx if deployed
    const sendEvent = (type, payload) => {
        res.write(`data: ${JSON.stringify({ type, payload })}\n\n`);
    };
    sendEvent('info', { message: `Started processing ${records.length} records...` });
    const totalCount = records.length;
    const totalBatches = Math.ceil(totalCount / batchSize);
    const allMapped = [];
    const allSkipped = [];
    try {
        for (let i = 0; i < totalBatches; i++) {
            const start = i * batchSize;
            const end = Math.min(start + batchSize, totalCount);
            const batchRecords = records.slice(start, end);
            sendEvent('info', { message: `Processing batch ${i + 1}/${totalBatches} (records ${start + 1} to ${end})...` });
            // Run AI processing for this batch
            const batchResult = await ai_service_1.AIService.processBatch(batchRecords, start);
            allMapped.push(...batchResult.mapped);
            allSkipped.push(...batchResult.skipped);
            // Emit incremental update
            sendEvent('progress', {
                batchIndex: i,
                totalBatches,
                processedCount: end,
                totalCount,
                mappedCount: allMapped.length,
                skippedCount: allSkipped.length,
                currentBatchMapped: batchResult.mapped,
                currentBatchSkipped: batchResult.skipped
            });
            // Avoid hitting API rate limits with a small gap between batches
            if (i < totalBatches - 1) {
                await new Promise((resolve) => setTimeout(resolve, 800));
            }
        }
        // Complete processing
        sendEvent('complete', {
            totalImported: allMapped.length,
            totalSkipped: allSkipped.length,
            mapped: allMapped,
            skipped: allSkipped
        });
        res.end();
    }
    catch (error) {
        console.error('Error in batch processing:', error);
        sendEvent('error', { message: 'An error occurred during batch processing: ' + error.message });
        res.end();
    }
});
exports.default = router;
