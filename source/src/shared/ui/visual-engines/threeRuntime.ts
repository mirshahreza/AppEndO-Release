import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PLATFORM_SHADER_SOURCES } from './shaders';
import type { EngineMount, EngineMountOptions } from './types';

function hex(value: string): THREE.Color {
  return new THREE.Color(value);
}

function safeTexture(
  texture: THREE.Texture,
  capability: EngineMountOptions['capability'],
  consumedBytes: { value: number },
): boolean {
  const image = texture.image as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number } | undefined;
  const width = image?.naturalWidth ?? image?.width ?? 0;
  const height = image?.naturalHeight ?? image?.height ?? 0;
  const bytes = width * height * 4 * 1.34;
  if (width < 1 || height < 1 || width > 4096 || height > 4096 || consumedBytes.value + bytes > capability.maxTextureBytes) {
    texture.dispose();
    return false;
  }
  consumedBytes.value += bytes;
  return true;
}

function disposeObjectTree(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      Object.values(material).forEach((candidate) => {
        if (
          candidate !== null &&
          typeof candidate === 'object' &&
          'isTexture' in candidate &&
          candidate.isTexture
        ) {
          (candidate as THREE.Texture).dispose();
        }
      });
      material.dispose();
    });
  });
  root.clear();
}

export function mountVisualEngine({
  canvas,
  config,
  capability,
  paused: initiallyPaused,
}: EngineMountOptions): EngineMount | null {
  if (config.engineId === 'canvas-particle-system' || config.engineId === 'canvas-vector-field') return null;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: true,
    });
  } catch {
    return null;
  }
  renderer.setPixelRatio(capability.dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 5);
  const root = new THREE.Group();
  scene.add(root);
  const resources: Array<{ dispose(): void }> = [];
  const consumedTextureBytes = { value: 0 };
  const track = <T extends { dispose(): void }>(resource: T): T => {
    resources.push(resource);
    return resource;
  };
  let paused = initiallyPaused;
  let disposed = false;
  let update = (_elapsed: number) => {};

  if (config.engineId === 'three-product-stage' || config.engineId === 'three-model-orbit') {
    const geometry = track(new THREE.IcosahedronGeometry(1.15, 3));
    const material = track(new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.32, metalness: 0.48 }));
    const model = new THREE.Mesh(geometry, material);
    root.add(model);
    const limits =
      config.engineId === 'three-product-stage'
        ? { triangles: 80_000, materials: 4, textures: 4 }
        : { triangles: 120_000, materials: 6, textures: 6 };
    new GLTFLoader().load(config.modelAsset, (gltf) => {
      if (disposed) {
        disposeObjectTree(gltf.scene);
        return;
      }
      let triangles = 0;
      const materials = new Set<THREE.Material>();
      const textures = new Set<THREE.Texture>();
      gltf.scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const meshGeometry = object.geometry;
        triangles += (meshGeometry.index?.count ?? meshGeometry.attributes.position?.count ?? 0) / 3;
        const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
        meshMaterials.forEach((entry) => {
          materials.add(entry);
          Object.values(entry).forEach((candidate) => {
            if (candidate instanceof THREE.Texture) textures.add(candidate);
          });
        });
      });
      const valid =
        triangles <= limits.triangles &&
        materials.size <= limits.materials &&
        textures.size <= limits.textures &&
        [...textures].every((texture) => safeTexture(texture, capability, consumedTextureBytes));
      if (!valid) {
        disposeObjectTree(gltf.scene);
        return;
      }
      gltf.scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        track(object.geometry);
        const entries = Array.isArray(object.material) ? object.material : [object.material];
        entries.forEach(track);
      });
      textures.forEach(track);
      root.remove(model);
      root.add(gltf.scene);
    });
    const key = new THREE.DirectionalLight(0xffffff, config.engineId === 'three-product-stage' ? config.exposure * 2 : 2);
    key.position.set(3, 4, 5);
    scene.add(key, new THREE.HemisphereLight(0xdbeafe, 0x0f172a, 1.2));
    update = (elapsed) => {
      model.rotation.y = elapsed * (config.engineId === 'three-model-orbit' ? 0.35 : 0.18);
      model.rotation.x = Math.sin(elapsed * 0.22) * 0.08;
    };
  } else if (config.engineId === 'three-spatial-gallery') {
    const textureLoader = new THREE.TextureLoader();
    config.images.forEach((image, index) => {
      const geometry = track(new THREE.PlaneGeometry(1.25, 0.85));
      const material = track(new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
      const texture = textureLoader.load(image.assetRef, (loaded) => {
        if (!safeTexture(loaded, capability, consumedTextureBytes)) return;
        loaded.colorSpace = THREE.SRGBColorSpace;
        loaded.minFilter = THREE.LinearFilter;
        material.map = loaded;
        material.needsUpdate = true;
      });
      track(texture);
      const plane = new THREE.Mesh(geometry, material);
      const angle = (index / config.images.length) * Math.PI * 2;
      plane.position.set(Math.cos(angle) * config.spacing, (index % 3 - 1) * 0.65, Math.sin(angle) * config.spacing);
      plane.lookAt(0, plane.position.y, 0);
      root.add(plane);
    });
    update = (elapsed) => { root.rotation.y = elapsed * 0.08; };
  } else if (config.engineId === 'three-data-constellation') {
    const nodeGeometry = track(new THREE.SphereGeometry(0.045, 8, 6));
    const nodeMaterial = track(new THREE.MeshBasicMaterial({ color: hex(config.color) }));
    const positions = new Map<string, THREE.Vector3>();
    config.nodes.forEach((node, index) => {
      const phi = Math.acos(1 - (2 * (index + 0.5)) / config.nodes.length);
      const theta = Math.PI * (1 + Math.sqrt(5)) * index + config.seed;
      const position = new THREE.Vector3(Math.cos(theta) * Math.sin(phi), Math.cos(phi), Math.sin(theta) * Math.sin(phi)).multiplyScalar(1.75);
      positions.set(node.id, position);
      const mesh = new THREE.Mesh(nodeGeometry, nodeMaterial);
      mesh.position.copy(position);
      mesh.scale.setScalar(0.7 + Math.min(1.5, Math.log10(node.value + 1) / 4));
      root.add(mesh);
    });
    const linePositions: number[] = [];
    config.edges.forEach((edge) => {
      const source = positions.get(edge.source);
      const target = positions.get(edge.target);
      if (source && target) linePositions.push(source.x, source.y, source.z, target.x, target.y, target.z);
    });
    const edgeGeometry = track(new THREE.BufferGeometry());
    edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    const edgeMaterial = track(new THREE.LineBasicMaterial({ color: hex(config.color), transparent: true, opacity: 0.22 }));
    root.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));
    update = (elapsed) => { root.rotation.y = elapsed * 0.06; };
  } else {
    const sources = PLATFORM_SHADER_SOURCES[config.shaderId];
    const geometry = track(new THREE.PlaneGeometry(2, 2));
    let texture: THREE.Texture | null = null;
    const uniforms: Record<string, THREE.IUniform> =
      config.engineId === 'shader-image-reveal'
        ? {
            imageTexture: { value: null },
            progress: { value: config.uniforms.progress },
            softness: { value: config.uniforms.softness },
            displacement: { value: config.uniforms.displacement },
            grain: { value: config.uniforms.grain },
          }
        : {
            time: { value: 0 },
            scale: { value: config.uniforms.scale },
            speed: { value: config.uniforms.speed },
            warp: { value: config.uniforms.warp },
            noiseAmount: { value: config.uniforms.noise },
            colorA: { value: hex(config.uniforms.colorA) },
            colorB: { value: hex(config.uniforms.colorB) },
          };
    const material = track(new THREE.ShaderMaterial({
      vertexShader: sources.vertex,
      fragmentShader: sources.fragment,
      uniforms,
      transparent: config.engineId === 'shader-image-reveal',
    }));
    if (config.engineId === 'shader-image-reveal') {
      texture = new THREE.TextureLoader().load(config.imageAsset, (loaded) => {
        if (!safeTexture(loaded, capability, consumedTextureBytes)) return;
        loaded.colorSpace = THREE.SRGBColorSpace;
        material.needsUpdate = true;
      });
      track(texture);
      uniforms.imageTexture.value = texture;
    }
    const plane = new THREE.Mesh(geometry, material);
    scene.add(plane);
    camera.position.z = 1;
    update = (elapsed) => {
      if (uniforms.time) uniforms.time.value = elapsed;
    };
  }

  const clock = new THREE.Clock();
  let frame = 0;
  const render = () => {
    if (paused || disposed) return;
    update(clock.getElapsedTime());
    renderer.render(scene, camera);
    frame = requestAnimationFrame(render);
  };
  if (!paused) frame = requestAnimationFrame(render);

  return {
    setPaused(next) {
      paused = next;
      cancelAnimationFrame(frame);
      if (!paused && !disposed) {
        clock.start();
        frame = requestAnimationFrame(render);
      }
    },
    resize(width, height, dpr) {
      const safeWidth = Math.max(1, width);
      const safeHeight = Math.max(1, height);
      const boundedDpr = Math.min(dpr, capability.dpr, Math.sqrt(capability.maxBackingPixels / (safeWidth * safeHeight)));
      renderer.setPixelRatio(boundedDpr);
      renderer.setSize(safeWidth, safeHeight, false);
      camera.aspect = safeWidth / safeHeight;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      resources.forEach((resource) => resource.dispose());
      scene.clear();
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.width = 1;
      canvas.height = 1;
    },
  };
}
