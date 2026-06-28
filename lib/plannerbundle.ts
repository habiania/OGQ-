import { createCanvas, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import PDFDocument from "pdfkit";
import path from "path";

let FR = "sans-serif", FB = "sans-serif", fontReady = false;
function ensureFont() {
  if (fontReady) return; fontReady = true;
  try { if (GlobalFonts.registerFromPath(path.join(process.cwd(), "assets/fonts/NanumGothic.ttf"), "PbR")) FR = "PbR"; } catch {}
  try { if (GlobalFonts.registerFromPath(path.join(process.cwd(), "assets/fonts/NanumGothicBold.ttf"), "PbB")) FB = "PbB"; } catch {}
}

export interface Style { name: string; bg: string; ink: string; acc: string; soft: string; muted: string }
export const STYLES: Style[] = [
  { name: "Scandinavian", bg: "#fbfbfa", ink: "#2b2b2b", acc: "#9aa7a0", soft: "#f1f1ef", muted: "#9b9b9b" },
  { name: "Japandi", bg: "#f6f3ee", ink: "#3a352e", acc: "#a08c74", soft: "#ece6dc", muted: "#9c9486" },
  { name: "Minimal Beige", bg: "#faf6f0", ink: "#4a4036", acc: "#c2a883", soft: "#f0e8dc", muted: "#a99e8c" },
  { name: "Sage Green", bg: "#f4f7f3", ink: "#33402f", acc: "#7e9b6b", soft: "#e6ede1", muted: "#92a085" },
  { name: "Botanical", bg: "#f5f7f2", ink: "#2f3a2a", acc: "#6f8f5f", soft: "#e7eede", muted: "#8a9a7c" },
  { name: "Neutral Luxury", bg: "#f7f5f2", ink: "#33302b", acc: "#b9a896", soft: "#eeeae4", muted: "#a59e93" },
  { name: "Soft Pastel", bg: "#fbf7f8", ink: "#46393f", acc: "#d3a9b6", soft: "#f3e9ed", muted: "#b6a3aa" },
  { name: "Feminine Modern", bg: "#fbf6f4", ink: "#4a3a37", acc: "#cf9a8a", soft: "#f3e6e1", muted: "#b39a93" },
  { name: "Dark Minimal", bg: "#1f2024", ink: "#eceae6", acc: "#c0a36b", soft: "#2a2c31", muted: "#8d8f96" },
  { name: "Earth Tone", bg: "#f6f1ea", ink: "#3f352b", acc: "#b07b50", soft: "#ece2d4", muted: "#a18c76" },
];

type Ctx = SKRSContext2D;
const MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

// ---------- premium helpers (minimal, generous whitespace) ----------
function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function tracked(ctx: Ctx, text: string, x: number, y: number, spacing: number) {
  let cx = x; for (const ch of text) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + spacing; }
}
function header(ctx: Ctx, W: number, M: number, title: string, st: Style) {
  ctx.fillStyle = st.muted; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.font = `bold ${W * 0.026}px "${FB}"`;
  tracked(ctx, title.toUpperCase(), M, M * 0.9, W * 0.012);
  ctx.strokeStyle = st.acc; ctx.lineWidth = Math.max(1.5, W * 0.002);
  ctx.beginPath(); ctx.moveTo(M, M * 1.1); ctx.lineTo(M + W * 0.08, M * 1.1); ctx.stroke();
}
function vlines(ctx: Ctx, x: number, y: number, w: number, n: number, gap: number, color: string) {
  ctx.strokeStyle = color; ctx.lineWidth = 1;
  for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.moveTo(x, y + i * gap); ctx.lineTo(x + w, y + i * gap); ctx.stroke(); }
}
function checkRows(ctx: Ctx, x: number, y: number, w: number, n: number, gap: number, st: Style, items?: string[]) {
  for (let i = 0; i < n; i++) {
    const yy = y + i * gap;
    ctx.strokeStyle = st.acc; ctx.lineWidth = 1.5; rr(ctx, x, yy, gap * 0.5, gap * 0.5, gap * 0.12); ctx.stroke();
    if (items && items[i]) { ctx.fillStyle = st.ink; ctx.font = `400 ${gap * 0.42}px "${FR}"`; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(items[i], x + gap * 0.8, yy + gap * 0.25); }
    else { ctx.strokeStyle = st.soft; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + gap * 0.8, yy + gap * 0.5); ctx.lineTo(x + w, yy + gap * 0.5); ctx.stroke(); }
  }
}
function label(ctx: Ctx, t: string, x: number, y: number, size: number, color: string, b = true) {
  ctx.fillStyle = color; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.font = `${b ? "bold" : "400"} ${size}px "${b ? FB : FR}"`; ctx.fillText(t, x, y);
}
function grid(ctx: Ctx, x: number, y: number, w: number, h: number, cols: number, rows: number, st: Style, headerRow?: string[]) {
  const cw = w / cols, rh = h / rows;
  ctx.strokeStyle = st.soft; ctx.lineWidth = 1;
  for (let r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(x, y + r * rh); ctx.lineTo(x + w, y + r * rh); ctx.stroke(); }
  for (let c = 0; c <= cols; c++) { ctx.beginPath(); ctx.moveTo(x + c * cw, y); ctx.lineTo(x + c * cw, y + h); ctx.stroke(); }
  if (headerRow) {
    ctx.fillStyle = st.muted; ctx.font = `bold ${rh * 0.3}px "${FB}"`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    headerRow.forEach((t, i) => ctx.fillText(t, x + i * cw + cw / 2, y + rh / 2));
  }
}

