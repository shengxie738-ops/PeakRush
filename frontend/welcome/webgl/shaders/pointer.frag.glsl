// get-seen (`landing-2-get-seen`) FRAGMENT shader — CAPTURED VERBATIM.
// Source: evidence/reference/raw/_nuxt/wH0WNvJv.js, the template literal assigned to
// `N`. No output encode happens here, which is why createPointerPanel acquires its
// texture with `colorSpace: 'none'` (an sRGB-tagged map would be hardware-decoded and
// never re-encoded, darkening the artwork).
varying vec2 vUv;
uniform sampler2D imageTexture;

void main() {
    gl_FragColor = texture2D(imageTexture, vUv);
}
