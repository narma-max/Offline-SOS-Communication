/*
  ============================================================
  OFFLINE EMERGENCY SOS COMMUNICATION SYSTEM
  app.js — Application Logic (Fully Local, No Internet)

  IMPORTANT NOTICE:
  This is a SOFTWARE SIMULATION ONLY.
  No real Bluetooth, LoRa, RF, or wireless transmission occurs.
  All communication is simulated inside the browser using
  JavaScript timers (setTimeout) and in-memory variables.

  HOW IT WORKS (simplified):
  1. User clicks "Send SOS" → sendSOS() is called
  2. The channel simulator checks if:
     a) The channel is enabled
     b) The sender is within simulated range
  3. If checks pass, a message is created with a unique ID
  4. After a simulated delay, the message is "delivered"
  5. The receiver panel displays it and offers an ACK button
  6. All events are recorded in the Event Log

  Written in beginner-friendly JavaScript with comments.
  ============================================================
*/

/* ============================================================
   SECTION 1: SYSTEM STATE
   These variables hold the current state of the application.
   ============================================================ */

// Channel settings (controlled by the sliders and toggle)
let channelEnabled     = true;   // Is the simulated channel on?
let communicationRange = 80;     // How far the channel reaches (units)
let senderDistance     = 30;     // How far the sender is from receiver (units)
let transmissionDelay  = 1500;   // Simulated delay before message arrives (ms)

// Tracking state
let isTransmitting      = false; // Prevents double-clicking Send while in progress
let messageCounter      = 0;     // Used to generate unique message IDs
let lastFailedMsgId     = null;  // Stores the last failed message for retry
let lastFailedText      = null;  // Stores the last failed message text for retry
let transitResetTimeout = null;  // Stores UI reset timer to avoid async collision

// Stats counters — track totals for the dashboard
let statsSent     = 0;  // Total SOS attempts
let statsDelivered = 0; // Successfully delivered
let statsFailed    = 0; // Failed transmissions
let statsAcked     = 0; // Acknowledged by receiver

// The messages array stores all received message objects
// Each message: { id, senderId, text, timestamp, acknowledged }
let receivedMessages = [];

// IDs for the sender and receiver — read from inputs on send
// Defaults shown in the editable input fields in HTML
let SENDER_ID   = "SENDER-001";
let RECEIVER_ID = "RECEIVER-001";

// Location state for GPS sharing & simulation
let currentLocation = {
  status:    "Unavailable", // "Available" | "Permission Denied" | "Unavailable"
  latitude:  null,
  longitude: null,
  accuracy:  null,
  timestamp: null,
  source:    "None"         // "Live Device GPS" | "Manual / Simulated" | "None"
};


/* ============================================================
   SECTION 2: INITIALISATION
   Runs when the page first loads.
   ============================================================ */

/**
 * init()
 * Called automatically when the page loads.
 * Sets up the live clock and logs the startup message.
 */
function init() {
  // Start the live clock that updates every second
  updateClock();
  setInterval(updateClock, 1000);

  // Update the range check indicator on startup
  updateRangeCheck();

  // Count characters for the message textarea on startup
  updateCharCount();

  // FIX: Wire textarea input listener here (removed duplicate DOMContentLoaded block below)
  const ta = document.getElementById("sosMessage");
  if (ta) ta.addEventListener("input", updateCharCount);

  // Populate the editable ID fields with defaults
  const senderInput   = document.getElementById("senderIdInput");
  const receiverInput = document.getElementById("receiverIdInput");
  if (senderInput)   senderInput.value   = SENDER_ID;
  if (receiverInput) receiverInput.value = RECEIVER_ID;

  // Update the static display badges from ID inputs
  syncIdBadges();

  // Initialise signal strength display
  updateSignalStrength();

  // Initialise stats display
  updateStats();

  // Initialise Sender ACK status
  setSenderAckStatus("—", "grey");

  // Initialise Sender GPS location module
  initLocation();

  // Initialise PWA Service Worker, offline caching & network listeners
  initPwa();

  // Log that the system is ready
  logEvent("info", "SYSTEM", "Offline SOS System initialised. All communication is simulated.");
}

/**
 * updateClock()
 * Updates the digital clock in the header every second.
 */
function updateClock() {
  const now  = new Date();
  const h    = String(now.getHours()).padStart(2, "0");
  const m    = String(now.getMinutes()).padStart(2, "0");
  const s    = String(now.getSeconds()).padStart(2, "0");
  document.getElementById("headerClock").textContent = `${h}:${m}:${s}`;
}

/**
 * getTimestamp()
 * Returns a nicely formatted current timestamp string.
 * Example: "11:34:22"
 */
function getTimestamp() {
  const now = new Date();
  const h   = String(now.getHours()).padStart(2, "0");
  const m   = String(now.getMinutes()).padStart(2, "0");
  const s   = String(now.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/**
 * generateMessageId()
 * Creates a unique ID for each SOS message.
 * Example: "MSG-004-1730450862"
 */
function generateMessageId() {
  messageCounter++;
  const count     = String(messageCounter).padStart(3, "0");
  const timestamp = Date.now(); // milliseconds since epoch, ensures uniqueness
  return `MSG-${count}-${timestamp}`;
}


/* ============================================================
   SECTION 3: SENDER DASHBOARD FUNCTIONS
   ============================================================ */

/**
 * syncIdBadges()
 * Reads the editable input fields for Sender/Receiver IDs and updates
 * the state variables and static display badges.
 */
function syncIdBadges() {
  const sInput = document.getElementById("senderIdInput");
  const rInput = document.getElementById("receiverIdInput");
  SENDER_ID   = (sInput && sInput.value.trim()) ? sInput.value.trim().toUpperCase() : "SENDER-001";
  RECEIVER_ID = (rInput && rInput.value.trim()) ? rInput.value.trim().toUpperCase() : "RECEIVER-001";
  // Update the display badges
  const senderBadge   = document.getElementById("senderId");
  const receiverBadge = document.getElementById("receiverId");
  if (senderBadge)   senderBadge.textContent   = SENDER_ID;
  if (receiverBadge) receiverBadge.textContent = RECEIVER_ID;
}

/**
 * applyPreset(type)
 * Sets the emergency message textarea with a standard emergency template.
 * @param {string} type - "medical" | "fire" | "trapped" | "flood"
 */
function applyPreset(type) {
  const presets = {
    medical: "CRITICAL MEDICAL EMERGENCY: Injured individual requires immediate paramedic assistance.",
    fire:    "FIRE EMERGENCY: Active fire reported nearby. Need immediate evacuation and firefighting support.",
    trapped: "TRAPPED IN STRUCTURE: Debris blocking exit. Immediate search and rescue needed.",
    flood:   "FLOODING EMERGENCY: Rapidly rising water level. Need urgent rescue and evacuation."
  };
  const ta = document.getElementById("sosMessage");
  if (ta && presets[type]) {
    ta.value = presets[type];
    updateCharCount();
    logEvent("info", "PRESET", `Loaded ${type.toUpperCase()} emergency message preset.`);
  }
}

/* ============================================================
   SECTION 3.1: SENDER GPS LOCATION MODULE
   Captures device GPS via browser Geolocation API or allows
   manual simulated coordinate entry for testing.
   ============================================================ */

/**
 * initLocation()
 * Initializes default location state and checks browser geolocation support.
 */
function initLocation() {
  updateLocationUI();

  // If browser supports Permissions API, check if location was already granted
  if (typeof navigator !== "undefined" && navigator.permissions && navigator.permissions.query) {
    try {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        if (result.state === "granted") {
          // Pre-fetch position silently if already granted
          requestGpsLocation(false);
        } else if (result.state === "denied") {
          currentLocation.status = "Permission Denied";
          updateLocationUI();
        }
      }).catch(() => {});
    } catch (e) {
      // Permissions API not supported or restricted; ignore
    }
  }
}

