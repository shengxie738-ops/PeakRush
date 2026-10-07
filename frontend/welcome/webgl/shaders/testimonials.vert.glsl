#ifndef PI
#define PI 3.141592653589
#endif

uniform vec2 progress;
uniform float progressScale;
uniform float offset;
uniform float radius;
uniform float effect;
varying vec2 vUv;

#define WIDTH 1.0
#define HEIGHT 1.0

vec3 getPoint(float radius, float anglePointX, float anglePointY) {
    return vec3(
        cos(anglePointX) * radius,
        sin(anglePointY) * radius,
        cos(anglePointY) * sin(anglePointX) * radius
    );
}

vec3 rotatePointAroundAnchorZ(vec3 point, vec3 anchor, float angle) {
    // Rotate a point around anchor
    vec3 relativePoint = point - anchor;
    vec3 rotatedPoint = vec3(
        cos(angle) * relativePoint.x - sin(angle) * relativePoint.y,
        sin(angle) * relativePoint.x + cos(angle) * relativePoint.y,
        relativePoint.z
    );
    return rotatedPoint + anchor;
}

vec3 rotatePointAroundAnchorY(vec3 point, vec3 anchor, float angle) {
    // Rotate a point around anchor
    vec3 relativePoint = point - anchor;
    vec3 rotatedPoint = vec3(
        cos(angle) * relativePoint.x - sin(angle) * relativePoint.z,
        relativePoint.y,
        sin(angle) * relativePoint.x + cos(angle) * relativePoint.z
    );
    return rotatedPoint + anchor;
}

void main() {
    vUv = uv;

    float angleX = WIDTH / radius;
    float angleY = HEIGHT / radius;
    float angleBaseX = offset + progress.x * progressScale;
    float angleBaseY = 0.0; //progress.y * progressScale;

    float anglePointX = angleX * (uv.x - 0.5) * 2.0 + angleBaseX;
    float anglePointY = angleY * (uv.y - 0.5) * 2.0 + angleBaseY;

    // Rotate point when effect > 0.0
    vec3 point = getPoint(radius, anglePointX, anglePointY);
    vec3 anchor = getPoint(radius, anglePointX, 0.0);

    // Base point when effect < 1.0
    // Calculate how much we need to move and scale base so that it would match position and size of image with full effect
    // Since we are calculating relative to projection which is "radius" amount away from anchor (0,0,0), we can just use
    // sin and cos to calculate correct scale and position
    float baseDistanceScale = radius * cos(1.0 / radius);
    float baseSizeScale = radius * sin(1.0 / radius);

    // Rotate by 90 degress to match correct orientation
    vec3 pointBase = rotatePointAroundAnchorZ(position * baseSizeScale * 2.0, vec3(0.0, 0.0, 0.0), PI / 2.0);

    // Rotate around
    pointBase = rotatePointAroundAnchorY(pointBase + vec3(baseDistanceScale, 0.0, 0.0), vec3(0.0, 0.0, 0.0), angleBaseX);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(mix(pointBase, point, effect), 1.0);
}
