// Mission Architect — launch sky dome vertex stage (step 7).
// world-space direction feeds the gradient so the dome reads as sky, not a ball.
varying vec3 vDir;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vDir = normalize(world.xyz - cameraPosition);
  gl_Position = projectionMatrix * viewMatrix * world;
}
