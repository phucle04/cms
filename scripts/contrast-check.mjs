// Kiểm tra tỉ lệ tương phản WCAG cho toàn bộ cặp chữ/nền + viền đang dùng,
// cho cả 2 theme (sáng/tối). Tự cài công thức OKLCH -> sRGB -> luminance
// theo chuẩn CSS Color 4 (không cần thư viện ngoài).
//
// Chạy: node scripts/contrast-check.mjs

import fs from 'fs';

// ---------- OKLCH -> sRGB (CSS Color 4) ----------
function oklchToLinearSrgb(L, C, Hdeg) {
  const h = (Hdeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  return [r, g, bl];
}

function srgbGammaEncode(c) {
  const cc = Math.min(Math.max(c, 0), 1);
  return cc <= 0.0031308 ? cc * 12.92 : 1.055 * Math.pow(cc, 1 / 2.4) - 0.055;
}

// alpha: nếu token có alpha (vd border trong .dark là oklch(1 0 0 / 12%)),
// trộn với nền `onBg` (đã là linear rgb [0,1]) trước khi tính luminance.
function oklchToRgb255(L, C, H, alpha = 1, onBg = [1, 1, 1]) {
  const [rl, gl, bl] = oklchToLinearSrgb(L, C, H);
  const mix = (fg, bg) => fg * alpha + bg * (1 - alpha);
  const rMixed = mix(rl, onBg[0]);
  const gMixed = mix(gl, onBg[1]);
  const bMixed = mix(bl, onBg[2]);
  return {
    linear: [rMixed, gMixed, bMixed],
    srgb255: [srgbGammaEncode(rMixed) * 255, srgbGammaEncode(gMixed) * 255, srgbGammaEncode(bMixed) * 255],
  };
}

function relLuminance(linearRgb) {
  const [r, g, b] = linearRgb;
  return 0.2126 * Math.max(r, 0) + 0.7152 * Math.max(g, 0) + 0.0722 * Math.max(b, 0);
}

function contrastRatio(lum1, lum2) {
  const L1 = Math.max(lum1, lum2);
  const L2 = Math.min(lum1, lum2);
  return (L1 + 0.05) / (L2 + 0.05);
}

// parse "oklch(L C H)" hoặc "oklch(L C H / A%)"
function parseOklch(str) {
  const m = str.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)%)?\s*\)/);
  if (!m) throw new Error(`Không parse được oklch: ${str}`);
  return {
    L: parseFloat(m[1]),
    C: parseFloat(m[2]),
    H: parseFloat(m[3]),
    alpha: m[4] ? parseFloat(m[4]) / 100 : 1,
  };
}

