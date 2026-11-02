// EXACT captured fragment shader for `landing-5-nexus` (home.card).
// Verbatim from evidence/reference/webgl-scenes.json (scene "landing-5-nexus"
// -> fragmentShader). Samples the texture with a horizontal mirror (1.0 - vUv.x)
// so DoubleSide back faces never read as mirrored text.
varying vec2 vUv;
uniform sampler2D imageTexture;
uniform float alpha;

void main() {
    gl_FragColor = texture2D(imageTexture, vec2(1.0 - vUv.x, vUv.y));
    gl_FragColor.a = alpha;
}