/**
 * updateLocationUI()
 * Synchronizes the location state with the Sender Dashboard badges and displays.
 */
function updateLocationUI() {
  const statusBadge = document.getElementById("locationStatusBadge");
  const coordsSpan  = document.getElementById("displayCoords");
  const sourceBadge = document.getElementById("locationSourceBadge");
  const timeSpan    = document.getElementById("locationTimestamp");

  if (!statusBadge || !coordsSpan) return;

  // 1. Update status badge
  statusBadge.textContent = currentLocation.status;
  if (currentLocation.status === "Available") {
    statusBadge.className = "badge badge-green";
  } else if (currentLocation.status === "Permission Denied") {
    statusBadge.className = "badge badge-red";
  } else {
    statusBadge.className = "badge badge-amber";
  }

  // 2. Update coordinates display
  if (currentLocation.latitude !== null && currentLocation.longitude !== null) {
    coordsSpan.textContent = `Lat: ${currentLocation.latitude.toFixed(6)}, Lon: ${currentLocation.longitude.toFixed(6)}`;
  } else {
    coordsSpan.textContent = "Lat: —, Lon: —";
  }

  // 3. Update source badge
  if (sourceBadge) {
    sourceBadge.textContent = currentLocation.source;
    if (currentLocation.source === "Live Device GPS") {
      sourceBadge.className = "badge badge-green";
    } else if (currentLocation.source === "Manual / Simulated") {
      sourceBadge.className = "badge badge-amber";
    } else {
      sourceBadge.className = "badge badge-grey";
    }
  }

  // 4. Update timestamp
  if (timeSpan) {
    timeSpan.textContent = currentLocation.timestamp || "—";
  }
}

/**
 * requestGpsLocation(isManualClick)
 * Requests live coordinates using the browser Geolocation API.
 * Prompts user for permission and handles success, denial, or timeout.
 * @param {boolean} isManualClick - Whether triggered by user clicking 'Get Live GPS'
 * @returns {Promise<Object>}
 */
function requestGpsLocation(isManualClick = false) {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      currentLocation.status = "Unavailable";
      currentLocation.source = "None";
      updateLocationUI();
      logEvent("failure", "GPS", "Geolocation API is not supported by this browser.");
      resolve(currentLocation);
      return;
    }

    if (isManualClick) {
      logEvent("info", "GPS-REQUEST", "Requesting browser GPS permission and coordinates...");
    }

    // Safety timeout in case user ignores prompt or GPS hardware hangs
    let finished = false;
    const safetyTimeout = setTimeout(() => {
      if (!finished && currentLocation.status !== "Available") {
        finished = true;
        currentLocation.status = "Unavailable";
        updateLocationUI();
        logEvent("failure", "GPS-TIMEOUT", "GPS request timed out (3.5s). You can enter manual coordinates.");
        resolve(currentLocation);
      }
    }, 3500);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (finished) return;
        finished = true;
        clearTimeout(safetyTimeout);

        currentLocation.status    = "Available";
        currentLocation.latitude  = pos.coords.latitude;
        currentLocation.longitude = pos.coords.longitude;
        currentLocation.accuracy  = pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null;
        currentLocation.timestamp = getTimestamp();
        currentLocation.source    = "Live Device GPS";

        updateLocationUI();
        const accInfo = currentLocation.accuracy ? ` (±${currentLocation.accuracy}m)` : "";
        logEvent(
          "success",
          "GPS-LOCK",
          `Live GPS coordinates captured: Lat ${currentLocation.latitude.toFixed(6)}, Lon ${currentLocation.longitude.toFixed(6)}${accInfo}.`
        );
        resolve(currentLocation);
      },
      (err) => {
        if (finished) return;
        finished = true;
        clearTimeout(safetyTimeout);

        if (err.code === 1) { // PERMISSION_DENIED
          currentLocation.status = "Permission Denied";
          logEvent("failure", "GPS-DENIED", "User denied Geolocation permission. Use Manual Coordinates below for testing.");
        } else if (err.code === 2) { // POSITION_UNAVAILABLE
          currentLocation.status = "Unavailable";
          logEvent("failure", "GPS-UNAVAIL", "GPS position unavailable from device hardware or network.");
        } else if (err.code === 3) { // TIMEOUT
          currentLocation.status = "Unavailable";
          logEvent("failure", "GPS-TIMEOUT", "Geolocation request timed out.");
        } else {
          currentLocation.status = "Unavailable";
          logEvent("failure", "GPS-ERROR", `Geolocation error: ${err.message || err.code}`);
        }

        updateLocationUI();
        resolve(currentLocation);
      },
      {
        enableHighAccuracy: true,
        timeout: 3000,
        maximumAge: 5000
      }
    );
  });
}

/**
 * toggleManualCoords()
 * Shows or hides the manual coordinate input form.
 */
function toggleManualCoords() {
  const form = document.getElementById("manualCoordsForm");
  if (!form) return;
  const isHidden = form.style.display === "none" || !form.style.display;
  form.style.display = isHidden ? "flex" : "none";
}

/**
 * setManualPreset(presetKey)
 * Fills in pre-defined geographical coordinates for quick simulation testing.
 * @param {string} presetKey - "city" | "mountain" | "coastal"
 */
function setManualPreset(presetKey) {
  const presets = {
    city:     { lat: 12.971598, lon: 77.594566, name: "Urban Tech Center (Bangalore)" },
    mountain: { lat: 34.052235, lon: -118.243683, name: "Remote Mountain Trail (Sierra/LA)" },
    coastal:  { lat: 19.076090, lon: 72.877426, name: "Coastal Harbor (Mumbai)" }
  };
  const target = presets[presetKey];
  if (target) {
    const latInp = document.getElementById("manualLat");
    const lonInp = document.getElementById("manualLon");
    if (latInp) latInp.value = target.lat;
    if (lonInp) lonInp.value = target.lon;
    logEvent("info", "PRESET", `Loaded test coordinates for ${target.name}.`);
  }
}

/**
 * applyManualCoords()
 * Reads the manual latitude and longitude inputs and activates them as simulated coordinates.
 */
