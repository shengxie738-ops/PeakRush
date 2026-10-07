// get-seen (`landing-2-get-seen`) VERTEX shader — CAPTURED VERBATIM.
//
// Source: evidence/reference/raw/_nuxt/wH0WNvJv.js (component
// `Landing2GetSeenWebGl`), the template literal assigned to `V`. This replaces the
// earlier reconstruction: the reference's real GLSL was recovered from the shipped
// chunk, so the arc/`bend()` maths, the BUBBLE_AMOUNT/BUBBLE_RADIUS mouse bulge and
// the `#if USE_MOUSE` gating below are the reference's own code, not an approximation.
// Used as a THREE.ShaderMaterial (GLSL1) with defines { USE_MOUSE: 1 } — desktop.
#ifndef PI
#define PI 3.141592653589
#endif

#define BUBBLE_AMOUNT 0.2
#define BUBBLE_RADIUS 0.9

uniform vec2 mousePos;
uniform float progressStart;
uniform float progressEnd;
uniform float radius;
varying vec2 vUv;


float scaleValue(float value, float valueMin, float valueMax, float targetMin, float targetMax) {
    return clamp(targetMin + (value - valueMin) / (valueMax - valueMin) * (targetMax - targetMin), min(targetMin, targetMax), max(targetMin, targetMax));
}

vec4 bend(vec4 coords, float progressStart, float progressEnd) {
    vec4 bentCoords = coords;
    float yAnimationOffset = 0.25;

    // Include Y into the progress
    float adjustedProgress = progressStart + (1.0 - coords.y) * yAnimationOffset;

    if (progressStart > 0.5) {
        float endProgressStart = scaleValue(progressStart, 0.5, 1.0, 0.0, 1.0);
        adjustedProgress = progressStart * endProgressStart + adjustedProgress * (1.0 - endProgressStart);
    }

    float angle = (1.0 - adjustedProgress) * PI;
    float zOffset = (2.0 - cos(angle) * 2.0);

    #if USE_MOUSE
        float yOffset = (1.0 - progressStart) * 0.25 + progressEnd * 2.25;
    #else
        float yOffset = (1.0 - progressStart) * 0.55 + progressEnd * 2.25;
    #endif

    bentCoords.y = bentCoords.y * cos(angle) + yOffset;
    bentCoords.z = bentCoords.z * sin(angle) - zOffset;

    return bentCoords;
}

void main() {
    vUv = uv;

    // Progress effect
    vec4 bentPosition = bend(vec4(position, 1.0), progressStart, progressEnd);

    // Mouse effect
    vec4 pos = modelViewMatrix * bentPosition;
    vec4 posScreen = projectionMatrix * pos;
    vec3 posScreenNormalized = posScreen.xyz / posScreen.w;

    #if USE_MOUSE
        float mouseDistance = length(mousePos.xy - posScreenNormalized.xy);
        float displacementStrength = 1.0 - smoothstep(0.0, BUBBLE_RADIUS, mouseDistance);
        float displacement = displacementStrength * BUBBLE_AMOUNT;

        pos.z += displacement;
    #endif

    gl_Position = projectionMatrix * pos;
}
