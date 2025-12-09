const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  sourcemap: 'external',
  external: [],
});

if (!result.success) {
  console.error("Build failed");
  for (const message of result.logs) {
    console.error(message);
  }
} else {
  console.log("Build successful");

  // Generate declaration files
  console.log("Generating declaration files...");
  const tsc = Bun.spawnSync(["bun", "x", "tsc", "--emitDeclarationOnly", "--declaration"]);

  if (!tsc.success) {
    console.error("Type generation failed");
    console.error(tsc.stderr.toString());
    console.error(tsc.stdout.toString());
    process.exit(1);
  } else {
    console.log("Types generated successfully");
  }
}

export {};
