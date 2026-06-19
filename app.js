/* System Application State */
const state = {
  stream: null,
  localModel: null,
  localModelLoading: false,
  isDetecting: false,
  isCloudScanning: false,
  autoScanIntervalId: null,
  history: [],
  gallery: [],
  stats: {
    latencyLogs: [], // last 10 scan latencies
    totalScans: 0,
    detectedEntities: {} // map of label -> counts
  },
  audio: {
    fxEnabled: true,
    ttsEnabled: false,
    synthesizer: null
  },
  settings: {
    apiMode: 'demo',
    geminiApiKey: '',
    proxyUrl: '',
    model: 'gemini-2.5-flash',
    confidenceThreshold: 0.5,
    autoScanInterval: 'off',
    ttsVoice: '',
    ttsRate: 1.0,
    ttsVolume: 1.0,
    promptBlueprint: 'Analyze this camera frame. Focus on objects, people, and environmental context. Write a highly clear, descriptive, professional analysis in 2-3 sentences. Do not use bullets or formatting.'
  }
};

// DOM Elements Mapping
const elements = {
  videoFeed: document.getElementById('videoFeed'),
  overlayCanvas: document.getElementById('overlayCanvas'),
  captureCanvas: document.getElementById('captureCanvas'),
  viewportContainer: document.getElementById('viewportContainer'),
  startFeedBtn: document.getElementById('startFeedBtn'),
  stopFeedBtn: document.getElementById('stopFeedBtn'),
  captureSnapshotBtn: document.getElementById('captureSnapshotBtn'),
  scanManualBtn: document.getElementById('scanManualBtn'),
  cameraPlaceholder: document.getElementById('cameraPlaceholder'),
  overlayResolution: document.getElementById('overlayResolution'),
  fpsCounter: document.getElementById('fpsCounter'),
  latencyText: document.getElementById('latencyText'),
  timestampText: document.getElementById('timestampText'),
  statusPill: document.getElementById('statusPill'),
  statusPillText: document.getElementById('statusPillText'),
  errorBanner: document.getElementById('errorBanner'),
  errorMessage: document.getElementById('errorMessage'),
  consoleLogs: document.getElementById('consoleLogs'),
  consoleClearBtn: document.getElementById('consoleClearBtn'),
  cloudAnalysisText: document.getElementById('cloudAnalysisText'),
  analysisLoader: document.getElementById('analysisLoader'),
  loaderText: document.getElementById('loaderText'),
  speakButton: document.getElementById('speakButton'),
  toggleTtsBtn: document.getElementById('toggleTtsBtn'),
  toggleAudioBtn: document.getElementById('toggleAudioBtn'),
  
  // Settings
  apiModeSelect: document.getElementById('apiModeSelect'),
  apiKeySettingRow: document.getElementById('apiKeySettingRow'),
  geminiApiKeyInput: document.getElementById('geminiApiKeyInput'),
  toggleVisibilityBtn: document.getElementById('toggleVisibilityBtn'),
  proxyUrlSettingRow: document.getElementById('proxyUrlSettingRow'),
  proxyUrlInput: document.getElementById('proxyUrlInput'),
  modelSelectRow: document.getElementById('modelSelectRow'),
  modelSelect: document.getElementById('modelSelect'),
  confidenceThreshold: document.getElementById('confidenceThreshold'),
  autoScanLoop: document.getElementById('autoScanLoop'),
  ttsVoiceSelect: document.getElementById('ttsVoiceSelect'),
  ttsRateSlider: document.getElementById('ttsRateSlider'),
  promptTemplateInput: document.getElementById('promptTemplateInput'),
  
  // Stats/Analytics
  latencyStat: document.getElementById('latencyStat'),
  scansCountStat: document.getElementById('scansCountStat'),
  analyticsChart: document.getElementById('analyticsChart'),
  entityList: document.getElementById('entityList'),
  
  // Gallery
  galleryGrid: document.getElementById('galleryGrid'),
  galleryEmptyState: document.getElementById('galleryEmptyState'),
  galleryCountText: document.getElementById('galleryCountText'),
  
  // Modal
  galleryModal: document.getElementById('galleryModal'),
  modalCloseBtn: document.getElementById('modalCloseBtn'),
  modalTitle: document.getElementById('modalTitle'),
  modalImage: document.getElementById('modalImage'),
  modalMetaTimestamp: document.getElementById('modalMetaTimestamp'),
  modalMetaAnalysis: document.getElementById('modalMetaAnalysis'),
  modalMetaDetections: document.getElementById('modalMetaDetections'),
  modalDeleteBtn: document.getElementById('modalDeleteBtn'),
  modalDownloadBtn: document.getElementById('modalDownloadBtn')
};

