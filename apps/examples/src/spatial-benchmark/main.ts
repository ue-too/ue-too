import { runBenchmark } from "@ue-too/dynamics";

console.log("🚀 Starting Spatial Index Benchmark...\n");

try {
    runBenchmark();
    console.log("\n✅ Benchmark completed! Check the results above.");
} catch (error) {
    console.log("❌ Error running benchmark:", error.message);
}