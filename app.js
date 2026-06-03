(() => {
  "use strict";

  const canvas = document.getElementById("wallpaper");
  const ctx = canvas.getContext("2d", { alpha: false });
  const hud = document.getElementById("hud");
  const selectedTitle = document.getElementById("selectedTitle");
  const selectedMeta = document.getElementById("selectedMeta");
  const metricLatency = document.getElementById("metricLatency");
  const metricLoad = document.getElementById("metricLoad");
  const metricPulse = document.getElementById("metricPulse");
  const selectorStrip = document.getElementById("selectorStrip");
  const intensityInput = document.getElementById("intensity");

  const palettes = {
    redwood: {
      bg0: "#080504",
      bg1: "#1a0d0a",
      line: "rgba(255, 193, 170, 0.20)",
      red: "#c74634",
      redBright: "#ff725c",
      ember: "#f6a05d",
      teal: "#4fc6bd",
      violet: "#9d7af2",
      text: "#fff4ee",
    },
    fusion: {
      bg0: "#07090b",
      bg1: "#161b1f",
      line: "rgba(215, 235, 235, 0.17)",
      red: "#ba5f47",
      redBright: "#ff8b6b",
      ember: "#edc778",
      teal: "#58d7cb",
      violet: "#86a7ff",
      text: "#edf7f5",
    },
    autonomous: {
      bg0: "#050608",
      bg1: "#120d17",
      line: "rgba(242, 204, 255, 0.16)",
      red: "#bd4b39",
      redBright: "#ff6c58",
      ember: "#dca85a",
      teal: "#35d4bf",
      violet: "#b18cff",
      text: "#fbf1ff",
    },
  };

  const nodes = [
    { id: "autonomous-db", label: "Autonomous DB", meta: "Data core selecionado", kind: "database", color: "#ff725c", base: 0.95 },
    { id: "fusion-apps", label: "Fusion Apps", meta: "Processos corporativos", kind: "apps", color: "#f6a05d", base: 0.58 },
    { id: "ai-agents", label: "AI Agents", meta: "Orquestracao inteligente", kind: "agent", color: "#4fc6bd", base: 0.72 },
    { id: "analytics", label: "Analytics", meta: "Sinais em tempo real", kind: "chart", color: "#9d7af2", base: 0.44 },
    { id: "integration", label: "Integration", meta: "Fluxos conectados", kind: "flow", color: "#ffd07a", base: 0.66 },
    { id: "security", label: "Security", meta: "Governanca ativa", kind: "shield", color: "#ffffff", base: 0.52 },
  ];

  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    time: 0,
    last: performance.now(),
    selected: "autonomous-db",
    hovered: null,
    dragging: null,
    mode: "mesh",
    palette: "redwood",
    particles: [],
    waves: [],
    trails: [],
    audio: 0,
    bass: 0,
    pointer: {
      x: 0,
      y: 0,
      px: 0,
      py: 0,
      active: false,
      moved: false,
    },
    settings: {
      density: 1,
      speed: 0.92,
      intensity: 0.92,
      glow: 0.92,
      showHud: true,
      audioReact: true,
    },
  };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function parseLivelyValue(value) {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  function palette() {
    return palettes[state.palette] || palettes.redwood;
  }

  function syncThemeVariables() {
    const p = palette();
    document.documentElement.style.setProperty("--bg", p.bg0);
    document.documentElement.style.setProperty("--redwood", p.red);
    document.documentElement.style.setProperty("--redwood-bright", p.redBright);
    document.documentElement.style.setProperty("--ember", p.ember);
    document.documentElement.style.setProperty("--teal", p.teal);
    document.documentElement.style.setProperty("--text", p.text);
  }

  function layoutNodes() {
    const cx = state.width * 0.54;
    const cy = state.height * 0.52;
    const radiusX = Math.min(state.width * 0.32, 420);
    const radiusY = Math.min(state.height * 0.28, 260);
    nodes.forEach((node, index) => {
      const angle = -Math.PI / 2 + (index / nodes.length) * Math.PI * 2;
      if (node.userPlaced) return;
      node.x = cx + Math.cos(angle) * radiusX;
      node.y = cy + Math.sin(angle) * radiusY;
      node.vx = node.vx || 0;
      node.vy = node.vy || 0;
      node.r = clamp(Math.min(state.width, state.height) * 0.042, 34, 58);
    });
  }

  function resetParticles() {
    const area = state.width * state.height;
    const count = Math.floor(clamp(area / 12600, 62, 190) * state.settings.density);
    state.particles = Array.from({ length: count }, (_, index) => ({
      x: Math.random() * state.width,
      y: Math.random() * state.height,
      vx: (Math.random() - 0.5) * 0.34,
      vy: (Math.random() - 0.5) * 0.34,
      size: 0.7 + Math.random() * 1.8,
      phase: Math.random() * Math.PI * 2,
      group: index % nodes.length,
      energy: Math.random(),
    }));
  }

  function resize() {
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.width = Math.max(1, window.innerWidth);
    state.height = Math.max(1, window.innerHeight);
    canvas.width = Math.floor(state.width * state.dpr);
    canvas.height = Math.floor(state.height * state.dpr);
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    if (!state.pointer.moved) {
      state.pointer.x = state.width * 0.5;
      state.pointer.y = state.height * 0.5;
      state.pointer.px = state.pointer.x;
      state.pointer.py = state.pointer.y;
    }
    layoutNodes();
    resetParticles();
  }

  function selectNode(id, burst = true) {
    if (!nodes.some((node) => node.id === id)) return;
    state.selected = id;
    document.querySelectorAll("[data-select]").forEach((button) => {
      button.classList.toggle("selected", button.dataset.select === id);
    });
    if (burst) {
      const node = nodes.find((item) => item.id === id);
      state.waves.push({ x: node.x, y: node.y, r: node.r * 0.7, life: 1, color: node.color });
    }
    updateHud();
  }

  function updateHud() {
    const node = nodes.find((item) => item.id === state.selected) || nodes[0];
    selectedTitle.textContent = node.label;
    selectedMeta.textContent = node.meta;
    const t = state.time * 0.001;
    const pulse = 1 + state.audio * 1.8 + Math.sin(t * 2 + node.base * 4) * 0.06;
    metricLatency.textContent = String(Math.round(9 + node.base * 18 + state.audio * 22));
    metricLoad.textContent = String(Math.round(56 + node.base * 32 + Math.sin(t + node.base) * 7));
    metricPulse.textContent = pulse.toFixed(1);
  }

  function getPointer(event) {
    const point = event.touches ? event.touches[0] : event;
    return {
      x: point.clientX,
      y: point.clientY,
    };
  }

  function hitNode(x, y) {
    for (let i = nodes.length - 1; i >= 0; i -= 1) {
      const node = nodes[i];
      const dx = x - node.x;
      const dy = y - node.y;
      if (Math.hypot(dx, dy) <= node.r + 14) return node;
    }
    return null;
  }

  function onPointerMove(event) {
    const point = getPointer(event);
    state.pointer.px = state.pointer.x;
    state.pointer.py = state.pointer.y;
    state.pointer.x = point.x;
    state.pointer.y = point.y;
    state.pointer.moved = true;
    state.hovered = hitNode(point.x, point.y)?.id || null;

    if (state.dragging) {
      const node = nodes.find((item) => item.id === state.dragging);
      if (node) {
        node.x = point.x;
        node.y = point.y;
        node.userPlaced = true;
        node.vx *= 0.72;
        node.vy *= 0.72;
      }
      event.preventDefault();
    }

    const speed = Math.hypot(state.pointer.x - state.pointer.px, state.pointer.y - state.pointer.py);
    if (speed > 8) {
      state.trails.push({
        x: state.pointer.x,
        y: state.pointer.y,
        px: state.pointer.px,
        py: state.pointer.py,
        life: clamp(speed / 80, 0.18, 1),
      });
    }
  }

  function onPointerDown(event) {
    const point = getPointer(event);
    state.pointer.active = true;
    state.pointer.x = point.x;
    state.pointer.y = point.y;
    const node = hitNode(point.x, point.y);
    if (node) {
      state.dragging = node.id;
      selectNode(node.id);
      event.preventDefault();
    } else {
      const p = palette();
      state.waves.push({ x: point.x, y: point.y, r: 12, life: 1, color: p.redBright });
    }
  }

  function onPointerUp() {
    state.pointer.active = false;
    state.dragging = null;
  }

  function drawBackground(p, t) {
    const linear = ctx.createLinearGradient(0, 0, state.width, state.height);
    linear.addColorStop(0, p.bg0);
    linear.addColorStop(0.46, p.bg1);
    linear.addColorStop(1, "#070707");
    ctx.fillStyle = linear;
    ctx.fillRect(0, 0, state.width, state.height);

    ctx.save();
    ctx.globalAlpha = 0.36 + state.settings.intensity * 0.12;
    const sweep = ctx.createLinearGradient(0, state.height * 0.18, state.width, state.height * 0.88);
    sweep.addColorStop(0, "rgba(199, 70, 52, 0)");
    sweep.addColorStop(0.46, "rgba(199, 70, 52, 0.24)");
    sweep.addColorStop(0.68, "rgba(79, 198, 189, 0.10)");
    sweep.addColorStop(1, "rgba(246, 160, 93, 0)");
    ctx.fillStyle = sweep;
    ctx.beginPath();
    ctx.moveTo(0, state.height * 0.68 + Math.sin(t * 0.5) * 20);
    ctx.bezierCurveTo(state.width * 0.25, state.height * 0.42, state.width * 0.48, state.height * 0.46, state.width, state.height * 0.2);
    ctx.lineTo(state.width, state.height * 0.58);
    ctx.bezierCurveTo(state.width * 0.7, state.height * 0.72, state.width * 0.36, state.height * 0.76, 0, state.height * 0.92);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawGrid(p, t) {
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = p.line;
    ctx.globalAlpha = 0.52;
    const horizon = state.height * 0.59;
    const spacing = 54;

    for (let i = -6; i < state.width / spacing + 8; i += 1) {
      const x = i * spacing + ((t * 18) % spacing);
      ctx.beginPath();
      ctx.moveTo(x, horizon);
      ctx.lineTo((x - state.width * 0.5) * 2.4 + state.width * 0.5, state.height + 20);
      ctx.stroke();
    }

    for (let j = 0; j < 12; j += 1) {
      const progress = j / 11;
      const y = lerp(horizon, state.height + 12, progress * progress);
      ctx.globalAlpha = 0.1 + progress * 0.32;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(state.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRibbons(p, t) {
    const modeFactor = state.mode === "flow" ? 1.45 : state.mode === "agent" ? 0.72 : 1;
    const centerShift = (state.pointer.x / state.width - 0.5) * 90;
    ctx.save();
    ctx.lineCap = "round";
    for (let i = 0; i < 7; i += 1) {
      const y = state.height * (0.24 + i * 0.082);
      const phase = t * (0.42 + i * 0.03) * modeFactor + i * 0.74;
      const color = i % 3 === 0 ? p.redBright : i % 3 === 1 ? p.ember : p.teal;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.08 + i * 0.018 + state.audio * 0.16;
      ctx.lineWidth = 1.5 + (i % 3) + state.settings.glow * 1.2;
      ctx.beginPath();
      ctx.moveTo(-80, y + Math.sin(phase) * 24);
      ctx.bezierCurveTo(
        state.width * 0.25,
        y - 110 + Math.cos(phase) * 52,
        state.width * 0.55 + centerShift,
        y + 120 + Math.sin(phase * 0.9) * 45,
        state.width + 90,
        y - 10 + Math.cos(phase * 1.2) * 34
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  function updateParticles(dt, t) {
    const p = palette();
    const mouseForce = state.pointer.active ? 1.6 : 0.74;
    const selected = nodes.find((node) => node.id === state.selected) || nodes[0];
    for (const particle of state.particles) {
      const dx = state.pointer.x - particle.x;
      const dy = state.pointer.y - particle.y;
      const dist2 = dx * dx + dy * dy + 80;
      const force = (2600 * mouseForce * state.settings.intensity) / dist2;
      particle.vx -= dx * force * dt;
      particle.vy -= dy * force * dt;

      const sx = selected.x - particle.x;
      const sy = selected.y - particle.y;
      const sdist = Math.hypot(sx, sy) + 1;
      particle.vx += (sx / sdist) * 0.006 * state.settings.intensity;
      particle.vy += (sy / sdist) * 0.006 * state.settings.intensity;

      particle.vx += Math.cos(t * 0.8 + particle.phase) * 0.005;
      particle.vy += Math.sin(t * 0.65 + particle.phase) * 0.005;
      particle.vx *= 0.986;
      particle.vy *= 0.986;
      particle.x += particle.vx * dt * 62 * state.settings.speed;
      particle.y += particle.vy * dt * 62 * state.settings.speed;
      particle.energy = lerp(particle.energy, Math.random() * state.audio + 0.18, 0.01);

      if (particle.x < -20) particle.x = state.width + 20;
      if (particle.x > state.width + 20) particle.x = -20;
      if (particle.y < -20) particle.y = state.height + 20;
      if (particle.y > state.height + 20) particle.y = -20;
    }

    ctx.save();
    ctx.lineWidth = 1;
    for (let i = 0; i < state.particles.length; i += 1) {
      const a = state.particles[i];
      for (let j = i + 1; j < state.particles.length; j += 1) {
        const b = state.particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d = Math.hypot(dx, dy);
        const threshold = state.mode === "mesh" ? 104 : state.mode === "agent" ? 82 : 72;
        if (d < threshold) {
          const alpha = (1 - d / threshold) * 0.16 * state.settings.intensity;
          ctx.strokeStyle = a.group === b.group ? `rgba(255, 114, 92, ${alpha + state.audio * 0.08})` : `rgba(79, 198, 189, ${alpha * 0.75})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    for (const particle of state.particles) {
      const node = nodes[particle.group];
      const color = node?.color || p.redBright;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.24 + particle.energy * 0.42;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * (1 + state.audio * 0.8), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function updateNodes(dt, t) {
    for (const node of nodes) {
      if (state.dragging === node.id) continue;
      const selected = state.selected === node.id;
      const hover = state.hovered === node.id;
      const targetR = clamp(Math.min(state.width, state.height) * 0.042, 34, 58) * (selected ? 1.14 : hover ? 1.08 : 1);
      node.r = lerp(node.r || targetR, targetR, 0.08);
      node.vx += Math.cos(t * 0.7 + node.base * 8) * 0.006;
      node.vy += Math.sin(t * 0.8 + node.base * 7) * 0.006;
      node.vx *= 0.94;
      node.vy *= 0.94;
      node.x += node.vx * dt * 60;
      node.y += node.vy * dt * 60;
      node.x = clamp(node.x, 52, state.width - 52);
      node.y = clamp(node.y, 76, state.height - 72);
    }
  }

  function drawNodeIcon(node, selected) {
    const r = node.r;
    const x = node.x;
    const y = node.y;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = selected ? "#fffaf5" : node.color;
    ctx.fillStyle = selected ? "#fffaf5" : node.color;
    ctx.lineWidth = Math.max(1.5, r * 0.052);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (node.kind === "database") {
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.18, r * 0.28, r * 0.12, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.28, -r * 0.18);
      ctx.lineTo(-r * 0.28, r * 0.2);
      ctx.ellipse(0, r * 0.2, r * 0.28, r * 0.12, 0, Math.PI, 0, true);
      ctx.lineTo(r * 0.28, -r * 0.18);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, r * 0.02, r * 0.28, r * 0.12, 0, 0, Math.PI);
      ctx.stroke();
    } else if (node.kind === "apps") {
      for (let yy = -1; yy <= 1; yy += 1) {
        for (let xx = -1; xx <= 1; xx += 1) {
          ctx.strokeRect(xx * r * 0.18 - r * 0.055, yy * r * 0.18 - r * 0.055, r * 0.11, r * 0.11);
        }
      }
    } else if (node.kind === "agent") {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.28, Math.sin(a) * r * 0.28);
        ctx.lineTo(Math.cos(a) * r * 0.43, Math.sin(a) * r * 0.43);
        ctx.stroke();
      }
    } else if (node.kind === "chart") {
      for (let i = 0; i < 4; i += 1) {
        const h = r * (0.16 + i * 0.065);
        ctx.fillRect(-r * 0.32 + i * r * 0.18, r * 0.28 - h, r * 0.08, h);
      }
      ctx.beginPath();
      ctx.moveTo(-r * 0.34, r * 0.32);
      ctx.lineTo(r * 0.34, r * 0.32);
      ctx.stroke();
    } else if (node.kind === "flow") {
      ctx.beginPath();
      ctx.moveTo(-r * 0.34, -r * 0.16);
      ctx.bezierCurveTo(-r * 0.04, -r * 0.36, r * 0.08, r * 0.28, r * 0.36, r * 0.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(r * 0.24, -r * 0.02);
      ctx.lineTo(r * 0.38, r * 0.1);
      ctx.lineTo(r * 0.22, r * 0.2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.36);
      ctx.lineTo(r * 0.3, -r * 0.22);
      ctx.lineTo(r * 0.24, r * 0.18);
      ctx.quadraticCurveTo(0, r * 0.42, -r * 0.24, r * 0.18);
      ctx.lineTo(-r * 0.3, -r * 0.22);
      ctx.closePath();
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawNodes(p, t) {
    const selectedNode = nodes.find((node) => node.id === state.selected) || nodes[0];
    ctx.save();
    ctx.lineCap = "round";
    for (const node of nodes) {
      const selected = node.id === state.selected;
      const hover = node.id === state.hovered;
      const dx = selectedNode.x - node.x;
      const dy = selectedNode.y - node.y;
      if (!selected) {
        ctx.strokeStyle = node.color;
        ctx.globalAlpha = 0.14 + state.audio * 0.12;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(selectedNode.x, selectedNode.y);
        ctx.lineTo(node.x, node.y);
        ctx.stroke();
      }

      const glow = ctx.createRadialGradient(node.x, node.y, 1, node.x, node.y, node.r * 2.2);
      glow.addColorStop(0, selected ? "rgba(255, 114, 92, 0.38)" : "rgba(255, 114, 92, 0.17)");
      glow.addColorStop(0.48, hover ? "rgba(79, 198, 189, 0.13)" : "rgba(199, 70, 52, 0.07)");
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glow;
      ctx.globalAlpha = state.settings.glow;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r * 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.fillStyle = selected ? "rgba(52, 24, 19, 0.72)" : "rgba(15, 12, 11, 0.64)";
      ctx.strokeStyle = selected ? p.redBright : hover ? p.teal : "rgba(255, 235, 220, 0.22)";
      ctx.lineWidth = selected ? 2 : 1;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.globalAlpha = 0.34 + state.audio * 0.2;
      ctx.strokeStyle = node.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r * (1.24 + Math.sin(t * 2 + node.base * 6) * 0.035), 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 1;
      drawNodeIcon(node, selected);

      ctx.font = `700 ${clamp(node.r * 0.22, 10, 13)}px "Segoe UI", Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = selected ? "#fff7f2" : "rgba(255, 239, 232, 0.82)";
      ctx.fillText(node.label, node.x, node.y + node.r + 10, node.r * 3.4);

      const direction = Math.atan2(dy, dx);
      const sweep = ((t * 1.4 + node.base * Math.PI * 2) % (Math.PI * 2)) - Math.PI;
      ctx.globalAlpha = selected ? 0.9 : 0.34;
      ctx.strokeStyle = selected ? "#fff7f2" : node.color;
      ctx.lineWidth = selected ? 2.2 : 1.2;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r * 1.43, direction + sweep, direction + sweep + Math.PI * 0.45);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTrails(p) {
    ctx.save();
    ctx.lineCap = "round";
    for (let i = state.trails.length - 1; i >= 0; i -= 1) {
      const trail = state.trails[i];
      trail.life -= 0.018;
      if (trail.life <= 0) {
        state.trails.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = trail.life * 0.46;
      ctx.strokeStyle = state.mode === "agent" ? p.teal : p.redBright;
      ctx.lineWidth = 2 + trail.life * 7;
      ctx.beginPath();
      ctx.moveTo(trail.px, trail.py);
      ctx.lineTo(trail.x, trail.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWaves() {
    ctx.save();
    for (let i = state.waves.length - 1; i >= 0; i -= 1) {
      const wave = state.waves[i];
      wave.r += 7.5 + state.settings.intensity * 4;
      wave.life -= 0.018;
      if (wave.life <= 0) {
        state.waves.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = wave.life * 0.62;
      ctx.strokeStyle = wave.color;
      ctx.lineWidth = 1 + wave.life * 3;
      ctx.beginPath();
      ctx.arc(wave.x, wave.y, wave.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function frame(now) {
    const rawDt = Math.min(0.04, (now - state.last) / 1000 || 0.016);
    const dt = reducedMotion ? rawDt * 0.25 : rawDt;
    state.last = now;
    state.time = now * (reducedMotion ? 0.25 : 1);
    const t = state.time * 0.001 * state.settings.speed;
    const p = palette();

    state.audio *= 0.94;
    state.bass *= 0.9;
    drawBackground(p, t);
    drawGrid(p, t);
    drawRibbons(p, t);
    updateNodes(dt, t);
    updateParticles(dt, t);
    drawTrails(p);
    drawWaves();
    drawNodes(p, t);
    updateHud();
    requestAnimationFrame(frame);
  }

  function setMode(mode) {
    if (!["mesh", "flow", "agent"].includes(mode)) return;
    state.mode = mode;
    document.querySelectorAll("[data-mode]").forEach((button) => {
      button.classList.toggle("active", button.dataset.mode === mode);
    });
  }

  function setHudVisibility(show) {
    state.settings.showHud = Boolean(show);
    hud.classList.toggle("is-minimal", !state.settings.showHud);
  }

  selectorStrip.addEventListener("click", (event) => {
    const button = event.target.closest("[data-select]");
    if (!button) return;
    selectNode(button.dataset.select);
  });

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });

  document.getElementById("toggleHud").addEventListener("click", () => {
    setHudVisibility(!state.settings.showHud);
  });

  intensityInput.addEventListener("input", () => {
    state.settings.intensity = Number(intensityInput.value) / 100;
    state.settings.glow = clamp(state.settings.intensity, 0.35, 1.4);
  });

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerdown", onPointerDown, { passive: false });
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("blur", onPointerUp);

  window.addEventListener("keydown", (event) => {
    const index = nodes.findIndex((node) => node.id === state.selected);
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      selectNode(nodes[(index + 1) % nodes.length].id);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      selectNode(nodes[(index - 1 + nodes.length) % nodes.length].id);
    } else if (event.key.toLowerCase() === "h") {
      setHudVisibility(!state.settings.showHud);
    }
  });

  window.livelyAudioListener = function livelyAudioListener(audioArray) {
    if (!state.settings.audioReact || !Array.isArray(audioArray)) return;
    let sum = 0;
    let bass = 0;
    const len = Math.min(audioArray.length, 128);
    for (let i = 0; i < len; i += 1) {
      const value = Math.abs(Number(audioArray[i]) || 0);
      sum += value;
      if (i < 24) bass += value;
    }
    state.audio = clamp(sum / len / 65, 0, 1.4);
    state.bass = clamp(bass / 24 / 55, 0, 1.6);
  };

  window.livelyPropertyListener = function livelyPropertyListener(name, val) {
    const value = parseLivelyValue(val);
    if (name === "animationSpeed") {
      state.settings.speed = clamp(Number(value) / 100, 0.2, 1.8);
    } else if (name === "meshDensity") {
      state.settings.density = clamp(Number(value) / 100, 0.45, 1.7);
      resetParticles();
    } else if (name === "glowStrength") {
      state.settings.glow = clamp(Number(value) / 100, 0.25, 1.6);
    } else if (name === "audioReact") {
      state.settings.audioReact = Boolean(value);
    } else if (name === "showHud") {
      setHudVisibility(Boolean(value));
    } else if (name === "palette") {
      const keys = ["redwood", "fusion", "autonomous"];
      state.palette = keys[Number(value)] || String(value).toLowerCase() || "redwood";
      syncThemeVariables();
    } else if (name === "visualMode") {
      const modes = ["mesh", "flow", "agent"];
      const labels = {
        mesh: "mesh",
        "data flow": "flow",
        flow: "flow",
        "ai agents": "agent",
        agent: "agent",
      };
      const key = String(value).toLowerCase();
      setMode(modes[Number(value)] || labels[key]);
    }
  };

  syncThemeVariables();
  resize();
  selectNode(state.selected, false);
  requestAnimationFrame(frame);
})();
