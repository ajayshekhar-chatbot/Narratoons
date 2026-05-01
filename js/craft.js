/**
 * craft.js — Narratoons Frontend + Voice Recognition
 * ====================================================
 * Features:
 *   1. Type a prompt normally in the text box
 *   2. OR click the 🎙 mic button to speak — Web Speech API
 *      converts your voice to text and fills the input box
 *   3. Pick grid layout (TYPE-1/2/3) and art style
 *   4. Click Generate → calls FastAPI backend → shows comic panels
 *
 * Voice Recognition uses the browser's built-in Web Speech API.
 * It works in Chrome and Edge. Firefox does NOT support it.
 * No extra library or API key needed — it's free and built-in.
 */

// ── State ────────────────────────────────────────────────────
let selectedGridType    = 0;
let selectedPictureType = 0;
const styleLabels       = ['Japanese', 'American', 'Egyptian'];
const BACKEND_URL       = 'http://127.0.0.1:8000/generate-comic';

// Voice recognition state
let recognition  = null;   // SpeechRecognition instance
let isListening  = false;  // are we currently recording?


// ════════════════════════════════════════════════════════════
// VOICE RECOGNITION
// Uses the Web Speech API — built into Chrome & Edge for free.
// No API key, no cost, no external service.
// ════════════════════════════════════════════════════════════

/**
 * initVoiceRecognition()
 * Sets up the SpeechRecognition object with event handlers.
 * Called once on page load.
 *
 * How it works:
 *   1. User clicks the mic button → startListening()
 *   2. Browser asks for microphone permission (first time only)
 *   3. Browser streams audio to Google's speech servers (built into Chrome)
 *   4. Transcribed text comes back via the `onresult` event
 *   5. We put that text into the input field
 */
function initVoiceRecognition() {
    // Check if browser supports Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        // Not supported — show warning, disable mic button
        document.getElementById('voice-unsupported').style.display = 'block';
        const btn = document.getElementById('mic-btn');
        if (btn) {
            btn.disabled = true;
            btn.title = 'Voice not supported — use Chrome or Edge';
            btn.style.opacity = '0.4';
            btn.style.cursor = 'not-allowed';
        }
        return;
    }

    // Create the recognition instance
    recognition = new SpeechRecognition();

    // Settings:
    recognition.lang = 'en-US';          // Listen for English
    recognition.continuous = false;       // Stop after one utterance
    recognition.interimResults = true;    // Show partial results while speaking

    // ── Event: Got speech result ──
    recognition.onresult = (event) => {
        const input = document.getElementById('prompt-input');

        // Loop through results and find the best transcript
        let finalTranscript   = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }

        // Show interim (partial) results in the input as user speaks
        if (interimTranscript) {
            input.value = interimTranscript;
            input.style.color = 'rgba(34,34,34,0.5)'; // greyed = still speaking
        }

        // When final result arrives, set it properly
        if (finalTranscript) {
            input.value = finalTranscript;
            input.style.color = '#222'; // normal color = done
        }
    };

    // ── Event: Recognition ended (user stopped speaking or timeout) ──
    recognition.onend = () => {
        stopListening();
    };

    // ── Event: Error ──
    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);

        let message = '❌ Voice error.';
        if (event.error === 'not-allowed') {
            message = '❌ Microphone blocked. Allow mic access in browser settings.';
        } else if (event.error === 'no-speech') {
            message = '⚠️ No speech detected. Try again.';
        } else if (event.error === 'network') {
            message = '❌ Network error. Check your connection.';
        }

        setVoiceStatus(message, false);
        stopListening();
    };

    // ── Event: Speech detected ──
    recognition.onspeechstart = () => {
        setVoiceStatus('🎙 Listening... speak now', true);
    };
}


/**
 * toggleVoice()
 * Called when user clicks the mic button.
 * Starts or stops voice recognition.
 */
function toggleVoice() {
    if (!recognition) {
        alert('Voice not supported in this browser.\nPlease use Chrome or Edge.');
        return;
    }

    if (isListening) {
        // User clicked again to stop
        recognition.stop();
        stopListening();
    } else {
        startListening();
    }
}


