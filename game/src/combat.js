// Combat: bullets, muzzle flashes, explosions and the little bursts of
// particles that make a hit feel like a hit. Everything here is data the
// renderer draws; nothing here draws.

export function createCombat() {
  const bullets = [];
  const particles = [];
  const floaters = [];

  function spawnParticles(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: 0.35 + Math.random() * 0.4,
        maxLife: 0.75,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  return {
    bullets,
    particles,
    floaters,
    fire(x, y, angle, speed, damage, friendly) {
      bullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, damage, friendly, life: 1.1 });
      spawnParticles(x + Math.cos(angle) * 18, y + Math.sin(angle) * 18, '#ffd94d', 3, 120);
    },
    explode(x, y) {
      spawnParticles(x, y, '#ff7a2f', 26, 320);
      spawnParticles(x, y, '#ffd94d', 16, 220);
      spawnParticles(x, y, '#555', 12, 90);
    },
    blood(x, y) {
      spawnParticles(x, y, '#c22', 8, 140);
    },
    sparks(x, y) {
      spawnParticles(x, y, '#ffe08a', 6, 200);
    },
    floater(x, y, text, color) {
      floaters.push({ x, y, text, color: color || '#fff', life: 1.2 });
    },
    step(dt) {
      for (let i = bullets.length - 1; i >= 0; i -= 1) {
        const b = bullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
        if (b.life <= 0) bullets.splice(i, 1);
      }
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 1 - 2.4 * dt;
        p.vy *= 1 - 2.4 * dt;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }
      for (let i = floaters.length - 1; i >= 0; i -= 1) {
        const f = floaters[i];
        f.y -= 34 * dt;
        f.life -= dt;
        if (f.life <= 0) floaters.splice(i, 1);
      }
      if (particles.length > 400) particles.splice(0, particles.length - 400);
    },
  };
}
