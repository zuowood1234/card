
import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import { ParticleManager } from './ParticleManager';

// --- Scene Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 30;

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

// --- BLOOM SETUP ---
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.0);
bloomPass.strength = 1.6;
bloomPass.radius = 0.5;
bloomPass.threshold = 0.1;

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// --- Managers ---
const particleManager = new ParticleManager(scene);
particleManager.init(); // Pre-calculates heart points for smooth performance

// --- Interactive Logic ---
const startBtn = document.getElementById('start-btn');
const finalContainer = document.getElementById('final-text');

// 微信浏览器音频加载优化 (WeChat Audio Hack)
// 在微信桥接准备好时，静默触发一次 load，让音频进入缓冲区
document.addEventListener("WeixinJSBridgeReady", function () {
    const bgm = document.getElementById('bgm');
    if (bgm) {
        bgm.load();
    }
}, false);

// Function to Start App
async function startApp() {
    // 0. Play Music Fade In
    const bgm = document.getElementById('bgm');
    if (bgm) {
        bgm.volume = 0;
        bgm.play().catch(e => console.log("Audio play failed:", e));
        // Fade in volume over 2 seconds
        let vol = 0;
        const fadeInterval = setInterval(() => {
            if (vol < 1.0) {
                vol += 0.05;
                bgm.volume = Math.min(vol, 1.0);
            } else {
                clearInterval(fadeInterval);
            }
        }, 100);
    }

    // 1. Hide Button
    if (startBtn) {
        startBtn.style.opacity = '0';
        startBtn.style.pointerEvents = 'none';
        setTimeout(() => startBtn.style.display = 'none', 1000);
    }

    // 2. Start Drifting
    if (particleManager) particleManager.activateDrift();

    // 3. Start Typewriter Sequence
    if (finalContainer) {
        finalContainer.style.display = 'block';
        // Hide all paragraphs initially to prevent flash
        const ps = finalContainer.querySelectorAll('p');
        ps.forEach(p => p.style.opacity = '0');

        // Run typewriter
        await runTypewriterSequence();
    }

    // 4. Morph to Heart AFTER typing is done
    setTimeout(() => {
        if (particleManager) particleManager.morphToHeart();
    }, 1000);
}

// ASYNC TYPEWRITER FUNCTION
async function runTypewriterSequence() {
    const lines = document.querySelectorAll('.typewriter p');
    if (!lines.length) return;

    // 1. Extract HTML content & Clear it
    const lineData = Array.from(lines).map(p => {
        const originalHTML = p.innerHTML;
        p.innerHTML = ''; // Clear content
        p.style.opacity = '1'; // Make container visible (so typed chars show up)
        return { el: p, fullHTML: originalHTML };
    });

    // 2. Type out line by line
    for (const data of lineData) {
        const fullHTML = data.fullHTML;
        let htmlIndex = 0;
        let currentString = "";

        while (htmlIndex < fullHTML.length) {
            const char = fullHTML[htmlIndex];

            if (char === '<') {
                // TAG HANDLING: Find closing '>'
                let tag = "";
                let loopGuard = 0;
                while (htmlIndex < fullHTML.length && fullHTML[htmlIndex] !== '>' && loopGuard < 1000) {
                    tag += fullHTML[htmlIndex];
                    htmlIndex++;
                    loopGuard++;
                }
                if (htmlIndex < fullHTML.length) {
                    tag += '>'; // Add closing brace
                    htmlIndex++; // Move past brace
                }
                currentString += tag;
                // Tags are instant, no await
            } else {
                // CHAR HANDLING
                currentString += char;
                htmlIndex++;

                // Render
                data.el.innerHTML = currentString;

                // Typing delay (Slower, more emotional: ~180ms)
                const delay = 150 + Math.random() * 50;
                await new Promise(r => setTimeout(r, delay));
            }
        }

        // Ensure line is fully typed correctly at end (fix any missed tags or rendering quirks)
        data.el.innerHTML = fullHTML;

        // Line break pause
        await new Promise(r => setTimeout(r, 400));
    }
}

// Bind Click
if (startBtn) {
    startBtn.addEventListener('click', startApp);
}
// Fallback click
document.addEventListener('click', (e) => {
    if (startBtn && startBtn.style.opacity !== '0' && e.target !== startBtn && e.target.tagName !== 'BUTTON') {
        startApp();
    }
});

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);
    let time = performance.now() * 0.001;
    TWEEN.update();
    if (particleManager) particleManager.update(time);
    if (composer) composer.render();
}

// Resize Handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

// START
animate();
