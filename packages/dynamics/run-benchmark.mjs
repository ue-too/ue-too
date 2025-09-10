#!/usr/bin/env node

// Simple benchmark runner that works with ESM
import { runBenchmark } from './dist/index.js';

console.log('🚀 Starting Spatial Index Benchmark...\n');

try {
    runBenchmark();
    console.log('\n✅ Benchmark completed successfully!');
} catch (error) {
    console.error('❌ Error running benchmark:', error.message);
    process.exit(1);
}