// ---------- Token theo theme (khớp app/globals.css) ----------
const TOKENS = {
  light: {
    background: 'oklch(1 0 0)',
    foreground: 'oklch(0.145 0 0)',
    card: 'oklch(1 0 0)',
    'card-foreground': 'oklch(0.145 0 0)',
    popover: 'oklch(1 0 0)',
    'popover-foreground': 'oklch(0.145 0 0)',
    primary: 'oklch(0.511 0.262 276.966)',
    'primary-foreground': 'oklch(0.985 0 0)',
    secondary: 'oklch(0.97 0 0)',
    'secondary-foreground': 'oklch(0.205 0 0)',
    muted: 'oklch(0.97 0 0)',
    'muted-foreground': 'oklch(0.52 0 0)',
    accent: 'oklch(0.97 0 0)',
    'accent-foreground': 'oklch(0.205 0 0)',
    link: 'oklch(0.511 0.262 276.966)',
    destructive: 'oklch(0.577 0.245 27.325)',
    'destructive-foreground': 'oklch(0.985 0 0)',
    'destructive-muted': 'oklch(0.971 0.013 17.38)',
    'destructive-muted-foreground': 'oklch(0.505 0.213 27.518)',
    success: 'oklch(0.627 0.194 149.214)',
    'success-foreground': 'oklch(0.985 0 0)',
    'success-muted': 'oklch(0.982 0.018 155.826)',
    'success-muted-foreground': 'oklch(0.527 0.154 150.069)',
    warning: 'oklch(0.666 0.179 58.318)',
    'warning-foreground': 'oklch(0.145 0 0)',
    'warning-muted': 'oklch(0.987 0.022 95.277)',
    'warning-muted-foreground': 'oklch(0.555 0.163 48.998)',
    info: 'oklch(0.546 0.245 262.881)',
    'info-foreground': 'oklch(0.985 0 0)',
    'info-muted': 'oklch(0.97 0.014 254.604)',
    'info-muted-foreground': 'oklch(0.488 0.243 264.376)',
    border: 'oklch(0.65 0 0)',
    'border-strong': 'oklch(0.55 0 0)',
    input: 'oklch(0.55 0 0)',
  },
  dark: {
    background: 'oklch(0.145 0 0)',
    foreground: 'oklch(0.965 0 0)',
    card: 'oklch(0.205 0 0)',
    'card-foreground': 'oklch(0.965 0 0)',
    popover: 'oklch(0.205 0 0)',
    'popover-foreground': 'oklch(0.965 0 0)',
    primary: 'oklch(0.52 0.2 277.117)',
    'primary-foreground': 'oklch(0.985 0 0)',
    secondary: 'oklch(0.269 0 0)',
    'secondary-foreground': 'oklch(0.965 0 0)',
    muted: 'oklch(0.269 0 0)',
    'muted-foreground': 'oklch(0.708 0 0)',
    accent: 'oklch(0.269 0 0)',
    'accent-foreground': 'oklch(0.965 0 0)',
    link: 'oklch(0.72 0.16 277.117)',
    destructive: 'oklch(0.704 0.16 22.216)',
    'destructive-foreground': 'oklch(0.145 0 0)',
    'destructive-muted': 'oklch(0.396 0.141 25.723)',
    'destructive-muted-foreground': 'oklch(0.808 0.114 19.571)',
    success: 'oklch(0.723 0.18 149.579)',
    'success-foreground': 'oklch(0.145 0 0)',
    'success-muted': 'oklch(0.393 0.095 152.535)',
    'success-muted-foreground': 'oklch(0.871 0.15 154.449)',
    warning: 'oklch(0.769 0.16 70.08)',
    'warning-foreground': 'oklch(0.145 0 0)',
    'warning-muted': 'oklch(0.414 0.112 45.904)',
    'warning-muted-foreground': 'oklch(0.879 0.169 91.605)',
    info: 'oklch(0.68 0.18 259.815)',
    'info-foreground': 'oklch(0.145 0 0)',
    'info-muted': 'oklch(0.379 0.146 265.522)',
    'info-muted-foreground': 'oklch(0.809 0.105 251.813)',
    border: 'oklch(1 0 0 / 16%)',
    'border-strong': 'oklch(0.5 0 0)',
    input: 'oklch(0.5 0 0)',
  },
};

// Cặp cần kiểm: [tên hiển thị, token chữ, token nền, ngưỡng ('normal'|'large'|'nontext')]
const PAIRS = [
  ['Chữ chính trên nền trang', 'foreground', 'background', 'normal'],
  ['Chữ phụ/mờ trên nền trang (muted-foreground - dùng chung cho secondary & muted)', 'muted-foreground', 'background', 'normal'],
  ['Chữ chính trên card', 'foreground', 'card', 'normal'],
  ['Chữ phụ trên card', 'muted-foreground', 'card', 'normal'],
  ['Chữ chính trên nền subtle (bg-muted, hover row)', 'foreground', 'muted', 'normal'],
  ['Chữ phụ trên nền subtle', 'muted-foreground', 'muted', 'normal'],
  ['Chữ trên nút chính (accent)', 'primary-foreground', 'primary', 'normal'],
  ['Link/chữ màu nhấn trên nền trang (token link, tách khỏi primary)', 'link', 'background', 'normal'],
  ['Link/chữ màu nhấn trên card', 'link', 'card', 'normal'],
  ['Chữ trên nút nguy hiểm', 'destructive-foreground', 'destructive', 'normal'],
  ['Badge nguy hiểm (nền nhạt + chữ đậm)', 'destructive-muted-foreground', 'destructive-muted', 'normal'],
  ['Badge thành công (nền nhạt + chữ đậm)', 'success-muted-foreground', 'success-muted', 'normal'],
  ['Badge cảnh báo (nền nhạt + chữ đậm)', 'warning-muted-foreground', 'warning-muted', 'normal'],
  ['Badge thông tin (nền nhạt + chữ đậm)', 'info-muted-foreground', 'info-muted', 'normal'],
  ['Icon trạng thái thành công trên nền trang', 'success', 'background', 'large'],
  ['Icon trạng thái cảnh báo trên nền trang', 'warning', 'background', 'large'],
  ['Icon trạng thái nguy hiểm trên nền trang', 'destructive', 'background', 'large'],
  ['Icon trạng thái info trên nền trang', 'info', 'background', 'large'],
  ['Viền thường trên nền trang', 'border', 'background', 'nontext'],
  ['Viền đậm (input/focus) trên nền trang', 'border-strong', 'background', 'nontext'],
  ['Viền thường trên card', 'border', 'card', 'nontext'],
  ['Viền ô nhập liệu (input) trên nền trang', 'input', 'background', 'nontext'],
];