// ---------- page renderers ----------
type Page = { key: string; title: string; draw: (ctx: Ctx, W: number, H: number, M: number, st: Style, meta: BundleMeta) => void };

export interface BundleMeta { title: string; year: string; welcome: string; }

const dotsTitle = (ctx: Ctx, W: number, H: number, big: string, small: string, st: Style) => {
  ctx.textAlign = "center";
  ctx.fillStyle = st.acc; ctx.beginPath(); ctx.arc(W / 2, H * 0.3, W * 0.06, 0, 7); ctx.fill();
  ctx.fillStyle = st.bg === "#1f2024" ? st.bg : "#ffffff"; ctx.beginPath(); ctx.arc(W / 2, H * 0.3, W * 0.045, 0, 7); ctx.fill();
  ctx.fillStyle = st.ink; ctx.font = `bold ${W * 0.085}px "${FB}"`; ctx.textBaseline = "middle";
  const words = big.toUpperCase().split(" ");
  let yy = H * 0.5; for (const wd of words) { ctx.fillText(wd, W / 2, yy); yy += W * 0.1; }
  ctx.fillStyle = st.muted; ctx.font = `400 ${W * 0.03}px "${FR}"`; ctx.fillText(small, W / 2, yy + W * 0.02);
};

const PAGES: Page[] = [
  { key: "cover", title: "", draw: (ctx, W, H, M, st, meta) => {
    ctx.strokeStyle = st.acc; ctx.lineWidth = W * 0.004; ctx.strokeRect(M * 0.7, M * 0.7, W - M * 1.4, H - M * 1.4);
    ctx.textAlign = "center"; ctx.fillStyle = st.muted; ctx.font = `400 ${W * 0.028}px "${FR}"`; ctx.textBaseline = "middle";
    tracked(ctx, "PREMIUM PLANNER", W / 2 - W * 0.16, H * 0.32, W * 0.01);
    ctx.fillStyle = st.ink; ctx.font = `bold ${W * 0.095}px "${FB}"`;
    const words = (meta.title || "LIFE PLANNER").toUpperCase().split(" ");
    let yy = H * 0.46; for (const wd of words) { ctx.fillText(wd, W / 2, yy); yy += W * 0.11; }
    ctx.fillStyle = st.acc; ctx.beginPath(); ctx.moveTo(W / 2 - W * 0.08, yy); ctx.lineTo(W / 2 + W * 0.08, yy); ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = st.muted; ctx.font = `400 ${W * 0.04}px "${FR}"`; ctx.fillText(meta.year, W / 2, yy + W * 0.06);
  }},
  { key: "welcome", title: "Welcome", draw: (ctx, W, H, M, st, meta) => {
    label(ctx, "Hello & Welcome", M, M * 1.8, W * 0.06, st.ink);
    ctx.fillStyle = st.ink; ctx.font = `400 ${W * 0.032}px "${FR}"`; ctx.textAlign = "left";
    const words = (meta.welcome || "This planner is designed to help you organize your life with clarity and calm. Take a deep breath, set your intentions, and make this year truly yours.").split(" ");
    let line = "", y = M * 2.6; const maxW = W - M * 2;
    for (const wd of words) { const t = line + wd + " "; if (ctx.measureText(t).width > maxW) { ctx.fillText(line, M, y); y += W * 0.05; line = wd + " "; } else line = t; }
    ctx.fillText(line, M, y);
    ctx.strokeStyle = st.soft; ctx.beginPath(); ctx.moveTo(M, H - M * 1.4); ctx.lineTo(M + W * 0.3, H - M * 1.4); ctx.stroke();
    label(ctx, "— xx", M, H - M * 1.2, W * 0.03, st.muted, false);
  }},
  { key: "index", title: "Index", draw: (ctx, W, H, M, st) => {
    header(ctx, W, M, "Index", st);
    const items = ["Yearly Goals", "Vision Board", "Monthly Planner", "Weekly Planner", "Daily Planner", "Budget Planner", "Expense Tracker", "Habit Tracker", "Mood Tracker", "Meal Planner", "Workout Planner", "Reading Log", "Notes", "Reflection"];
    let y = M * 1.9; ctx.textBaseline = "middle";
    items.forEach((it, i) => {
      ctx.fillStyle = st.ink; ctx.font = `400 ${W * 0.032}px "${FR}"`; ctx.textAlign = "left"; ctx.fillText(`${String(i + 1).padStart(2, "0")}`, M, y);
      ctx.fillText(it, M + W * 0.08, y);
      ctx.fillStyle = st.muted; ctx.setLineDash([2, 6]); ctx.strokeStyle = st.muted; ctx.beginPath(); ctx.moveTo(M + W * 0.45, y); ctx.lineTo(W - M, y); ctx.stroke(); ctx.setLineDash([]);
      y += W * 0.052;
    });
  }},
  { key: "yearlygoals", title: "Yearly Goals", draw: (ctx, W, H, M, st) => {
    header(ctx, W, M, "Yearly Goals", st);
    const cats = ["Personal", "Career", "Health", "Finance", "Relationships", "Growth"];
    const cols = 2, cw = (W - M * 2) / cols, ch = (H - M * 2.4) / 3;
    cats.forEach((cat, i) => {
      const x = M + (i % cols) * cw, y = M * 1.7 + Math.floor(i / cols) * ch;
      label(ctx, cat, x, y + W * 0.03, W * 0.034, st.acc);
      vlines(ctx, x, y + W * 0.06, cw - W * 0.04, 4, W * 0.04, st.soft);
    });
  }},
  { key: "vision", title: "Vision Board", draw: (ctx, W, H, M, st) => {
    header(ctx, W, M, "Vision Board", st);
    const cols = 2, rows = 2, gap = W * 0.03; const aw = (W - M * 2 - gap) / cols, ah = (H - M * 2.2 - gap) / rows;
    for (let i = 0; i < cols * rows; i++) {
      const x = M + (i % cols) * (aw + gap), y = M * 1.7 + Math.floor(i / cols) * (ah + gap);
      ctx.fillStyle = st.soft; rr(ctx, x, y, aw, ah, W * 0.012); ctx.fill();
      ctx.strokeStyle = st.acc; ctx.lineWidth = 1.5; ctx.setLineDash([6, 8]); rr(ctx, x + 12, y + 12, aw - 24, ah - 24, W * 0.01); ctx.stroke(); ctx.setLineDash([]);
    }
  }},
  { key: "monthly", title: "Monthly Planner", draw: (ctx, W, H, M, st) => {
    header(ctx, W, M, "Monthly Planner", st);
    label(ctx, "Month", M, M * 1.7, W * 0.05, st.ink);
    label(ctx, "Focus", M, M * 2.3, W * 0.03, st.acc); vlines(ctx, M, M * 2.45, (W - M * 2) * 0.55, 1, 0, st.soft);
    label(ctx, "Goals", M, M * 2.9, W * 0.03, st.acc); checkRows(ctx, M, M * 3.05, (W - M * 2) * 0.55, 6, W * 0.05, st);
    label(ctx, "Notes", W * 0.6, M * 2.3, W * 0.03, st.acc); vlines(ctx, W * 0.6, M * 2.5, W - M - W * 0.6, 10, W * 0.05, st.soft);
  }},
  { key: "calendar", title: "Monthly Calendar", draw: (ctx, W, H, M, st, meta) => {
    header(ctx, W, M, "Calendar", st);
    label(ctx, "MONTH", M, M * 1.7, W * 0.045, st.ink);
    grid(ctx, M, M * 2.1, W - M * 2, H - M * 3, 7, 6, st, ["S", "M", "T", "W", "T", "F", "S"]);
  }},
  { key: "weekly", title: "Weekly Planner", draw: (ctx, W, H, M, st) => {
    header(ctx, W, M, "Weekly Planner", st);
    const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
    const rowH = (H - M * 1.9) / 7;
    days.forEach((d, i) => {
      const y = M * 1.7 + i * rowH;
      ctx.fillStyle = st.soft; rr(ctx, M, y, W - M * 2, rowH - W * 0.012, W * 0.008); ctx.fill();
      label(ctx, d, M + W * 0.02, y + rowH * 0.4, W * 0.022, st.acc);
      ctx.strokeStyle = st.muted + "55"; ctx.lineWidth = 1;
      for (let k = 1; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(M + W * 0.16, y + rowH * 0.33 * k); ctx.lineTo(W - M - W * 0.03, y + rowH * 0.33 * k); ctx.stroke(); }
    });
  }},
  { key: "daily", title: "Daily Planner", draw: (ctx, W, H, M, st) => {
    header(ctx, W, M, "Daily Planner", st);
    const colW = (W - M * 2 - W * 0.04) / 2;
    label(ctx, "SCHEDULE", M, M * 1.7, W * 0.026, st.acc);
    ctx.fillStyle = st.muted; ctx.font = `400 ${W * 0.02}px "${FR}"`;
    let y = M * 1.95; for (let h = 6; h <= 21; h++) { ctx.textAlign = "left"; ctx.fillStyle = st.muted; ctx.fillText(`${String(h).padStart(2, "0")}:00`, M, y + 4); ctx.strokeStyle = st.soft; ctx.beginPath(); ctx.moveTo(M + W * 0.08, y); ctx.lineTo(M + colW, y); ctx.stroke(); y += (H - M * 2.2) / 17; }
    const x2 = M + colW + W * 0.04;
    label(ctx, "TOP PRIORITIES", x2, M * 1.7, W * 0.026, st.acc); checkRows(ctx, x2, M * 1.95, colW, 3, W * 0.05, st);
    label(ctx, "TO-DO", x2, M * 1.7 + W * 0.22, W * 0.026, st.acc); checkRows(ctx, x2, M * 1.95 + W * 0.22, colW, 7, W * 0.05, st);
  }},
  { key: "priority", title: "Priority Matrix", draw: (ctx, W, H, M, st) => {
    header(ctx, W, M, "Priority Matrix", st);
    const quads = ["Urgent + Important", "Not Urgent + Important", "Urgent + Not Important", "Not Urgent + Not Important"];
    const cw = (W - M * 2) / 2, ch = (H - M * 2.1) / 2;
    quads.forEach((q, i) => {
      const x = M + (i % 2) * cw, y = M * 1.8 + Math.floor(i / 2) * ch;
      ctx.fillStyle = i === 0 ? st.acc + "22" : st.soft; rr(ctx, x + 6, y + 6, cw - 12, ch - 12, W * 0.01); ctx.fill();
      label(ctx, q, x + W * 0.025, y + W * 0.05, W * 0.022, st.acc);
    });
  }},
  { key: "timeblock", title: "Time Blocking", draw: (ctx, W, H, M, st) => {
    header(ctx, W, M, "Time Blocking", st);
    const y0 = M * 1.7, rh = (H - M * 1.9) / 16;
    for (let h = 6; h <= 21; h++) {
      const y = y0 + (h - 6) * rh;
      ctx.fillStyle = st.muted; ctx.font = `400 ${W * 0.02}px "${FR}"`; ctx.textAlign = "left"; ctx.fillText(`${String(h).padStart(2, "0")}:00`, M, y + rh * 0.6);
      ctx.fillStyle = (h % 2 === 0) ? st.soft : st.bg; rr(ctx, M + W * 0.08, y, W - M * 2 - W * 0.08, rh - 4, W * 0.006); ctx.fill();
    }
  }},
  { key: "meal", title: "Meal Planner", draw: (ctx, W, H, M, st) => {
    header(ctx, W, M, "Meal Planner", st);
    grid(ctx, M, M * 1.8, W - M * 2, H - M * 2.6, 4, 8, st, ["DAY", "BREAKFAST", "LUNCH", "DINNER"]);
    const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]; const rh = (H - M * 2.6) / 8;
    ctx.fillStyle = st.acc; ctx.font = `bold ${rh * 0.28}px "${FB}"`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    days.forEach((d, i) => ctx.fillText(d, M + (W - M * 2) / 8, M * 1.8 + rh * (i + 1.5)));
  }},
  { key: "grocery", title: "Grocery List", draw: (ctx, W, H, M, st) => {
    header(ctx, W, M, "Grocery List", st);
    const cats = ["Produce", "Dairy", "Meat", "Pantry", "Frozen", "Household"]; const cols = 2, cw = (W - M * 2) / cols, ch = (H - M * 2.2) / 3;
    cats.forEach((cat, i) => { const x = M + (i % cols) * cw, y = M * 1.7 + Math.floor(i / cols) * ch;
      label(ctx, cat, x, y + W * 0.03, W * 0.03, st.acc); checkRows(ctx, x, y + W * 0.055, cw - W * 0.04, 5, W * 0.038, st); });
  }},
  { key: "budget", title: "Budget Planner", draw: (ctx, W, H, M, st) => {
    header(ctx, W, M, "Budget Planner", st);
    label(ctx, "INCOME", M, M * 1.8, W * 0.03, st.acc); vlines(ctx, M, M * 1.95, (W - M * 2) * 0.45, 5, W * 0.045, st.soft);
    label(ctx, "EXPENSES", W * 0.55, M * 1.8, W * 0.03, st.acc); vlines(ctx, W * 0.55, M * 1.95, W - M - W * 0.55, 10, W * 0.045, st.soft);
    ctx.fillStyle = st.soft; rr(ctx, M, H - M * 1.8, (W - M * 2) * 0.45, W * 0.12, W * 0.01); ctx.fill();
    label(ctx, "TOTAL", M + W * 0.02, H - M * 1.8 + W * 0.06, W * 0.03, st.ink);
  }},
  { key: "expense", title: "Expense Tracker", draw: (ctx, W, H, M, st) => {
    header(ctx, W, M, "Expense Tracker", st);
    grid(ctx, M, M * 1.8, W - M * 2, H - M * 2.6, 4, 18, st, ["DATE", "DESCRIPTION", "CATEGORY", "AMOUNT"]);
  }},
  { key: "savings", title: "Savings Tracker", draw: (ctx, W, H, M, st) => {
    header(ctx, W, M, "Savings Goal", st);
    label(ctx, "Goal Amount", M, M * 1.9, W * 0.035, st.ink);
    ctx.strokeStyle = st.soft; ctx.beginPath(); ctx.moveTo(M + W * 0.35, M * 1.9); ctx.lineTo(W - M, M * 1.9); ctx.stroke();
    const cols = 5, rows = 4, gap = W * 0.02, cw = (W - M * 2 - gap * (cols - 1)) / cols;
    for (let i = 0; i < cols * rows; i++) { const x = M + (i % cols) * (cw + gap), y = M * 2.5 + Math.floor(i / cols) * (cw + gap);
      ctx.strokeStyle = st.acc; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + cw / 2, y + cw / 2, cw * 0.42, 0, 7); ctx.stroke(); }
  }},
  { key: "debt", title: "Debt Tracker", draw: (ctx, W, H, M, st) => {
    header(ctx, W, M, "Debt Payoff", st);
    grid(ctx, M, M * 1.8, W - M * 2, H - M * 2.6, 4, 14, st, ["CREDITOR", "BALANCE", "PAID", "REMAINING"]);
  }},
  { key: "habit", title: "Habit Tracker", draw: (ctx, W, H, M, st) => {
    header(ctx, W, M, "Habit Tracker", st);
    const labelW = W * 0.28, days = 31, gw = W - M * 2 - labelW, colW = gw / days, y0 = M * 1.9;
    ctx.fillStyle = st.muted; ctx.font = `400 ${W * 0.012}px "${FR}"`; ctx.textAlign = "center";
    for (let d = 0; d < days; d++) ctx.fillText(String(d + 1), M + labelW + d * colW + colW / 2, y0 - W * 0.01);
    const rows = 12, rh = (H - M * 2 - y0 + M) / rows;
    for (let r = 0; r < rows; r++) { const y = y0 + r * rh;
      ctx.fillStyle = st.soft; rr(ctx, M, y, labelW - W * 0.01, rh - 6, W * 0.006); ctx.fill();
      for (let d = 0; d < days; d++) { ctx.strokeStyle = st.soft; ctx.lineWidth = 1; ctx.strokeRect(M + labelW + d * colW, y, colW, rh - 6); } }
  }},
  { key: "mood", title: "Mood Tracker", draw: (ctx, W, H, M, st) => {
    header(ctx, W, M, "Mood Tracker", st);
    const cols = 7, rows = 5, gap = W * 0.02, cw = (W - M * 2 - gap * (cols - 1)) / cols, y0 = M * 1.9;
    for (let i = 0; i < 31; i++) { const x = M + (i % cols) * (cw + gap), y = y0 + Math.floor(i / cols) * (cw + gap);
      ctx.fillStyle = st.soft; ctx.beginPath(); ctx.arc(x + cw / 2, y + cw / 2, cw * 0.45, 0, 7); ctx.fill();
      ctx.fillStyle = st.muted; ctx.font = `400 ${cw * 0.3}px "${FR}"`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(i + 1), x + cw / 2, y + cw / 2); }
  }},
  { key: "workout", title: "Workout Planner", draw: (ctx, W, H, M, st) => {
    header(ctx, W, M, "Workout Planner", st);
    grid(ctx, M, M * 1.8, W - M * 2, H - M * 2.6, 4, 16, st, ["EXERCISE", "SETS", "REPS", "DONE"]);
  }},
  { key: "water", title: "Water Tracker", draw: (ctx, W, H, M, st) => {
    header(ctx, W, M, "Water Tracker", st);
    const rows = 14, perRow = 8, y0 = M * 1.9, rh = (H - M * 2 - y0 + M) / rows;
    for (let r = 0; r < rows; r++) { const y = y0 + r * rh;
      ctx.fillStyle = st.muted; ctx.font = `400 ${rh * 0.3}px "${FR}"`; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(`Day ${r + 1}`, M, y + rh / 2);
      for (let i = 0; i < perRow; i++) { const x = M + W * 0.12 + i * ((W - M * 2 - W * 0.12) / perRow);
        ctx.strokeStyle = st.acc; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x + rh * 0.3, y + rh / 2, rh * 0.28, 0, 7); ctx.stroke(); } }
  }},
  { key: "reading", title: "Reading Log", draw: (ctx, W, H, M, st) => {
    header(ctx, W, M, "Reading Log", st);
    grid(ctx, M, M * 1.8, W - M * 2, H - M * 2.6, 4, 14, st, ["TITLE", "AUTHOR", "DATE", "RATING"]);
  }},
  { key: "password", title: "Password Tracker", draw: (ctx, W, H, M, st) => {
    header(ctx, W, M, "Password Tracker", st);
    grid(ctx, M, M * 1.8, W - M * 2, H - M * 2.6, 3, 16, st, ["WEBSITE", "USERNAME", "PASSWORD"]);
  }},
  { key: "notes", title: "Notes", draw: (ctx, W, H, M, st) => {
    header(ctx, W, M, "Notes", st);
    ctx.fillStyle = st.acc; const dot = W * 0.004;
    for (let y = M * 1.8; y < H - M; y += W * 0.045) for (let x = M; x < W - M; x += W * 0.045) { ctx.beginPath(); ctx.arc(x, y, dot, 0, 7); ctx.fillStyle = st.muted + "55"; ctx.fill(); }
  }},
  { key: "reflection", title: "Reflection", draw: (ctx, W, H, M, st) => {
    header(ctx, W, M, "Monthly Reflection", st);
    const prompts = ["What went well?", "What could improve?", "What am I grateful for?", "Next month's intention"];
    let y = M * 1.8;
    for (const p of prompts) { label(ctx, p, M, y + W * 0.03, W * 0.03, st.acc); vlines(ctx, M, y + W * 0.055, W - M * 2, 3, W * 0.04, st.soft); y += W * 0.2; }
  }},
  // ===== 니치 전용 페이지 =====
  { key: "braindump", title: "Brain Dump", draw: (ctx, W, H, M, st) => {
    header(ctx, W, M, "Brain Dump", st);
    const cols = 2, cw = (W - M * 2 - W * 0.04) / 2;
    for (let cI = 0; cI < cols; cI++) { const x = M + cI * (cw + W * 0.04); ctx.fillStyle = st.soft; rr(ctx, x, M * 1.7, cw, H - M * 2.7, W * 0.012); ctx.fill(); }
  }},
  { key: "lessonplan", title: "Lesson Plan", draw: (ctx, W, H, M, st) => {
    header(ctx, W, M, "Lesson Plan", st);
    label(ctx, "SUBJECT", M, M * 1.8, W * 0.03, st.acc); vlines(ctx, M + W * 0.18, M * 1.78, (W - M * 2) * 0.4, 1, 0, st.soft);
    label(ctx, "DATE", W * 0.6, M * 1.8, W * 0.03, st.acc); vlines(ctx, W * 0.72, M * 1.78, W - M - W * 0.72, 1, 0, st.soft);
    const secs = ["Objectives", "Materials", "Activities", "Assessment", "Homework"]; let y = M * 2.2;
    for (const s of secs) { label(ctx, s, M, y + W * 0.03, W * 0.028, st.ink); vlines(ctx, M, y + W * 0.055, W - M * 2, 2, W * 0.04, st.soft); y += W * 0.14; }
  }},
  { key: "attendance", title: "Attendance", draw: (ctx, W, H, M, st) => {
    header(ctx, W, M, "Attendance", st);
    const labelW = W * 0.3, days = 20, gw = W - M * 2 - labelW, colW = gw / days, y0 = M * 1.9, rows = 16, rh = (H - M * 2 - y0 + M) / rows;
    ctx.fillStyle = st.muted; ctx.font = `400 ${W * 0.012}px "${FR}"`; ctx.textAlign = "center";
    for (let d = 0; d < days; d++) ctx.fillText(String(d + 1), M + labelW + d * colW + colW / 2, y0 - W * 0.008);
    for (let r = 0; r < rows; r++) { const y = y0 + r * rh; ctx.fillStyle = st.soft; rr(ctx, M, y, labelW - W * 0.01, rh - 5, W * 0.005); ctx.fill();
      for (let d = 0; d < days; d++) { ctx.strokeStyle = st.soft; ctx.lineWidth = 1; ctx.strokeRect(M + labelW + d * colW, y, colW, rh - 5); } }
  }},
  { key: "gradetracker", title: "Grade Tracker", draw: (ctx, W, H, M, st) => { header(ctx, W, M, "Grade Tracker", st); grid(ctx, M, M * 1.8, W - M * 2, H - M * 2.6, 4, 16, st, ["STUDENT", "ASSIGNMENT", "SCORE", "GRADE"]); }},
  { key: "parentnotes", title: "Parent Notes", draw: (ctx, W, H, M, st) => { header(ctx, W, M, "Parent Communication", st); grid(ctx, M, M * 1.8, W - M * 2, H - M * 2.6, 3, 14, st, ["DATE", "STUDENT", "NOTES"]); }},
  { key: "contentcal", title: "Content Calendar", draw: (ctx, W, H, M, st) => { header(ctx, W, M, "Content Calendar", st); grid(ctx, M, M * 1.8, W - M * 2, H - M * 2.6, 4, 16, st, ["DATE", "PLATFORM", "CONTENT IDEA", "STATUS"]); }},
  { key: "videoplan", title: "Video Planner", draw: (ctx, W, H, M, st) => {
    header(ctx, W, M, "Video / Post Planner", st);
    const secs = ["Title", "Hook", "Main Points", "Call To Action", "Hashtags"]; let y = M * 1.8;
    for (const s of secs) { label(ctx, s, M, y + W * 0.03, W * 0.028, st.acc); vlines(ctx, M, y + W * 0.055, W - M * 2, 2, W * 0.04, st.soft); y += W * 0.15; }
  }},
  { key: "keywords", title: "Keyword Research", draw: (ctx, W, H, M, st) => { header(ctx, W, M, "Keyword Research", st); grid(ctx, M, M * 1.8, W - M * 2, H - M * 2.6, 4, 18, st, ["KEYWORD", "VOLUME", "DIFFICULTY", "USE?"]); }},
  { key: "affiliate", title: "Affiliate Tracker", draw: (ctx, W, H, M, st) => { header(ctx, W, M, "Affiliate Tracker", st); grid(ctx, M, M * 1.8, W - M * 2, H - M * 2.6, 4, 16, st, ["PRODUCT", "LINK", "CLICKS", "EARNINGS"]); }},
  { key: "branddeals", title: "Brand Deals", draw: (ctx, W, H, M, st) => { header(ctx, W, M, "Brand Deals", st); grid(ctx, M, M * 1.8, W - M * 2, H - M * 2.6, 4, 14, st, ["BRAND", "DELIVERABLE", "FEE", "STATUS"]); }},
  { key: "analytics", title: "Analytics", draw: (ctx, W, H, M, st) => {
    header(ctx, W, M, "Monthly Analytics", st);
    const stats = ["Followers", "Views", "Engagement", "Revenue"]; const cw = (W - M * 2 - W * 0.06) / 4;
    stats.forEach((s, i) => { const x = M + i * (cw + W * 0.02); ctx.fillStyle = st.soft; rr(ctx, x, M * 1.7, cw, W * 0.18, W * 0.012); ctx.fill();
      label(ctx, s, x + W * 0.015, M * 1.7 + W * 0.04, W * 0.022, st.muted); });
    grid(ctx, M, M * 1.7 + W * 0.24, W - M * 2, H - (M * 1.7 + W * 0.24) - M, 3, 12, st, ["DATE", "METRIC", "VALUE"]);
  }},
  { key: "bills", title: "Bills Tracker", draw: (ctx, W, H, M, st) => { header(ctx, W, M, "Bills Tracker", st); grid(ctx, M, M * 1.8, W - M * 2, H - M * 2.6, 4, 18, st, ["BILL", "DUE DATE", "AMOUNT", "PAID"]); }},
  { key: "subscriptions", title: "Subscriptions", draw: (ctx, W, H, M, st) => { header(ctx, W, M, "Subscription Tracker", st); grid(ctx, M, M * 1.8, W - M * 2, H - M * 2.6, 4, 16, st, ["SERVICE", "COST", "RENEWAL", "CANCEL?"]); }},
  { key: "gratitude", title: "Gratitude", draw: (ctx, W, H, M, st) => {
    header(ctx, W, M, "Gratitude Journal", st);
    const days = 7; const rh = (H - M * 1.9) / days;
    for (let i = 0; i < days; i++) { const y = M * 1.7 + i * rh; ctx.fillStyle = st.acc; ctx.beginPath(); ctx.arc(M + W * 0.01, y + rh * 0.3, W * 0.008, 0, 7); ctx.fill();
      vlines(ctx, M + W * 0.04, y + rh * 0.5, W - M * 2 - W * 0.04, 2, rh * 0.28, st.soft); }
  }},
  { key: "selfcare", title: "Self Care", draw: (ctx, W, H, M, st) => {
    header(ctx, W, M, "Self Care Checklist", st);
    const cats = ["Mind", "Body", "Soul", "Social"]; const cols = 2, cw = (W - M * 2) / cols, ch = (H - M * 2.2) / 2;
    cats.forEach((cat, i) => { const x = M + (i % cols) * cw, y = M * 1.7 + Math.floor(i / cols) * ch;
      label(ctx, cat, x, y + W * 0.03, W * 0.03, st.acc); checkRows(ctx, x, y + W * 0.055, cw - W * 0.04, 5, W * 0.04, st); });
  }},
  { key: "goals", title: "Goal Setting", draw: (ctx, W, H, M, st) => {
    header(ctx, W, M, "Goal Setting", st);
    const secs = ["My Goal", "Why it matters", "Action Steps", "Deadline", "Reward"]; let y = M * 1.8;
    for (const s of secs) { label(ctx, s, M, y + W * 0.03, W * 0.028, st.acc); vlines(ctx, M, y + W * 0.055, W - M * 2, 2, W * 0.04, st.soft); y += W * 0.15; }
  }},
];

