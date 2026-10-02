import fs from 'fs';
import path from 'path';

const USERNAME = 'kambojmayan-png';

async function fetchContributions() {
  const url = `https://github.com/users/${USERNAME}/contributions`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching contributions`);
  return await res.text();
}

function parseContributions(html) {
  const monthRegex = /<td[^>]*class="ContributionCalendar-label"[^>]*colspan="(\d+)"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/g;
  const months = [];
  let mMatch;
  while ((mMatch = monthRegex.exec(html)) !== null) {
    months.push({ colspan: parseInt(mMatch[1]), name: mMatch[2].trim().slice(0, 3) });
  }

  const cellRegex = /<td[^>]*data-date="([^"]+)"[^>]*id="contribution-day-component-(\d+)-(\d+)"[^>]*data-level="(\d+)"/g;
  const cells = [];
  let cMatch;
  while ((cMatch = cellRegex.exec(html)) !== null) {
    cells.push({
      date:      cMatch[1],
      dayOfWeek: parseInt(cMatch[2]),
      weekIndex: parseInt(cMatch[3]),
      level:     parseInt(cMatch[4])
    });
  }
  return { months, cells };
}

function generateSvg({ months, cells }) {
  const CW = 10, CH = 10, GAP = 4, STEP = CW + GAP;

  const GRID_X      = 68;
  const GRID_Y      = 44;
  const TOTAL_WEEKS = 53;
  const SVG_W       = 840;
  const SVG_H       = 196;
  const LEGEND_Y    = 166;

  const palette = {
    0: '#161b22',
    1: '#0e4429',
    2: '#006d32',
    3: '#26a641',
    4: '#39d353'
  };

  // Month labels
  let weekCursor = 0;
  const monthLabels = months.map(m => {
    const x = GRID_X + weekCursor * STEP;
    weekCursor += m.colspan;
    return `<text x="${x}" y="27" class="month-label">${m.name}</text>`;
  }).join('\n  ');

  // Day labels
  const dayLabels = [
    `<text x="20" y="${GRID_Y + 1 * STEP + 9}" class="day-label">Mon</text>`,
    `<text x="20" y="${GRID_Y + 3 * STEP + 9}" class="day-label">Wed</text>`,
    `<text x="20" y="${GRID_Y + 5 * STEP + 9}" class="day-label">Fri</text>`
  ].join('\n  ');

  // Animated cells — staggered wave reveal, glow pulse for active cells
  const cellElements = cells.map(cell => {
    const x    = GRID_X + cell.weekIndex * STEP;
    const y    = GRID_Y + cell.dayOfWeek * STEP;
    const fill = palette[cell.level] || palette[0];
    const delay = (cell.weekIndex * 18 + cell.dayOfWeek * 4);

    let cls = 'cell';
    if      (cell.level >= 3) cls += ' cell-glow-bright';
    else if (cell.level >= 1) cls += ' cell-glow-dim';

    return `<rect x="${x}" y="${y}" width="${CW}" height="${CH}" rx="2" fill="${fill}" class="${cls}" style="animation-delay:${delay}ms" data-date="${cell.date}" data-level="${cell.level}"/>`;
  }).join('\n    ');

  // Shimmer & glow animation start (after last cell finishes revealing)
  const postReveal = (52 * 18 + 6 * 4) + 400;

  // Legend
  const legendX = GRID_X + TOTAL_WEEKS * STEP - 120;
  const legendSwatches = [0, 1, 2, 3, 4].map((lvl, i) =>
    `<rect x="${legendX + 38 + i * 14}" y="${LEGEND_Y - 2}" width="10" height="10" rx="2" fill="${palette[lvl]}" class="legend-swatch" style="animation-delay:${i * 80}ms"/>`
  ).join('\n    ');

  // Timestamp for "live" indicator
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_W} ${SVG_H}" width="${SVG_W}" height="${SVG_H}" fill="none">
  <defs>
    <linearGradient id="shimmer-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#0d1117" stop-opacity="0"/>
      <stop offset="45%"  stop-color="#58a6ff" stop-opacity="0.03"/>
      <stop offset="50%"  stop-color="#58a6ff" stop-opacity="0.09"/>
      <stop offset="55%"  stop-color="#58a6ff" stop-opacity="0.03"/>
      <stop offset="100%" stop-color="#0d1117" stop-opacity="0"/>
    </linearGradient>
    <filter id="f-bright" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2.8" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="f-dim" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="1.4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="grid-clip">
      <rect x="${GRID_X}" y="${GRID_Y}" width="${TOTAL_WEEKS * STEP + 2}" height="${7 * STEP + 2}"/>
    </clipPath>
  </defs>

  <style>
    .month-label {
      fill: #7d8590;
      font-size: 11px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    }
    .day-label {
      fill: #7d8590;
      font-size: 10px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    }
    .legend-text, .link-text, .ts-text {
      fill: #7d8590;
      font-size: 10px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    }
    .ts-label {
      fill: #484f58;
      font-size: 9px;
      font-family: 'Courier New', monospace;
    }

    /* Cell wave reveal */
    @keyframes cell-in {
      0%   { opacity: 0; transform: scale(0.3); }
      65%  { opacity: 1; transform: scale(1.2); }
      100% { opacity: 1; transform: scale(1.0); }
    }
    .cell {
      opacity: 0;
      transform-origin: center;
      transform-box: fill-box;
      animation: cell-in 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }

    /* Bright glow pulse (level 3-4) */
    @keyframes pulse-bright {
      0%, 100% { filter: url(#f-bright); opacity: 1.0; }
      50%       { filter: url(#f-bright); opacity: 0.68; }
    }
    .cell-glow-bright {
      opacity: 0;
      transform-origin: center;
      transform-box: fill-box;
      animation:
        cell-in       0.32s cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
        pulse-bright  2.6s  ease-in-out ${postReveal}ms infinite;
    }

    /* Dim glow pulse (level 1-2) */
    @keyframes pulse-dim {
      0%, 100% { filter: url(#f-dim); opacity: 1.0; }
      50%       { filter: url(#f-dim); opacity: 0.75; }
    }
    .cell-glow-dim {
      opacity: 0;
      transform-origin: center;
      transform-box: fill-box;
      animation:
        cell-in    0.32s cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
        pulse-dim  3.4s  ease-in-out ${postReveal + 400}ms infinite;
    }

    /* Shimmer sweep */
    @keyframes shimmer {
      0%   { transform: translateX(-${SVG_W}px); }
      100% { transform: translateX(${SVG_W * 2}px); }
    }
    .shimmer {
      animation: shimmer 2.8s ease-in-out ${postReveal - 200}ms infinite;
    }

    /* Live dot blink */
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.25; }
    }
    .live-dot {
      animation: blink 1.6s ease-in-out infinite;
    }

    /* Legend swatches pop in */
    @keyframes swatch-in {
      from { opacity: 0; transform: scale(0); }
      to   { opacity: 1; transform: scale(1); }
    }
    .legend-swatch {
      opacity: 0;
      transform-origin: center;
      transform-box: fill-box;
      animation: swatch-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
  </style>

  <!-- Background -->
  <rect x="0.5" y="0.5" width="${SVG_W - 1}" height="${SVG_H - 1}" rx="8"
        fill="#0d1117" stroke="#30363d" stroke-width="1"/>

  <!-- Month labels -->
  <g>${monthLabels}</g>

  <!-- Day labels -->
  <g>${dayLabels}</g>

  <!-- Contribution cells -->
  <g id="cells">
    ${cellElements}
  </g>

  <!-- Shimmer overlay -->
  <g clip-path="url(#grid-clip)">
    <rect class="shimmer"
          x="-${SVG_W}" y="${GRID_Y - 1}"
          width="${SVG_W}" height="${7 * STEP + 2}"
          fill="url(#shimmer-grad)"/>
  </g>

  <!-- Footer -->
  <g>
    <a href="https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/managing-contribution-settings-on-your-profile/why-are-my-contributions-not-showing-up-on-my-profile" target="_blank">
      <text x="${GRID_X}" y="${LEGEND_Y + 9}" class="link-text">Learn how we count contributions</text>
    </a>

    <!-- Live indicator -->
    <circle class="live-dot" cx="${GRID_X + 206}" cy="${LEGEND_Y + 5}" r="3.5" fill="#39d353"/>
    <text x="${GRID_X + 215}" y="${LEGEND_Y + 9}" class="ts-label">updated ${now}</text>

    <!-- Less → More scale -->
    <text x="${legendX + 2}" y="${LEGEND_Y + 9}" class="legend-text" text-anchor="end">Less</text>
    ${legendSwatches}
    <text x="${legendX + 112}" y="${LEGEND_Y + 9}" class="legend-text">More</text>
  </g>
</svg>`;
}

async function run() {
  console.log('Fetching contributions from GitHub...');
  const html = await fetchContributions();
  const data  = parseContributions(html);
  console.log(`Parsed ${data.months.length} months, ${data.cells.length} cells.`);

  const svg     = generateSvg(data);
  const outPath = path.resolve('assets/contribution-graph.svg');
  fs.writeFileSync(outPath, svg, 'utf-8');
  console.log(`Saved -> ${outPath}`);
}

run().catch(console.error);
