import { Router, Request, Response } from 'express';
import { AIService, CRMLead } from '../services/ai.service';
import multer from 'multer';
import csvParser from 'csv-parser';
import { Readable } from 'stream';

const router = Router();
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

/**
 * Endpoint 1: Preview CSV Upload
 * Parses the uploaded CSV file and returns the first 10 rows as raw JSON.
 * No AI processing happens here.
 */
router.post('/preview', upload.single('file'), (req: Request, res: Response): void => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const results: any[] = [];
    const bufferStream = new Readable();
    bufferStream.push(req.file.buffer);
    bufferStream.push(null); // End of stream

    bufferStream
      .pipe(csvParser())
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint 2: Batch Process CSV Records with AI Mapping
 * Accept JSON array of records, processes them in batches, and streams progress using SSE.
 */
router.post('/process', async (req: Request, res: Response): Promise<void> => {
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

  const sendEvent = (type: string, payload: any) => {
    res.write(`data: ${JSON.stringify({ type, payload })}\n\n`);
  };

  sendEvent('info', { message: `Started processing ${records.length} records...` });

  const totalCount = records.length;
  const totalBatches = Math.ceil(totalCount / batchSize);
  const allMapped: CRMLead[] = [];
  const allSkipped: any[] = [];

  try {
    for (let i = 0; i < totalBatches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, totalCount);
      const batchRecords = records.slice(start, end);

      sendEvent('info', { message: `Processing batch ${i + 1}/${totalBatches} (records ${start + 1} to ${end})...` });

      // Run AI processing for this batch
      const batchResult = await AIService.processBatch(batchRecords, start);

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
  } catch (error: any) {
    console.error('Error in batch processing:', error);
    sendEvent('error', { message: 'An error occurred during batch processing: ' + error.message });
    res.end();
  }
});

export default router;
