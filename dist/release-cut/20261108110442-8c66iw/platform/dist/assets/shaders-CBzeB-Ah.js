const e=Object.freeze({"image-soft-wipe-v1":Object.freeze({vertex:`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragment:`
      uniform sampler2D imageTexture;
      uniform float progress;
      uniform float softness;
      uniform float displacement;
      uniform float grain;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      void main() {
        float noise = (hash(vUv * 320.0) - 0.5) * grain;
        float edge = smoothstep(progress - softness, progress + softness, vUv.x + noise);
        vec2 uv = vUv + vec2((1.0 - edge) * displacement * 0.04, 0.0);
        gl_FragColor = vec4(texture2D(imageTexture, uv).rgb, edge);
      }
    `}),"ambient-flow-v1":Object.freeze({vertex:`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragment:`
      uniform float time;
      uniform float scale;
      uniform float speed;
      uniform float warp;
      uniform float noiseAmount;
      uniform vec3 colorA;
      uniform vec3 colorB;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(41.0,289.0))) * 45758.5453); }
      void main() {
        vec2 p = vUv * scale;
        float field = sin(p.x + time * speed + sin(p.y * 1.7) * warp);
        field += (hash(floor(p * 32.0)) - 0.5) * noiseAmount;
        vec3 color = mix(colorA, colorB, clamp(field * 0.5 + 0.5, 0.0, 1.0));
        gl_FragColor = vec4(color, 1.0);
      }
    `})});export{e as P};
