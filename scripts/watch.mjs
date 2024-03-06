#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */

import { context } from 'esbuild';
import less from '@arnog/esbuild-plugin-less';

import pkg from '../package.json' assert { type: 'json' };

process.env.BUILD = 'development';
const PRODUCTION = false;
const SDK_VERSION = pkg.version || 'v?.?.?';

const BUILD_OPTIONS = {
  banner: {
    js: `/** MathLive ${SDK_VERSION} ${
      process.env.GIT_VERSION ? ' -- ' + process.env.GIT_VERSION : ''
    }*/`,
  },
  bundle: true,
  define: {
    ENV: JSON.stringify(process.env.BUILD),
    SDK_VERSION: JSON.stringify(SDK_VERSION),
    GIT_VERSION: JSON.stringify(process.env.GIT_VERSION || '?.?.?'),
  },
  plugins: [less({ compress: true })],
  loader: { '.ts': 'ts' },
  sourcemap: !PRODUCTION,
  sourceRoot: '../src',
  sourcesContent: false,
  target: ['es2017'],
  external: ['@cortex-js/compute-engine'],
};

// Build and serve the library
const cont = await context({
  ...BUILD_OPTIONS,
  entryPoints: ['./src/mathlive.ts'],
  outfile: './dist/mathlive.mjs',
  format: 'esm',
});

cont.watch();
