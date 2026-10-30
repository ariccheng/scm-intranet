/* ---- Stage and camera ------------------------------------------------------------
   The desk is a fixed-ratio stage (scene.json stage.width x height, 16:10
   here). It is scaled to cover the window unless that would cut into the
   "safe" area holding every clickable object; then it is scaled to fit that
   area and the matte colour fills the rest. Positions in scene.json are
   percentages of the stage.

   The camera is one transform on .camera, which holds the stage. Zooming in
   brings the monitor's face to the middle of the window and scales it until
   a thin margin is left, so the bezel stays in view. The computer's screen
   (#os) is not scaled with it: it is placed at its real pixel size where the
   monitor's screen lands, so text stays sharp. If the desk photo is taken at
   an angle, monitor.corners (four [x, y] points: top-left, top-right,
   bottom-right, bottom-left) map #os onto the screen with a 3D transform. */
import { wait, reducedMotion } from "../core/dom.js";

let SC = null, L = null, els = null, cam = null, onLayout = null;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function setup(scene, nodes, changed) {
  SC = scene; els = nodes; onLayout = changed;
  els.stage.style.setProperty("--matte", scene.stage.matte || "");
  new ResizeObserver(() => layout()).observe(document.documentElement);
  layout();
}

function safeArea() {
  if (SC.safe) return SC.safe;
  const rs = [...SC.objects, SC.monitor.face];
  const x0 = Math.min(...rs.map(r => r.x)), y0 = Math.min(...rs.map(r => r.y));
  const x1 = Math.max(...rs.map(r => r.x + r.w)), y1 = Math.max(...rs.map(r => r.y + r.h));
  const x = clamp(x0 - 3, 0, 100), y = clamp(y0 - 3, 0, 100);
  return { x, y, w: clamp(x1 + 3, 0, 100) - x, h: clamp(y1 + 3, 0, 100) - y };
}

export function layout() {
  if (!SC) return;
  const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
  if (!vw || !vh) return;
  const W = SC.stage.width, H = SC.stage.height, safe = safeArea();
  const s = Math.min(Math.max(vw / W, vh / H), vw / (safe.w / 100 * W), vh / (safe.h / 100 * H));
  const sw = W * s, sh = H * s;
  let ox = vw / 2 - (safe.x + safe.w / 2) / 100 * sw, oy = vh / 2 - (safe.y + safe.h / 2) / 100 * sh;
  ox = sw >= vw ? clamp(ox, vw - sw, 0) : (vw - sw) / 2;
  oy = sh >= vh ? clamp(oy, vh - sh, 0) : (vh - sh) / 2;
  L = { vw, vh, sw, sh, ox, oy };
  Object.assign(els.stage.style, { width: sw + "px", height: sh + "px", left: ox + "px", top: oy + "px" });
  els.stage.style.setProperty("--u", sw / 100 + "px");
  if (cam) set(cameraFor());
  if (onLayout) onLayout();
}

/* a scene rectangle (percent) in window pixels, before the camera moves */
export const toView = r => ({ x: L.ox + r.x / 100 * L.sw, y: L.oy + r.y / 100 * L.sh, w: r.w / 100 * L.sw, h: r.h / 100 * L.sh });

export function cameraFor() {
  const F = toView(SC.monitor.face), S = toView(SC.monitor.screen);
  const g = clamp(.025 * Math.min(L.vw, L.vh), 12, 40);
  const k = Math.min((L.vw - 2 * g) / F.w, (L.vh - 2 * g) / F.h);
  const tx = L.vw / 2 - k * (F.x + F.w / 2), ty = L.vh / 2 - k * (F.y + F.h / 2);
  const out = { k, tx, ty, screen: { x: tx + k * S.x, y: ty + k * S.y, w: k * S.w, h: k * S.h,
    r: (SC.monitor.screen.radius || 0) / 100 * L.sw * k, matrix: null } };
  const c = SC.monitor.corners;
  if (Array.isArray(c) && c.length === 4) {
    const q = c.map(([x, y]) => [tx + k * (L.ox + x / 100 * L.sw), ty + k * (L.oy + y / 100 * L.sh)]);
    const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const w = (d(q[0], q[1]) + d(q[3], q[2])) / 2, h = (d(q[0], q[3]) + d(q[1], q[2])) / 2;
    Object.assign(out.screen, { x: 0, y: 0, w, h, r: 0, matrix: quad(w, h, q) });
  }
  return out;
}

/* move the camera; c = null goes back to the whole desk */
export async function move(c) {
  const t = c ? `translate(${c.tx}px, ${c.ty}px) scale(${c.k})` : "none";
  cam = c;
  if (reducedMotion()) {
    els.viewport.classList.add("fade");
    await wait(180);
    set(c, false);
    els.viewport.classList.remove("fade");
    await wait(180);
    return;
  }
  const el = els.camera;
  el.style.willChange = "transform";
  el.style.transition = "transform var(--t-cam) var(--ease-cam)";
  void el.offsetWidth;
  el.style.transform = t;
  await new Promise(done => {
    const end = e => {
      if (e && (e.target !== el || e.propertyName !== "transform")) return;   // children's transitions bubble up too
      clearTimeout(timer); el.removeEventListener("transitionend", end); done();
    };
    const timer = setTimeout(end, 760);
    el.addEventListener("transitionend", end);
  });
  el.style.transition = "";
  el.style.willChange = "";
}

/* jump without animation (window resized, layout switched) */
export function set(c, keep = true) {
  if (keep) cam = c;
  els.camera.style.transition = "";
  els.camera.style.transform = c ? `translate(${c.tx}px, ${c.ty}px) scale(${c.k})` : "none";
}

/* CSS matrix3d that maps the rectangle (0,0)-(w,h) onto the quad q */
export function quad(w, h, q) {
  const src = [[0, 0], [w, 0], [w, h], [0, h]], A = [], b = [];
  src.forEach(([x, y], i) => {
    const [u, v] = q[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  });
  const m = solve(A, b);
  if (!m) return null;
  const [a, bb, c, d, e, f, g, hh] = m;
  return `matrix3d(${a},${d},0,${g},${bb},${e},0,${hh},0,0,1,0,${c},${f},0,1)`;
}
function solve(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}
