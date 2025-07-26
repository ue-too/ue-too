/**
 * @type {import('rollup').RollupOptions}
 */
import typescript from '@rollup/plugin-typescript';

export default {
	input: 'src/index.ts',
	output: {
		file: 'dist/index.js',
		format: 'esm',
        sourcemap: true
	},
    plugins: [
        typescript({
            tsconfig: 'tsconfig.json',
            outputToFilesystem: true,
            projectReferences: true,
        })
    ],
    external: ['@ue-too/math', '@ue-too/being']
};
