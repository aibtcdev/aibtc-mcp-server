#!/usr/bin/env node
/**
 * Test script for path pattern matching in lookupEndpoint
 */
import { lookupEndpoint } from './dist/endpoints/registry.js';

console.log('Testing path pattern matching in lookupEndpoint...\n');

const tests = [
  {
    name: 'POST /api/inbox/{address} with real address',
    method: 'POST',
    path: '/api/inbox/SP2ABC123',
    url: 'https://aibtc.com',
    expectedPath: '/api/inbox/{address}',
  },
  {
    name: 'GET /api/inbox/{address} with real address',
    method: 'GET',
    path: '/api/inbox/SP2ABC123XYZ',
    url: 'https://aibtc.com',
    expectedPath: '/api/inbox/{address}',
  },
  {
    name: 'DELETE /api/inbox/{address}/{messageId}',
    method: 'DELETE',
    path: '/api/inbox/SP2ABC123/msg-456',
    url: 'https://aibtc.com',
    expectedPath: '/api/inbox/{address}/{messageId}',
  },
  {
    name: 'Exact match: /api/market/stats',
    method: 'GET',
    path: '/api/market/stats',
    url: 'https://x402.biwas.xyz',
    expectedPath: '/api/market/stats',
  },
  {
    name: 'Pattern: /api/links/expand/{slug}',
    method: 'GET',
    path: '/api/links/expand/abc123',
    url: 'https://stx402.com',
    expectedPath: '/api/links/expand/{slug}',
  },
  {
    name: 'Pattern: /api/paste/{code}',
    method: 'GET',
    path: '/api/paste/xyz789',
    url: 'https://stx402.com',
    expectedPath: '/api/paste/{code}',
  },
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  const result = lookupEndpoint(test.method, test.path, test.url);

  if (!result) {
    console.log(`❌ FAIL: ${test.name}`);
    console.log(`   Expected path: ${test.expectedPath}`);
    console.log(`   Got: undefined\n`);
    failed++;
    continue;
  }

  if (result.path !== test.expectedPath) {
    console.log(`❌ FAIL: ${test.name}`);
    console.log(`   Expected path: ${test.expectedPath}`);
    console.log(`   Got path: ${result.path}\n`);
    failed++;
    continue;
  }

  console.log(`✅ PASS: ${test.name}`);
  console.log(`   Matched: ${result.method} ${result.path} (${result.source})`);
  console.log(`   Cost: ${result.cost}\n`);
  passed++;
}

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(50)}`);

process.exit(failed > 0 ? 1 : 0);
