import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { createClient } from '@supabase/supabase-js';

export const METRIC_NAMESPACE = 'GrievanceSystem';

// Clients are created lazily: ES imports run before server.js calls dotenv.config().
let cloudWatch;
let adminDb;

const getCloudWatch = () => {
  cloudWatch ??= new CloudWatchClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
  });
  return cloudWatch;
};

// Aggregates must count every grievance, so this needs the service role key (bypasses RLS).
// Server-only: never expose it with a VITE_ prefix.
const getAdminDb = () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set; cannot compute metrics.');
  }
  adminDb ??= createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  return adminDb;
};

const RESOLVED_STATUSES = ['resolved', 'closed'];

// Legacy rows use 'wifi/network'; fold them into the canonical value.
const normalizeCategory = (category) => {
  const value = (category || 'other').toLowerCase();
  return value === 'wifi/network' ? 'wifi_network' : value;
};

const countBy = (rows, getKey) =>
  rows.reduce((acc, row) => {
    const key = getKey(row);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

/**
 * Recomputes grievance aggregates from Supabase and publishes a snapshot to CloudWatch:
 * GrievanceCount by Category / Location / Status, TotalGrievances and AverageResolutionHours.
 * @returns {Promise<object>} The published snapshot.
 */
export async function publishGrievanceMetrics() {
  const { data: rows, error } = await getAdminDb()
    .from('grievances')
    .select('category, location, status, created_at, updated_at, resolved_at');

  if (error) throw new Error(`Supabase query failed: ${error.message}`);

  const byCategory = countBy(rows, (r) => normalizeCategory(r.category));
  const byLocation = countBy(rows, (r) => r.location || 'unspecified');
  const byStatus = countBy(rows, (r) => r.status || 'pending');

  // Resolution time = resolved_at - created_at. Rows resolved before resolved_at existed fall back to updated_at.
  const resolutionHours = rows
    .filter((r) => RESOLVED_STATUSES.includes(r.status))
    .map((r) => (new Date(r.resolved_at || r.updated_at) - new Date(r.created_at)) / 36e5)
    .filter((h) => Number.isFinite(h) && h >= 0);
  const avgResolutionHours = resolutionHours.length
    ? resolutionHours.reduce((sum, h) => sum + h, 0) / resolutionHours.length
    : 0;

  const timestamp = new Date();
  const countDatum = (dimension, value, count) => ({
    MetricName: 'GrievanceCount',
    Dimensions: [{ Name: dimension, Value: value }],
    Value: count,
    Unit: 'Count',
    Timestamp: timestamp,
  });

  const metricData = [
    ...Object.entries(byCategory).map(([k, v]) => countDatum('Category', k, v)),
    ...Object.entries(byLocation).map(([k, v]) => countDatum('Location', k, v)),
    ...Object.entries(byStatus).map(([k, v]) => countDatum('Status', k, v)),
    { MetricName: 'TotalGrievances', Value: rows.length, Unit: 'Count', Timestamp: timestamp },
    { MetricName: 'AverageResolutionHours', Value: avgResolutionHours, Unit: 'None', Timestamp: timestamp },
  ];

  await getCloudWatch().send(new PutMetricDataCommand({
    Namespace: METRIC_NAMESPACE,
    MetricData: metricData,
  }));

  return { total: rows.length, byCategory, byLocation, byStatus, avgResolutionHours };
}

// Best-effort wrapper for request handlers: metrics must never break the main flow.
export async function publishGrievanceMetricsSafe() {
  try {
    await publishGrievanceMetrics();
  } catch (err) {
    console.error('Failed to publish CloudWatch metrics:', err.message);
  }
}
