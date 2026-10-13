import { isHighlyNegative } from './comprehendService.js';
import { ComprehendClient, DetectSentimentCommand } from '@aws-sdk/client-comprehend';
import dotenv from 'dotenv';

dotenv.config();

console.log('--- Testing AWS Comprehend Integration ---\n');

const client = new ComprehendClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined
});

async function runDetailedCheck(sampleText, label) {
  console.log(`[Test: ${label}]`);
  console.log(`Input text: "${sampleText}"`);

  try {
    const command = new DetectSentimentCommand({
      LanguageCode: 'en',
      Text: sampleText.substring(0, 1000)
    });
    const response = await client.send(command);
    console.log(`AWS Sentiment: ${response.Sentiment}`);
    console.log(`Scores:`, response.SentimentScore);
    const isEscalated = response.Sentiment === 'NEGATIVE' && response.SentimentScore.Negative > 0.80;
    console.log(`Should set priority to HIGH? -> ${isEscalated ? 'YES (HIGH)' : 'NO (NORMAL)'}\n`);
  } catch (err) {
    console.error(`AWS Comprehend error: ${err.name} - ${err.message}`);
    if (err.name === 'SubscriptionRequiredException') {
      console.log('ℹ️ Tip: Your AWS Account or IAM user needs an active subscription/permission for Amazon Comprehend.');
    }
    console.log();
  }
}

async function main() {
  await runDetailedCheck(
    'The classroom projector bulb is flickering occasionally during class.',
    'Mild / Neutral Issue'
  );

  await runDetailedCheck(
    'This situation is absolutely intolerable, completely dangerous, disgusting, and horrible! Students are in severe danger!',
    'Severe / Highly Negative Issue'
  );

  console.log('Testing isHighlyNegative utility wrapper:');
  const result = await isHighlyNegative('Terrible horrible dangerous emergency situation!');
  console.log('isHighlyNegative returned:', result);
}

main();