const THRESHOLDS = { normal: 4.5, large: 3, nontext: 3 };

function resolveColor(theme, tokenName) {
  const raw = TOKENS[theme][tokenName];
  const { L, C, H, alpha } = parseOklch(raw);
  const onBg = theme === 'light' ? [1, 1, 1] : oklchToLinearSrgb(...Object.values(parseOklch(TOKENS[theme].background)).slice(0, 3));
  return oklchToRgb255(L, C, H, alpha, onBg);
}

function runTheme(theme) {
  const rows = [];
  for (const [label, fgToken, bgToken, kind] of PAIRS) {
    const fg = resolveColor(theme, fgToken);
    const bg = resolveColor(theme, bgToken);
    const lumFg = relLuminance(fg.linear);
    const lumBg = relLuminance(bg.linear);
    const ratio = contrastRatio(lumFg, lumBg);
    const threshold = THRESHOLDS[kind];
    const pass = ratio >= threshold;
    rows.push({ label, fgToken, bgToken, kind, ratio, threshold, pass });
  }
  return rows;
}

function fmtRatio(r) {
  return `${r.toFixed(2)}:1`;
}

function renderTable(rows) {
  const lines = [
    '| Cặp | Chữ/viền | Nền | Ngưỡng | Tỉ lệ đo được | Kết quả |',
    '|---|---|---|---|---|---|',
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.label} | \`${r.fgToken}\` | \`${r.bgToken}\` | ${r.threshold}:1 | ${fmtRatio(r.ratio)} | ${r.pass ? '✅ Đạt' : '❌ KHÔNG đạt'} |`
    );
  }
  return lines.join('\n');
}

const lightRows = runTheme('light');
const darkRows = runTheme('dark');

const failedLight = lightRows.filter((r) => !r.pass);
const failedDark = darkRows.filter((r) => !r.pass);

const report = `# Báo cáo tương phản màu (WCAG)

Tự động tính bằng \`scripts/contrast-check.mjs\` (OKLCH -> sRGB -> luminance theo chuẩn CSS Color 4, không dùng thư viện ngoài). Ngưỡng: chữ thường ≥ 4.5:1, chữ lớn/icon ≥ 3:1, viền ≥ 3:1.

## Chế độ Sáng

${renderTable(lightRows)}

**Số cặp không đạt: ${failedLight.length}**

## Chế độ Tối

${renderTable(darkRows)}

**Số cặp không đạt: ${failedDark.length}**

---

Chạy lại: \`node scripts/contrast-check.mjs\`
`;

fs.writeFileSync('docs/contrast-report.md', report, 'utf-8');

console.log(`Sáng: ${lightRows.length - failedLight.length}/${lightRows.length} đạt, ${failedLight.length} không đạt`);
if (failedLight.length) console.log('  Không đạt:', failedLight.map((r) => `${r.label} (${fmtRatio(r.ratio)} < ${r.threshold}:1)`).join('; '));
console.log(`Tối: ${darkRows.length - failedDark.length}/${darkRows.length} đạt, ${failedDark.length} không đạt`);
if (failedDark.length) console.log('  Không đạt:', failedDark.map((r) => `${r.label} (${fmtRatio(r.ratio)} < ${r.threshold}:1)`).join('; '));
console.log('\nĐã ghi docs/contrast-report.md');
