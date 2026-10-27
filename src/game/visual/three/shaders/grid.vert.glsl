// Mission Architect — holographic grid floor vertex stage.
// Passes the world-space position to the fragment stage.
varying vec3 vWorld;

void main() {
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}
