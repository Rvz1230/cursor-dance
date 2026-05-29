import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const PARTICLE_INTERVAL = 1200;

function AuroraPreview() {
  const [particles, setParticles] = useState([]);
  const idRef = useRef(0);
  useEffect(() => {
    const spawn = () => {
      const newId = ++idRef.current;
      const colors = ["#a78bfa", "#818cf8", "#6366f1", "#22d3ee", "#38bdf8"];
      const x = 30 + Math.random() * 40;
      const count = 4 + Math.floor(Math.random() * 4);
      const batch = [];
      for (let i = 0; i < count; i++) {
        batch.push({
          key: `${newId}-${i}`,
          x: x + (Math.random() - 0.5) * 30,
          color: colors[i % colors.length],
          delay: i * 0.08,
          tx: (Math.random() - 0.5) * 40,
          ty: -(40 + Math.random() * 60),
          size: 2 + Math.random() * 3,
        });
      }
      setParticles((p) => [...p.slice(-30), ...batch]);
    };
    spawn();
    const timer = setInterval(spawn, PARTICLE_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.key}
            initial={{ x: 0, y: 0, opacity: 0.9, scale: 1 }}
            animate={{ x: p.tx, y: p.ty, opacity: 0, scale: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, delay: p.delay, ease: "easeOut" }}
            className="absolute rounded-full"
            style={{
              left: `${p.x}%`,
              top: "75%",
              width: p.size,
              height: p.size,
              background: p.color,
              boxShadow: `0 0 6px ${p.color}`,
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function FlamePreview() {
  const [rings, setRings] = useState([]);
  const idRef = useRef(0);
  useEffect(() => {
    const spawn = () => {
      const newId = ++idRef.current;
      setRings((r) => [
        ...r.slice(-4),
        { key: newId, delay: 0 },
        { key: newId + 0.5, delay: 0.35 },
      ]);
    };
    spawn();
    const timer = setInterval(spawn, 1600);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
      <AnimatePresence>
        {rings.map((r) => (
          <motion.div
            key={r.key}
            initial={{ scale: 0.2, opacity: 0.7 }}
            animate={{ scale: 1.8, opacity: 0 }}
            transition={{ duration: 1.2, delay: r.delay, ease: "easeOut" }}
            className="absolute rounded-full border-2"
            style={{
              width: 50,
              height: 50,
              borderColor: r.delay > 0 ? "rgba(251,146,60,0.6)" : "rgba(239,68,68,0.6)",
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function MinimalPreview() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 4 + i * 2,
            height: 4 + i * 2,
            background: `rgba(255,255,255,${0.5 - i * 0.15})`,
            top: `${35 + i * 12}%`,
          }}
          animate={{
            left: ["15%", "65%", "35%", "15%"],
            top: [`${35 + i * 12}%`, `${28 + i * 8}%`, `${42 + i * 6}%`, `${35 + i * 12}%`],
          }}
          transition={{ duration: 3 + i, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function NeonPreview() {
  const [flashes, setFlashes] = useState([]);
  const idRef = useRef(0);
  useEffect(() => {
    const spawn = () => {
      const colors = ["#f472b6", "#c084fc", "#22d3ee", "#f9a8d4"];
      const batch = [];
      for (let i = 0; i < 6; i++) {
        batch.push({
          key: ++idRef.current,
          x: 25 + Math.random() * 50,
          y: 25 + Math.random() * 50,
          color: colors[i % colors.length],
          delay: i * 0.06,
        });
      }
      setFlashes((f) => [...f.slice(-20), ...batch]);
    };
    spawn();
    const timer = setInterval(spawn, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <AnimatePresence>
        {flashes.map((f) => (
          <motion.div
            key={f.key}
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 0.5, delay: f.delay, ease: "easeOut" }}
            className="absolute rounded-full"
            style={{
              left: `${f.x}%`,
              top: `${f.y}%`,
              width: 4,
              height: 4,
              background: f.color,
              boxShadow: `0 0 10px ${f.color}, 0 0 20px ${f.color}`,
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function StardustPreview() {
  const [dust, setDust] = useState([]);
  const idRef = useRef(0);
  useEffect(() => {
    const spawn = () => {
      const colors = ["#fbbf24", "#f59e0b", "#fcd34d", "#fbbf24", "#f97316"];
      const batch = [];
      for (let i = 0; i < 5; i++) {
        batch.push({
          key: ++idRef.current,
          x: 15 + Math.random() * 70,
          color: colors[i],
          delay: i * 0.1,
          tx: 20 + Math.random() * 50,
          ty: 30 + Math.random() * 40,
          size: 2 + Math.random() * 2,
        });
      }
      setDust((d) => [...d.slice(-25), ...batch]);
    };
    spawn();
    const timer = setInterval(spawn, 900);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <AnimatePresence>
        {dust.map((d) => (
          <motion.div
            key={d.key}
            initial={{ x: 0, y: 0, opacity: 0.9, scale: 1 }}
            animate={{ x: d.tx, y: d.ty, opacity: 0, scale: 0.3 }}
            transition={{ duration: 1.2, delay: d.delay, ease: "easeOut" }}
            className="absolute rounded-full"
            style={{
              left: `${d.x}%`,
              top: "45%",
              width: d.size,
              height: d.size,
              background: d.color,
              boxShadow: `0 0 8px ${d.color}`,
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function OceanPreview() {
  const [waves, setWaves] = useState([]);
  const idRef = useRef(0);
  useEffect(() => {
    const spawn = () => {
      const newId = ++idRef.current;
      setWaves((w) => [
        ...w.slice(-4),
        { key: newId, size: 40, color: "rgba(45,212,191,0.5)", delay: 0 },
        { key: newId + 0.5, size: 55, color: "rgba(34,211,238,0.35)", delay: 0.4 },
      ]);
    };
    spawn();
    const timer = setInterval(spawn, 1800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
      <AnimatePresence>
        {waves.map((w) => (
          <motion.div
            key={w.key}
            initial={{ scale: 0.15, opacity: 0.6 }}
            animate={{ scale: 1.9, opacity: 0 }}
            transition={{ duration: 1.3, delay: w.delay, ease: "easeOut" }}
            className="absolute rounded-full border"
            style={{
              width: w.size,
              height: w.size,
              borderColor: w.color,
              borderWidth: 1.5,
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

const PREVIEWS = {
  aurora: AuroraPreview,
  flame: FlamePreview,
  minimal: MinimalPreview,
  neon: NeonPreview,
  stardust: StardustPreview,
  ocean: OceanPreview,
};

function useIsVisible() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, visible];
}

export default function ThemePreview({ themeId }) {
  const [ref, visible] = useIsVisible();
  const Comp = PREVIEWS[themeId];
  if (!Comp) return null;
  return (
    <div ref={ref} className="absolute inset-0">
      {visible && <Comp />}
    </div>
  );
}