// ===== 니치 정의 (검색 키워드 + 전용 페이지 구성) =====
export interface Niche { key: string; label: string; keyword: string; pages: string[] }
export const NICHES: Niche[] = [
  { key: "adhd", label: "ADHD Planner", keyword: "ADHD Planner", pages: ["braindump", "priority", "daily", "timeblock", "habit", "mood", "goals", "reflection"] },
  { key: "budget", label: "Budget Planner", keyword: "Budget Planner", pages: ["monthly", "budget", "expense", "bills", "subscriptions", "savings", "debt", "reflection"] },
  { key: "teacher", label: "Teacher Planner", keyword: "Teacher Planner", pages: ["yearlygoals", "lessonplan", "weekly", "attendance", "gradetracker", "parentnotes", "notes"] },
  { key: "content", label: "Content Creator Planner", keyword: "Content Creator Planner", pages: ["yearlygoals", "contentcal", "videoplan", "keywords", "affiliate", "branddeals", "analytics", "monthly"] },
  { key: "etsyseller", label: "Etsy Seller Planner", keyword: "Etsy Seller Planner", pages: ["yearlygoals", "monthly", "expense", "keywords", "analytics", "bills", "branddeals", "notes"] },
  { key: "smallbiz", label: "Small Business Planner", keyword: "Small Business Planner", pages: ["yearlygoals", "monthly", "expense", "bills", "subscriptions", "analytics", "goals", "notes"] },
  { key: "fitness", label: "Fitness Planner", keyword: "Fitness Planner", pages: ["yearlygoals", "workout", "meal", "water", "habit", "mood", "reflection"] },
  { key: "selfcare", label: "Self Care Planner", keyword: "Self Care Planner", pages: ["selfcare", "mood", "habit", "water", "gratitude", "goals", "reflection"] },
  { key: "anxiety", label: "Anxiety Journal", keyword: "Anxiety Journal", pages: ["mood", "braindump", "gratitude", "habit", "reflection", "selfcare", "goals"] },
  { key: "student", label: "Student Planner", keyword: "Student Planner", pages: ["yearlygoals", "weekly", "timeblock", "gradetracker", "reading", "habit", "notes"] },
  { key: "wedding", label: "Wedding Planner", keyword: "Wedding Planner", pages: ["yearlygoals", "budget", "bills", "checklistGuests", "monthly", "notes"] },
  { key: "meal", label: "Meal Planner", keyword: "Meal Planner", pages: ["meal", "grocery", "habit", "water", "budget", "reflection"] },
];
// 페이지 키 중 미정의(checklistGuests)는 notes로 대체
function safeKey(k: string): string { return PAGES.find((p) => p.key === k) ? k : "notes"; }