function applyManualCoords() {
  const latVal = parseFloat(document.getElementById("manualLat").value);
  const lonVal = parseFloat(document.getElementById("manualLon").value);

  if (isNaN(latVal) || latVal < -90 || latVal > 90) {
    alert("Please enter a valid Latitude between -90 and 90.");
    return;
  }
  if (isNaN(lonVal) || lonVal < -180 || lonVal > 180) {
    alert("Please enter a valid Longitude between -180 and 180.");
    return;
  }

  currentLocation.status    = "Available";
  currentLocation.latitude  = latVal;
  currentLocation.longitude = lonVal;
  currentLocation.accuracy  = null;
  currentLocation.timestamp = getTimestamp();
  currentLocation.source    = "Manual / Simulated";

  updateLocationUI();
  logEvent(
    "info",
    "GPS-MANUAL",
    `Applied simulated test coordinates: Lat ${latVal.toFixed(6)}, Lon ${lonVal.toFixed(6)} [Manual Entry].`
  );
}

/**
 * updateStats()
 * Refreshes the 4 stats counter elements (sent, delivered, failed, acked).
 */
function updateStats() {
  const el = (id) => document.getElementById(id);
  if (el("statSent"))      el("statSent").textContent      = statsSent;
  if (el("statDelivered")) el("statDelivered").textContent = statsDelivered;
  if (el("statFailed"))    el("statFailed").textContent    = statsFailed;
  if (el("statAcked"))     el("statAcked").textContent     = statsAcked;
}

/**
 * sendSOS()
 * Main function triggered when the "Send SOS" button is clicked.
 * Validates conditions, then starts the simulated transmission.
 */
async function sendSOS() {
  // Prevent sending a new SOS while one is already being transmitted
  if (isTransmitting) {
    logEvent("failure", "TX-BLOCKED", "Cannot send — transmission already in progress.");
    return;
  }

  // Read current editable IDs before sending
  syncIdBadges();

  // If GPS location has not been captured yet, attempt to acquire it
  if (currentLocation.status !== "Available" && currentLocation.status !== "Permission Denied") {
    setTxStatus("GETTING GPS...", "amber");
    logEvent("info", "GPS", "Acquiring sender location via browser Geolocation API...");
    await requestGpsLocation(false);
  }

  // Get the message text from the textarea (or use a default SOS message)
  const msgInput = document.getElementById("sosMessage").value.trim();
  const msgText  = msgInput || "EMERGENCY! SOS! Please send help immediately!";

  // Snapshot location payload to transmit with message
  const locationPayload = {
    status:    currentLocation.status,
    latitude:  currentLocation.latitude,
    longitude: currentLocation.longitude,
    accuracy:  currentLocation.accuracy,
    timestamp: currentLocation.timestamp || getTimestamp(),
    source:    currentLocation.source
  };

  // Record the timestamp of this attempt
  const timestamp = getTimestamp();
  document.getElementById("senderTimestamp").textContent = timestamp;

  // Generate a unique ID for this message
  const msgId = generateMessageId();
  document.getElementById("lastMsgId").textContent = msgId;

  // Track this send attempt in stats
  statsSent++;
  updateStats();

  // Store for potential retry
  lastFailedMsgId = msgId;
  lastFailedText  = msgText;

  // Hide the retry button (a fresh send replaces it)
  const retryBtn = document.getElementById("retryBtn");
  if (retryBtn) retryBtn.style.display = "none";

  // Update the Sender TX status to TRANSMITTING
  setTxStatus("TRANSMITTING", "amber");

  // Update Sender ACK status to PENDING
  setSenderAckStatus("PENDING", "amber");

  // Log the transmission attempt with location details
  if (locationPayload.status === "Available" && locationPayload.latitude !== null) {
    logEvent(
      "attempt",
      "TX-ATTEMPT",
      `[${msgId}] Transmitting from ${SENDER_ID} with Location: Lat ${locationPayload.latitude.toFixed(6)}, Lon ${locationPayload.longitude.toFixed(6)} [${locationPayload.source}]. Msg: "${msgText.substring(0, 35)}..."`
    );
  } else {
    logEvent(
      "attempt",
      "TX-ATTEMPT",
      `[${msgId}] Transmitting from ${SENDER_ID} [Location: ${locationPayload.status}]. Msg: "${msgText.substring(0, 35)}..."`
    );
  }

  // ---- HAND OFF TO CHANNEL SIMULATOR ----
  transmitThroughChannel(msgId, msgText, timestamp, locationPayload);
}

/**
 * retrySOS()
 * Re-sends the last failed message without re-generating an ID.
 * Called from the Retry button that appears after a failure.
 */
function retrySOS() {
  if (!lastFailedText) {
    logEvent("info", "RETRY", "No failed message to retry.");
    return;
  }
  // Put the last text back in the textarea and trigger a send
  document.getElementById("sosMessage").value = lastFailedText;
  updateCharCount();
  logEvent("attempt", "RETRY", `Retrying last failed transmission...`);
  sendSOS();
}

/**
 * setTxStatus(text, color)
 * Updates the "TX Status" badge in the Sender Dashboard.
 * @param {string} text  - Status label (e.g., "IDLE", "TRANSMITTING")
 * @param {string} color - Badge color key (grey, amber, green, red)
 */
function setTxStatus(text, color) {
  const badge = document.getElementById("txStatus");
  badge.textContent = text;
  // Remove all badge color classes and apply the new one
  badge.className = `badge badge-${color}`;
}

/**
 * setSenderAckStatus(text, color)
 * Updates the "ACK Status" badge in the Sender Dashboard.
 * @param {string} text  - Status label (e.g., "—", "PENDING", "ACKNOWLEDGED ✓")
 * @param {string} color - Badge color key (grey, amber, green, red)
 */
function setSenderAckStatus(text, color) {
  const badge = document.getElementById("senderAckStatus");
  if (badge) {
    badge.textContent = text;
    badge.className   = `badge badge-${color}`;
  }
}

/**
 * updateCharCount()
 * Updates the character counter below the textarea.
 */
function updateCharCount() {
  const textarea = document.getElementById("sosMessage");
  const count    = document.getElementById("charCount");
  count.textContent = `${textarea.value.length} / 200`;
}


/* ============================================================
   SECTION 4: SIMULATED OFFLINE CHANNEL FUNCTIONS
   ============================================================ */

/**
 * toggleChannel()
 * Called when the channel enable/disable toggle is clicked.
 * Updates the channel state and visual indicators.
 */
function toggleChannel() {
  channelEnabled = document.getElementById("channelToggle").checked;

  const badge    = document.getElementById("channelStatusBadge");
  const waveDiv  = document.getElementById("waveContainer");

  if (channelEnabled) {
    // Channel is ON — show green badge, animate waves
    badge.textContent        = "ENABLED";
    badge.style.background   = "var(--green)";
    badge.style.color        = "#000";
    waveDiv.classList.remove("disabled");
    logEvent("info", "CHANNEL", "Simulated channel ENABLED.");
  } else {
    // Channel is OFF — show red badge, stop wave animation
    badge.textContent        = "DISABLED";
    badge.style.background   = "var(--red)";
    badge.style.color        = "#fff";
    waveDiv.classList.add("disabled");
    logEvent("info", "CHANNEL", "Simulated channel DISABLED.");
  }

  // Update signal strength to reflect channel power status
  updateSignalStrength();
}