/* Synthesized Audio Engine (Web Audio API) */
const audioEngine = {
  init() {
    if (!state.audio.synthesizer) {
      state.audio.synthesizer = new (window.AudioContext || window.webkitAudioContext)();
    }
  },
  playClick() {
    if (!state.audio.fxEnabled) return;
    this.init();
    const ctx = state.audio.synthesizer;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(900, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  },
  playTick() {
    if (!state.audio.fxEnabled) return;
    this.init();
    const ctx = state.audio.synthesizer;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(1600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.03);
    gain.gain.setValueAtTime(0.03, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
    osc.start();
    osc.stop(ctx.currentTime + 0.03);
  },
  playAlert(isWarning = false) {
    if (!state.audio.fxEnabled) return;
    this.init();
    const ctx = state.audio.synthesizer;
    if (!ctx) return;
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    const freqs = isWarning ? [280, 220] : [587.33, 698.46, 880]; // D5, F5, A5
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = isWarning ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.06);
      osc.connect(gain);
      osc.start(now + i * 0.06);
      osc.stop(now + 0.35);
    });
  }
};

/* System Utility and Console Logging */
function systemLog(msg, type = 'default') {
  const now = new Date();
  const time = now.toTimeString().split(' ')[0];
  const div = document.createElement('div');
  div.className = `log-entry ${type}`;
  div.innerHTML = `<span class="log-time">[${time}]</span><span>${msg}</span>`;
  elements.consoleLogs.appendChild(div);
  elements.consoleLogs.scrollTop = elements.consoleLogs.scrollHeight;
}

function clearConsole() {
  audioEngine.playClick();
  elements.consoleLogs.innerHTML = '';
  systemLog('Console buffer cleared.');
}

function toggleAudioFx() {
  state.audio.fxEnabled = !state.audio.fxEnabled;
  elements.toggleAudioBtn.classList.toggle('active', state.audio.fxEnabled);
  if (state.audio.fxEnabled) {
    audioEngine.init();
    audioEngine.playClick();
    systemLog('System Audio Sound FX: Enabled.', 'info');
  } else {
    systemLog('System Audio Sound FX: Disabled.');
  }
}

function toggleTts() {
  state.audio.ttsEnabled = !state.audio.ttsEnabled;
  elements.toggleTtsBtn.classList.toggle('active', state.audio.ttsEnabled);
  if (state.audio.ttsEnabled) {
    audioEngine.playClick();
    systemLog('Neural Synthesizer Text-To-Speech: Active.', 'info');
    speakText('Narrator active.');
  } else {
    window.speechSynthesis.cancel();
    systemLog('Neural Synthesizer Text-To-Speech: Standby.');
  }
}

function speakText(text) {
  if (!state.audio.ttsEnabled) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.volume = state.settings.ttsVolume;
  utterance.rate = state.settings.ttsRate;
  
  const voices = window.speechSynthesis.getVoices();
  const selected = voices.find(v => v.name === state.settings.ttsVoice);
  if (selected) utterance.voice = selected;
  
  window.speechSynthesis.speak(utterance);
}

function readAloudCurrent() {
  audioEngine.playClick();
  const txt = elements.cloudAnalysisText.textContent;
  if (txt && txt !== 'Analysis empty.') speakText(txt);
}

function updateRangeLabel(elementId, value) {
  document.getElementById(elementId).textContent = value;
  saveSettings();
}

function togglePasswordVisibility(inputId) {
  audioEngine.playClick();
  const input = document.getElementById(inputId);
  input.type = input.type === 'password' ? 'text' : 'password';
}

/* Tab Controller */
function switchTab(tabName) {
  audioEngine.playClick();
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
    if(btn.textContent.toLowerCase().includes(tabName)) btn.classList.add('active');
  });
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`tab-${tabName}`).classList.add('active');
  
  if (tabName === 'analytics') {
    renderAnalyticsChart();
  }
}

/* Initialize and Stop Camera Feed */
let lastFrameTime = performance.now();
let frameCount = 0;
let actualFps = 0.0;

