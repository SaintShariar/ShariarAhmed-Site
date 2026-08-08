/**
 * Interactive textured Earth globe — Brooklyn, Atlanta, Buffalo
 * ES module: Three.js + OrbitControls via import map in index.html
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const PLACES = {
  brooklyn: {
    id: 'brooklyn',
    name: 'Brooklyn, NY',
    lat: 40.6782,
    lng: -73.9442,
    status: 'Flying to Brooklyn — roots, Banneker Academy, the start of the path.'
  },
  atlanta: {
    id: 'atlanta',
    name: 'Atlanta, GA',
    lat: 33.749,
    lng: -84.388,
    status: 'Flying to Atlanta — Atlanta Police Department and Southern chapter.'
  },
  buffalo: {
    id: 'buffalo',
    name: 'Buffalo, NY',
    lat: 42.8864,
    lng: -78.8784,
    status: 'Flying to Buffalo — University at Buffalo & Buffalo State.'
  }
};

const EARTH_DAY =
  'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-blue-marble.jpg';
const EARTH_BUMP =
  'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-topology.png';
const EARTH_WATER =
  'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-water.png';
const EARTH_CLOUDS =
  'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_clouds_1024.png';
const SKY =
  'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/night-sky.png';

const GLOBE_RADIUS = 100;
const MARKER_ALT = 1.6;

function latLngToVector3(lat, lng, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const container = document.getElementById('globe-container');
const fallback = document.getElementById('globe-fallback');
const statusEl = document.getElementById('globe-status');
const tourBtn = document.getElementById('globe-tour');
const placeButtons = document.querySelectorAll('.place-btn[data-place]');

if (!container) {
  // nothing to mount
} else {
  init().catch((err) => {
    console.error('Globe failed to initialize:', err);
    showFallback('Your browser couldn’t load the 3D globe. Explore the places below.');
  });
}

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function setActiveButton(id) {
  placeButtons.forEach((btn) => {
    btn.classList.toggle('is-active', btn.getAttribute('data-place') === id);
  });
}

/**
 * Chrome lets author `display: grid` override the HTML `hidden` attribute
 * (UA no longer uses !important). Force-hide the overlay so the WebGL
 * canvas is visible even when textures succeed.
 */
function hideFallback() {
  if (!fallback) return;
  fallback.hidden = true;
  fallback.classList.remove('is-visible');
  fallback.setAttribute('aria-hidden', 'true');
  fallback.style.setProperty('display', 'none', 'important');
}

function showFallback(message) {
  if (!fallback) return;
  fallback.hidden = false;
  fallback.classList.add('is-visible');
  fallback.removeAttribute('aria-hidden');
  fallback.style.removeProperty('display');
  const p = fallback.querySelector('p');
  if (p && message) p.textContent = message;
}

