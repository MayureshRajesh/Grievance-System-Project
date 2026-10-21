import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { S3Client, PutObjectCommand, PutObjectTaggingCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { createClient } from '@supabase/supabase-js';
import { isHighlyNegative } from './comprehendService.js';
import { publishGrievanceMetrics, publishGrievanceMetricsSafe } from './metricsService.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
);

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

// Endpoint to create a new grievance with automated sentiment-based priority detection
app.post('/api/grievances', async (req, res) => {
  try {
    const {
      subject,
      title,
      description,
      category,
      user_id,
      user_email,
      location,
      privacy,
      image_url,
      s3_image_url,
      status,
      progress
    } = req.body;

    // Default priority for all new tickets
    let priority = "NORMAL";

    // Run the text through our AWS Comprehend utility
    const needsHighPriority = await isHighlyNegative(description);

    if (needsHighPriority) {
      priority = "HIGH"; // Automatically escalate the ticket!
    }

    // Save to Supabase database
    const grievanceRecord = {
      description,
      category,
      priority,
      title: title || subject || 'Untitled Grievance',
      ...(subject && { subject }),
      ...(user_id && { user_id }),
      ...(user_email && { user_email }),
      ...(location && { location }),
      ...(privacy && { privacy }),
      ...(image_url && { image_url }),
      ...(s3_image_url && { s3_image_url }),
      status: status || 'pending',
      progress: progress !== undefined ? progress : 0
    };

    // Use user-authenticated client if Authorization header was passed from frontend
    const authHeader = req.headers.authorization;
    const dbClient = authHeader
      ? createClient(
          process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
          process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
          { global: { headers: { Authorization: authHeader } } }
        )
      : supabase;

    let { data, error } = await dbClient
      .from('grievances')
      .insert([grievanceRecord])
      .select();

    // If Supabase table doesn't have the priority column yet, retry without it and warn
    if (error && error.message && error.message.includes("'priority' column")) {
      console.warn("⚠️ Note: Supabase 'grievances' table does not have a 'priority' column yet. Add it via SQL: ALTER TABLE grievances ADD COLUMN priority TEXT DEFAULT 'NORMAL';");
      const fallbackRecord = { ...grievanceRecord };
      delete fallbackRecord.priority;
      const retryResult = await dbClient
        .from('grievances')
        .insert([fallbackRecord])
        .select();

      if (!retryResult.error) {
        await publishGrievanceMetricsSafe();
        return res.status(201).json({
          message: "Grievance submitted (Notice: 'priority' column missing in Supabase schema cache)",
          data: retryResult.data,
          priority
        });
      }
      error = retryResult.error;
    }

    if (error) {
      console.error('Supabase error inserting grievance:', error);
      return res.status(500).json({ error: error.message || error });
    }

    // Awaited (not fire-and-forget) because Vercel may freeze the function after the response.
    await publishGrievanceMetricsSafe();

    res.status(201).json({ message: "Grievance submitted", data, priority });
  } catch (err) {
    console.error('Error creating grievance:', err);
    res.status(500).json({ error: 'Failed to create grievance.' });
  }
});

app.post('/api/presigned-url', async (req, res) => {
  try {
    const { fileName, fileType, fileSize } = req.body;

    // Validate size (max 2MB)
    const MAX_SIZE = 2 * 1024 * 1024;
    if (fileSize && fileSize > MAX_SIZE) {
      return res.status(400).json({ error: 'File size must be 2MB or less.' });
    }

    // Validate file type
    if (!fileType || (!fileType.startsWith('image/') && fileType !== 'application/pdf')) {
      return res.status(400).json({ error: 'Only images and PDFs are allowed.' });
    }

    const key = `uploads/${Date.now()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
      ContentType: fileType,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    const finalUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    res.json({ presignedUrl, finalUrl });
  } catch (err) {
    console.error('Error generating presigned URL:', err);
    res.status(500).json({ error: 'Failed to generate presigned URL.' });
  }
});

app.post('/api/notify-status', async (req, res) => {
  try {
    const { grievanceId, newStatus, s3ImageUrl } = req.body;
    
    if (!grievanceId || !newStatus) {
      return res.status(400).json({ error: 'grievanceId and newStatus are required.' });
    }

    // Tag the attachment so the S3 lifecycle rule (status=resolved -> Glacier) can pick it up.
    // Best-effort: a tagging failure must not block the status notification.
    if (s3ImageUrl) {
      try {
        const key = decodeURIComponent(new URL(s3ImageUrl).pathname.slice(1));
        const resolved = newStatus === 'resolved' || newStatus === 'closed';
        await s3Client.send(new PutObjectTaggingCommand({
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: key,
          Tagging: { TagSet: [{ Key: 'status', Value: resolved ? 'resolved' : 'active' }] },
        }));
      } catch (tagErr) {
        console.error('Failed to tag S3 object:', tagErr);
      }
    }

    await publishGrievanceMetricsSafe();

    const command = new PublishCommand({
      TopicArn: process.env.AWS_SNS_TOPIC_ARN,
      Message: `Your grievance ${grievanceId} status has been updated to ${newStatus}.`,
    });

    const snsClient = new SNSClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    });

    const result = await snsClient.send(command);
    res.json({ success: true, messageId: result.MessageId });
  } catch (err) {
    console.error('Error publishing SNS message:', err);
    res.status(500).json({ error: 'Failed to send notification.' });
  }
});

// Manually publish a fresh metrics snapshot (e.g. to seed the CloudWatch dashboard before a demo).
app.post('/api/metrics/publish', async (req, res) => {
  try {
    const snapshot = await publishGrievanceMetrics();
    res.json({ success: true, snapshot });
  } catch (err) {
    console.error('Error publishing metrics:', err);
    res.status(500).json({ error: 'Failed to publish metrics.' });
  }
});

app.post('/api/notify-new', async (req, res) => {
  try {
    const { title, category, userEmail } = req.body;
    
    if (!title || !category) {
      return res.status(400).json({ error: 'title and category are required.' });
    }

    const command = new PublishCommand({
      TopicArn: process.env.AWS_SNS_TOPIC_ARN,
      Message: `A new grievance titled "${title}" has been lodged under the "${category}" category by ${userEmail || 'a student'}.`,
    });

    const snsClient = new SNSClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    });

    const result = await snsClient.send(command);
    res.json({ success: true, messageId: result.MessageId });
  } catch (err) {
    console.error('Error publishing SNS message for new grievance:', err);
    res.status(500).json({ error: 'Failed to send notification.' });
  }
});

// Vercel invokes the exported app as a serverless function; only listen when run directly.
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

export default app;
