import fs from 'fs';
import path from 'path';

const USERNAME = 'kambojmayan-png';

async function fetchContributions() {
  const url = `https://github.com/users/${USERNAME}/contributions`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching contributions`);
  return await res.text();
}

function parseContributions(html) {
  // Extract month labels & colspans
  const monthRegex = /<td[^>]*class="ContributionCalendar-label"[^>]*colspan="(\d+)"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/g;
  const months = [];
  let mMatch;
  while ((mMatch = monthRegex.exec(html)) !== null) {
    const fullName = mMatch[2].trim();
    const shortName = fullName.slice(0, 3);
    months.push({ colspan: parseInt(mMatch[1]), name: shortName });
  }

  // Extract day cells
  const cellRegex = /<td[^>]*data-date="([^"]+)"[^>]*id="contribution-day-component-(\d+)-(\d+)"[^>]*data-level="(\d+)"/g;
  const cells = [];
  let cMatch;
  while ((cMatch = cellRegex.exec(html)) !== null) {
    cells.push({
      date: cMatch[1],
      dayOfWeek: parseInt(cMatch[2]), // 0 to 6
      weekIndex: parseInt(cMatch[3]), // 0 to 52
      level: parseInt(cMatch[4])       // 0 to 4
    });
  }

  return { months, cells };
}

function generateSvg({ months, cells }) {
  const cellWidth = 10;
  const cellHeight = 10;
  const cellGap = 4;
  const step = cellWidth + cellGap; // 14px

  const gridStartX = 66;
  const gridStartY = 42;

  const totalWeeks = 53;
  const gridWidth = totalWeeks * step; // ~742px

  const svgWidth = 840;
  const svgHeight = 188;

  const colorPalette = {
    0: '#161b22', // empty
    1: '#0e4429', // level 1
    2: '#006d32', // level 2
    3: '#26a641', // level 3
    4: '#39d353'  // level 4
  };

  // Month labels positioning
  let currentWeek = 0;
  const monthSvgElements = [];
  for (const m of months) {
    const x = gridStartX + currentWeek * step;
    monthSvgElements.push(
      `<text x="${x}" y="28" fill="#848d97" font-size="11" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">${m.name}</text>`
    );
    currentWeek += m.colspan;
  }

  // Day labels (Mon, Wed, Fri)
  // dayOfWeek 1 = Mon (y index 1), 3 = Wed (y index 3), 5 = Fri (y index 5)
  const daySvgElements = [
    `<text x="24" y="${gridStartY + 1 * step + 9}" fill="#848d97" font-size="10" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">Mon</text>`,
    `<text x="24" y="${gridStartY + 3 * step + 9}" fill="#848d97" font-size="10" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">Wed</text>`,
    `<text x="24" y="${gridStartY + 5 * step + 9}" fill="#848d97" font-size="10" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">Fri</text>`
  ];

  // Grid cells
  const cellSvgElements = cells.map(cell => {
    const x = gridStartX + cell.weekIndex * step;
    const y = gridStartY + cell.dayOfWeek * step;
    const fill = colorPalette[cell.level] || colorPalette[0];
    return `<rect x="${x}" y="${y}" width="${cellWidth}" height="${cellHeight}" rx="2" fill="${fill}" data-date="${cell.date}" data-level="${cell.level}"/>`;
  });

  // Bottom legend
  const legendY = 160;
  const legendRightX = gridStartX + gridWidth - 100;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}" fill="none">
  <style>
    .legend-text { fill: #7d8590; font-size: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }
    .link-text { fill: #7d8590; font-size: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; text-decoration: none; }
    .link-text:hover { fill: #2f81f7; text-decoration: underline; }
  </style>

  <!-- Container Box -->
  <rect x="0.5" y="0.5" width="${svgWidth - 1}" height="${svgHeight - 1}" rx="8" fill="#0d1117" stroke="#30363d" stroke-width="1"/>

  <!-- Months -->
  <g>${monthSvgElements.join('\n  ')}</g>

  <!-- Days -->
  <g>${daySvgElements.join('\n  ')}</g>

  <!-- Cells -->
  <g id="contribution-cells">
    ${cellSvgElements.join('\n    ')}
  </g>

  <!-- Footer -->
  <g>
    <a href="https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/managing-contribution-settings-on-your-profile/why-are-my-contributions-not-showing-up-on-my-profile" target="_blank">
      <text x="${gridStartX}" y="${legendY + 8}" class="link-text">Learn how we count contributions</text>
    </a>

    <!-- Legend -->
    <text x="${legendRightX}" y="${legendY + 8}" class="legend-text" text-anchor="end">Less</text>
    <rect x="${legendRightX + 6}" y="${legendY - 1}" width="10" height="10" rx="2" fill="#161b22"/>
    <rect x="${legendRightX + 20}" y="${legendY - 1}" width="10" height="10" rx="2" fill="#0e4429"/>
    <rect x="${legendRightX + 34}" y="${legendY - 1}" width="10" height="10" rx="2" fill="#006d32"/>
    <rect x="${legendRightX + 48}" y="${legendY - 1}" width="10" height="10" rx="2" fill="#26a641"/>
    <rect x="${legendRightX + 62}" y="${legendY - 1}" width="10" height="10" rx="2" fill="#39d353"/>
    <text x="${legendRightX + 78}" y="${legendY + 8}" class="legend-text">More</text>
  </g>
</svg>`;
}

async function run() {
  console.log('Fetching contributions from GitHub...');
  const html = await fetchContributions();
  const data = parseContributions(html);
  console.log(`Parsed ${data.months.length} months and ${data.cells.length} cells.`);

  const svg = generateSvg(data);
  const outPath = path.resolve('assets/contribution-graph.svg');
  fs.writeFileSync(outPath, svg, 'utf-8');
  console.log(`Saved generated contribution graph to ${outPath}`);
}

run().catch(console.error);
