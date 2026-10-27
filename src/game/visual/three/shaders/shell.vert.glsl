// Mission Architect — shell vertex stage (atmosphere, shield, scan bands).
// Passes view-space normal, view direction and local position.
varying vec3 vNormalV;
varying vec3 vViewDir;
varying vec3 vPos;

void main() {
  vPos = position;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vNormalV = normalize(normalMatrix * normal);
  vViewDir = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
}
