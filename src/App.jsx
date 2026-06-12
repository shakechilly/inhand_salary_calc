import { useState, useEffect, useRef, useCallback } from "react";

// ── Tax slabs: New Regime FY 2025-26 ──────────────────────────────────────
const SLABS = [
  { min: 0,        max: 400000,   rate: 0.00 },
  { min: 400000,   max: 800000,   rate: 0.05 },
  { min: 800000,   max: 1200000,  rate: 0.10 },
  { min: 1200000,  max: 1600000,  rate: 0.15 },
  { min: 1600000,  max: 2000000,  rate: 0.20 },
  { min: 2000000,  max: 2400000,  rate: 0.25 },
  { min: 2400000,  max: Infinity, rate: 0.30 },
];

function computeTax(ti) {
  if (ti <= 0) return 0;
  let base = 0;
  for (const s of SLABS) {
    if (ti <= s.min) break;
    base += (Math.min(ti, s.max) - s.min) * s.rate;
  }
  if (ti <= 700000) base = 0;
  return base * 1.04;
}

function slabBreakdown(ti) {
  return SLABS.filter(s => ti > s.min).map(s => ({
    ...s, taxHere: (Math.min(ti, s.max) - s.min) * s.rate,
  }));
}

// pfFixed: if true, both employee & employer PF = 1800/mo = 21600/yr
function calcAll(ctc, pfPct, npsPct, pfFixed) {
  const basic   = ctc / 2;
  const empPF   = pfFixed ? 21600 : basic * pfPct  / 100;
  const emplPF  = pfFixed ? 21600 : basic * pfPct  / 100;
  const nps     = basic * npsPct / 100;
  const taxableIncome = ctc - empPF - nps - 75000;
  const annualTax     = computeTax(Math.max(0, taxableIncome));
  const preMonthly    = (ctc - empPF - emplPF - nps) / 12;
  const inHand        = preMonthly - annualTax / 12;
  return { basic, empPF, emplPF, nps, taxableIncome, annualTax, preMonthly, inHand };
}

const fmtINR = n => "₹" + Math.round(n).toLocaleString("en-IN");
const fmtL = n => {
  if (n >= 10000000) return (n / 10000000).toFixed(1) + "Cr";
  if (n >= 100000)   return (n / 100000).toFixed(1) + "L";
  if (n >= 1000)     return (n / 1000).toFixed(0) + "K";
  return String(Math.round(n));
};

function ctcFromTaxable(ti, pfPct, npsPct, pfFixed) {
  if (pfFixed) {
    // taxable = ctc - 21600 - nps - 75000; nps = (ctc/2)*npsPct/100 = ctc*npsPct/200
    // taxable = ctc*(1 - npsPct/200) - 21600 - 75000
    const k = 1 - npsPct / 200;
    return k <= 0 ? Infinity : (ti + 21600 + 75000) / k;
  }
  const k = 1 - (pfPct + npsPct) / 200;
  return k <= 0 ? Infinity : (ti + 75000) / k;
}

function piecewiseSections(pfPct, npsPct, pfFixed) {
  const bounds = [0];
  for (const s of SLABS) {
    if (s.max === Infinity) break;
    const c = ctcFromTaxable(s.max, pfPct, npsPct, pfFixed);
    if (c > 0 && c < 10000000) bounds.push(Math.round(c));
  }
  const rc = ctcFromTaxable(700000, pfPct, npsPct, pfFixed);
  if (rc > 0 && rc < 10000000) bounds.push(Math.round(rc));
  bounds.push(10000000);
  const u = [...new Set(bounds)].sort((a, b) => a - b);
  return u.slice(0, -1).map((lo, i) => ({ lo, hi: u[i + 1] }));
}

// ── Toggle component ───────────────────────────────────────────────────────
function Toggle({ checked, onChange, label }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "none", border: "none", cursor: "pointer",
        padding: "6px 10px 6px 0", color: checked ? "#5b8dff" : "#8892a4",
        fontSize: 12, fontWeight: checked ? 600 : 400, fontFamily: "system-ui,sans-serif",
        transition: "color 0.15s",
      }}
    >
      <div style={{
        width: 36, height: 20, borderRadius: 10,
        background: checked ? "#5b8dff" : "#252a38",
        border: checked ? "1px solid #5b8dff" : "1px solid #3a4060",
        position: "relative", transition: "background 0.2s",
        flexShrink: 0,
      }}>
        <div style={{
          position: "absolute", top: 2,
          left: checked ? 17 : 2,
          width: 14, height: 14, borderRadius: "50%",
          background: checked ? "#fff" : "#6b7280",
          transition: "left 0.2s",
        }} />
      </div>
      {label}
    </button>
  );
}

