// Mission Architect — dashed orbit-ring fragment stage.
// Uniforms: uAccent (live accent), uTime (s), uDashes (count), uSpeed (flow),
//           uOpacity (fade for locked rings), uEmphasis (0..1 brightening).
varying vec2 vUv;

uniform vec3 uAccent;
uniform float uTime;
uniform float uDashes;
uniform float uSpeed;
uniform float uOpacity;
uniform float uEmphasis;

void main() {
  float flow = fract(vUv.x * uDashes - uTime * uSpeed);
  float dash = step(flow, 0.55);
  float alpha = (0.18 + dash * 0.82) * uOpacity;
  vec3 col = uAccent * (0.6 + dash * (0.4 + uEmphasis * 0.8));
  gl_FragColor = vec4(col, alpha);
}