// 니치 기반 번들 페이지 순서
function bundleSequence(nicheKey?: string): { key: string; title: string }[] {
  const niche = NICHES.find((n) => n.key === nicheKey);
  const seq: { key: string; title: string }[] = [];
  for (const k of ["cover", "welcome", "index"]) seq.push({ key: k, title: "" });
  for (let m = 0; m < 12; m++) seq.push({ key: "calendar", title: MONTHS[m] });
  const pages = niche ? niche.pages : ["yearlygoals", "monthly", "weekly", "daily", "habit", "mood", "notes", "reflection"];
  for (const k of pages) seq.push({ key: safeKey(k), title: "" });
  return seq;
}

export function pageCount(nicheKey?: string): number { return bundleSequence(nicheKey).length; }

function renderPageCanvas(key: string, monthTitle: string | undefined, W: number, H: number, st: Style, meta: BundleMeta) {
  ensureFont();
  const c = createCanvas(W, H); const ctx = c.getContext("2d");
  ctx.fillStyle = st.bg; ctx.fillRect(0, 0, W, H);
  const M = W * 0.085;
  const page = PAGES.find((p) => p.key === key)!;
  page.draw(ctx, W, H, M, st, meta);
  if (key === "calendar" && monthTitle) {
    ctx.fillStyle = st.ink; ctx.font = `bold ${W * 0.045}px "${FB}"`; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillText(monthTitle, M, M * 1.7);
  }
  return c;
}
function renderOnePage(key: string, monthTitle: string | undefined, W: number, H: number, st: Style, meta: BundleMeta): Buffer {
  return renderPageCanvas(key, monthTitle, W, H, st, meta).toBuffer("image/png");
}

