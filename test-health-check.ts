import { executeContentHealthCheck } from './server/content-health-check';

async function test() {
  console.log('Starting health check test...');
  try {
    const result = await executeContentHealthCheck(1, 'Test content');
    console.log('Health check result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Health check error:', error);
  }
}

test();