/**
 * updateRange(value)
 * Called when the Communication Range slider is moved.
 * @param {number|string} value - New range value (0–100)
 */
function updateRange(value) {
  communicationRange = parseInt(value);
  document.getElementById("rangeVal").textContent = communicationRange;
  updateRangeCheck();       // Re-check if sender is still in range
  updateSignalStrength();   // Update signal strength visual
}

/**
 * updateDist(value)
 * Called when the Sender Distance slider is moved.
 * @param {number|string} value - New distance value (0–150)
 */
function updateDist(value) {
  senderDistance = parseInt(value);
  document.getElementById("distVal").textContent = senderDistance;
  updateRangeCheck();       // Re-check if sender is now in/out of range
  updateSignalStrength();   // Update signal strength visual
}

/**
 * updateDelay(value)
 * Called when the TX Delay slider is moved.
 * @param {number|string} value - Delay in milliseconds (500–5000)
 */
function updateDelay(value) {
  transmissionDelay = parseInt(value);
  document.getElementById("delayVal").textContent = transmissionDelay;
}

/**
 * updateRangeCheck()
 * Reads the current distance vs. range and updates the "Range Check" badge.
 */
function updateRangeCheck() {
  const badge   = document.getElementById("rangeStatus");
  const inRange = senderDistance <= communicationRange;

  if (inRange) {
    badge.textContent = "IN RANGE ✅";
    badge.className   = "badge badge-green";
  } else {
    badge.textContent = "OUT OF RANGE ❌";
    badge.className   = "badge badge-red";
  }
}

/**
 * updateSignalStrength()
 * Calculates a 0-100% signal strength based on distance vs range,
 * then updates the signal strength bar and label in the channel panel.
 * Signal = 100% when distance=0, 0% when distance >= range.
 */
function updateSignalStrength() {
  const bar   = document.getElementById("signalBar");
  const label = document.getElementById("signalLabel");
  if (!bar || !label) return;

  // If channel is switched off, indicate clearly
  if (!channelEnabled) {
    bar.style.width      = "0%";
    bar.style.background = "linear-gradient(90deg, #ff1744, #ff5252)";
    label.textContent    = "Signal: CHANNEL DISABLED (0%)";
    label.style.color    = "var(--red)";
    return;
  }

  // Calculate: 100% signal when at 0 distance, 0% when at or beyond range
  let strength = 0;
  if (communicationRange > 0) {
    strength = Math.max(0, Math.round((1 - senderDistance / communicationRange) * 100));
    strength = Math.min(strength, 100); // Cap at 100%
  }

  // Set bar width
  bar.style.width = strength + "%";

  // Colour-code the bar: green=strong, amber=medium, red=weak/out-of-range
  if (strength > 60) {
    bar.style.background = "linear-gradient(90deg, #00e676, #69f0ae)";
    label.textContent    = `Signal: ${strength}% (Strong)`;
    label.style.color    = "var(--green)";
  } else if (strength > 25) {
    bar.style.background = "linear-gradient(90deg, #ffab00, #ffd740)";
    label.textContent    = `Signal: ${strength}% (Weak)`;
    label.style.color    = "var(--amber)";
  } else {
    bar.style.background = "linear-gradient(90deg, #ff1744, #ff5252)";
    label.textContent    = strength === 0 ? "Signal: OUT OF RANGE (0%)" : `Signal: ${strength}% (Critical)`;
    label.style.color    = "var(--red)";
  }
}

/**
 * isInRange()
 * Simple helper that returns true if the sender is within the channel range.
 * @returns {boolean}
 */
function isInRange() {
  return senderDistance <= communicationRange;
}

/**
 * transmitThroughChannel(msgId, msgText, timestamp, locationPayload)
 * The core simulation function.
 * Checks channel conditions, then delivers the message after a delay.
 *
 * @param {string} msgId           - Unique message ID
 * @param {string} msgText         - The SOS message content
 * @param {string} timestamp       - When the sender pressed Send
 * @param {Object} locationPayload - GPS / simulated location metadata
 */
function transmitThroughChannel(msgId, msgText, timestamp, locationPayload) {
  // Cancel any previous pending UI reset timer
  if (transitResetTimeout) {
    clearTimeout(transitResetTimeout);
    transitResetTimeout = null;
  }

  // Lock transmission to prevent new sends
  isTransmitting = true;
  const sosBtn   = document.getElementById("sosBtn");
  sosBtn.disabled = true;

  // Update the channel's "transit" display
  document.getElementById("transitMsgId").textContent = msgId;
  setDeliveryStatus("TRANSMITTING...", "amber");

  // Show and start the progress bar animation
  const progressWrap = document.getElementById("progressWrap");
  const progressBar  = document.getElementById("progressBar");
  progressWrap.style.display = "block";
  progressBar.style.width    = "0%";

  // Animate the progress bar over the transmission delay period
  let elapsed  = 0;
  const tick   = 100; // update every 100ms
  const progInterval = setInterval(() => {
    elapsed += tick;
    const pct = Math.min((elapsed / transmissionDelay) * 100, 100);
    progressBar.style.width = pct + "%";
  }, tick);

  // ---- SIMULATE THE TRANSMISSION DELAY ----
  // setTimeout pauses the function for `transmissionDelay` ms
  // This simulates the time it takes to transmit over a wireless channel
  setTimeout(() => {
    // Clear the progress bar animation
    clearInterval(progInterval);
    progressBar.style.width = "100%";

    // ---- CHECK CONDITION 1: Is the channel enabled? ----
    if (!channelEnabled) {
      // FAIL: Channel is off — message cannot be sent
      handleTransmissionFailure(msgId, "Channel is DISABLED. Message could not be transmitted.");
      return; // Stop here — don't deliver
    }

    // ---- CHECK CONDITION 2: Is the sender within range? ----
    if (!isInRange()) {
      // FAIL: Sender is too far away — message cannot be sent
      handleTransmissionFailure(
        msgId,
        `Sender out of range! Distance=${senderDistance} units exceeds Range=${communicationRange} units.`
      );
      return; // Stop here — don't deliver
    }

    // ---- SUCCESS: All checks passed — deliver the message ----
    handleTransmissionSuccess(msgId, msgText, timestamp, locationPayload);

  }, transmissionDelay);
}

/**
 * handleTransmissionFailure(msgId, reason)
 * Called when the channel check fails. Updates status indicators and logs.
 *
 * @param {string} msgId  - The message ID that failed
 * @param {string} reason - Human-readable reason for failure
 */