export interface SizeDef { name: string; w: number; h: number }
// 무료 서버(저성능 CPU) 대응: A4 1종 + 적정 해상도로 경량화
export const BUNDLE_SIZES: SizeDef[] = [
  { name: "A4", w: 1240, h: 1754 },
];

// 한 사이즈 전체 번들 PDF
export function buildBundlePdf(st: Style, meta: BundleMeta, size: SizeDef, nicheKey?: string): Promise<Buffer> {
  const doc = new PDFDocument({ size: [size.w * 0.48, size.h * 0.48], margin: 0, bufferPages: true });
  const chunks: Buffer[] = []; doc.on("data", (c) => chunks.push(c as Buffer));
  const done = new Promise<Buffer>((r) => doc.on("end", () => r(Buffer.concat(chunks))));
  const PW = doc.page.width, PH = doc.page.height;
  bundleSequence(nicheKey).forEach((pg, i) => {
    if (i > 0) doc.addPage({ size: [PW, PH], margin: 0 });
    const png = renderOnePage(pg.key, pg.title, size.w, size.h, st, meta);
    try { doc.image(png, 0, 0, { width: PW, height: PH }); } catch {}
  });
  doc.end();
  return done;
}

// 커버 썸네일
export function coverThumbnail(st: Style, meta: BundleMeta): Buffer {
  return renderOnePage("cover", undefined, 1000, 1414, st, meta);
}