async function initiateCamera() {
  audioEngine.playClick();
  systemLog('Requesting optical access permissions...');
  elements.startFeedBtn.disabled = true;

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { 
        facingMode: 'user',
        width: { ideal: 640 },
        height: { ideal: 480 }
      },
      audio: false
    });

    // Swapped order to prevent media loaded metadata race conditions
    elements.videoFeed.onloadedmetadata = () => {
      systemLog(`Optical link locked: ${elements.videoFeed.videoWidth}x${elements.videoFeed.videoHeight}`, 'success');
      elements.overlayResolution.textContent = `${elements.videoFeed.videoWidth}x${elements.videoFeed.videoHeight} FEED`;
      resizeCanvas();
    };
    elements.videoFeed.srcObject = state.stream;

    elements.cameraPlaceholder.style.display = 'none';
    elements.stopFeedBtn.disabled = false;
    elements.captureSnapshotBtn.disabled = false;
    elements.scanManualBtn.disabled = false;
    
    updateSystemStatus();
    startDetectionLoop();
    audioEngine.playAlert(false);

  } catch (err) {
    systemLog(`Optical access denied: ${err.message}`, 'error');
    showErrorBanner(`Optical Feed Lock Failure: ${err.message}. Check permissions.`);
    elements.startFeedBtn.disabled = false;
    audioEngine.playAlert(true);
  }
}

function terminateCamera() {
  audioEngine.playClick();
  systemLog('Optical disconnect command received.');
  if (state.stream) {
    state.stream.getTracks().forEach(t => t.stop());
    state.stream = null;
  }
  elements.videoFeed.srcObject = null;
  elements.cameraPlaceholder.style.display = 'flex';
  elements.overlayResolution.textContent = 'CAMERA DISCONNECTED';
  elements.fpsCounter.textContent = '0.0';
  
  elements.stopFeedBtn.disabled = true;
  elements.captureSnapshotBtn.disabled = true;
  elements.scanManualBtn.disabled = true;
  state.isDetecting = false;

  updateSystemStatus();
  
  const overlayCtx = elements.overlayCanvas.getContext('2d');
  overlayCtx.clearRect(0, 0, elements.overlayCanvas.width, elements.overlayCanvas.height);
  systemLog('Neural scanning terminated successfully.');
}

function resizeCanvas() {
  elements.overlayCanvas.width = elements.videoFeed.clientWidth;
  elements.overlayCanvas.height = elements.videoFeed.clientHeight;
}

window.addEventListener('resize', resizeCanvas);

function updateSystemStatus() {
  const active = !!state.stream;
  const statusText = elements.statusPillText;
  const pill = elements.statusPill;
  
  pill.className = 'sys-status';
  
  if (!active) {
    pill.classList.add('offline');
    statusText.textContent = 'OFFLINE';
  } else if (state.isCloudScanning) {
    pill.classList.add('scanning');
    statusText.textContent = 'SCANNING';
  } else if (state.settings.apiMode === 'demo') {
    pill.classList.add('active');
    statusText.textContent = 'LIVE (DEMO)';
  } else {
    pill.classList.add('cloud');
    statusText.textContent = 'LIVE (CLOUD)';
  }
}

/* Error Banners */
function showErrorBanner(msg) {
  elements.errorMessage.textContent = msg;
  elements.errorBanner.classList.add('active');
}

function hideErrorBanner() {
  elements.errorBanner.classList.remove('active');
}

/* TensorFlow local object detection loop */
let cocoDetections = [];

async function loadCocoModel() {
  if (state.localModel || state.localModelLoading) return;
  state.localModelLoading = true;
  systemLog('Initializing TensorFlow client-side neural nets...', 'info');
  try {
    state.localModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
    systemLog('Local object detection engine loaded successfully.', 'success');
  } catch (err) {
    systemLog(`Failed to load local model: ${err.message}. Using simulation fallback.`, 'warn');
  } finally {
    state.localModelLoading = false;
  }
}

async function startDetectionLoop() {
  if (!state.stream) return;
  state.isDetecting = true;
  await loadCocoModel();
  
  lastFrameTime = performance.now();
  frameCount = 0;
  
  requestAnimationFrame(detectionLoop);
}

async function detectionLoop() {
  if (!state.isDetecting || !state.stream) return;

  // Track FPS
  frameCount++;
  const now = performance.now();
  if (now - lastFrameTime >= 1000) {
    actualFps = (frameCount * 1000) / (now - lastFrameTime);
    elements.fpsCounter.textContent = actualFps.toFixed(1);
    frameCount = 0;
    lastFrameTime = now;
  }

  // Local COCO-SSD Detection
  if (state.localModel && elements.videoFeed.readyState === 4) {
    try {
      cocoDetections = await state.localModel.detect(elements.videoFeed);
    } catch (e) {
      // ignore transient detection frames error
    }
  } else {
    cocoDetections = [];
  }

  // Draw local visuals
  drawOverlayVisuals();

  requestAnimationFrame(detectionLoop);
}