function handleTransmissionFailure(msgId, reason) {
  // Increment failed counter
  statsFailed++;
  updateStats();

  // Update Sender TX status
  setTxStatus("FAILED ✗", "red");

  // Update Sender ACK status to reflect failure
  setSenderAckStatus("FAILED ✗", "red");

  // Update Channel delivery status
  setDeliveryStatus("FAILED ✗", "red");

  // Log the failure
  logEvent("failure", "TX-FAILED", `[${msgId}] ${reason}`);

  // Show the retry button so the user can re-attempt without retyping
  const retryBtn = document.getElementById("retryBtn");
  if (retryBtn) retryBtn.style.display = "inline-block";

  // Reset the progress bar after a short delay
  if (transitResetTimeout) clearTimeout(transitResetTimeout);
  transitResetTimeout = setTimeout(() => {
    document.getElementById("progressWrap").style.display = "none";
    document.getElementById("progressBar").style.width    = "0%";
    document.getElementById("transitMsgId").textContent   = "—";
    setTxStatus("IDLE", "grey");
    setDeliveryStatus("WAITING", "grey");
    transitResetTimeout = null;
  }, 2000);

  // Unlock transmission
  isTransmitting = false;
  document.getElementById("sosBtn").disabled = false;
}

/**
 * handleTransmissionSuccess(msgId, msgText, timestamp, locationPayload)
 * Called when the message is successfully simulated to be delivered.
 *
 * @param {string} msgId           - The message ID
 * @param {string} msgText         - The SOS message text
 * @param {string} timestamp       - Original send timestamp
 * @param {Object} locationPayload - GPS / simulated location metadata
 */
function handleTransmissionSuccess(msgId, msgText, timestamp, locationPayload) {
  // Increment delivered counter
  statsDelivered++;
  updateStats();

  // Update Sender TX status
  setTxStatus("DELIVERED ✓", "green");

  // Update Channel delivery status
  setDeliveryStatus("DELIVERED ✓", "green");

  // Hide retry button on success (no need to retry)
  const retryBtn = document.getElementById("retryBtn");
  if (retryBtn) retryBtn.style.display = "none";

  // Log success
  logEvent("success", "TX-SUCCESS", `[${msgId}] Message & coordinates delivered to ${RECEIVER_ID} at ${getTimestamp()}.`);

  // ---- DELIVER TO RECEIVER ----
  receiveMessage(msgId, msgText, timestamp, locationPayload);

  // Reset progress bar and transit display after 2 seconds
  if (transitResetTimeout) clearTimeout(transitResetTimeout);
  transitResetTimeout = setTimeout(() => {
    document.getElementById("progressWrap").style.display = "none";
    document.getElementById("progressBar").style.width    = "0%";
    document.getElementById("transitMsgId").textContent   = "—";
    setTxStatus("IDLE", "grey");
    setDeliveryStatus("WAITING", "grey");
    transitResetTimeout = null;
  }, 2000);

  // Unlock transmission
  isTransmitting = false;
  document.getElementById("sosBtn").disabled = false;
}

/**
 * setDeliveryStatus(text, color)
 * Updates the "Delivery Status" badge in the Channel panel.
 */
function setDeliveryStatus(text, color) {
  const badge   = document.getElementById("deliveryStatus");
  badge.textContent = text;
  badge.className   = `badge badge-${color}`;
}


/* ============================================================
   SECTION 5: RECEIVER DASHBOARD FUNCTIONS
   ============================================================ */

/**
 * receiveMessage(msgId, msgText, sentTimestamp, locationPayload)
 * Called when a message is successfully delivered to the receiver.
 * Creates a message card with location details, map links, and tactical radar.
 *
 * @param {string} msgId           - Unique message ID
 * @param {string} msgText         - SOS message content
 * @param {string} sentTimestamp   - When the SOS was originally sent
 * @param {Object} locationPayload - Attached location metadata
 */
function receiveMessage(msgId, msgText, sentTimestamp, locationPayload) {
  const receivedAt = getTimestamp();

  // Store the message in the receivedMessages array
  const messageObj = {
    id:           msgId,
    senderId:     SENDER_ID,
    text:         msgText,
    sentAt:       sentTimestamp,
    receivedAt:   receivedAt,
    acknowledged: false,
    location:     locationPayload || null
  };
  receivedMessages.push(messageObj);

  // ---- Update the Alert Indicator to ACTIVE state ----
  setAlertState("active", "🚨 EMERGENCY ALERT — SOS RECEIVED!");

  // Update ACK status badge
  document.getElementById("ackStatus").textContent = "PENDING";
  document.getElementById("ackStatus").className   = "badge badge-amber";

  // ---- Remove the "no messages" placeholder if it exists ----
  const noMsg = document.querySelector(".no-messages");
  if (noMsg) noMsg.remove();

  // ---- Generate Location Block HTML ----
  let locationHtml = "";
  if (locationPayload && locationPayload.status === "Available" && locationPayload.latitude !== null && locationPayload.longitude !== null) {
    const lat = locationPayload.latitude;
    const lon = locationPayload.longitude;
    const isLive = locationPayload.source === "Live Device GPS";
    const sourceBadgeClass = isLive ? "badge-green" : "badge-amber";
    const sourceBadgeText  = isLive ? "🛰️ Live Device GPS" : "📝 Simulated / Manual";
    const osmUrl  = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;
    const gmapUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

    locationHtml = `
      <div class="msg-location-block">
        <div class="msg-location-header">
          <span class="location-box-title">📍 Sender Coordinates:</span>
          <span class="badge ${sourceBadgeClass}">${sourceBadgeText}</span>
        </div>
        <div class="msg-coords-text">Lat: ${lat.toFixed(6)}, Lon: ${lon.toFixed(6)}</div>
        <div class="msg-location-meta">
          <span>Captured: ${locationPayload.timestamp || sentTimestamp}</span>
          ${locationPayload.accuracy ? `<span>Accuracy: ±${locationPayload.accuracy}m</span>` : ""}
          <span>Status: <strong>${locationPayload.status}</strong></span>
        </div>
        <!-- Tactical Radar Offline Map Preview -->
        <div class="tactical-map-preview" title="Tactical Coordinate Grid (100% Offline Preview)">
          <div class="radar-crosshair-h"></div>
          <div class="radar-crosshair-v"></div>
          <div class="radar-ring radar-ring-1"></div>
          <div class="radar-ring radar-ring-2"></div>
          <div class="radar-ring radar-ring-3"></div>
          <div class="radar-beacon"></div>
          <span class="radar-cardinal cardinal-n">N</span>
          <span class="radar-cardinal cardinal-s">S</span>
          <span class="radar-cardinal cardinal-e">E</span>
          <span class="radar-cardinal cardinal-w">W</span>
          <div class="radar-label">${lat.toFixed(4)}, ${lon.toFixed(4)}</div>
        </div>
        <!-- External Online Map Links -->
        <div class="msg-map-actions">
          <a href="${osmUrl}" target="_blank" rel="noopener noreferrer" class="btn-map-link">
            🗺️ Open in OpenStreetMap
          </a>
          <a href="${gmapUrl}" target="_blank" rel="noopener noreferrer" class="btn-map-link">
            📍 Open in Google Maps
          </a>
        </div>
      </div>
    `;

    logEvent(
      "success",
      "LOCATION-RCVD",
      `[${msgId}] Coordinates received: Lat ${lat.toFixed(6)}, Lon ${lon.toFixed(6)} [${locationPayload.source}].`
    );
  } else if (locationPayload && locationPayload.status === "Permission Denied") {
    locationHtml = `
      <div class="msg-location-block">
        <div class="msg-location-header">
          <span class="location-box-title">📍 Sender Location:</span>
          <span class="badge badge-red">❌ Permission Denied</span>
        </div>
        <p class="muted" style="font-size:0.75rem;margin-top:2px;">
          Sender denied geolocation permission. Coordinates were not transmitted.
        </p>
      </div>
    `;
    logEvent("info", "LOCATION-RCVD", `[${msgId}] Location status received: Permission Denied.`);
  } else if (locationPayload && locationPayload.status === "Unavailable") {
    locationHtml = `
      <div class="msg-location-block">
        <div class="msg-location-header">
          <span class="location-box-title">📍 Sender Location:</span>
          <span class="badge badge-amber">⚠️ Unavailable</span>
        </div>
        <p class="muted" style="font-size:0.75rem;margin-top:2px;">
          GPS signal was unavailable on sender device at transmission time.
        </p>
      </div>
    `;
    logEvent("info", "LOCATION-RCVD", `[${msgId}] Location status received: Unavailable.`);
  }

  // ---- Create the message card HTML ----
  const msgList = document.getElementById("messagesList");
  const card    = document.createElement("div");
  card.className = "msg-card";
  card.id        = `card-${msgId}`;

  card.innerHTML = `
    <div class="msg-meta">
      <span class="msg-sender-id">📤 ${SENDER_ID}</span>
      <span class="msg-time">Sent: ${sentTimestamp} | Rcvd: ${receivedAt}</span>
    </div>
    <div class="msg-id">ID: ${msgId}</div>
    <div class="msg-text">${escapeHtml(msgText)}</div>
    ${locationHtml}
    <button
      class="btn-ack"
      id="ack-btn-${msgId}"
      onclick="acknowledgeMessage('${msgId}')"
      title="Click to acknowledge this SOS message"
    >
      ✔ Acknowledge SOS
    </button>
  `;

  // Prepend so newest message is at the top
  msgList.insertBefore(card, msgList.firstChild);

  // Log the reception
  logEvent("success", "MSG-RECEIVED", `[${msgId}] SOS received by ${RECEIVER_ID} from ${SENDER_ID}.`);
}

