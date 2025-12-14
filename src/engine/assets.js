import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

const loader = new GLTFLoader();
const cache = new Map();

export async function loadGLBScene(url) {
  if (!cache.has(url)) {
    const gltf = await new Promise((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    });
    cache.set(url, gltf);
  }

  const gltf = cache.get(url);
  return {
    scene: SkeletonUtils.clone(gltf.scene),
    animations: gltf.animations,
  };
}