// ── Slider + text input ───────────────────────────────────────────────────
function SliderInput({ label, value, min, max, step, onSlider, onText, textVal, isPct, disabled }) {
  return (
    <div style={{ marginBottom: 14, opacity: disabled ? 0.4 : 1, transition: "opacity 0.2s" }}>
      <div style={{ fontSize: 11, color: "#8892a4", marginBottom: 5, fontWeight: 500 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="range" min={min} max={max} step={step} value={value}
          disabled={disabled}
          onChange={e => !disabled && onSlider(e.target.value)}
          style={{ flex: 1, accentColor: "#5b8dff", cursor: disabled ? "not-allowed" : "pointer", minWidth: 0 }} />
        <input type="text" value={textVal}
          disabled={disabled}
          onChange={e => !disabled && onText(e.target.value)}
          onBlur={e => !disabled && onText(e.target.value, true)}
          onKeyDown={e => e.key === "Enter" && !disabled && onText(e.target.value, true)}
          style={{
            width: isPct ? 54 : 90, background: "#0d0f14",
            border: "1px solid #252a38", borderRadius: 6,
            color: disabled ? "#4a5568" : "#5b8dff",
            fontFamily: "monospace", fontSize: 11, fontWeight: 700,
            padding: "3px 7px", textAlign: "right", outline: "none", flexShrink: 0,
          }} />
      </div>
    </div>
  );
}

function Card({ label, value, color }) {
  return (
    <div style={{ background: "#0d0f14", border: "1px solid #252a38", borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 9, letterSpacing: "1px", textTransform: "uppercase", color: "#4a5568", marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: color || "#e8eaf0" }}>{value}</div>
    </div>
  );
}

// ── Zoomable Graph ────────────────────────────────────────────────────────
function Graph({ pfPct, npsPct, pfFixed, currentCTC }) {
  const ref       = useRef(null);
  const stateRef  = useRef({ zoom: 1, panX: 0, isPanning: false, lastX: 0, lastPinchDist: null });

  const MAX_CTC = 10000000;
  const MIN_ZOOM = 1, MAX_ZOOM = 20;

  const clampPan = (panX, zoom, gW) => {
    const maxPan = gW * (zoom - 1);
    return Math.max(-maxPan, Math.min(0, panX));
  };

  const draw = useCallback(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.parentElement.clientWidth;
    const H = canvas.parentElement.clientHeight || 340;
    canvas.width  = W * dpr; canvas.height = H * dpr;
    canvas.style.width  = W + "px"; canvas.style.height = H + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const PAD = { t: 16, r: 20, b: 46, l: 68 };
    const gW = W - PAD.l - PAD.r, gH = H - PAD.t - PAD.b;
    const { zoom, panX } = stateRef.current;

    // Visible CTC range based on zoom + pan
    const visibleRange = MAX_CTC / zoom;
    const ctcStart = (-panX / gW) * MAX_CTC / zoom;
    const ctcEnd   = ctcStart + visibleRange;

    const STEPS = 500;
    const data = Array.from({ length: STEPS + 1 }, (_, i) => {
      const ctc = ctcStart + visibleRange * i / STEPS;
      return { ctc, y: calcAll(ctc, pfPct, npsPct, pfFixed).inHand };
    });

    const yMax = Math.max(...Array.from({ length: 201 }, (_, i) => calcAll(MAX_CTC * i / 200, pfPct, npsPct, pfFixed).inHand)) * 1.08;

    const toX = ctc => PAD.l + ((ctc - ctcStart) / visibleRange) * gW;
    const toY = v   => PAD.t + gH - (v / yMax) * gH;

    ctx.fillStyle = "#0d0f14"; ctx.fillRect(0, 0, W, H);

    // Clip graph area
    ctx.save();
    ctx.beginPath(); ctx.rect(PAD.l, PAD.t, gW, gH); ctx.clip();

    // Horizontal grid
    for (let i = 0; i <= 5; i++) {
      const y = yMax * i / 5, py = toY(y);
      ctx.strokeStyle = "#1a1e29"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD.l, py); ctx.lineTo(PAD.l + gW, py); ctx.stroke();
    }

    // Vertical grid — smart tick density
    const rawTick = MAX_CTC / zoom / 5;
    const mag = Math.pow(10, Math.floor(Math.log10(rawTick)));
    const norm = rawTick / mag;
    const nice = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
    const tickStep = nice * mag;
    const firstTick = Math.ceil(ctcStart / tickStep) * tickStep;

    for (let x = firstTick; x <= ctcEnd + tickStep; x += tickStep) {
      const px = toX(x);
      if (px < PAD.l || px > PAD.l + gW) continue;
      ctx.strokeStyle = "#1a1e29"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, PAD.t); ctx.lineTo(px, PAD.t + gH); ctx.stroke();
    }

    // Slab boundaries
    piecewiseSections(pfPct, npsPct, pfFixed).forEach(s => {
      if (s.lo <= 0 || s.lo >= MAX_CTC) return;
      const px = toX(s.lo);
      if (px < PAD.l || px > PAD.l + gW) return;
      ctx.strokeStyle = "rgba(91,141,255,0.22)"; ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(px, PAD.t); ctx.lineTo(px, PAD.t + gH); ctx.stroke();
      ctx.setLineDash([]);
    });

    // Gradient fill
    const grad = ctx.createLinearGradient(0, PAD.t, 0, PAD.t + gH);
    grad.addColorStop(0, "rgba(91,141,255,0.22)"); grad.addColorStop(1, "rgba(91,141,255,0.01)");
    ctx.beginPath();
    const x0 = toX(data[0].ctc), y0 = toY(Math.max(0, data[0].y));
    ctx.moveTo(x0, toY(0));
    data.forEach(d => ctx.lineTo(toX(d.ctc), toY(Math.max(0, d.y))));
    ctx.lineTo(toX(data[data.length-1].ctc), toY(0));
    ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(toX(data[0].ctc), toY(Math.max(0, data[0].y)));
    data.forEach(d => ctx.lineTo(toX(d.ctc), toY(Math.max(0, d.y))));
    ctx.strokeStyle = "#5b8dff"; ctx.lineWidth = 2.5; ctx.lineJoin = "round"; ctx.stroke();

    ctx.restore(); // end clip

    // Y-axis labels (outside clip)
    for (let i = 0; i <= 5; i++) {
      const y = yMax * i / 5, py = toY(y);
      ctx.fillStyle = "#4a5568"; ctx.font = "10px monospace"; ctx.textAlign = "right";
      ctx.fillText("₹" + fmtL(Math.round(y)), PAD.l - 6, py + 4);
    }

    // X-axis labels
    for (let x = firstTick; x <= ctcEnd + tickStep; x += tickStep) {
      const px = toX(x);
      if (px < PAD.l || px > PAD.l + gW) continue;
      ctx.fillStyle = "#4a5568"; ctx.font = "10px monospace"; ctx.textAlign = "center";
      ctx.fillText(fmtL(x), px, H - PAD.b + 14);
    }

    // Axis titles
    ctx.fillStyle = "#4a5568"; ctx.font = "11px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("Annual CTC (₹)", PAD.l + gW / 2, H - 2);
    ctx.save(); ctx.translate(11, PAD.t + gH / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText("In-Hand / Month (₹)", 0, 0); ctx.restore();

    // Axes
    ctx.strokeStyle = "#252a38"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.l, PAD.t); ctx.lineTo(PAD.l, PAD.t + gH);
    ctx.moveTo(PAD.l, PAD.t + gH); ctx.lineTo(PAD.l + gW, PAD.t + gH); ctx.stroke();

    // Current CTC marker (only if in view)
    if (currentCTC >= ctcStart && currentCTC <= ctcEnd) {
      const r  = calcAll(currentCTC, pfPct, npsPct, pfFixed);
      const px = toX(currentCTC);
      const py = toY(r.inHand);
      ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 1; ctx.setLineDash([3,3]);
      ctx.beginPath(); ctx.moveTo(px, PAD.t); ctx.lineTo(px, PAD.t + gH); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI*2);
      ctx.fillStyle = "#5b8dff"; ctx.fill(); ctx.strokeStyle = "#0d0f14"; ctx.lineWidth = 2.5; ctx.stroke();
      const lbl = "₹" + Math.round(r.inHand).toLocaleString("en-IN") + "/mo";
      ctx.font = "600 11px sans-serif";
      const tw = ctx.measureText(lbl).width;
      let bx = px + 12; if (bx + tw + 18 > PAD.l + gW) bx = px - tw - 28;
      const by = Math.max(py - 30, PAD.t + 4);
      ctx.fillStyle = "rgba(91,141,255,0.93)";
      ctx.beginPath(); ctx.roundRect(bx, by, tw + 16, 24, 4); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.fillText(lbl, bx + 8, by + 16);
    }

    // Zoom hint
    if (zoom > 1) {
      ctx.fillStyle = "rgba(91,141,255,0.7)";
      ctx.font = "10px monospace"; ctx.textAlign = "right";
      ctx.fillText(`${zoom.toFixed(1)}×`, W - PAD.r, PAD.t + 12);
    }
  }, [pfPct, npsPct, pfFixed, currentCTC]);

  // Mouse wheel zoom
  const onWheel = useCallback(e => {
    e.preventDefault();
    const canvas = ref.current;
    if (!canvas) return;
    const PAD = { l: 68, r: 20 }, gW = canvas.clientWidth - PAD.l - PAD.r;
    const s = stateRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - PAD.l;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, s.zoom * factor));
    // zoom around mouse position
    const ratio = mouseX / gW;
    const newPanX = (s.panX - ratio * gW * (newZoom - s.zoom) / s.zoom);
    s.zoom = newZoom;
    s.panX = clampPan(newPanX, newZoom, gW);
    draw();
  }, [draw]);

  // Mouse drag pan
  const onMouseDown = useCallback(e => {
    const s = stateRef.current;
    s.isPanning = true; s.lastX = e.clientX;
  }, []);
  const onMouseMove = useCallback(e => {
    const s = stateRef.current;
    if (!s.isPanning) return;
    const canvas = ref.current; if (!canvas) return;
    const PAD = { l: 68, r: 20 }, gW = canvas.clientWidth - PAD.l - PAD.r;
    const dx = e.clientX - s.lastX; s.lastX = e.clientX;
    s.panX = clampPan(s.panX + dx, s.zoom, gW);
    draw();
  }, [draw]);
  const onMouseUp = useCallback(() => { stateRef.current.isPanning = false; }, []);

  // Touch: pinch-to-zoom + drag pan
  const onTouchStart = useCallback(e => {
    const s = stateRef.current;
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      s.lastPinchDist = Math.sqrt(dx*dx + dy*dy);
    } else if (e.touches.length === 1) {
      s.isPanning = true; s.lastX = e.touches[0].clientX;
    }
  }, []);
  const onTouchMove = useCallback(e => {
    e.preventDefault();
    const s = stateRef.current;
    const canvas = ref.current; if (!canvas) return;
    const PAD = { l: 68, r: 20 }, gW = canvas.clientWidth - PAD.l - PAD.r;
    if (e.touches.length === 2 && s.lastPinchDist !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const factor = dist / s.lastPinchDist;
      s.lastPinchDist = dist;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, s.zoom * factor));
      const midX = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - canvas.getBoundingClientRect().left - PAD.l;
      const ratio = midX / gW;
      const newPanX = s.panX - ratio * gW * (newZoom - s.zoom) / s.zoom;
      s.zoom = newZoom;
      s.panX = clampPan(newPanX, newZoom, gW);
      draw();
    } else if (e.touches.length === 1 && s.isPanning) {
      const dx = e.touches[0].clientX - s.lastX; s.lastX = e.touches[0].clientX;
      s.panX = clampPan(s.panX + dx, s.zoom, gW);
      draw();
    }
  }, [draw]);
  const onTouchEnd = useCallback(() => {
    stateRef.current.isPanning = false;
    stateRef.current.lastPinchDist = null;
  }, []);

  // Reset zoom button
  const resetZoom = useCallback(() => {
    stateRef.current.zoom = 1; stateRef.current.panX = 0; draw();
  }, [draw]);

  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("touchmove", onTouchMove);
    };
  }, [onWheel, onTouchMove]);

  useEffect(() => {
    draw();
    const ro = new ResizeObserver(draw);
    if (ref.current?.parentElement) ro.observe(ref.current.parentElement);
    return () => ro.disconnect();
  }, [draw]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <canvas ref={ref}
        style={{ display: "block", width: "100%", height: "100%", borderRadius: 6, cursor: "crosshair", touchAction: "none" }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      />
      <button onClick={resetZoom} title="Reset zoom"
        style={{
          position: "absolute", top: 10, right: 28,
          background: "rgba(26,30,41,0.9)", border: "1px solid #252a38",
          borderRadius: 6, color: "#8892a4", fontSize: 10, fontFamily: "monospace",
          padding: "4px 8px", cursor: "pointer", letterSpacing: "0.5px",
        }}>
        ⟳ RESET
      </button>
      <div style={{ position: "absolute", bottom: 52, right: 28, fontSize: 9, color: "#3a4060", fontFamily: "monospace", pointerEvents: "none" }}>
        scroll/pinch to zoom · drag to pan
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────
export default function App() {
  const [ctc,     setCTC]     = useState(1200000);
  const [pfPct,   setPF]      = useState(12);
  const [npsPct,  setNPS]     = useState(10);
  const [pfFixed, setPFFixed] = useState(false);
  const [ctcTxt,  setCTCTxt]  = useState("12,00,000");
  const [pfTxt,   setPFTxt]   = useState("12%");
  const [npsTxt,  setNPSTxt]  = useState("10%");

  const r        = calcAll(ctc, pfPct, npsPct, pfFixed);
  const rows     = slabBreakdown(Math.max(0, r.taxableIncome));
  const sections = piecewiseSections(pfPct, npsPct, pfFixed);
  const rebated  = r.taxableIncome <= 700000;
  const k        = pfFixed ? null : 1 - (pfPct + npsPct) / 200;

  const handleCTCSlider = v => { const n=+v; setCTC(n); setCTCTxt(Math.round(n).toLocaleString("en-IN")); };
  const handlePFSlider  = v => { const n=+v; setPF(n);  setPFTxt(n+"%"); };
  const handleNPSSlider = v => { const n=+v; setNPS(n); setNPSTxt(n+"%"); };

  const commitCTC = (raw, go) => { setCTCTxt(raw); if(!go) return; const v=Math.max(0,Math.min(10000000,parseInt(raw.replace(/,/g,""))||0)); setCTC(v); setCTCTxt(v.toLocaleString("en-IN")); };
  const commitPF  = (raw, go) => { setPFTxt(raw);  if(!go) return; const v=Math.max(0,Math.min(12,parseFloat(raw)||0)); setPF(v);  setPFTxt(v+"%"); };
  const commitNPS = (raw, go) => { setNPSTxt(raw); if(!go) return; const v=Math.max(0,Math.min(14,parseFloat(raw)||0)); setNPS(v); setNPSTxt(v+"%"); };

  const T = {
    bg: "#0d0f14", surf: "#13161e", bdr: "1px solid #252a38",
    txt: "#e8eaf0", muted: "#8892a4", dim: "#4a5568",
    blue: "#5b8dff", red: "#ff6b6b", green: "#56d364", yellow: "#f0c040", teal: "#4ecdc4",
  };

  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.txt, fontFamily: "system-ui,sans-serif", padding: "clamp(12px,3vw,24px)", boxSizing: "border-box" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: "clamp(16px,3.5vw,22px)", fontWeight: 700, margin: 0, letterSpacing: "-0.4px" }}>CTC → In-Hand Salary</h1>
        <span style={{ fontFamily: "monospace", fontSize: 10, background: "rgba(91,141,255,0.12)", color: T.blue, border: "1px solid rgba(91,141,255,0.3)", padding: "3px 10px", borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>
          New Tax Regime · FY 2025-26
        </span>
      </div>

      {/* Main layout — responsive grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%,300px), 1fr))", gap: 16, alignItems: "start" }}>

        {/* LEFT PANEL */}
        <div style={{ background: T.surf, border: T.bdr, borderRadius: 12, padding: "clamp(14px,3vw,20px)", minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: T.muted, marginBottom: 14, paddingBottom: 10, borderBottom: T.bdr }}>Inputs</div>

          <SliderInput label="Annual CTC (₹)" value={ctc} min={0} max={10000000} step={10000}
            textVal={ctcTxt} isPct={false} onSlider={handleCTCSlider} onText={commitCTC} />

          {/* PF section with toggle */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 4 }}>
              <div style={{ fontSize: 11, color: T.muted, fontWeight: 500 }}>PF Contribution (each side)</div>
              <Toggle checked={pfFixed} onChange={setPFFixed} label="Fix at ₹1,800/mo" />
            </div>
            {pfFixed ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "rgba(91,141,255,0.08)", border: "1px solid rgba(91,141,255,0.2)", borderRadius: 8 }}>
                <span style={{ fontSize: 11, color: T.blue, fontFamily: "monospace" }}>₹1,800 / month (EPFO cap)</span>
                <span style={{ fontSize: 10, color: T.dim, marginLeft: "auto" }}>= ₹21,600 / yr</span>
              </div>
            ) : (
              <SliderInput label="" value={pfPct} min={0} max={12} step={0.5}
                textVal={pfTxt} isPct={true} onSlider={handlePFSlider} onText={commitPF} disabled={pfFixed} />
            )}
          </div>

          <SliderInput label="NPS % of Basic" value={npsPct} min={0} max={14} step={0.5}
            textVal={npsTxt} isPct={true} onSlider={handleNPSSlider} onText={commitNPS} />

          {/* Derivation */}
          <div style={{ background: T.bg, border: T.bdr, borderRadius: 8, padding: 12, marginTop: 4 }}>
            <div style={{ fontSize: 9, letterSpacing: "1.5px", textTransform: "uppercase", color: T.dim, marginBottom: 8 }}>Derivation</div>
            {[
              ["Basic",     "= CTC / 2",                            fmtINR(r.basic)],
              ["Emp PF", pfFixed
    ? "= ₹21,600/yr (₹1,800 × 12)"
    : "= Empl PF",
  fmtINR(r.empPF)
              ],
              ["NPS",       "=",                                     fmtINR(r.nps)],
              ["Taxable", pfFixed
    ? "= CTC − ₹21,600 − NPS − ₹75,000"
    : "= CTC − EmpPF − NPS − ₹75,000",
  fmtINR(r.taxableIncome)
              ],
              ["PreTax/mo", "= (CTC−EmpPF−EmplPF−NPS)/12",          fmtINR(r.preMonthly)],
            ].map(([sym, op, num]) => (
              <div key={sym} style={{ fontFamily: "monospace", fontSize: 10, lineHeight: 1.85, display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span style={{ color: T.teal, minWidth: 70 }}>{sym}</span>
                <span style={{ color: T.dim }}>{op}</span>
                <span style={{ color: T.yellow }}>{num}</span>
              </div>
            ))}
          </div>

          <div style={{ height: 1, background: "#252a38", margin: "14px 0" }} />

          {/* Slab table */}
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: T.muted, marginBottom: 10 }}>Tax Breakdown (Annual)</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "monospace", fontSize: 11, minWidth: 220 }}>
              <thead>
                <tr>{["Slab","Rate","Tax"].map(h => <th key={h} style={{ textAlign:"left", color:T.dim, fontSize:9, letterSpacing:"1px", textTransform:"uppercase", paddingBottom:6, fontWeight:500 }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const active = r.taxableIncome > row.min;
                  const c = active ? T.blue : T.muted;
                  return (
                    <tr key={row.min}>
                      <td style={{ padding:"4px 0", borderTop:"1px solid #252a38", color:c, borderLeft:active?"2px solid "+T.blue:"none", paddingLeft:active?6:0 }}>
                        {fmtL(row.min)}–{row.max===Infinity?"∞":fmtL(row.max)}
                      </td>
                      <td style={{ padding:"4px 0", borderTop:"1px solid #252a38", color:c }}>{(row.rate*100).toFixed(0)}%</td>
                      <td style={{ padding:"4px 0", borderTop:"1px solid #252a38", color:c }}>
                        {rebated && row.min < 700000 ? <span style={{color:T.green}}>Rebated</span> : fmtINR(row.taxHere)}
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td colSpan={2} style={{ color:T.muted, paddingTop:8, fontSize:10, borderTop:"1px solid #3a4060" }}>Total (incl. 4% cess)</td>
                  <td style={{ color:T.red, fontWeight:700, paddingTop:8, fontFamily:"monospace", borderTop:"1px solid #3a4060" }}>{fmtINR(r.annualTax)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Result cards */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:12 }}>
            <Card label="Taxable Income" value={fmtINR(r.taxableIncome)} />
            <Card label="Tax + Cess"     value={fmtINR(r.annualTax)}    color={T.red} />
            <Card label="Effective Rate" value={ctc>0 ? (r.annualTax/ctc*100).toFixed(1)+"%" : "0%"} />
            <Card label="In-Hand / Month" value={fmtINR(r.inHand)}      color={T.green} />
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>

          {/* Graph block — fills available height */}
          <div style={{ background: T.surf, border: T.bdr, borderRadius: 12, padding: "clamp(12px,2.5vw,18px)", minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 12 }}>
              y = In-Hand / Month &nbsp;·&nbsp; x = Annual CTC
            </div>
            <div style={{ width: "100%", height: "clamp(240px,40vw,420px)", position: "relative" }}>
              <Graph pfPct={pfPct} npsPct={npsPct} pfFixed={pfFixed} currentCTC={ctc} />
            </div>
          </div>

          {/* Piecewise function */}
          <div style={{ background: T.bg, border: T.bdr, borderRadius: 8, padding: "14px 16px", fontFamily: "monospace", minWidth: 0, overflowX: "auto" }}>
            <div style={{ fontSize: 9, letterSpacing: "1.5px", textTransform: "uppercase", color: T.dim, marginBottom: 10 }}>Piecewise Function · y(x) = In-Hand / month</div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", minWidth: 480 }}>
              <span style={{ color: T.blue, fontWeight: 700, fontSize: 13, paddingTop: 2 }}>y =</span>
              <span style={{ fontSize: 48, lineHeight: 1, color: T.dim, fontWeight: 100, marginTop: -4 }}>{`{`}</span>
              <div style={{ flex: 1 }}>
                {sections.map((sec, i) => {
                  const mid  = (sec.lo + sec.hi) / 2;
                  const sr   = calcAll(mid, pfPct, npsPct, pfFixed);
                  const slab = SLABS.find(s => sr.taxableIncome > s.min && sr.taxableIncome <= s.max) || SLABS[0];
                  const rate = sr.taxableIncome <= 700000 ? 0 : slab.rate;
                  const effR = rate * 1.04;
                  const act  = ctc >= sec.lo && ctc < sec.hi;
                  return (
                    <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:12, padding:"4px 0", paddingLeft:act?6:0, borderBottom:i<sections.length-1?"1px solid #252a38":"none", background:act?"rgba(91,141,255,0.06)":"transparent", borderRadius:act?4:0 }}>
                      <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.7 }}>
                        {pfFixed
                          ? <>  x·<span style={{color:T.yellow}}>
      {((1 - npsPct / 200) * 100).toFixed(1)}%
    </span>/12 −
    <span style={{color:T.dim}}>
      ₹43,200/yr PF (₹3,600/mo)
    </span>
  </>
                          : <>x·<span style={{color:T.yellow}}>{(k*100).toFixed(1)}%</span>/12</>
                        }
                        {effR > 0
                          ? <> − <span style={{color:T.red,fontWeight:700}}>{(effR*100).toFixed(2)}%</span> · tax-portion / 12</>
                          : <> − <span style={{color:T.green}}>0 (87A rebate)</span></>
                        }
                      </div>
                      <div style={{ fontSize: 11, color: act?T.blue:T.dim, whiteSpace:"nowrap", lineHeight:1.7 }}>
                        x∈[{fmtL(sec.lo)},{sec.hi>=10000000?"∞":fmtL(sec.hi)})
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #252a38", display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 6, textAlign: "center" }}>
        <span style={{ fontSize: 12, color: "#4a5568", fontFamily: "system-ui,sans-serif" }}>Developed by</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#8892a4", fontFamily: "system-ui,sans-serif" }}>Abhishek Pandey</span>
        <span style={{ fontSize: 12, color: "#252a38" }}>·</span>
        <a href="https://github.com/shakechilly" target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 12, color: "#5b8dff", textDecoration: "none", fontFamily: "monospace", display: "flex", alignItems: "center", gap: 5 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          github.com/shakechilly
        </a>
      </div>
    </div>
  );
}
