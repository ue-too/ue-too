#!/usr/bin/env node

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

console.log('🚀 Running Spatial Index Benchmark...\n');

try {
    // Build the dynamics package first
    console.log('📦 Building dynamics package...');
    execSync('npm run build', {
        cwd: path.join(projectRoot, 'packages', 'dynamics'),
        stdio: 'inherit',
    });

    // Run the benchmark using the built package
    console.log('\n🏃 Executing benchmark...\n');

    // Create a simple test runner that imports the built benchmark
    const benchmarkRunner = `
import { SpatialIndexBenchmark } from './packages/dynamics/dist/index.js';

console.log('='.repeat(80));
console.log('SPATIAL INDEX BENCHMARK RESULTS');
console.log('='.repeat(80));

const benchmark = new SpatialIndexBenchmark();
benchmark.run();

console.log('\\n✅ Benchmark completed!');
`;

    // Write temporary runner
    import('fs').then(fs => {
        fs.writeFileSync(
            path.join(projectRoot, 'temp-benchmark-runner.mjs'),
            benchmarkRunner
        );

        // Execute the benchmark
        execSync('node temp-benchmark-runner.mjs', {
            cwd: projectRoot,
            stdio: 'inherit',
        });

        // Clean up
        fs.unlinkSync(path.join(projectRoot, 'temp-benchmark-runner.mjs'));
    });
} catch (error) {
    console.error('❌ Error running benchmark:', error.message);
    process.exit(1);
}