function drawOverlayVisuals() {
  const overlayCtx = elements.overlayCanvas.getContext('2d');
  overlayCtx.clearRect(0, 0, elements.overlayCanvas.width, elements.overlayCanvas.height);
  
  const width = elements.overlayCanvas.width;
  const height = elements.overlayCanvas.height;

  // Apply confidence threshold filter
  const thresh = state.settings.confidenceThreshold;
  const filtered = cocoDetections.filter(d => d.score >= thresh);

  filtered.forEach(d => {
    // Coordinate mapping (mirror matching video scaleX(-1))
    const videoW = elements.videoFeed.videoWidth || 640;
    const videoH = elements.videoFeed.videoHeight || 480;

    const scaleX = width / videoW;
    const scaleY = height / videoH;

    let [x, y, w, h] = d.bbox;
    x = x * scaleX;
    y = y * scaleY;
    w = w * scaleX;
    h = h * scaleY;

    // Bounding box draw
    overlayCtx.strokeStyle = 'rgba(0, 229, 255, 0.85)';
    overlayCtx.lineWidth = 1.5;
    overlayCtx.strokeRect(x, y, w, h);

    // Reticle Corners for object
    const cornerLen = Math.min(10, w / 4, h / 4);
    overlayCtx.strokeStyle = '#8b5cf6';
    overlayCtx.lineWidth = 2.5;

    // TL corner
    overlayCtx.beginPath();
    overlayCtx.moveTo(x + cornerLen, y); overlayCtx.lineTo(x, y); overlayCtx.lineTo(x, y + cornerLen);
    overlayCtx.stroke();
    // TR corner
    overlayCtx.beginPath();
    overlayCtx.moveTo(x + w - cornerLen, y); overlayCtx.lineTo(x + w, y); overlayCtx.lineTo(x + w, y + cornerLen);
    overlayCtx.stroke();
    // BL corner
    overlayCtx.beginPath();
    overlayCtx.moveTo(x + cornerLen, y + h); overlayCtx.lineTo(x, y + h); overlayCtx.lineTo(x, y + h - cornerLen);
    overlayCtx.stroke();
    // BR corner
    overlayCtx.beginPath();
    overlayCtx.moveTo(x + w - cornerLen, y + h); overlayCtx.lineTo(x + w, y + h); overlayCtx.lineTo(x + w, y + h - cornerLen);
    overlayCtx.stroke();

    // Adjusted label background and text coordinate drawing to prevent clipping when object is on top border
    const labelY = (y - 18 < 0) ? (y + h) : y;
    const bgY = (y - 18 < 0) ? y : (y - 18);
    const textY = (y - 18 < 0) ? (y + 12) : (y - 6);

    // Object Label text background
    overlayCtx.fillStyle = 'rgba(11, 12, 21, 0.8)';
    overlayCtx.fillRect(x, bgY, Math.max(90, w), 18);
    overlayCtx.strokeStyle = 'rgba(0, 229, 255, 0.2)';
    overlayCtx.strokeRect(x, bgY, Math.max(90, w), 18);

    // Draw Label Text
    overlayCtx.fillStyle = '#f8fafc';
    overlayCtx.font = "bold 9px 'Space Mono', monospace";
    overlayCtx.fillText(`${d.class.toUpperCase()} // ${Math.round(d.score * 100)}%`, x + 6, textY);

    // Record metrics entity list
    trackEntityMetric(d.class);
  });

  // Update resolution clock HUD text
  const timeNow = new Date();
  elements.timestampText.textContent = timeNow.toTimeString().split(' ')[0] + ' LOCAL';
}

function trackEntityMetric(className) {
  if (!state.stats.detectedEntities[className]) {
    state.stats.detectedEntities[className] = 0;
  }
  // Simple debounce/dampener to increment entity counts at reasonable rate
  if (Math.random() < 0.05) { // 5% chance of recording hit per animation frame
    state.stats.detectedEntities[className]++;
    updateEntityDatabaseUI();
  }
}

function updateEntityDatabaseUI() {
  const list = elements.entityList;
  const keys = Object.keys(state.stats.detectedEntities);
  if (keys.length === 0) {
    list.innerHTML = '<div class="entity-empty">No objects detected yet</div>';
    return;
  }
  list.innerHTML = keys.map(k => `
    <div class="entity-item">
      <span class="entity-name">${k}</span>
      <span class="entity-count">${state.stats.detectedEntities[k]} hits</span>
    </div>
  `).join('');
}

