const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');

console.log('[build-api-libs] Pre-bundling serverless libraries for Vercel...');

// 1. Bundle engine-src.ts -> engine.js
execSync(
  'bunx esbuild api/_lib/engine-src.ts --bundle --platform=node --format=esm --packages=external --outfile=api/_lib/engine.js',
  { cwd: rootDir, stdio: 'inherit' }
);

// 2. Bundle auth.ts -> auth.js
execSync(
  'bunx esbuild api/_lib/auth.ts --bundle --platform=node --format=esm --packages=external --outfile=api/_lib/auth.js',
  { cwd: rootDir, stdio: 'inherit' }
);

// 3. Bundle gemini.ts -> gemini.js
execSync(
  'bunx esbuild api/_lib/gemini.ts --bundle --platform=node --format=esm --packages=external --outfile=api/_lib/gemini.js',
  { cwd: rootDir, stdio: 'inherit' }
);

console.log('[build-api-libs] Successfully generated api/_lib/{engine,auth,gemini}.js');
