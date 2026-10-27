// Mission Architect — iridescent surface fragment stage (torus knots, rings).
// Fresnel-driven hue shift mixing the live accent with a neon partner colour.
// Uniforms: uAccent (live accent), uNeon (partner hue), uRange (hue spread),
//           uShift (phase), uGlow (rim strength).
varying vec3 vNormalV;
varying vec3 vViewDir;

uniform vec3 uAccent;
uniform vec3 uNeon;
uniform float uRange;
uniform float uShift;
uniform float uGlow;

void main() {
  float fres = pow(1.0 - abs(dot(normalize(vNormalV), normalize(vViewDir))), 2.0);
  float hue = fract(uShift + fres * uRange);
  vec3 col = mix(uAccent, uNeon, hue);
  col *= 0.35 + fres * uGlow;
  gl_FragColor = vec4(col, 1.0);
}