/* Snapshot Generation */
function captureRawImageBase64() {
  const videoW = elements.videoFeed.videoWidth || 640;
  const videoH = elements.videoFeed.videoHeight || 480;
  elements.captureCanvas.width = videoW;
  elements.captureCanvas.height = videoH;
  const cCtx = elements.captureCanvas.getContext('2d');
  
  // Mirror frame to match mirrored user view
  cCtx.translate(videoW, 0);
  cCtx.scale(-1, 1);
  cCtx.drawImage(elements.videoFeed, 0, 0, videoW, videoH);
  cCtx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform matrix
  
  return elements.captureCanvas.toDataURL('image/jpeg', 0.85);
}

function triggerSnapshot() {
  audioEngine.playTick();
  if (!state.stream) return;
  
  const base64Data = captureRawImageBase64();
  const now = new Date();
  const timeStr = now.toLocaleTimeString();
  
  // Collect current local predictions
  const localPredictions = cocoDetections
    .filter(d => d.score >= state.settings.confidenceThreshold)
    .map(d => `${d.class} (${Math.round(d.score * 100)}%)`)
    .join(', ') || 'None';

  const snap = {
    id: Date.now(),
    image: base64Data,
    timestamp: now.toLocaleString(),
    analysisText: elements.cloudAnalysisText.textContent,
    localDetections: localPredictions
  };

  state.gallery.unshift(snap);
  systemLog('Snapshot captured and saved to gallery buffer.', 'success');
  updateGalleryUI();
}

function updateGalleryUI() {
  elements.galleryCountText.textContent = state.gallery.length;
  if (state.gallery.length === 0) {
    elements.galleryGrid.style.display = 'none';
    elements.galleryEmptyState.style.display = 'flex';
    return;
  }

  elements.galleryGrid.style.display = 'grid';
  elements.galleryEmptyState.style.display = 'none';

  elements.galleryGrid.innerHTML = state.gallery.map(snap => `
    <div class="gallery-item" data-id="${snap.id}">
      <img src="${snap.image}" alt="Captured frame">
      <span class="gallery-time">${snap.timestamp.split(',')[1].trim()}</span>
    </div>
  `).join('');

  // Re-bind click event on newly added gallery thumbnails
  document.querySelectorAll('.gallery-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = parseInt(item.getAttribute('data-id'));
      openSnapshotModal(id);
    });
  });
}

function openSnapshotModal(id) {
  audioEngine.playClick();
  const snap = state.gallery.find(s => s.id === id);
  if (!snap) return;

  elements.modalImage.src = snap.image;
  elements.modalMetaTimestamp.textContent = snap.timestamp;
  elements.modalMetaAnalysis.textContent = snap.analysisText;
  elements.modalMetaDetections.textContent = snap.localDetections;
  
  elements.modalDeleteBtn.onclick = () => deleteSnapshot(id);
  elements.modalDownloadBtn.onclick = () => downloadSnapshot(snap);

  elements.galleryModal.classList.add('active');
}

function closeModal() {
  audioEngine.playClick();
  elements.galleryModal.classList.remove('active');
}

function deleteSnapshot(id) {
  state.gallery = state.gallery.filter(s => s.id !== id);
  systemLog('Snapshot removed from local buffer.');
  updateGalleryUI();
  closeModal();
}

