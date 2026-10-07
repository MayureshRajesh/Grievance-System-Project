import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
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
    const { grievanceId, newStatus } = req.body;
    
    if (!grievanceId || !newStatus) {
      return res.status(400).json({ error: 'grievanceId and newStatus are required.' });
    }

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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