// 목업 (책상 위 인쇄물 느낌)
export async function bundleMockup(st: Style, meta: BundleMeta, nicheKey?: string): Promise<Buffer> {
  const { loadImage } = await import("@napi-rs/canvas");
  const S = 1200; const c = createCanvas(S, S); const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, S); g.addColorStop(0, "#eceae5"); g.addColorStop(1, "#dcd8d1");
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  const cov = await loadImage(renderOnePage("cover", undefined, 1000, 1414, st, meta));
  const w = S * 0.46, h = w * 1.414, x = (S - w) / 2, y = S * 0.13;
  ctx.save(); ctx.shadowColor = "#00000030"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 24;
  ctx.fillStyle = "#fff"; ctx.fillRect(x - 8, y - 8, w + 16, h + 16); ctx.restore();
  ctx.drawImage(cov, x, y, w, h);
  ctx.fillStyle = st.ink; ctx.textAlign = "center"; ctx.font = `bold 30px "${FB}"`;
  ctx.fillText(`${bundleSequence(nicheKey).length} Pages · ${st.name}`, S / 2, S * 0.93);
  return c.toBuffer("image/png");
}

// Etsy 리스팅용 "전 페이지 미리보기 그리드" (포함 내역 이미지)
export function previewGrid(st: Style, meta: BundleMeta, nicheKey?: string): Buffer {
  ensureFont();
  const seq = bundleSequence(nicheKey);
  const cols = 6, cell = 300, ch = Math.round(cell * 1.414), gap = 22, pad = 60, top = 150;
  const rows = Math.ceil(seq.length / cols);
  const W = pad * 2 + cols * cell + (cols - 1) * gap;
  const H = top + pad + rows * ch + (rows - 1) * gap + 40;
  const c = createCanvas(W, H); const ctx = c.getContext("2d");
  ctx.fillStyle = "#f3f1ec"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#2b2b2b"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `bold 64px "${FB}"`; ctx.fillText(`${seq.length} PRINTABLE PAGES`, W / 2, 70);
  ctx.fillStyle = "#8a8a8a"; ctx.font = `400 30px "${FR}"`; ctx.fillText(`${st.name} · A4 · Instant Download`, W / 2, 116);
  seq.forEach((pg, i) => {
    const x = pad + (i % cols) * (cell + gap), y = top + Math.floor(i / cols) * (ch + gap);
    const mini = renderPageCanvas(pg.key, pg.title, cell, ch, st, meta);
    ctx.drawImage(mini, x, y, cell, ch);
    ctx.strokeStyle = "#00000012"; ctx.lineWidth = 1; ctx.strokeRect(x, y, cell, ch);
  });
  return c.toBuffer("image/png");
}