/**
 * startListening()
 * Activates the mic, updates UI to "listening" state.
 */
function startListening() {
    try {
        recognition.start();
        isListening = true;

        // Update mic button: red + pulsing
        const btn  = document.getElementById('mic-btn');
        const icon = document.getElementById('mic-icon');
        btn.classList.add('listening');
        icon.className = 'fa-solid fa-microphone-slash'; // change icon to "slash" = recording

        setVoiceStatus('🎙 Waiting for microphone...', true);

    } catch (e) {
        // Already started — just stop it
        recognition.stop();
        stopListening();
    }
}


/**
 * stopListening()
 * Deactivates the mic, resets UI to normal state.
 */
function stopListening() {
    isListening = false;

    // Reset button appearance
    const btn  = document.getElementById('mic-btn');
    const icon = document.getElementById('mic-icon');
    if (btn)  btn.classList.remove('listening');
    if (icon) icon.className = 'fa-solid fa-microphone';

    // Show "done" message briefly, then hide
    const input = document.getElementById('prompt-input');
    if (input && input.value.trim()) {
        setVoiceStatus('✅ Got it! Click Generate to create your comic.', false);
        input.style.color = '#222';
    } else {
        setVoiceStatus('', false);
    }

    setTimeout(() => {
        setVoiceStatus('', false);
    }, 3000);
}


/**
 * setVoiceStatus(message, show)
 * Updates the small status text below the input row.
 *
 * @param {string}  message - Text to display
 * @param {boolean} show    - true = visible, false = hidden
 */
function setVoiceStatus(message, show) {
    const status = document.getElementById('voice-status');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('hidden', !show && !message);
}


// ════════════════════════════════════════════════════════════
// GRID DROPDOWN
// ════════════════════════════════════════════════════════════

function toggleDropdown() {
    const list = document.getElementById('dropdown-list');
    list.style.display = list.style.display === 'block' ? 'none' : 'block';
}

function selectGrid(idx) {
    const labels = ['TYPE-1', 'TYPE-2', 'TYPE-3'];
    const icons  = [
        `<svg width="24" height="24" viewBox="0 0 24 24"><rect x="2" y="2" width="9" height="9" fill="#444"/><rect x="13" y="2" width="9" height="9" fill="#444"/><rect x="2" y="13" width="9" height="9" fill="#444"/><rect x="13" y="13" width="9" height="9" fill="#444"/></svg>`,
        `<svg width="24" height="24" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="9" fill="#444"/><rect x="2" y="13" width="9" height="9" fill="#888"/><rect x="13" y="13" width="9" height="9" fill="#444"/></svg>`,
        `<svg width="24" height="24" viewBox="0 0 24 24"><rect x="2" y="2" width="9" height="20" fill="#444"/><rect x="13" y="2" width="9" height="9" fill="#888"/><rect x="13" y="13" width="9" height="9" fill="#888"/></svg>`
    ];

    document.getElementById('selected-grid-icon').innerHTML = icons[idx];
    document.getElementById('selected-grid-label').innerText = labels[idx];
    document.getElementById('dropdown-list').style.display = 'none';

    document.querySelectorAll('.grid-type-dropdown .dropdown-item').forEach((item, i) => {
        item.classList.toggle('selected', i === idx);
        const ck = item.querySelector('.checkmark');
        if (i === idx && !ck) {
            const c = document.createElement('span');
            c.className = 'checkmark'; c.innerHTML = '&#10003;';
            item.appendChild(c);
        } else if (i !== idx && ck) { ck.remove(); }
    });

    selectedGridType = idx;
    updateOutputDemo();
}


// ════════════════════════════════════════════════════════════
// STYLE DROPDOWN
// ════════════════════════════════════════════════════════════

function togglePictureDropdown() {
    const list = document.getElementById('picture-dropdown-list');
    list.style.display = list.style.display === 'block' ? 'none' : 'block';
}

