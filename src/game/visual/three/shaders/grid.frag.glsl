// Mission Architect — holographic grid floor fragment stage.
// Antialiased grid lines, distance fade and an expanding scan pulse.
// Uniforms: uAccent (live accent), uNeon (mix partner), uTime (s),
//           uScale (cells per unit), uFade (metres → fade distance),
//           uPulse (strength), uPulseSpeed.
varying vec3 vWorld;

uniform vec3 uAccent;
uniform vec3 uNeon;
uniform float uTime;
uniform float uScale;
uniform float uFade;
uniform float uPulse;
uniform float uPulseSpeed;

void main() {
  vec2 p = vWorld.xz * uScale;
  vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p);
  float line = 1.0 - min(min(g.x, g.y), 1.0);
  float dist = length(vWorld.xz);
  float fade = 1.0 - smoothstep(uFade * 0.25, uFade, dist);
  float ring = smoothstep(0.12, 0.0, abs(dist - mod(uTime * uPulseSpeed, uFade)));
  vec3 col = mix(uAccent, uNeon, 0.3 + 0.3 * sin(vWorld.x + vWorld.z * 0.7));
  float alpha = (line * 0.32 + ring * uPulse * 0.4) * fade;
  gl_FragColor = vec4(col * (0.7 + line * 0.3 + ring * 0.6), alpha);
}
