// Mission Architect — fresnel shell fragment stage.
// Uniforms:
//   uAccent    vec3  — shared live accent colour (see store-adapters/accent)
//   uPower     float — rim falloff exponent (higher = thinner rim)
//   uIntensity float — overall rim strength
//   uTime      float — seconds, drives the slow scan band
//   uBand      float — scan-band strength (0 disables the band)
varying vec3 vNormalV;
varying vec3 vViewDir;

uniform vec3 uAccent;
uniform float uPower;
uniform float uIntensity;
uniform float uTime;
uniform float uBand;

void main() {
  float fres = pow(1.0 - abs(dot(normalize(vNormalV), normalize(vViewDir))), uPower);
  float band = 0.0;
  if (uBand > 0.0) {
    float scan = fract(vViewDir.y * 5.0 - uTime * 0.22);
    band = smoothstep(0.88, 1.0, scan) * uBand;
  }
  vec3 color = uAccent * (fres * uIntensity + band);
  gl_FragColor = vec4(color, fres * 0.85 + band * 0.5);
}