function downloadSnapshot(snap) {
  audioEngine.playTick();
  const link = document.createElement('a');
  link.href = snap.image;
  link.download = `neural-scan-${snap.id}.jpg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/* Core Cloud AI Multimodal Scanning */
async function triggerCloudScan() {
  if (state.isCloudScanning || !state.stream) return;
  hideErrorBanner();

  const startTime = performance.now();
  state.isCloudScanning = true;
  updateSystemStatus();
  
  elements.analysisLoader.style.display = 'flex';
  elements.cloudAnalysisText.style.display = 'none';
  elements.speakButton.style.display = 'none';
  
  systemLog('Triggering multimodal neural scan...', 'info');
  if (state.settings.apiMode !== 'demo') {
    elements.loaderText.textContent = `CONNECTING CLOUD: ${state.settings.model.toUpperCase()}...`;
  } else {
    elements.loaderText.textContent = 'RUNNING MOCK SCENE INTERPRETATION...';
  }

  // Pre-defined element access fixes potential unhandled reference crashes
  elements.viewportContainer.classList.add('scanning');

  try {
    const rawFrameData = captureRawImageBase64().split(',')[1];
    let responseText = '';

    if (state.settings.apiMode === 'gemini') {
      responseText = await sendGeminiRequest(rawFrameData);
    } else if (state.settings.apiMode === 'custom') {
      responseText = await sendProxyRequest(rawFrameData);
    } else {
      // Zero-Key Demo simulation mode
      responseText = await simulateSceneAnalysis();
    }

    // Display results
    elements.cloudAnalysisText.textContent = responseText;
    elements.cloudAnalysisText.style.display = 'block';
    elements.cloudAnalysisText.className = 'analysis-body';
    elements.speakButton.style.display = 'block';
    
    systemLog('Interpretation response loaded.', 'success');
    audioEngine.playTick();
    
    // Speak results if TTS active
    speakText(responseText);

    // Latency metric
    const latency = Math.round(performance.now() - startTime);
    elements.latencyText.textContent = `${latency}ms`;
    state.stats.latencyLogs.push(latency);
    if (state.stats.latencyLogs.length > 10) state.stats.latencyLogs.shift();
    
    state.stats.totalScans++;
    elements.scansCountStat.textContent = state.stats.totalScans;
    elements.latencyStat.textContent = `${latency} ms`;

    // Real-time canvas graph update when user is on the tab
    if (document.getElementById('tab-analytics').classList.contains('active')) {
      renderAnalyticsChart();
    }

  } catch (err) {
    systemLog(`Cloud scan failure: ${err.message}`, 'error');
    showErrorBanner(`Scanning Connection Error: ${err.message}`);
    
    elements.cloudAnalysisText.textContent = `Interpretation failed: ${err.message}`;
    elements.cloudAnalysisText.className = 'analysis-body empty';
    elements.speakButton.style.display = 'none';
    
    audioEngine.playAlert(true);
  } finally {
    state.isCloudScanning = false;
    elements.analysisLoader.style.display = 'none';
    elements.cloudAnalysisText.style.display = 'block';
    elements.viewportContainer.classList.remove('scanning');
    updateSystemStatus();
  }
}

// Google Gemini API Request
async function sendGeminiRequest(base64Image) {
  const apiKey = state.settings.geminiApiKey;
  if (!apiKey) {
    throw new Error('API Key missing. Navigate to settings tab to save key.');
  }

  const modelName = state.settings.model;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image
            }
          },
          {
            text: state.settings.promptBlueprint
          }
        ]
      }
    ]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    const errMsg = errorJson.error?.message || `HTTP ${response.status} Error`;
    throw new Error(errMsg);
  }

  const responseJson = await response.json();
  
  try {
    const textOut = responseJson.candidates[0].content.parts[0].text;
    return textOut.trim();
  } catch (err) {
    throw new Error("Invalid response format received from Google Gemini API.");
  }
}

// Proxy request
async function sendProxyRequest(base64Image) {
  const proxyUrl = state.settings.proxyUrl;
  if (!proxyUrl) {
    throw new Error('Proxy Endpoint Link missing in settings.');
  }

  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      image: base64Image,
      prompt: state.settings.promptBlueprint,
      model: state.settings.model
    })
  });

  if (!response.ok) {
    throw new Error(`Proxy responded with ${response.status}`);
  }

  const textOut = await response.text();
  return textOut.trim();
}

// Simulated description for Offline/Demo mode
async function simulateSceneAnalysis() {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Look at cocoSSD detections to make simulated output realistic
      const currentVisible = cocoDetections
        .filter(d => d.score >= state.settings.confidenceThreshold)
        .map(d => d.class);

      let analysis = '';
      if (currentVisible.length > 0) {
        const unique = Array.from(new Set(currentVisible));
        const itemsList = unique.join(' and ');
        analysis = `System detected local object signatures containing a ${itemsList} in the active frame viewport. The environment presents a stable indoor workspace layout with adequate lighting parameters. No hostile activities or movement anomalies detected in the immediate area.`;
      } else {
        analysis = "Neural scanner telemetry shows a clear indoor workspace with no highlighted object identifiers in the frame. Lighting remains uniform and constant. System scanning vectors report normal static room configurations.";
      }

      resolve(analysis);
    }, 1200); // simulated network delay
  });
}

/* Auto Scan interval triggers */
function toggleScanLoop(intervalVal) {
  state.settings.autoScanInterval = intervalVal;
  saveSettings();
  if (state.autoScanIntervalId) {
    clearInterval(state.autoScanIntervalId);
    state.autoScanIntervalId = null;
    systemLog('Automated scanning sequence loop paused.');
  }

  if (intervalVal === 'off') return;

  const ms = parseInt(intervalVal);
  state.autoScanIntervalId = setInterval(() => {
    if (state.stream && !state.isCloudScanning) {
      triggerCloudScan();
    }
  }, ms);
  
  systemLog(`Automated scanning sequence initialized. Interval: ${ms / 1000}s`, 'info');
}

/* Settings management */
function handleApiModeChange(val) {
  state.settings.apiMode = val;
  
  elements.apiKeySettingRow.style.display = val === 'gemini' ? 'block' : 'none';
  elements.proxyUrlSettingRow.style.display = val === 'custom' ? 'block' : 'none';
  elements.modelSelectRow.style.display = (val === 'gemini' || val === 'custom') ? 'block' : 'none';
  
  updateSystemStatus();
  saveSettings();
}

function saveSettings() {
  state.settings.geminiApiKey = elements.geminiApiKeyInput.value;
  state.settings.proxyUrl = elements.proxyUrlInput.value;
  state.settings.model = elements.modelSelect.value;
  state.settings.confidenceThreshold = parseFloat(elements.confidenceThreshold.value) / 100;
  state.settings.ttsVoice = elements.ttsVoiceSelect.value;
  state.settings.ttsRate = parseFloat(elements.ttsRateSlider.value) / 10;
  state.settings.promptBlueprint = elements.promptTemplateInput.value;
  state.settings.apiMode = elements.apiModeSelect.value;
  state.settings.autoScanInterval = elements.autoScanLoop.value;

  localStorage.setItem('vision_ai_settings', JSON.stringify({
    apiMode: state.settings.apiMode,
    proxyUrl: state.settings.proxyUrl,
    model: state.settings.model,
    confidenceThreshold: state.settings.confidenceThreshold,
    autoScanInterval: state.settings.autoScanInterval,
    ttsVoice: state.settings.ttsVoice,
    ttsRate: state.settings.ttsRate,
    promptBlueprint: state.settings.promptBlueprint
  }));

  // Sensitive API key saved separately
  if (state.settings.geminiApiKey) {
    localStorage.setItem('vision_ai_gemini_key', state.settings.geminiApiKey);
  }
}

function loadSettings() {
  const saved = localStorage.getItem('vision_ai_settings');
  const savedKey = localStorage.getItem('vision_ai_gemini_key');
  
  if (saved) {
    const parsed = JSON.parse(saved);
    state.settings.apiMode = parsed.apiMode || 'demo';
    state.settings.proxyUrl = parsed.proxyUrl || '';
    state.settings.model = parsed.model || 'gemini-2.5-flash';
    state.settings.confidenceThreshold = parsed.confidenceThreshold !== undefined ? parsed.confidenceThreshold : 0.5;
    state.settings.autoScanInterval = parsed.autoScanInterval || 'off';
    state.settings.ttsVoice = parsed.ttsVoice || '';
    state.settings.ttsRate = parsed.ttsRate || 1.0;
    state.settings.promptBlueprint = parsed.promptBlueprint || state.settings.promptBlueprint;
  }

  if (savedKey) {
    state.settings.geminiApiKey = savedKey;
  }

  // Populate elements
  elements.apiModeSelect.value = state.settings.apiMode;
  elements.geminiApiKeyInput.value = state.settings.geminiApiKey;
  elements.proxyUrlInput.value = state.settings.proxyUrl;
  elements.modelSelect.value = state.settings.model;
  elements.confidenceThreshold.value = Math.round(state.settings.confidenceThreshold * 100);
  document.getElementById('confidenceThresholdVal').textContent = Math.round(state.settings.confidenceThreshold * 100) + '%';
  
  elements.autoScanLoop.value = state.settings.autoScanInterval;
  
  elements.ttsRateSlider.value = Math.round(state.settings.ttsRate * 10);
  document.getElementById('ttsRateVal').textContent = state.settings.ttsRate + 'x';
  
  elements.promptTemplateInput.value = state.settings.promptBlueprint;

  handleApiModeChange(state.settings.apiMode);
  populateSpeechVoices();
  
  // Set up the loop interval if it was saved as active
  if (state.settings.autoScanInterval !== 'off') {
    toggleScanLoop(state.settings.autoScanInterval);
  }
}

// Populate system Speech Synthesis voices
function populateSpeechVoices() {
  if (typeof speechSynthesis === 'undefined') return;

  const populate = () => {
    const voices = window.speechSynthesis.getVoices();
    elements.ttsVoiceSelect.innerHTML = voices.map(v => `
      <option value="${v.name}" ${v.name === state.settings.ttsVoice ? 'selected' : ''}>
        ${v.name} (${v.lang})
      </option>
    `).join('');
  };

  populate();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = populate;
  }
}

/* Latency canvas graph drawer */
function renderAnalyticsChart() {
  const canvas = elements.analyticsChart;
  const ctx = canvas.getContext('2d');
  
  // Make high DPI sharp
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = width * window.devicePixelRatio;
  canvas.height = height * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  ctx.clearRect(0, 0, width, height);

  const logs = state.stats.latencyLogs;
  if (logs.length < 2) {
    ctx.fillStyle = '#475569';
    ctx.font = "11px 'Space Mono', monospace";
    ctx.textAlign = 'center';
    ctx.fillText("Insufficient latency data logs to graph", width / 2, height / 2);
    return;
  }

  const padding = 20;
  const maxVal = Math.max(...logs, 1000); // graph scale
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Draw Grid Lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding + (chartHeight * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  // Plot Points
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  
  logs.forEach((latency, i) => {
    const x = padding + (chartWidth * i) / (logs.length - 1);
    const y = padding + chartHeight - (chartHeight * latency) / maxVal;
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  // Plot fill area
  ctx.fillStyle = 'rgba(0, 229, 255, 0.05)';
  ctx.lineTo(padding + chartWidth, padding + chartHeight);
  ctx.lineTo(padding, padding + chartHeight);
  ctx.closePath();
  ctx.fill();

  // Plot dots
  logs.forEach((latency, i) => {
    const x = padding + (chartWidth * i) / (logs.length - 1);
    const y = padding + chartHeight - (chartHeight * latency) / maxVal;
    
    ctx.fillStyle = '#8b5cf6';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Axis labels
  ctx.fillStyle = '#64748b';
  ctx.font = "8px 'Space Mono', monospace";
  ctx.textAlign = 'left';
  ctx.fillText(`${maxVal}ms`, padding, padding - 5);
  ctx.fillText("0ms", padding, padding + chartHeight + 12);
  ctx.textAlign = 'right';
  ctx.fillText("Latency Timeline (Scans 1-10)", width - padding, padding + chartHeight + 12);
}

// Bind Event Listeners Dynamically (Modern CSP Safe Approach)
function bindEventListeners() {
  elements.toggleTtsBtn.addEventListener('click', toggleTts);
  elements.toggleAudioBtn.addEventListener('click', toggleAudioFx);
  elements.startFeedBtn.addEventListener('click', initiateCamera);
  elements.stopFeedBtn.addEventListener('click', terminateCamera);
  elements.captureSnapshotBtn.addEventListener('click', triggerSnapshot);
  elements.speakButton.addEventListener('click', readAloudCurrent);
  elements.scanManualBtn.addEventListener('click', triggerCloudScan);
  elements.consoleClearBtn.addEventListener('click', clearConsole);
  
  elements.apiModeSelect.addEventListener('change', (e) => handleApiModeChange(e.target.value));
  elements.geminiApiKeyInput.addEventListener('change', saveSettings);
  elements.proxyUrlInput.addEventListener('change', saveSettings);
  elements.modelSelect.addEventListener('change', saveSettings);
  elements.ttsVoiceSelect.addEventListener('change', saveSettings);
  elements.promptTemplateInput.addEventListener('change', saveSettings);
  
  elements.confidenceThreshold.addEventListener('input', (e) => {
    updateRangeLabel('confidenceThresholdVal', e.target.value + '%');
  });
  elements.ttsRateSlider.addEventListener('input', (e) => {
    updateRangeLabel('ttsRateVal', (e.target.value / 10) + 'x');
  });
  elements.autoScanLoop.addEventListener('change', (e) => toggleScanLoop(e.target.value));

  // Tab switching events
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.textContent.includes('Hub')) switchTab('hub');
      else if (btn.textContent.includes('Analytics')) switchTab('analytics');
      else if (btn.textContent.includes('Gallery')) switchTab('gallery');
      else if (btn.textContent.includes('Settings')) switchTab('settings');
    });
  });

  // Modal events
  elements.modalCloseBtn.addEventListener('click', closeModal);
  elements.toggleVisibilityBtn.addEventListener('click', () => togglePasswordVisibility('geminiApiKeyInput'));
}

// App Initialization
window.addEventListener('load', () => {
  systemLog('Initializing Neural Scanning Subsystems...');
  loadSettings();
  bindEventListeners();
  systemLog('All systems online. Standby mode.', 'success');
});