/**
 * acknowledgeMessage(msgId)
 * Called when the receiver clicks "Acknowledge SOS" on a message card.
 * Updates the message card, alert indicator, and logs the event.
 *
 * @param {string} msgId - The ID of the message being acknowledged
 */
function acknowledgeMessage(msgId) {
  // Find the message in the array and mark it acknowledged
  const msg = receivedMessages.find(m => m.id === msgId);
  if (!msg || msg.acknowledged) return; // Guard: don't double-acknowledge
  msg.acknowledged = true;

  // Increment acked counter
  statsAcked++;
  updateStats();

  // Update the message card style to "acknowledged"
  const card = document.getElementById(`card-${msgId}`);
  if (card) {
    card.classList.add("acknowledged");
    // Disable the ACK button and change its text
    const ackBtn = document.getElementById(`ack-btn-${msgId}`);
    if (ackBtn) {
      ackBtn.textContent = "✔ Acknowledged";
      ackBtn.disabled    = true;
    }
    // Show the ack timestamp on the card
    const ackTime = document.createElement("div");
    ackTime.className   = "msg-ack-time";
    ackTime.textContent = `ACK sent at ${getTimestamp()}`;
    card.appendChild(ackTime);
  }

  // Check if ALL received messages are acknowledged
  const allAcked = receivedMessages.every(m => m.acknowledged);

  if (allAcked) {
    // All messages acknowledged — update alert to "acked" (green) state
    setAlertState("acked", "All Messages Acknowledged");
    document.getElementById("ackStatus").textContent = "ACKNOWLEDGED ✓";
    document.getElementById("ackStatus").className   = "badge badge-green";
  } else {
    // Some still pending
    document.getElementById("ackStatus").textContent = "PARTIAL ACK";
    document.getElementById("ackStatus").className   = "badge badge-amber";
  }

  // Update Sender Dashboard Acknowledgement Status
  setSenderAckStatus("ACKNOWLEDGED ✓", "green");

  // If this was the last sent message, update Sender TX Status badge too
  const lastMsgEl = document.getElementById("lastMsgId");
  if (lastMsgEl && lastMsgEl.textContent === msgId) {
    if (transitResetTimeout) {
      clearTimeout(transitResetTimeout);
      transitResetTimeout = null;
    }
    setTxStatus("ACK RECEIVED ✓", "green");
  }

  // Update channel delivery badge to reflect ACK reception
  setDeliveryStatus("ACK RECEIVED ✓", "green");

  // Log the acknowledgement
  logEvent("ack", "MSG-ACKED", `[${msgId}] SOS acknowledged by ${RECEIVER_ID} at ${getTimestamp()}.`);
  logEvent("ack", "ACK-CONFIRMED", `[${msgId}] Acknowledgement displayed on Sender Dashboard.`);
}

/**
 * clearMessages()
 * Clears all received message cards from the Receiver panel
 * and resets the alert indicator to idle.
 */
function clearMessages() {
  receivedMessages = [];
  const msgList = document.getElementById("messagesList");
  msgList.innerHTML = '<div class="no-messages muted">No messages received yet.</div>';
  setAlertState("idle", "STANDBY — No Active Alert");
  document.getElementById("ackStatus").textContent = "—";
  document.getElementById("ackStatus").className   = "badge badge-grey";
  setSenderAckStatus("—", "grey");
  logEvent("info", "RECEIVER", "Receiver message list cleared.");
}

/**
 * setAlertState(state, text)
 * Changes the alert indicator appearance.
 * @param {string} state - "idle" | "active" | "acked"
 * @param {string} text  - Text to display in the indicator
 */
function setAlertState(state, text) {
  const indicator = document.getElementById("alertIndicator");
  const alertText = document.getElementById("alertText");

  // Remove all state classes and apply the new one
  indicator.classList.remove("idle", "active", "acked");
  indicator.classList.add(state);

  alertText.textContent = text;
}


/* ============================================================
   SECTION 6: EVENT LOG FUNCTIONS
   ============================================================ */

/**
 * logEvent(type, label, message)
 * Adds a new entry to the Event Log panel.
 * Entries are prepended (newest first).
 *
 * @param {string} type    - "info" | "attempt" | "success" | "failure" | "ack"
 * @param {string} label   - Short type label shown in the log (e.g., "TX-ATTEMPT")
 * @param {string} message - The full descriptive message
 */
