/**
 * @type {import('rollup').RollupOptions}
 */
import typescript from '@rollup/plugin-typescript';
// import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

export default {
	input: 'src/index.ts',
	output: {
		file: 'dist/index.js',
		format: 'esm',
        sourcemap: true
	},
    plugins: [
        // nodeResolve({
        //     preferBuiltins: false,
        // }),
        typescript({
            tsconfig: 'tsconfig.json',
            outputToFilesystem: true,
            projectReferences: true,
            declarationMap: false,
            paths: undefined,
            allowImportingTsExtensions: false
        }),
        terser()
    ],
    external: ['@ue-too/math', '@ue-too/being']
};
