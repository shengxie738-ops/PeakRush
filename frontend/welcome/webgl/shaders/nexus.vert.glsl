// EXACT captured vertex shader for `landing-5-nexus` (home.card).
// Verbatim from docs/DOM_CONTRACT.md + evidence/reference/webgl-scenes.json
// (scene "landing-5-nexus" -> vertexShader). Consumed as a THREE.ShaderMaterial
// (GLSL1), so three.js upgrades it to GLSL3 + declares position/uv/projectionMatrix/
// modelViewMatrix automatically. Do NOT edit — this is reference ground truth.
#ifndef PI
#define PI 3.141592653589
#endif

uniform float progress;
uniform float progressScale;
uniform float offset;
uniform float radius;
varying vec2 vUv;

#define HEIGHT 1.0

void main() {
    vUv = uv;

    float angle = HEIGHT / radius;
    float anglePoint = angle * (uv.y - 0.5) * 2.0 + offset + progress * progressScale;
    float z = cos(anglePoint) * radius;
    float y = sin(anglePoint) * radius;

    vec4 bentPosition = vec4(position.x, y, z, 1.0);

    gl_Position = projectionMatrix * modelViewMatrix * bentPosition;
}
