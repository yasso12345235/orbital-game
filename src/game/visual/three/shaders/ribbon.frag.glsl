// Mission Architect — energy ribbon fragment stage (tube flow dashes).
// Uniforms: uAccent (live accent), uNeon (gradient partner), uTime (s),
//           uSpeed (flow), uGlow (dash strength), uRepeat (dashes per tube).
varying vec2 vUv;

uniform vec3 uAccent;
uniform vec3 uNeon;
uniform float uTime;
uniform float uSpeed;
uniform float uGlow;
uniform float uRepeat;

void main() {
  float flow = fract(vUv.x * uRepeat - uTime * uSpeed);
  float dash = smoothstep(0.0, 0.18, flow) * smoothstep(1.0, 0.62, flow);
  vec3 col = mix(uAccent, uNeon, clamp(vUv.x, 0.0, 1.0) * 0.8);
  gl_FragColor = vec4(col * (0.25 + dash * uGlow), 0.28 + dash * 0.7);
}
