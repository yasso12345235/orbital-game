// Wormhole transition — full-viewport quad. uv passes straight through;
// the tunnel is generated procedurally in the fragment shader.

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
