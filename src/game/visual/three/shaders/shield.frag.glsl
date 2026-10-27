// Mission Architect — shield bubble fragment stage.
// Fresnel rim + hex-grid veil + an expanding ripple around an impact point.
// Uniforms: uAccent (live accent), uHex (hex texture), uHexOpacity,
//           uImpact (unit sphere direction, w = strength),
//           uRipple (expanding radius, 0 = idle), uPower, uIntensity.
varying vec3 vNormalV;
varying vec3 vViewDir;
varying vec3 vPos;

uniform vec3 uAccent;
uniform sampler2D uHex;
uniform float uHexOpacity;
uniform vec4 uImpact; // xyz direction, w strength
uniform float uRipple; // 0..1 expanding radius
uniform float uPower;
uniform float uIntensity;

void main() {
  float fres = pow(1.0 - abs(dot(normalize(vNormalV), normalize(vViewDir))), uPower);
  vec2 uv = vec2(atan(vPos.z, vPos.x) / 6.28318 + 0.5, asin(clamp(vPos.y, -1.0, 1.0)) / 3.14159 + 0.5);
  float hex = texture2D(uHex, uv * 2.5).a;
  float ripple = 0.0;
  if (uRipple > 0.0) {
    vec3 dir = normalize(vPos);
    float d = acos(clamp(dot(dir, normalize(uImpact.xyz)), -1.0, 1.0));
    ripple = smoothstep(0.25, 0.0, abs(d - uRipple * 2.4)) * uImpact.w;
  }
  vec3 col = uAccent * (fres * uIntensity + hex * uHexOpacity + ripple * 1.6);
  float alpha = fres * 0.7 + hex * 0.35 + ripple * 0.6;
  gl_FragColor = vec4(col, alpha);
}
