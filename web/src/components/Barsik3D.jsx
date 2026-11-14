import { useEffect, useRef } from "react";
import { AmbientLight, BoxGeometry, Color, CylinderGeometry, DirectionalLight, Group, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, SphereGeometry, WebGLRenderer } from "three";

// 3D-модель Барсика с логотипа: снежный барс в красной кепке выглядывает из-за жёлтого бортика.
// Собрана из примитивов three.js, без внешних файлов моделей.
function buildBarsik() {
  const mat = (color, rough = 0.85) => new MeshStandardMaterial({ color: new Color(color), roughness: rough, metalness: 0 });
  const fur = mat("#d9d3c4"), cream = mat("#f7f3ea"), dark = mat("#34332f"), red = mat("#d62828", 0.6), redD = mat("#a51d1d", 0.6), green = mat("#9bd13a", 0.3), black = mat("#111214", 0.2), yellow = mat("#ffcc33", 0.5), pink = mat("#c98a8a");
  const sphere = (r, m, [x, y, z], [sx, sy, sz] = [1, 1, 1], seg = 28) => { const o = new Mesh(new SphereGeometry(r, seg, seg), m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); return o; };

  const root = new Group();
  const head = new Group(); root.add(head);
  head.add(sphere(1, fur, [0, 0, 0], [1.08, 0.96, 1]));
  // уши
  for (const s of [-1, 1]) { head.add(sphere(0.3, fur, [0.68 * s, 0.7, -0.05])); head.add(sphere(0.17, pink, [0.68 * s, 0.7, 0.12])); }
  // морда, нос, щёки
  head.add(sphere(0.46, cream, [0, -0.3, 0.72], [1.25, 0.8, 0.85]));
  head.add(sphere(0.11, dark, [0, -0.14, 1.1], [1.25, 0.8, 0.7]));
  // глаза: белок, зелёная радужка, вертикальный зрачок, тяжёлое веко — тот самый хитрый взгляд
  const eyes = new Group(); head.add(eyes);
  for (const s of [-1, 1]) {
    eyes.add(sphere(0.19, cream, [0.37 * s, 0.1, 0.8]));
    eyes.add(sphere(0.135, green, [0.37 * s, 0.09, 0.89]));
    eyes.add(sphere(0.07, black, [0.37 * s, 0.08, 0.99], [0.55, 1.1, 0.6]));
    const lid = sphere(0.21, fur, [0.37 * s, 0.2, 0.82], [1.05, 0.62, 1]); lid.rotation.z = -0.28 * s; head.add(lid);
    const brow = new Mesh(new BoxGeometry(0.34, 0.05, 0.06), dark); brow.position.set(0.37 * s, 0.25, 0.99); brow.rotation.z = -0.3 * s; head.add(brow);
  }
  // пятна-розетки
  const spots = [[0.86, 0.12, 0.52], [0.98, -0.2, 0.2], [0.8, -0.5, 0.5], [0.62, 0.4, 0.72], [0.92, 0.35, 0.05], [0.7, -0.62, 0.2], [1.02, 0.05, -0.2]];
  for (const [x, y, z] of spots) for (const s of [-1, 1]) head.add(sphere(0.085, dark, [x * s, y, z], [0.5, 1, 1], 12));
  // красная кепка козырьком назад-вбок
  const cap = new Group(); head.add(cap);
  const dome = new Mesh(new SphereGeometry(1.06, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2.15), red); dome.scale.set(1.08, 0.92, 1.02); dome.position.y = 0.22; cap.add(dome);
  const band = new Mesh(new CylinderGeometry(1.13, 1.13, 0.1, 40, 1, true), redD); band.position.y = 0.33; band.scale.set(1.02, 1, 0.96); cap.add(band);
  const brim = new Mesh(new CylinderGeometry(0.62, 0.62, 0.07, 28), redD); brim.scale.set(1.25, 1, 0.9); brim.position.set(0.95, 0.42, -0.72); brim.rotation.set(0.15, 0, -0.12); cap.add(brim);
  cap.add(sphere(0.09, redD, [0, 1.2, 0]));
  cap.rotation.z = 0.1;
  // жёлтый бортик («значок 1С») и лапы на нём
  const ledge = new Mesh(new BoxGeometry(3.3, 0.7, 1.3), yellow); ledge.position.set(0, -1.45, 0.45); root.add(ledge);
  const paws = [];
  for (const s of [-1, 1]) {
    const paw = new Group(); paw.position.set(0.82 * s, -1.02, 0.98);
    paw.add(sphere(0.3, cream, [0, 0, 0], [1.1, 0.7, 1.1]));
    for (const t of [-0.17, 0, 0.17]) paw.add(sphere(0.085, fur, [t, -0.02, 0.27], [1, 1, 1], 10));
    root.add(paw); paws.push(paw);
  }
  return { root, head, eyes, paws };
}

