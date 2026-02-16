
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

export class GestureDetector {
    constructor() {
        this.handLandmarker = undefined;
        this.runningMode = "VIDEO";
        this.lastVideoTime = -1;
        this.isLoaded = false;
        this.lastFingerPos = null;

        // Debug UI - REMOVED to prevent sticking "Initializing" message
        // this.debugDiv = document.createElement('div');
        // ...
        // document.body.appendChild(this.debugDiv);
    }

    async initialize() {
        try {
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
            );
            this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                    delegate: "GPU"
                },
                runningMode: this.runningMode,
                numHands: 1
            });
            this.isLoaded = true;
            this.debugDiv.innerText = "Model Ready. Waiting for hand...";
        } catch (error) {
            console.error("Error initializing HandLandmarker:", error);
            this.debugDiv.innerText = "Model Failed: " + error.message;
        }
    }

    detect(videoElement) {
        if (!this.handLandmarker || !videoElement.currentTime) return null;

        if (videoElement.currentTime !== this.lastVideoTime) {
            this.lastVideoTime = videoElement.currentTime;

            try {
                const results = this.handLandmarker.detectForVideo(videoElement, performance.now());

                if (results.landmarks && results.landmarks.length > 0) {
                    const landmarks = results.landmarks[0];

                    // Store Index Finger Tip (Index 8) normalized coordinates
                    this.lastFingerPos = {
                        x: landmarks[8].x,
                        y: landmarks[8].y
                    };

                    const gesture = this.classifyGesture(landmarks);

                    this.debugDiv.innerText = `Gesture: ${gesture}`;
                    return gesture;
                } else {
                    this.debugDiv.innerText = "No Hand Detected";
                    this.lastFingerPos = null;
                }
            } catch (e) {
                // Ignore transient errors
            }
        }
        return null;
    }

    classifyGesture(landmarks) {
        // Robust Finger Counting Logic based on Distance from Wrist (Index 0)

        const wrist = landmarks[0];
        const distSq = (p1, p2) => (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;

        const isFingerOpen = (tipIdx, pipIdx) => {
            return distSq(landmarks[tipIdx], wrist) > distSq(landmarks[pipIdx], wrist);
        };

        const isThumbOpen = isFingerOpen(4, 2);
        const isIndexOpen = isFingerOpen(8, 6);
        const isMiddleOpen = isFingerOpen(12, 10);
        const isRingOpen = isFingerOpen(16, 14);
        const isPinkyOpen = isFingerOpen(20, 18);

        let count = 0;
        if (isThumbOpen) count++;
        if (isIndexOpen) count++;
        if (isMiddleOpen) count++;
        if (isRingOpen) count++;
        if (isPinkyOpen) count++;

        // --- IMPROVED LOGIC FOR COUNTDOWN ---

        // 3: To eliminate confusion with "2", we usually REQUIRE Ring or Pinky to be open for "3".
        // (Either "Chinese 3" or "OK sign 3")
        // If it's pure Thumb + Index + Middle (3 fingers), we treat it as "Sloppy 2"
        // unless you specifically WANT to support "German 3".

        if (count >= 3 && (isRingOpen || isPinkyOpen)) return "THREE";

        // If count is 3 but Ring/Pinky are closed, it's ambiguous but safer to call it TWO
        // (Index+Middle+Thumb)
        if (count === 3 && !isRingOpen && !isPinkyOpen) return "TWO";

        // 2: Index + Middle (Typical V-shape or Index+Thumb)
        if (isIndexOpen && isMiddleOpen) return "TWO";

        // 1: Must include Index, but Middle must be CLOSED
        if (isIndexOpen && !isMiddleOpen) return "ONE";

        // Fallbacks
        if (count === 2) return "TWO";
        if (count === 1) return "ONE";

        return `OTHER (${count})`;
    }
}
