import * as THREE from 'three';

class SpaceScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.sizes = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    this.cursor = { x: 0, y: 0 };
    this.scrollY = window.scrollY || 0; 
    this.lastScrollY = this.scrollY;
    this.scrollVelocity = 0;
    
    // Total Z depth to travel (from Z=20 to Z=-230, distance of 250)
    this.totalDepth = 250;
    
    this.clock = new THREE.Clock();
    
    // Hoist dummy Object3D — avoids GC pressure from creating one every frame
    this.dummy = new THREE.Object3D();

    this.init();
    this.createStarfield();
    this.createSolarSystem();
    if (!this.isMobile) this.createAsteroids(); // Skip asteroids on mobile entirely
    this.createLights();
    this.bindEvents();
    
    this.updateCameraTarget(0);
    this.camera.position.z = this.targetZ; 
    
    this.animate = this.animate.bind(this);
    this.renderer.setAnimationLoop(this.animate);
  }

  init() {
    this.isMobile = window.innerWidth < 768;
    this.scene = new THREE.Scene();
    
    // Deep cosmic blue fog. Background is transparent so CSS grid shows.
    this.scene.fog = new THREE.FogExp2(0x050510, 0.0015);

    this.camera = new THREE.PerspectiveCamera(60, this.sizes.width / this.sizes.height, 0.1, 1000);
    this.camera.position.z = 20;
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true, // Transparent so CSS background acts as a base layer
      antialias: !this.isMobile, // Disable antialiasing on mobile for performance
      powerPreference: this.isMobile ? 'low-power' : 'high-performance'
    });
    this.renderer.setSize(this.sizes.width, this.sizes.height);
    this.renderer.setPixelRatio(this.isMobile ? 1 : Math.min(window.devicePixelRatio, 2));
  }

  createStarfield() {
    // Adaptive star count — fewer on mobile for smooth 60fps, but dense enough to look good
    const starCount = this.isMobile ? 3000 : 8000; 
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      // Squeeze volume to 350x350 so they feel much denser around the camera
      positions[i3] = (Math.random() - 0.5) * 350;
      positions[i3 + 1] = (Math.random() - 0.5) * 350;
      // Spread across 1500 units depth to completely eliminate gaps during flight
      positions[i3 + 2] = (Math.random() - 1.0) * 1500 + 200; 

      const color = new THREE.Color();
      const rand = Math.random();
      if (rand > 0.9) color.setHex(0xec4899); 
      else if (rand > 0.7) color.setHex(0x818cf8); 
      else if (rand > 0.5) color.setHex(0xfde68a); 
      else color.setHex(0xffffff); 

      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
      
      // Bigger stars for clear 3D movement instead of a twinkling moiré effect
      sizes[i] = (Math.random() * 4.0 + 2.0) * (this.isMobile ? 1.5 : 1.0);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(sizes, 1));

    // Create a smooth circular texture for the stars to prevent aliasing/twinkling
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 16, 16);
    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
      size: this.isMobile ? 1.5 : 2.5,
      map: texture,
      transparent: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });

    this.stars = new THREE.Points(geometry, material);
    this.scene.add(this.stars);
  }

  createSolarSystem() {
    this.planetsGroup = new THREE.Group();
    this.scene.add(this.planetsGroup);
    
    this.planets = [];
    const textureLoader = new THREE.TextureLoader();

    // Adaptive geometry segments: 64x64 on desktop, 16x16 on mobile
    const segments = this.isMobile ? 16 : 64;

    const createPlanet = (radius, textureFile, z, xOffset, isSun = false) => {
      const geo = new THREE.SphereGeometry(radius, segments, segments);
      const tex = textureFile ? textureLoader.load('/textures/' + textureFile) : null;
      
      let mat;
      if (isSun) {
        mat = new THREE.MeshBasicMaterial({ 
          map: tex,
          color: tex ? 0xffffff : 0xffaa00 
        });
      } else {
        mat = new THREE.MeshStandardMaterial({
          map: tex,
          color: tex ? 0xffffff : 0x888888,
          roughness: 0.6,
          metalness: 0.2
        });
      }
      const mesh = new THREE.Mesh(geo, mat);
      
      mesh.rotation.x = Math.random() * 0.4;
      mesh.rotation.z = Math.random() * 0.2;
      mesh.position.set(xOffset, 0, z);
      
      this.planetsGroup.add(mesh);
      this.planets.push(mesh);
      return mesh;
    };

    // Sun at X = +14 on desktop, but bring it much closer to center (+5) on mobile so it's visible
    const sunX = this.isMobile ? 5 : 14;
    const sun = createPlanet(7, 'sun.jpg', -5, sunX, true);
    
    const sunLight = new THREE.PointLight(0xffffff, 8, 800); 
    sunLight.position.copy(sun.position);
    this.scene.add(sunLight);

    // Planets scattered across Z, pulled tighter to center on mobile
    const spread = this.isMobile ? 0.4 : 1.0;
    createPlanet(0.3, 'mercury.jpg', -25, -4 * spread);
    createPlanet(0.7, 'venus.jpg', -50, 6 * spread);
    createPlanet(0.8, 'earth.jpg', -75, -5 * spread);
    createPlanet(0.5, 'mars.jpg', -100, 4 * spread);

    createPlanet(3.0, 'jupiter.jpg', -150, -12 * spread);
    const saturn = createPlanet(2.5, 'saturn.jpg', -175, 14 * spread);
    
    const ringGeo = new THREE.RingGeometry(3.0, 5.0, segments);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xcfb590,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
      roughness: 0.5
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2 + 0.3; 
    saturn.add(ring);

    createPlanet(1.2, 'uranus.jpg', -200, -8 * spread);
    createPlanet(1.1, 'neptune.jpg', -225, 6 * spread);
  }

  createAsteroids() {
    this.asteroidCount = 1200;
    const geo = new THREE.DodecahedronGeometry(0.15, 0); 
    const mat = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.7,
      metalness: 0.3
    });
    
    this.asteroids = new THREE.InstancedMesh(geo, mat, this.asteroidCount);
    
    // Store asteroid data for dynamic tumbling and revolving
    this.asteroidData = [];
    
    for(let i=0; i<this.asteroidCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 8 + Math.random() * 12;
      const y = (Math.random() - 0.5) * 4;
      const rotSpeedX = (Math.random() - 0.5) * 2;
      const rotSpeedY = (Math.random() - 0.5) * 2;
      const rotSpeedZ = (Math.random() - 0.5) * 2;
      const orbitSpeed = 0.05 + (Math.random() * 0.1);
      const scale = 0.5 + Math.random() * 2.0;

      this.asteroidData.push({
        angle, radius, y, 
        rotX: Math.random() * Math.PI, 
        rotY: Math.random() * Math.PI, 
        rotZ: Math.random() * Math.PI,
        rotSpeedX, rotSpeedY, rotSpeedZ, 
        orbitSpeed, scale
      });
    }

    this.updateAsteroidMatrices(0);
    this.scene.add(this.asteroids);
  }

  updateAsteroidMatrices(deltaTime) {
    // Reuse hoisted dummy Object3D instead of creating new one per frame
    const dummy = this.dummy;
    
    for(let i=0; i<this.asteroidCount; i++) {
      const data = this.asteroidData[i];
      
      // Orbiting
      data.angle += data.orbitSpeed * deltaTime;
      const x = Math.cos(data.angle) * data.radius;
      const z = -125 + Math.sin(data.angle) * (data.radius * 0.5); 
      
      // Tumbling
      data.rotX += data.rotSpeedX * deltaTime;
      data.rotY += data.rotSpeedY * deltaTime;
      data.rotZ += data.rotSpeedZ * deltaTime;

      dummy.position.set(x, data.y, z);
      dummy.rotation.set(data.rotX, data.rotY, data.rotZ);
      dummy.scale.set(data.scale, data.scale, data.scale);
      
      dummy.updateMatrix();
      this.asteroids.setMatrixAt(i, dummy.matrix);
    }
    
    this.asteroids.instanceMatrix.needsUpdate = true;
  }

  createLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);
    
    const galacticLight = new THREE.DirectionalLight(0x818cf8, 1);
    galacticLight.position.set(50, 20, 50);
    this.scene.add(galacticLight);
  }

  bindEvents() {
    // Debounced resize handler
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.sizes.width = window.innerWidth;
        this.sizes.height = window.innerHeight;
        this.camera.aspect = this.sizes.width / this.sizes.height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.sizes.width, this.sizes.height);
        this.updateCameraTarget();
      }, 150);
    });

    // Only bind mousemove on non-touch devices
    if (!this.isMobile) {
      window.addEventListener('mousemove', (event) => {
        this.cursor.x = event.clientX / this.sizes.width - 0.5;
        this.cursor.y = event.clientY / this.sizes.height - 0.5;
      });
    }

    // Passive scroll listener for better scroll performance
    window.addEventListener('scroll', () => {
      this.scrollY = window.scrollY;
      this.updateCameraTarget();
    }, { passive: true });
  }

  updateCameraTarget() {
    // Map scroll percentage to the depth length
    const maxScroll = Math.max(1, document.body.scrollHeight - window.innerHeight);
    const scrollProgress = Math.min(1.0, Math.max(0.0, this.scrollY / maxScroll));
    
    // Target Z progresses deeply through the system
    this.targetZ = 20 - (scrollProgress * this.totalDepth);

    // Make the flight path curved! Swoop around the planets.
    this.targetX = Math.sin(scrollProgress * Math.PI * 4) * 8; 
    this.targetY = Math.cos(scrollProgress * Math.PI * 3) * 4 - 2;
  }

  animate() {
    const deltaTime = Math.min(this.clock.getDelta(), 0.1);
    
    // Calculate scroll velocity
    const scrollDelta = this.scrollY - this.lastScrollY;
    this.lastScrollY = this.scrollY;
    // Smooth the velocity
    this.scrollVelocity += (scrollDelta - this.scrollVelocity) * 0.15;

    // Rotate planets
    this.planets.forEach((planet, index) => {
      const speed = index === 0 ? 0.02 : 0.15;
      planet.rotation.y += deltaTime * speed;
    });

    // Orbit and Tumble Asteroids (only on desktop)
    if(this.asteroids) {
      this.updateAsteroidMatrices(deltaTime);
    }

    // Parallax (only on desktop — cursor is always 0,0 on mobile)
    const parallaxX = this.cursor.x * 2;
    const parallaxY = -this.cursor.y * 2;
    
    // Smooth Camera Movement (Flight Dynamics)
    const finalTargetX = this.targetX + parallaxX;
    const finalTargetY = this.targetY + parallaxY;
    
    const previousX = this.camera.position.x;
    
    this.camera.position.x += (finalTargetX - this.camera.position.x) * 2 * deltaTime;
    this.camera.position.y += (finalTargetY - this.camera.position.y) * 2 * deltaTime;
    this.camera.position.z += (this.targetZ - this.camera.position.z) * 5 * deltaTime; 
    
    // Camera Banking (Tilt the spaceship based on turn velocity)
    const velocityX = this.camera.position.x - previousX;
    this.camera.rotation.z = -velocityX * 0.1;

    // Look straight ahead, factoring in the curve so it feels natural
    this.camera.lookAt(
      this.camera.position.x * 0.5, 
      this.camera.position.y * 0.5, 
      this.camera.position.z - 20
    );

    // 3D Star Wrapping & Velocity! (Increased speed so they clearly move past the camera)
    const baseSpeed = 150;
    const scrollBoost = Math.abs(this.scrollVelocity) * 3.0;
    const totalStarSpeed = baseSpeed + scrollBoost;

    const positions = this.stars.geometry.attributes.position.array;
    for(let i = 0; i < positions.length; i += 3) {
      positions[i + 2] += totalStarSpeed * deltaTime;

      if (positions[i + 2] > this.camera.position.z + 50) {
        positions[i + 2] -= 1500;
        positions[i] = (Math.random() - 0.5) * 350;
        positions[i + 1] = (Math.random() - 0.5) * 350;
      } else if (positions[i + 2] < this.camera.position.z - 1450) {
        positions[i + 2] += 1500;
      }
    }
    this.stars.geometry.attributes.position.needsUpdate = true;

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Dispose of all WebGL resources to prevent context leaks.
   * Called automatically on page unload.
   */
  dispose() {
    this.renderer.setAnimationLoop(null);

    // Recursively dispose geometries, materials, textures
    this.scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((mat) => {
            if (mat.map) mat.map.dispose();
            mat.dispose();
          });
        } else {
          if (object.material.map) object.material.map.dispose();
          object.material.dispose();
        }
      }
    });

    this.renderer.dispose();
  }
}

// ----------------------------------------------------
// Failsafe Initializer
// ----------------------------------------------------
let sceneInstance = null;

export function initSpaceBackground() {
    const canvas = document.getElementById('space-canvas');
    if (!canvas) return;
    
    // Don't pre-test with getContext — it locks the canvas to that context type
    // and prevents Three.js (which defaults to WebGL2) from initializing.
    // Instead, just try-catch the entire SpaceScene constructor.
    try {
        sceneInstance = new SpaceScene(canvas);

        // Clean up WebGL context on page unload to prevent leaks
        window.addEventListener('beforeunload', () => {
          if (sceneInstance) {
            sceneInstance.dispose();
            sceneInstance = null;
          }
        });
    } catch (e) {
        console.warn("Three.js solar system failed. Falling back to CSS.", e);
    }
}
