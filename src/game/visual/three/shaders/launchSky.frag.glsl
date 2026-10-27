// Mission Architect — launch sky dome fragment stage (step 7).
// One timeline value (uProgress) blends dawn → dusk → space, with a warm
// horizon band that dies out as the vehicle climbs and a faint accent tint.
// Uniforms:
//   uProgress float — cinematic progress 0…1
//   uAccent   vec3  — shared live accent colour
varying vec3 vDir;

uniform float uProgress;
uniform vec3 uAccent;

void main() {
  float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
  float space = smoothstep(0.08, 0.55, uProgress);

  vec3 horizon = mix(vec3(0.86, 0.47, 0.26), vec3(0.030, 0.040, 0.080), space);
  vec3 zenith  = mix(vec3(0.14, 0.29, 0.58), vec3(0.008, 0.012, 0.030), space);
  vec3 below   = mix(vec3(0.05, 0.09, 0.16), vec3(0.005, 0.007, 0.014), space);

  vec3 col = mix(horizon, zenith, smoothstep(0.5, 1.0, h));
  col = mix(col, below, smoothstep(0.5, 0.4, h));

  // low sun band near the horizon (fades with altitude)
  float band = pow(max(0.0, 1.0 - abs(h - 0.5) * 7.0), 2.0);
  col += vec3(1.0, 0.63, 0.34) * band * 0.30 * (1.0 - space * 0.96);

  // thin atmosphere limb once the vehicle is high (reads as the edge of space)
  float limb = pow(max(0.0, 1.0 - abs(h - 0.5) * 26.0), 3.0);
  col += vec3(0.30, 0.55, 1.0) * limb * 0.16 * space;

  // subtle aurora accent high in the sky
  col += uAccent * 0.035 * smoothstep(0.55, 0.95, h) * (1.0 - space * 0.55);

  gl_FragColor = vec4(col, 1.0);
}