/** Канвас с 3D-Барсиком: голова следит за курсором, моргает, кивает при клике. */
export default function Barsik3D({ size = 132, nudge = 0 }) {
  const host = useRef(null);
  const nudgeRef = useRef(nudge);
  const bounce = useRef(0);
  useEffect(() => { if (nudge !== nudgeRef.current) { nudgeRef.current = nudge; bounce.current = 1; } }, [nudge]);

  useEffect(() => {
    let renderer;
    try { renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" }); }
    catch { host.current?.classList.add("no-webgl"); return undefined; }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr); renderer.setSize(size, size);
    host.current.appendChild(renderer.domElement);
    const scene = new Scene();
    const camera = new PerspectiveCamera(32, 1, 0.1, 50); camera.position.set(0, -0.15, 6.3);
    scene.add(new AmbientLight(0xffffff, 1.5));
    const sun = new DirectionalLight(0xfff4d6, 2.2); sun.position.set(2.5, 4, 5); scene.add(sun);
    const rim = new DirectionalLight(0x9ecbff, 0.7); rim.position.set(-4, 1, -2); scene.add(rim);
    const { root, head, eyes, paws } = buildBarsik();
    scene.add(root);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const target = { x: 0, y: 0 };
    const onMove = (e) => {
      const r = renderer.domElement.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      target.y = Math.max(-0.65, Math.min(0.65, dx / 500)); target.x = Math.max(-0.35, Math.min(0.4, dy / 500));
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    let raf = 0, t0 = performance.now(), blinkAt = t0 + 2500, visible = true;
    const onVis = () => { visible = !document.hidden; if (visible) loop(performance.now()); };
    document.addEventListener("visibilitychange", onVis);
    function loop(now) {
      if (!visible) return;
      const t = (now - t0) / 1000;
      head.rotation.y += (target.y - head.rotation.y) * 0.08;
      head.rotation.x += (target.x - head.rotation.x) * 0.08;
      if (!reduce) { head.position.y = Math.sin(t * 1.6) * 0.035; head.rotation.z = Math.sin(t * 0.9) * 0.03; paws[0].position.y = -1.02 + Math.max(0, Math.sin(t * 0.7)) * 0.03; }
      if (bounce.current > 0) { bounce.current = Math.max(0, bounce.current - 0.04); head.position.y += Math.sin(bounce.current * Math.PI * 3) * 0.12 * bounce.current; }
      const blink = now > blinkAt ? Math.max(0.08, Math.abs(1 - (now - blinkAt) / 90)) : 1;
      if (now > blinkAt + 180) blinkAt = now + 2200 + Math.random() * 3500;
      eyes.scale.y = Math.min(1, blink);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); visible = false;
      window.removeEventListener("pointermove", onMove); document.removeEventListener("visibilitychange", onVis);
      scene.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      renderer.dispose(); renderer.domElement.remove();
    };
  }, [size]);

  return <div ref={host} className="barsik3d" style={{ width: size, height: size }} aria-hidden="true" />;
}