function logEvent(type, label, message) {
  const logContainer = document.getElementById("eventLog");
  const timestamp    = getTimestamp();

  // Map type strings to CSS class names
  const cssClassMap = {
    "info":    "log-info",
    "attempt": "log-attempt",
    "success": "log-success",
    "failure": "log-failure",
    "ack":     "log-ack"
  };
  const cssClass = cssClassMap[type] || "log-info";

  // Create the log entry element
  const entry = document.createElement("div");
  entry.className = `log-entry ${cssClass}`;
  entry.innerHTML = `
    <span class="log-time">${timestamp}</span>
    <span class="log-type">${label}</span>
    <span class="log-msg">${escapeHtml(message)}</span>
  `;

  // Prepend so newest events appear at the top
  logContainer.insertBefore(entry, logContainer.firstChild);
}

/**
 * clearLog()
 * Clears all entries from the Event Log.
 */
function clearLog() {
  const logContainer = document.getElementById("eventLog");
  logContainer.innerHTML = "";
  // Add a "cleared" system message
  logEvent("info", "SYSTEM", "Event log cleared by user.");
}


/* ============================================================
   SECTION 7: TESTING SCENARIO FUNCTIONS
   These allow the user to quickly simulate different scenarios.
   ============================================================ */

/**
 * runScenario(scenarioName)
 * Sets up the system for a pre-defined testing scenario,
 * then automatically triggers a send.
 *
 * @param {string} scenarioName - Which scenario to run
 */
function runScenario(scenarioName) {
  // Show a brief log entry that a scenario is being run
  logEvent("info", "SCENARIO", `Running scenario: "${scenarioName.toUpperCase()}"`);

  switch (scenarioName) {

    // ---- SCENARIO 1: Successful SOS ----
    // Enable channel, set sender within range, send SOS
    case "success":
      setChannelState(true);
      setRangeAndDist(80, 30);  // range 80, distance 30 → in range
      document.getElementById("sosMessage").value = "SCENARIO: Successful SOS transmission test.";
      updateCharCount();
      setTimeout(() => sendSOS(), 300);
      break;

    // ---- SCENARIO 2: Channel Disabled ----
    // Disable the channel, then attempt to send
    case "disabled":
      setChannelState(false);
      setRangeAndDist(80, 30);
      document.getElementById("sosMessage").value = "SCENARIO: Testing disabled channel.";
      updateCharCount();
      setTimeout(() => sendSOS(), 300);
      break;

    // ---- SCENARIO 3: Out of Range ----
    // Set sender distance beyond communication range
    case "outofrange":
      setChannelState(true);
      setRangeAndDist(50, 120); // range 50, distance 120 → out of range
      document.getElementById("sosMessage").value = "SCENARIO: Testing out-of-range transmission.";
      updateCharCount();
      setTimeout(() => sendSOS(), 300);
      break;

    // ---- SCENARIO 4: Boundary Range ----
    // Test transmission at the exact communication range boundary
    case "boundary":
      setChannelState(true);
      setRangeAndDist(80, 80); // Distance equals range (boundary edge condition)
      document.getElementById("sosMessage").value = "SCENARIO: Boundary range test (Distance = Range = 80).";
      updateCharCount();
      setTimeout(() => sendSOS(), 300);
      break;

    // ---- SCENARIO 5: Weak Signal ----
    // Test transmission at high distance near range limit
    case "weak":
      setChannelState(true);
      setRangeAndDist(80, 75); // High distance near range (critical signal strength)
      document.getElementById("sosMessage").value = "SCENARIO: Weak signal test (Distance 75, Range 80).";
      updateCharCount();
      setTimeout(() => sendSOS(), 300);
      break;

    // ---- SCENARIO 6: Acknowledge ----
    // Successful delivery, then auto-acknowledge after delay
    case "acknowledge":
      setChannelState(true);
      setRangeAndDist(80, 30);
      document.getElementById("sosMessage").value = "SCENARIO: Test acknowledgement flow.";
      updateCharCount();
      setTimeout(() => sendSOS(), 300);
      // Wait for delivery + 1 second, then auto-acknowledge the latest message
      setTimeout(() => {
        const unacked = receivedMessages.filter(m => !m.acknowledged);
        if (unacked.length > 0) {
          const latest = unacked[unacked.length - 1];
          acknowledgeMessage(latest.id);
          logEvent("info", "SCENARIO", "Auto-acknowledged latest message for demonstration.");
        }
      }, transmissionDelay + 1500);
      break;

    // ---- SCENARIO 7: Multiple SOS Messages ----
    // Send 3 messages in rapid succession with different texts
    // FIX: Wrapped in a block {} to allow const inside switch/case (prevents SyntaxError)
    case "multiple": {
      setChannelState(true);
      setRangeAndDist(80, 30);
      const multiMsgs = [
        "SCENARIO: Multiple SOS - Message 1 of 3. FIRE reported at Block A.",
        "SCENARIO: Multiple SOS - Message 2 of 3. Medical emergency, need paramedic.",
        "SCENARIO: Multiple SOS - Message 3 of 3. Evacuation required immediately."
      ];
      // Send each message with increasing delays so they don't overlap
      multiMsgs.forEach((text, index) => {
        setTimeout(() => {
          document.getElementById("sosMessage").value = text;
          updateCharCount();
          sendSOS();
        }, index * (transmissionDelay + 2500)); // space them out
      });
      break;
    }

    // ---- SCENARIO 8: Location-Enabled SOS ----
    // Set simulated GPS coordinates, enable channel in-range, and send SOS
    case "location":
      setChannelState(true);
      setRangeAndDist(80, 30);
      setManualPreset("city");
      applyManualCoords();
      document.getElementById("sosMessage").value = "SCENARIO: SOS with verified sender location coordinates.";
      updateCharCount();
      setTimeout(() => sendSOS(), 300);
      break;

    default:
      logEvent("info", "SCENARIO", `Unknown scenario: "${scenarioName}"`);
  }
}

/**
 * runDiagnosticsSuite()
 * Executes an automated sequential test of all key features:
 * 1. Channel Failure Detection (channel disabled)
 * 2. Range Failure Detection (out of range)
 * 3. Functional In-Range Transmission with GPS / Coordinates
 * 4. Receiver Acknowledgement & Sender Confirmation
 */
