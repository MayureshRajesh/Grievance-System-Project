// One-off setup: publishes a fresh metrics snapshot, then creates/updates the CloudWatch dashboard.
// Usage: npm run metrics:dashboard
import dotenv from 'dotenv';
import { CloudWatchClient, PutDashboardCommand } from '@aws-sdk/client-cloudwatch';
import { publishGrievanceMetrics, METRIC_NAMESPACE } from '../metricsService.js';

dotenv.config();

const DASHBOARD_NAME = 'Grievance-System';
const region = process.env.AWS_REGION;

// SEARCH picks up every dimension value automatically, so new categories/locations appear without edits.
const searchByDimension = (dimension) =>
  `SEARCH('{${METRIC_NAMESPACE},${dimension}} MetricName="GrievanceCount"', 'Maximum', 60)`;

const searchWidget = (title, dimension, view, x, y, width, height) => ({
  type: 'metric',
  x, y, width, height,
  properties: {
    title,
    region,
    view,
    stat: 'Maximum',
    period: 60,
    liveData: true,
    // false = show the latest snapshot rather than aggregating over the whole time range.
    setPeriodToTimeRange: false,
    metrics: [[{ expression: searchByDimension(dimension), id: dimension.toLowerCase() }]],
  },
});

const singleValueWidget = (title, metricName, label, x) => ({
  type: 'metric',
  x, y: 0, width: 6, height: 5,
  properties: {
    title, region, view: 'singleValue', stat: 'Maximum', period: 60,
    liveData: true, setPeriodToTimeRange: false,
    metrics: [[METRIC_NAMESPACE, metricName, { label }]],
  },
});

const dashboardBody = {
  start: '-P7D',
  widgets: [
    singleValueWidget('Total grievances', 'TotalGrievances', 'Total', 0),
    singleValueWidget('Average resolution time (hours)', 'AverageResolutionHours', 'Avg hours to resolve', 6),
    searchWidget('Grievances by status', 'Status', 'pie', 12, 0, 12, 7),
    searchWidget('Grievances by category', 'Category', 'bar', 0, 5, 12, 8),
    searchWidget('Grievances by location', 'Location', 'bar', 12, 7, 12, 8),
    searchWidget('Status over time', 'Status', 'timeSeries', 0, 13, 12, 7),
    {
      type: 'metric', x: 12, y: 15, width: 12, height: 7,
      properties: {
        title: 'Average resolution time trend (hours)', region, view: 'timeSeries', stat: 'Maximum', period: 300,
        liveData: true,
        metrics: [[METRIC_NAMESPACE, 'AverageResolutionHours', { label: 'Avg hours' }]],
      },
    },
  ],
};

const snapshot = await publishGrievanceMetrics();
console.log('Published metrics snapshot:', JSON.stringify(snapshot, null, 2));

const cloudWatch = new CloudWatchClient({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});
await cloudWatch.send(new PutDashboardCommand({
  DashboardName: DASHBOARD_NAME,
  DashboardBody: JSON.stringify(dashboardBody),
}));

console.log(`Dashboard ready: https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#dashboards/dashboard/${DASHBOARD_NAME}`);
