// Mission Architect — nebula billboard fragment stage (fbm noise).
// Uniforms: uAccent (live accent), uNeon (partner hue), uTime (s),
//           uScale (noise frequency), uDrift (scroll), uIntensity.
varying vec2 vUv;

uniform vec3 uAccent;
uniform vec3 uNeon;
uniform float uTime;
uniform float uScale;
uniform float uDrift;
uniform float uIntensity;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.55;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(31.7, 11.3);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vUv * uScale;
  float n = fbm(uv + vec2(uTime * uDrift, uTime * uDrift * 0.6));
  float n2 = fbm(uv * 1.9 - vec2(uTime * uDrift * 0.4, 0.0));
  float mask = smoothstep(0.25, 0.95, n * 0.7 + n2 * 0.5);
  vec3 col = mix(uAccent, uNeon, clamp(n2 * 1.2, 0.0, 1.0));
  float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x)
             * smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
  gl_FragColor = vec4(col * mask, mask * edge * uIntensity);
}
