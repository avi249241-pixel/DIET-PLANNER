import fs from 'fs';
import path from 'path';

const manifestPath = path.join(process.cwd(), 'benchmark', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const imagesDir = path.join(process.cwd(), 'benchmark', 'images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// Generate distinct stylized visual plates for each meal item
for (const item of manifest.items) {
  const imgFileName = `${item.id}.svg`;
  const imgPath = path.join(imagesDir, imgFileName);

  const colors: Record<string, { bg: string; plate: string; accent: string }> = {
    'South Asian': { bg: '#FFF7ED', plate: '#FED7AA', accent: '#EA580C' },
    'East/Southeast Asian': { bg: '#FEF2F2', plate: '#FECACA', accent: '#DC2626' },
    'Western': { bg: '#EFF6FF', plate: '#BFDBFE', accent: '#2563EB' },
    'Middle Eastern/Mediterranean': { bg: '#F0FDF4', plate: '#BBF7D0', accent: '#16A34A' },
    'Composite/Difficult': { bg: '#FAF5FF', plate: '#E9D5FF', accent: '#9333EA' }
  };

  const scheme = colors[item.category] || { bg: '#F3F4F6', plate: '#E5E7EB', accent: '#4B5563' };

  const componentsXml = item.reference.components.map((c: any, i: number) => {
    const yOffset = 210 + (i * 24);
    return `<text x="50%" y="${yOffset}" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="#374151" text-anchor="middle">• ${c.name} (${c.grams}g · ${c.calories} kcal)</text>`;
  }).join('\n    ');

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="600" height="450">
  <rect width="100%" height="100%" fill="${scheme.bg}"/>
  <circle cx="300" cy="225" r="180" fill="${scheme.plate}" stroke="${scheme.accent}" stroke-width="4"/>
  <circle cx="300" cy="225" r="140" fill="#FFFFFF" opacity="0.9"/>
  <text x="50%" y="100" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="bold" fill="${scheme.accent}" text-anchor="middle">${item.id} · ${item.category}</text>
  <text x="50%" y="135" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="600" fill="#1F2937" text-anchor="middle">${item.meal_name}</text>
  <text x="50%" y="165" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#6B7280" text-anchor="middle">${item.cuisine} | Reference: ${item.reference.calories} kcal (${item.reference.total_grams}g)</text>
  <g>
    ${componentsXml}
  </g>
  <text x="50%" y="385" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="#9CA3AF" text-anchor="middle">${item.source}</text>
</svg>`;

  fs.writeFileSync(imgPath, svgContent, 'utf8');
  item.image_path = `benchmark/images/${imgFileName}`;
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
console.log(`Generated ${manifest.items.length} image assets in benchmark/images/ and updated manifest.json.`);
