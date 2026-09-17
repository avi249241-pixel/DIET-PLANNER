const fs = require('fs');
const path = require('path');

const releaseDir = path.join(process.cwd(), 'release');
if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}

const distIndex = path.join(process.cwd(), 'dist', 'index.html');
if (!fs.existsSync(distIndex)) {
  console.error('dist/index.html not found, please build first');
  process.exit(1);
}

let html = fs.readFileSync(distIndex, 'utf8');

// Inline CSS stylesheets
const linkRegex = /<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
html = html.replace(linkRegex, (match, href) => {
  const cleanHref = href.replace(/^\.\//, '');
  const cssPath = path.join(process.cwd(), 'dist', cleanHref);
  if (fs.existsSync(cssPath)) {
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    return `<style>\n${cssContent}\n</style>`;
  }
  return match;
});

// Inline JS modules
const scriptRegex = /<script\s+[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*><\/script>/gi;
html = html.replace(scriptRegex, (match, src) => {
  const cleanSrc = src.replace(/^\.\//, '');
  const jsPath = path.join(process.cwd(), 'dist', cleanSrc);
  if (fs.existsSync(jsPath)) {
    const jsContent = fs.readFileSync(jsPath, 'utf8');
    return `<script type="module">\n${jsContent}\n</script>`;
  }
  return match;
});

const outputPath = path.join(releaseDir, 'Diet-Planner-App.html');
fs.writeFileSync(outputPath, html, 'utf8');
const stat = fs.statSync(outputPath);
console.log(`[RELEASE] Standalone single-file HTML generated: ${outputPath} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