async function init() {
  hideFallback();

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width = container.clientWidth || 640;
  let height = container.clientHeight || 520;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070c);

  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 2000);
  camera.position.set(0, 40, 320);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  renderer.setClearColor(0x05070c, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 160;
  controls.maxDistance = 480;
  controls.autoRotate = !reduced;
  controls.autoRotateSpeed = 0.45;
  controls.target.set(0, 0, 0);

  scene.add(new THREE.AmbientLight(0x8899aa, 0.55));
  const sun = new THREE.DirectionalLight(0xfff5ea, 1.35);
  sun.position.set(4, 1.2, 2);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xe8194f, 0.25);
  rim.position.set(-3, -1, -2);
  scene.add(rim);

  const loader = new THREE.TextureLoader();
  loader.crossOrigin = 'anonymous';

  const loadTex = (url) =>
    new Promise((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    });

  /** Prefer primary URL; optionally try alternates. Never reject — returns null on total failure. */
  const loadTexSafe = async (urls) => {
    const list = Array.isArray(urls) ? urls : [urls];
    for (const url of list) {
      try {
        return await loadTex(url);
      } catch (err) {
        console.warn('Texture load failed:', url, err);
      }
    }
    return null;
  };

  let earthMesh;
  let cloudsMesh;
  let markerGroup = new THREE.Group();
  const markerHits = [];
  let animating = false;
  let tourTimer = null;
  let tourIndex = 0;
  let userPausedTour = true;

  try {
    // Day map is required for a textured globe; bump/water/sky degrade gracefully.
    const [dayMap, bumpMap, waterMap, skyMap] = await Promise.all([
      loadTexSafe(EARTH_DAY),
      loadTexSafe(EARTH_BUMP),
      loadTexSafe(EARTH_WATER),
      loadTexSafe(SKY)
    ]);

    if (skyMap) {
      skyMap.colorSpace = THREE.SRGBColorSpace;
      scene.background = skyMap;
    } else {
      scene.background = new THREE.Color(0x05070c);
    }

    const earthGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);
    let earthMat;
    if (dayMap) {
      dayMap.colorSpace = THREE.SRGBColorSpace;
      earthMat = new THREE.MeshPhongMaterial({
        map: dayMap,
        bumpMap: bumpMap || null,
        bumpScale: bumpMap ? 1.2 : 0,
        specularMap: waterMap || null,
        specular: new THREE.Color(0x222222),
        shininess: 12
      });
    } else {
      // Procedural ocean/land-ish material when remote textures are blocked
      earthMat = new THREE.MeshPhongMaterial({
        color: 0x1a4d6d,
        emissive: 0x0a1a28,
        specular: new THREE.Color(0x334455),
        shininess: 18
      });
      console.warn('Earth day texture unavailable — using solid material.');
    }
    earthMesh = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earthMesh);

    const cloudMap = await loadTexSafe(EARTH_CLOUDS);
    if (cloudMap) {
      const cloudGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.015, 48, 48);
      const cloudMat = new THREE.MeshPhongMaterial({
        map: cloudMap,
        transparent: true,
        opacity: 0.35,
        depthWrite: false
      });
      cloudsMesh = new THREE.Mesh(cloudGeo, cloudMat);
      scene.add(cloudsMesh);
    }

    // Atmosphere glow
    const atmoGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.08, 48, 48);
    const atmoMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      uniforms: {
        glowColor: { value: new THREE.Color(0xe8194f) }
      },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.2);
          gl_FragColor = vec4(glowColor, intensity * 0.55);
        }
      `
    });
    scene.add(new THREE.Mesh(atmoGeo, atmoMat));

    Object.values(PLACES).forEach((place) => {
      const pos = latLngToVector3(place.lat, place.lng, GLOBE_RADIUS + MARKER_ALT);

      const pin = new THREE.Group();
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(1.55, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xe8194f })
      );
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(2.2, 3.1, 32),
        new THREE.MeshBasicMaterial({
          color: 0xe8194f,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );
      pin.add(core);
      pin.add(ring);
      pin.position.copy(pos);
      pin.lookAt(pos.clone().multiplyScalar(2));
      pin.userData.placeId = place.id;
      markerGroup.add(pin);
      markerHits.push(core);
      core.userData.placeId = place.id;
    });
    scene.add(markerGroup);

    hideFallback();
    setStatus(
      dayMap
        ? 'Globe ready — click a city or marker to zoom in.'
        : 'Globe online (simple materials) — click a city to zoom in.'
    );
  } catch (err) {
    console.warn('Globe init failed:', err);
    hideFallback();
    setStatus('Globe running in safe mode — use the city list to explore.');
    earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS, 48, 48),
      new THREE.MeshPhongMaterial({ color: 0x1a3040, emissive: 0x0a1520 })
    );
    scene.add(earthMesh);
  }

  function focusPlace(id, duration = 1600) {
    const place = PLACES[id];
    if (!place) return;

    setActiveButton(id);
    setStatus(place.status);
    controls.autoRotate = false;

    const targetPos = latLngToVector3(place.lat, place.lng, GLOBE_RADIUS);
    const startCam = camera.position.clone();
    const startTarget = controls.target.clone();

    // Camera sits outward from city along surface normal
    const endCam = targetPos.clone().normalize().multiplyScalar(240);
    // Slight lift for cinematic angle
    endCam.y += 28;
    const endTarget = targetPos.clone().multiplyScalar(0.15);

    if (reduced || duration <= 0) {
      camera.position.copy(endCam);
      controls.target.copy(endTarget);
      controls.update();
      return;
    }

    animating = true;
    const start = performance.now();

    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const e = easeInOutCubic(t);
      camera.position.lerpVectors(startCam, endCam, e);
      controls.target.lerpVectors(startTarget, endTarget, e);
      controls.update();
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        animating = false;
        setStatus(`Focused: ${place.name}. Drag to orbit · scroll to zoom.`);
      }
    }
    requestAnimationFrame(step);
  }

  function stopTour() {
    userPausedTour = true;
    if (tourTimer) {
      clearInterval(tourTimer);
      tourTimer = null;
    }
    if (tourBtn) {
      tourBtn.innerHTML = '<i class="fa-solid fa-play" aria-hidden="true"></i> Auto tour';
    }
  }

  function startTour() {
    userPausedTour = false;
    const order = ['brooklyn', 'atlanta', 'buffalo'];
    tourIndex = 0;
    focusPlace(order[0]);
    if (tourBtn) {
      tourBtn.innerHTML = '<i class="fa-solid fa-pause" aria-hidden="true"></i> Stop tour';
    }
    if (tourTimer) clearInterval(tourTimer);
    tourTimer = setInterval(() => {
      if (userPausedTour) return;
      tourIndex = (tourIndex + 1) % order.length;
      focusPlace(order[tourIndex]);
    }, 4800);
  }

  placeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      stopTour();
      focusPlace(btn.getAttribute('data-place'));
    });
  });

  if (tourBtn) {
    tourBtn.addEventListener('click', () => {
      if (tourTimer && !userPausedTour) stopTour();
      else startTour();
    });
  }

  // Marker click via raycaster
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function onPointer(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    const clientX = event.clientX ?? (event.touches && event.touches[0]?.clientX);
    const clientY = event.clientY ?? (event.touches && event.touches[0]?.clientY);
    if (clientX == null) return;
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(markerHits, false);
    if (hits.length) {
      stopTour();
      focusPlace(hits[0].object.userData.placeId);
    }
  }

  renderer.domElement.addEventListener('click', onPointer);
  controls.addEventListener('start', () => {
    if (!animating) controls.autoRotate = false;
  });

  // Opening cinematic: overview → Brooklyn
  camera.position.set(80, 60, 360);
  controls.update();
  window.setTimeout(() => {
    focusPlace('brooklyn', reduced ? 0 : 2200);
  }, reduced ? 200 : 700);

  // Pause auto-rotate when section off-screen
  const section = document.getElementById('journey');
  if (section && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!reduced && !animating && userPausedTour) {
            controls.autoRotate = entry.isIntersecting && camera.position.length() > 280;
          }
        });
      },
      { threshold: 0.15 }
    );
    io.observe(section);
  }

  function onResize() {
    width = container.clientWidth || width;
    height = container.clientHeight || height;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  window.addEventListener('resize', onResize);

  let last = performance.now();
  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (cloudsMesh) cloudsMesh.rotation.y += dt * 0.02;
    if (markerGroup) {
      markerGroup.children.forEach((pin, i) => {
        const ring = pin.children[1];
        if (ring) {
          const s = 1 + Math.sin(now * 0.003 + i) * 0.12;
          ring.scale.set(s, s, s);
        }
      });
    }
    controls.update();
    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);

  // Mobile: slightly pull camera back
  if (window.matchMedia('(max-width: 768px)').matches) {
    controls.minDistance = 200;
    camera.position.multiplyScalar(1.08);
  }
}
