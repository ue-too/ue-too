/**
 * @type {import('rollup').RollupOptions}
 */
// import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

export default {
    input: 'src/index.ts',
    output: {
        file: 'dist/index.js',
        format: 'esm',
        sourcemap: true,
    },
    plugins: [
        // nodeResolve({
        //     preferBuiltins: false,
        // }),
        typescript({
            tsconfig: 'tsconfig.json',
            outputToFilesystem: true,
            declarationMap: false,
            paths: undefined,
            allowImportingTsExtensions: false,
        }),
        terser(),
    ],
    external: ['@ue-too/math', '@ue-too/being'],
};
