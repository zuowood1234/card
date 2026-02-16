
import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';

// --- SHADERS ---
const particleVertexShader = `
    attribute float size;
    attribute vec3 customColor;
    varying vec3 vColor;
    varying float vAlpha;
    
    uniform float uTime;
    uniform float uBeatStrength;
    
    void main() {
        vColor = customColor;
        vec3 transformed = position;
        
        // HEART PULSE EFFECT
        if (uBeatStrength > 0.0) {
            float dist = length(position);
            vec3 dir = normalize(position);
            
            // "Breathing" expansion
            // Uniform expansion for a natural beat (No ripple ring)
            // Increased amplitude to 0.8 for bigger pulse
            float spread = uBeatStrength * 0.8; 
            
            // Apply scale uniformly in direction
            transformed += dir * spread;
        }
        
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        // RESTORE ORIGINAL PARTICLE SIZE CALCULATION (300.0)
        gl_PointSize = size * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
        vAlpha = 0.8 + 0.2 * sin(uTime * 2.0 + length(position)); 
    }
`;

const particleFragmentShader = `
    uniform sampler2D pointTexture;
    varying vec3 vColor;
    varying float vAlpha;
    
    void main() {
        // Boost color for bloom
        gl_FragColor = vec4(vColor * 1.8, vAlpha);
        gl_FragColor = gl_FragColor * texture2D(pointTexture, gl_PointCoord);
        if (gl_FragColor.a < 0.1) discard;
    }
`;

export class ParticleManager {
    constructor(scene) {
        this.scene = scene;
        this.particles = null;
        this.particleCount = 16000; // Increase slightly for density

        this.isMorphing = false;
        this.isHeart = false;

        const textureLoader = new THREE.TextureLoader();
        const sprite = textureLoader.load('https://threejs.org/examples/textures/sprites/spark1.png');

        this.uniforms = {
            uTime: { value: 0.0 },
            uBeatStrength: { value: 0.0 },
            pointTexture: { value: sprite }
        };

        this.material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: particleVertexShader,
            fragmentShader: particleFragmentShader,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            transparent: true,
            vertexColors: true
        });

        this.tween = null;
        this.heartPoints = null; // Store PRE-CALCULATED points
    }

    async init() {
        this._createBaseParticles();
        // PRE-CALCULATE HEART POINTS HERE to avoid lags later
        this.heartPoints = this._generateHeartPoints();
    }

    activateDrift() {
        // No-op
    }

    _getColorForParticle() {
        const c = new THREE.Color();
        const r = Math.random();

        if (r > 0.8) {
            // White
            c.setHSL(0.0, 0.0, 1.0);
        } else if (r > 0.6) {
            // Gold
            c.setHSL(0.12, 1.0, 0.8);
        } else {
            // Pink
            const hue = 0.92 + Math.random() * 0.05;
            c.setHSL(hue, 0.8, 0.7);
        }
        return c;
    }

    _createBaseParticles() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.particleCount * 3);
        const colors = new Float32Array(this.particleCount * 3);
        const sizes = new Float32Array(this.particleCount);

        for (let i = 0; i < this.particleCount; i++) {
            // Keep SPHERICAL DISTRIBUTION
            const r = 20 + Math.random() * 30;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);

            const c = this._getColorForParticle();
            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;

            sizes[i] = Math.random() * 0.6 + 0.2;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        this.particles = new THREE.Points(geometry, this.material);
        this.scene.add(this.particles);
    }

    _generateHeartPoints() {
        const target = new Float32Array(this.particleCount * 3);
        let count = 0;

        // Loop safety break
        let safety = 0;
        while (count < this.particleCount && safety < 1000000) {
            safety++;
            const x = (Math.random() * 3) - 1.5;
            const y = (Math.random() * 3) - 1.5;
            const z = (Math.random() * 1.5) - 0.75;

            // Offset constant: 0.6 -> 0.45 makes the top notch deeper
            const ay = y + 0.45;
            const term1 = x * x + ay * ay - 1;
            const val = term1 * term1 * term1 - x * x * ay * ay * ay;

            if (val <= 0) {
                const jitter = 1.0 + (Math.random() - 0.5) * 0.2;

                // --- HEART SIZE CONFIGURATION ---
                // ADJUST THESE NUMBERS TO CHANGE SIZE
                // 11.5 Width / 10.0 Height = Grand, wide, embracing heart
                target[count * 3] = x * 11.5 * jitter;      // WIDTH (宽度)
                // Increase height slightly to match new shape
                target[count * 3 + 1] = y * 10.5 * jitter + 4.0; // HEIGHT (高度) + Offset Up
                target[count * 3 + 2] = z * 6.5 * jitter;  // THICKNESS (厚度)
                count++;
            }
        }
        return target;
    }

    morphToHeart() {
        if (this.isMorphing) return;

        // Use PRE-CALCULATED coordinates (Zero Lag)
        const targetBuf = this.heartPoints;
        if (!targetBuf) return; // Safety check

        const currentAttr = this.particles.geometry.attributes.position;
        const sourcePositions = new Float32Array(currentAttr.array);

        this.isMorphing = true;
        this.isHeart = false;

        // Reset rotation to ensure heart faces front
        new TWEEN.Tween(this.particles.rotation)
            .to({ x: 0, y: 0, z: 0 }, 1000)
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();

        if (this.tween) this.tween.stop();

        const animData = { t: 0 };
        this.tween = new TWEEN.Tween(animData)
            .to({ t: 1 }, 3000)
            .easing(TWEEN.Easing.Cubic.InOut)
            .onUpdate(() => {
                const t = animData.t;
                for (let i = 0; i < this.particleCount * 3; i++) {
                    currentAttr.array[i] = sourcePositions[i] * (1 - t) + targetBuf[i] * t;
                }
                currentAttr.needsUpdate = true;
                this.uniforms.uBeatStrength.value = t * 1.0;
            })
            .onComplete(() => {
                this.isMorphing = false;
                this.isHeart = true;
            })
            .start();
    }

    update(time) {
        TWEEN.update();
        this.uniforms.uTime.value = time;

        // HEART BEAT LOOP
        if (this.isHeart && !this.isMorphing) {
            const beatFreq = 2.0;
            const t = time * beatFreq;
            let beat = Math.pow(Math.abs(Math.sin(t)), 6.0);
            this.uniforms.uBeatStrength.value = 1.0 + beat * 0.8;
        }

        // BACKGROUND DRIFT
        if (!this.isHeart) {
            this.particles.rotation.y += 0.0005;
        }

        // HEART GENTLE SWAY (Minimal)
        if (this.isHeart) {
            this.particles.rotation.y = Math.sin(time * 1.0) * 0.1; // Gentle sway
        }
    }
}