function selectPictureType(idx) {
    document.getElementById('selected-picture-label').innerText = styleLabels[idx];
    document.getElementById('picture-dropdown-list').style.display = 'none';

    document.querySelectorAll('#picture-dropdown-list .dropdown-item').forEach((item, i) => {
        item.classList.toggle('selected', i === idx);
        const ck = item.querySelector('.checkmark');
        if (i === idx && !ck) {
            const c = document.createElement('span');
            c.className = 'checkmark'; c.innerHTML = '&#10003;';
            item.appendChild(c);
        } else if (i !== idx && ck) { ck.remove(); }
    });

    selectedPictureType = idx;
    updateOutputDemo();
}


// ════════════════════════════════════════════════════════════
// PANEL PREVIEW & GENERATION
// ════════════════════════════════════════════════════════════

function updateOutputDemo() {
    document.getElementById('output-picture-style').innerText =
        'Style: ' + styleLabels[selectedPictureType];

    const output = document.getElementById('output-images');
    output.className = 'output-images grid-' + selectedGridType;
    output.innerHTML = '';

    const numPanels = selectedGridType === 0 ? 4 : 3;
    for (let i = 0; i < numPanels; i++) {
        const panel = document.createElement('div');
        panel.className = `comic-panel panel-${i + 1} empty-outline`;
        panel.innerHTML = `<span class="panel-placeholder-text">Panel ${i + 1}</span>`;
        output.appendChild(panel);
    }
}

function showGeneratingState() {
    const output = document.getElementById('output-images');
    output.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Generating your comic...<br>
            <small>Each panel takes ~30s. Please wait.</small></p>
        </div>
    `;
}

async function generateComic() {
    const input  = document.getElementById('prompt-input');
    const prompt = input ? input.value.trim() : '';

    if (!prompt) {
        alert('Please type or speak a prompt first!\nExample: "A samurai battles a giant robot at sunset"');
        return;
    }

    // Stop mic if still listening
    if (isListening && recognition) {
        recognition.stop();
        stopListening();
    }

    showGeneratingState();

    const numPanels = selectedGridType === 0 ? 4 : 3;

    try {
        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt:     prompt,
                style:      styleLabels[selectedPictureType],
                grid_type:  selectedGridType,
                num_panels: numPanels
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || `Server error: ${response.status}`);
        }

        const data = await response.json();
        if (!data.images || data.images.length === 0) throw new Error('No images returned.');

        const output = document.getElementById('output-images');
        output.className = 'output-images grid-' + selectedGridType;
        output.innerHTML = '';

        data.images.forEach((src, idx) => {
            const panel = document.createElement('div');
            panel.className = `comic-panel panel-${idx + 1}`;
            const img = document.createElement('img');
            img.src = src;
            img.alt = `Comic panel ${idx + 1}`;
            panel.appendChild(img);
            output.appendChild(panel);
        });

    } catch (error) {
        console.error('Error:', error);
        alert(
            `Failed to generate comic:\n${error.message}\n\n` +
            `Check:\n• Is the backend running? (python -m uvicorn comic_backend:app --reload)\n` +
            `• Is your .env file set with STABILITY_API_KEY?\n` +
            `• Visit http://127.0.0.1:8000/health`
        );
        updateOutputDemo();
    }
}


// ════════════════════════════════════════════════════════════
// INIT — runs when page loads
// ════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {

    // Set up voice recognition
    initVoiceRecognition();

    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
        const gd = document.querySelector('.grid-type-dropdown');
        const pd = document.querySelector('.picture-style-dropdown');
        if (gd && !gd.contains(e.target))
            document.getElementById('dropdown-list').style.display = 'none';
        if (pd && !pd.contains(e.target))
            document.getElementById('picture-dropdown-list').style.display = 'none';
    });

    // Enter key in input field triggers generate
    const inp = document.getElementById('prompt-input');
    if (inp) inp.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') generateComic();
    });

    // Generate button
    document.getElementById('generate-btn')?.addEventListener('click', generateComic);

    // Show initial empty panel preview
    updateOutputDemo();
});
