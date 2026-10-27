// Wormhole transition tunnel (step 3).
// A polar tunnel whose depth scroll accelerates with uProgress, lit by the
// live accent + the world aurora palette. Temporal oscillations stay below
// ~2 Hz even at full speed (accessibility: no flashing).
//
// Uniforms:
//   uTime       accumulated seconds (scene-driven)
//   uProgress   0..1 timeline (rAF-driven by the overlay; owns fade in/out)
//   uIntensity  quality-scaled master alpha
//   uAccent     live uAccent uniform (shared Color instance)
//   uCool/uViolet  WORLD.auroraA / WORLD.auroraB static palette colours
//   uAspect     canvas width / height

precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform float uProgress;
uniform float uIntensity;
uniform vec3 uAccent;
uniform vec3 uCool;
uniform vec3 uViolet;
uniform float uAspect;

float h21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x),
    mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// Timeline envelope: quick rise, long hold, gentle release.
float envelope(float p) {
  return smoothstep(0.0, 0.22, p) * (1.0 - smoothstep(0.78, 1.0, p));
}

void main() {
  float env = envelope(uProgress);

  vec2 p = vUv * 2.0 - 1.0;
  p.x *= uAspect;
  float r = length(p);
  float a = atan(p.y, p.x);

  // Scroll speed ramps up mid-warp then eases out near the end.
  float speed = mix(0.55, 3.2, smoothstep(0.08, 0.82, uProgress));
  float t = uTime * speed;

  float core = smoothstep(0.55, 0.0, r);
  float d = 1.0 / (r + 0.18); // depth proxy along the tunnel

  float spokes = 0.5 + 0.5 * sin(a * 9.0 + d * 5.0 - t * 2.2 + vnoise(vec2(a * 2.0, d * 0.8)) * 3.0);
  float rings = 0.5 + 0.5 * sin(d * 9.0 - t * 3.0);
  float grain = vnoise(vec2(a * 6.0 + t * 0.6, d * 3.0 - t * 1.1));
  float beam = pow(0.55 + 0.45 * spokes, 3.0) * rings * (0.55 + 0.55 * grain);
  float glow = core * 1.35 + beam * smoothstep(1.15, 0.12, r) * 0.85;

  vec3 col = mix(uCool, uViolet, 0.5 + 0.5 * sin(a * 2.0 + t * 0.5));
  col = mix(col, uAccent, 0.45 + 0.3 * core);
  col += uViolet * beam * 0.35;
  col += vec3(1.0) * pow(core, 3.0) * 0.9;

  float alpha = env * uIntensity * (glow * 0.9 + core * 0.4) * smoothstep(1.35, 0.25, r);
  gl_FragColor = vec4(col * (0.65 + glow), clamp(alpha, 0.0, 1.0));
}