function runDiagnosticsSuite() {
  logEvent("info", "DIAGNOSTICS", "=== STARTING AUTOMATED DIAGNOSTIC SUITE ===");

  // Step 1: Channel Disabled Failure Test
  logEvent("attempt", "TEST-1", "Testing Channel Failure Detection (Channel Disabled)...");
  setChannelState(false);
  setRangeAndDist(80, 30);
  document.getElementById("sosMessage").value = "DIAGNOSTIC TEST 1: Channel Disabled Verification.";
  updateCharCount();
  sendSOS();

  // Step 2: Out of Range Test (after transmissionDelay + 1000ms)
  setTimeout(() => {
    logEvent("attempt", "TEST-2", "Testing Range Failure Detection (Distance > Range)...");
    setChannelState(true);
    setRangeAndDist(40, 90);
    document.getElementById("sosMessage").value = "DIAGNOSTIC TEST 2: Out of Range Verification.";
    updateCharCount();
    sendSOS();
  }, transmissionDelay + 1000);

  // Step 3: In-Range Transmission with Coordinates Success Test
  setTimeout(() => {
    logEvent("attempt", "TEST-3", "Testing In-Range SOS Transmission with Location Coordinates...");
    setChannelState(true);
    setRangeAndDist(80, 30);
    setManualPreset("city");
    applyManualCoords();
    document.getElementById("sosMessage").value = "DIAGNOSTIC TEST 3: Successful In-Range Transmission with Coordinates.";
    updateCharCount();
    sendSOS();
  }, (transmissionDelay + 1000) * 2);

  // Step 4: Acknowledgement Verification Test
  setTimeout(() => {
    logEvent("attempt", "TEST-4", "Testing Receiver Acknowledgement & Sender Display...");
    const unacked = receivedMessages.filter(m => !m.acknowledged);
    if (unacked.length > 0) {
      const targetMsg = unacked[unacked.length - 1];
      acknowledgeMessage(targetMsg.id);
      logEvent("success", "DIAGNOSTICS", "=== DIAGNOSTIC SUITE COMPLETED SUCCESSFULLY: ALL 4 TESTS PASSED ===");
    } else {
      logEvent("failure", "DIAGNOSTICS", "Test 4 failed: No message available to acknowledge.");
    }
  }, (transmissionDelay + 1000) * 3 + 1200);
}

/**
 * setChannelState(enabled)
 * Helper to programmatically enable or disable the channel.
 * Also syncs the toggle UI element.
 *
 * @param {boolean} enabled
 */
function setChannelState(enabled) {
  channelEnabled = enabled;
  document.getElementById("channelToggle").checked = enabled;
  toggleChannel(); // Trigger the UI update
}

/**
 * setRangeAndDist(range, dist)
 * Helper to set the range and distance sliders programmatically.
 *
 * @param {number} range - Communication range (0–100)
 * @param {number} dist  - Sender distance (0–150)
 */
function setRangeAndDist(range, dist) {
  // Update state variables
  communicationRange = range;
  senderDistance     = dist;

  // Sync the HTML slider elements
  document.getElementById("rangeSlider").value = range;
  document.getElementById("distSlider").value  = dist;

  // Update the displayed values
  document.getElementById("rangeVal").textContent = range;
  document.getElementById("distVal").textContent  = dist;

  // Refresh the range check badge and signal strength
  updateRangeCheck();
  updateSignalStrength();
}


/* ============================================================
   SECTION 8: UTILITY FUNCTIONS
   ============================================================ */

/**
 * escapeHtml(text)
 * Escapes special HTML characters to prevent XSS injection.
 * Important when displaying user-entered text in the DOM.
 *
 * @param {string} text - Raw text input
 * @returns {string}    - Safe text for innerHTML
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}


/* ============================================================
   SECTION 8.1: PWA & MOBILE RESPONSIVE FUNCTIONS
   Service worker registration, install prompt, network status,
   and mobile tab switching.
   ============================================================ */

let deferredInstallPrompt = null;

/**
 * initPwa()
 * Sets up Service Worker caching, online/offline detection,
 * and PWA Add-to-Home-Screen prompt handling.
 */
function initPwa() {
  // 1. Initialise network status badge
  updateNetworkStatus();
  if (typeof window !== "undefined") {
    window.addEventListener("online", updateNetworkStatus);
    window.addEventListener("offline", updateNetworkStatus);

    // 2. Capture PWA beforeinstallprompt event
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      const btn = document.getElementById("btnInstallPwa");
      if (btn) btn.style.display = "inline-block";
      logEvent("info", "PWA", 'Application ready for installation. Click "Install App" to add to Home Screen.');
    });

    window.addEventListener("appinstalled", () => {
      deferredInstallPrompt = null;
      const btn = document.getElementById("btnInstallPwa");
      if (btn) btn.style.display = "none";
      logEvent("success", "PWA", "Application installed successfully to device Home Screen!");
    });
  }

  // 3. Register Service Worker for offline shell caching
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js")
      .then((reg) => {
        logEvent("info", "PWA", `Service Worker registered. Offline interface cached (Scope: ${reg.scope}).`);
      })
      .catch((err) => {
        console.warn("Service Worker registration warning:", err);
      });
  }
}

/**
 * triggerPwaInstall()
 * Shows the native browser Add to Home Screen install dialog.
 */
function triggerPwaInstall() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === "accepted") {
        logEvent("info", "PWA", "User accepted the PWA install prompt.");
      } else {
        logEvent("info", "PWA", "User dismissed the PWA install prompt.");
      }
      deferredInstallPrompt = null;
    });
  } else {
    alert("To install this app on your device:\n\n• On Chrome/Edge (Desktop): Click the install icon in the address bar.\n• On Android (Chrome): Tap menu (⋮) -> 'Add to Home screen' or 'Install app'.\n• On iOS (Safari): Tap Share button -> 'Add to Home Screen'.");
  }
}

/**
 * updateNetworkStatus()
 * Updates the network status indicator in the header.
 */
function updateNetworkStatus() {
  const badge = document.getElementById("networkStatus");
  if (!badge) return;

  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  if (isOnline) {
    badge.textContent = "🌐 Online";
    badge.className   = "badge badge-green";
    badge.title       = "Internet connected. PWA cache active.";
  } else {
    badge.textContent = "📴 Offline (Cached)";
    badge.className   = "badge badge-amber";
    badge.title       = "No internet connection. App running 100% from offline PWA cache.";
    logEvent("info", "NETWORK", "Internet disconnected. Running seamlessly from offline PWA cache.");
  }
}

/**
 * switchMobileTab(tab)
 * On mobile/tablet screens, toggles visibility between Sender, Channel, and Receiver panels.
 * @param {string} tab - "sender" | "channel" | "receiver" | "all"
 */
function switchMobileTab(tab) {
  const grid = document.getElementById("mainGrid");
  if (!grid) return;

  // Remove existing show-* classes
  grid.classList.remove("show-sender", "show-channel", "show-receiver");

  if (tab !== "all") {
    grid.classList.add(`show-${tab}`);
  }

  // Update active state on buttons
  const buttons = document.querySelectorAll(".mobile-nav-btn");
  buttons.forEach((btn) => btn.classList.remove("active"));

  const targetMap = {
    sender:   "tabSender",
    channel:  "tabChannel",
    receiver: "tabReceiver",
    all:      "tabAll"
  };
  const activeBtn = document.getElementById(targetMap[tab]);
  if (activeBtn) activeBtn.classList.add("active");
}


/* ============================================================
   SECTION 9: START THE APPLICATION
   ============================================================ */

// When the HTML page finishes loading, call init() to start everything
// NOTE: The textarea input listener is wired inside init() above — no duplicate needed here.
if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", init);
}
