varying vec2 vUv;
uniform sampler2D imageTexture;

void main() {
    gl_FragColor = texture2D(imageTexture, vUv);
}
