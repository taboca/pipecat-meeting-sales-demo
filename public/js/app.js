
/**
 * Initializes a new instance of the `DailyCallManager` class, creating
 * a Daily.co call object and setting initial states for camera and
 * microphone muting, as well as the current room URL. It then calls the
 * `initialize` method to set up event listeners and UI interactions.
 */
class DailyCallManager {
  constructor() {
    this.call = Daily.createCallObject();
    this.currentRoomUrl = null;
    this.colors = new Map();
    this.lastActiveId = null;
    this.logEl = null;
    this.initialize();
  }

  /**
   * Performs initial setup of event listeners and UI component interactions.
   */
  async initialize() {
    this.setupEventListeners();
    this.loadConfig();
    this.logEl = document.getElementById('debug-log');
    this.placeInCanvas = this.placeInCanvas.bind(this);
    document
      .getElementById('toggle-camera')
      .addEventListener('click', () => this.toggleCamera());
    document
      .getElementById('toggle-mic')
      .addEventListener('click', () => this.toggleMicrophone());
    document
      .getElementById('share-screen')
      .addEventListener('click', () => this.toggleScreenShare());

    const sendBtn = document.getElementById('send-meta-btn');
    const textarea = document.getElementById('meta-text');
    if (sendBtn && textarea) {
      sendBtn.addEventListener('click', () => {
        const text = textarea.value.trim();
        if (!text) return;
        this.sendMeta(text);
        textarea.value = '';
      });
    }

  }

  async loadConfig() {
    try {
      const res = await fetch('/config', { cache: 'no-store' });
      if (!res.ok) return;
      const cfg = await res.json();
      if (cfg.roomUrl) {
        const roomInput = document.getElementById('room-url');
        if (roomInput) roomInput.value = cfg.roomUrl;
      }
      if (cfg.joinToken) {
        const tokenInput = document.getElementById('join-token');
        if (tokenInput) tokenInput.value = cfg.joinToken;
      }
    } catch (err) {
      console.warn('Failed to load config', err);
    }
  }
  
  
  /**
   * Configures event listeners for various call-related events.
   */
  setupEventListeners() {
    const events = {
      'active-speaker-change': this.handleActiveSpeakerChange.bind(this),
      error: this.handleError.bind(this),
      'joined-meeting': this.handleJoin.bind(this),
      'left-meeting': this.handleLeave.bind(this),
      'participant-joined': this.handleParticipantJoinedOrUpdated.bind(this),
      'participant-left': this.handleParticipantLeft.bind(this),
      'participant-updated': this.handleParticipantJoinedOrUpdated.bind(this),
      'local-screen-share-started': this.onLocalScreenStarted.bind(this),
      'local-screen-share-stopped': this.onLocalScreenStopped.bind(this),
      'app-message': this.handleAppMessage.bind(this)

    };

    Object.entries(events).forEach(([event, handler]) => {
      this.call.on(event, handler);
    });
  }

  sendMeta(text) {
    this.call.sendAppMessage(
      { type: 'meta', text, ts: Date.now() },
      '*' // broadcast
    );

    // also show your own message locally
    this.appendMetaDiv('me', { text, ts: Date.now() });
  }
  
  // ✅ Receive and display messages
  handleAppMessage(ev) {
    const { fromId, data } = ev;
    if (!data) return;
    this.logEvent(`app-message from ${fromId}: ${JSON.stringify(data)}`);
    this.appendMetaDiv(fromId, data);
  }


  appendMetaDiv(fromId, data) {
    const log = document.getElementById('meta-log');
    if (!log) return;

    const div = document.createElement('div');
    div.style.border = '1px solid #ccc';
    div.style.padding = '8px';
    div.style.margin = '6px 0';
    div.style.borderRadius = '6px';
    div.style.background = '#fff';

    const who = fromId === 'me' ? 'You' : fromId;
    const time = new Date(data.ts || Date.now()).toLocaleTimeString();

    div.textContent = `[${time}] ${who}: ${data.text}`;
    log.appendChild(div);

    // scroll into view for latest messages
    log.scrollTop = log.scrollHeight;
  }



  /**
   * Handler for the local participant joining:
   * - Prints the room URL
   * - Enables the toggle camera, toggle mic, and leave buttons
   * - Gets the initial track states
   * - Sets up and enables the device selectors
   * @param {Object} event - The joined-meeting event object.
   */
  handleJoin(event) {
    const tracks = event.participants.local.tracks;

    console.log(`Successfully joined: ${this.currentRoomUrl}`);

    // Update the participant count
    this.updateAndDisplayParticipantCount();

    // Enable the leave button
    document.getElementById('leave-btn').disabled = false;

    // Enable the toggle camera and mic buttons and selectors
    document.getElementById('toggle-camera').disabled = false;
    document.getElementById('toggle-mic').disabled = false;
    document.getElementById('camera-selector').disabled = false;
    document.getElementById('mic-selector').disabled = false;
    document.getElementById('share-screen').disabled = false;

    // Set up the camera and mic selectors
    this.setupDeviceSelectors();

    // Initialize the camera and microphone states and UI for the local
    // participant
    Object.entries(tracks).forEach(([trackType, trackInfo]) => {
      this.updateUiForDevicesState(trackType, trackInfo);
    });
  }

  /**
   * Handler for participant leave events:
   * - Confirms leaving with a console message
   * - Disable the toggle camera and mic buttons
   * - Resets the camera and mic selectors
   * - Updates the call state in the UI
   * - Removes all video containers
   */
  handleLeave() {
    console.log('Successfully left the call');

    // Update the join and leave button states
    document.getElementById('leave-btn').disabled = true;
    document.getElementById('join-btn').disabled = false;

    // Disable the toggle camera and mic buttons
    document.getElementById('toggle-camera').disabled = true;
    document.getElementById('toggle-mic').disabled = true;
    document.getElementById('share-screen').disabled = true;

    // Reset and disable the camera and mic selectors
    const cameraSelector = document.getElementById('camera-selector');
    const micSelector = document.getElementById('mic-selector');
    cameraSelector.selectedIndex = 0;
    micSelector.selectedIndex = 0;
    cameraSelector.disabled = true;
    micSelector.disabled = true;

    // Update the call state in the UI
    document.getElementById('camera-state').textContent = 'Camera: Off';
    document.getElementById('mic-state').textContent = 'Mic: Off';
    document.getElementById(
      'participant-count'
    ).textContent = `Participants: 0`;
    document.getElementById(
      'active-speaker'
    ).textContent = `Active Speaker: None`;

    // Remove all video containers
    const videosDiv = document.getElementById('canvas-participants');
    while (videosDiv.firstChild) {
      videosDiv.removeChild(videosDiv.firstChild);
    }
  }

  onLocalScreenStarted() {
    document.getElementById('share-screen').textContent = 'Stop Sharing';
  }

  onLocalScreenStopped() {
    document.getElementById('share-screen').textContent = 'Share Screen';
    // Também remove o container se quisermos limpar imediatamente
    const local = this.call.participants().local;
    const id = local.session_id;
    document.getElementById(`screenVideo-${id}`)?.remove();
  }

  async toggleScreenShare() {
    const local = this.call.participants().local;
    const isSharing = !!local.tracks.screenVideo?.persistentTrack;
    try {
      if (isSharing) {
        this.call.stopScreenShare();
      } else {
        await this.call.startScreenShare({ displayMediaOptions: { video: true, audio: false } });
      }
    } catch (e) {
      console.error('Erro ao alternar screen share:', e);
    }
  }

  /**
   * Handles fatal errors emitted from the Daily call object.
   * These errors result in the participant leaving the meeting. A
   * `left-meeting` event will also be sent, so we still rely on that event
   * for cleanup.
   * @param {Object} e - The error event object.
   */
  handleError(e) {
    console.error('DAILY SENT AN ERROR!', e.error ? e.error : e.errorMsg);
  }

  /**
   * Handles participant-left event:
   * - Cleans up the video and audio tracks for the participant
   * - Removes the related UI elements
   * @param {Object} event - The participant-left event object.
   */
  handleParticipantLeft(event) {
    const participantId = event.participant.session_id;

    // Clean up the video and audio tracks for the participant
    this.destroyTracks(['video', 'audio'], participantId);

    // Now, remove the related video UI
    document.getElementById(`video-container-${participantId}`)?.remove();
    document.getElementById(`video-container-${participantId}-video`)?.remove();
    document.getElementById(`video-container-${participantId}-screenVideo`)?.remove();

    // Update the participant count
    this.updateAndDisplayParticipantCount();
  }

handleParticipantJoinedOrUpdated(event) {
  const { participant } = event;
  const participantId = participant.session_id;
  const isLocal = participant.local;
  const tracks = participant.tracks;

  this.updateAndDisplayParticipantCount();
  this.logEvent(`participant update: ${participantId} (local=${isLocal})`);

  // Avatar bubble if no video
  const bubbleId = `video-container-${participantId}-video`;
  const hasVideoTrack = tracks.video?.persistentTrack;
  if (!hasVideoTrack) {
    let bubble = document.getElementById(bubbleId);
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.id = bubbleId;
      bubble.classList.add('video-container', 'avatar-bubble');
      bubble.style.zIndex = "1000";
      bubble.style.position = "absolute";
      document.getElementById('canvas-participants').appendChild(bubble);
      this.placeInCanvas(bubble);
    }
    enableDragging(bubble);
    const label = bubble.querySelector('.avatar-label') || document.createElement('div');
    label.className = 'avatar-label';
    const name = participant.user_name || participant.user_id || participantId;
    label.textContent = (name || '?')
      .split(/\s+/)
      .map((s) => s[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    if (!label.parentElement) bubble.appendChild(label);
  }

  // Video/screen tracks
  Object.entries(tracks).forEach(([trackType, trackInfo]) => {
    if (!trackInfo.persistentTrack) {
      this.destroyTracks([trackType], participantId);
      return;
    }
    if (trackType !== 'video' && trackType !== 'screenVideo') return;

    const parentEl = document.getElementById('canvas-participants');
    const containerId = `video-container-${participantId}-${trackType}`;
    let container = document.getElementById(containerId);

    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      container.classList.add('video-container');
      if (trackType === 'video') container.classList.add('webcam-container');
      else container.classList.add('screen-share-container');
      container.style.zIndex = "1000";
      container.style.position = "absolute";
      parentEl.appendChild(container);
      this.placeInCanvas(container);
      enableDragging(container);
      const video = document.createElement('video');
      video.autoplay = true;
      video.playsInline = true;
      video.classList.add('video-element');
      container.appendChild(video);
    } else {
      container.innerHTML = "";
      container.className = "video-container";
      if (trackType === 'video') container.classList.add('webcam-container');
      else container.classList.add('screen-share-container');
      container.style.zIndex = "1000";
      container.style.position = "absolute";
      enableDragging(container);
      const video = document.createElement('video');
      video.autoplay = true;
      video.playsInline = true;
      video.classList.add('video-element');
      container.appendChild(video);
    }

    const videoEl = container.querySelector('video');
    const currentTracks = videoEl?.srcObject?.getTracks() || [];
    const needsUpdate = !currentTracks.includes(trackInfo.persistentTrack);
    if (needsUpdate) {
      videoEl.srcObject = new MediaStream([trackInfo.persistentTrack]);
    }
  });

  if (!document.getElementById(`audio-${participantId}`) && !isLocal) {
    this.createAudioElement(participantId);
  }

  Object.entries(tracks).forEach(([trackType, trackInfo]) => {
    if (trackInfo.persistentTrack) {
      if (!(isLocal && trackType === 'audio')) {
        this.startOrUpdateTrack(trackType, trackInfo, participantId);
      }
    } else {
      this.destroyTracks([trackType], participantId);
    }
    if (trackType === 'video') {
      this.updateVideoUi(trackInfo, participantId);
    }
    if (isLocal) {
      this.updateUiForDevicesState(trackType, trackInfo);
    }
  });

  if (this.lastActiveId) {
    this.highlightParticipant(this.lastActiveId);
  }
}

  /**
   * Updates the UI with the current active speaker's identity.  /**
   * Updates the UI with the current active speaker's identity.
   * @param {Object} event - The active speaker change event object.
   */
  handleActiveSpeakerChange(event) {
    const pid = event.activeSpeaker.peerId;
    document.getElementById('active-speaker').textContent = `Active Speaker: ${pid}`;
    this.logEvent(`active-speaker: ${pid}`);
    this.highlightParticipant(pid);
  }

  /**
   * Tries to join a call with provided room URL and optional join token.
   * @param {string} roomUrl - The URL of the room to join.
   * @param {string|null} joinToken - An optional token for joining the room.
   */
  async joinRoom(roomUrl, joinToken = null) {
    if (!roomUrl) {
      console.error('Room URL is required to join a room.');
      return;
    }

    this.currentRoomUrl = roomUrl;

    const joinOptions = { url: roomUrl };
    if (joinToken) {
      joinOptions.token = joinToken;
      console.log('Joining with a token.');
    } else {
      console.log('Joining without a token.');
    }

    try {
      // Disable the join button to prevent multiple attempts to join
      document.getElementById('join-btn').disabled = true;
      // Join the room
      await this.call.join(joinOptions);
    } catch (e) {
      console.error('Join failed:', e);
    }
  }

  colorForParticipant(participantId) {
    if (this.colors.has(participantId)) return this.colors.get(participantId);
    // Use a consistent green-ish base for bubbles
    const color = 'rgb(46, 160, 90)';
    this.colors.set(participantId, color);
    return color;
  }

  highlightParticipant(participantId) {
    // Style update disabled for now; keep track of id for logs or future use.
    this.lastActiveId = participantId;
  }

  logEvent(text) {
    if (!this.logEl) return;
    const line = document.createElement('div');
    line.textContent = text;
    this.logEl.insertBefore(line, this.logEl.firstChild);
    // keep last 50 lines
    while (this.logEl.children.length > 50) {
      this.logEl.removeChild(this.logEl.lastChild);
    }
  }

  placeInCanvas(el) {
    const canvas = document.getElementById('canvas');
    if (!canvas || !el) return;
    const rect = canvas.getBoundingClientRect();
    const width = el.offsetWidth || 180;
    const height = el.offsetHeight || 180;
    const maxX = Math.max(10, rect.width - width - 10);
    const maxY = Math.max(10, rect.height - height - 10);
    if (!el.style.left) {
      el.style.left = `${Math.floor(10 + Math.random() * maxX)}px`;
      el.style.top = `${Math.floor(10 + Math.random() * maxY)}px`;
    }
    el.style.position = 'absolute';
  }

  /**
   * Creates and sets up a new video container for a specific participant. This
   * function dynamically generates a video element along with a container and
   * an overlay displaying the participant's ID. The newly created elements are
   * appended to a designated parent in the DOM, preparing them for video
   * streaming or playback related to the specified participant.
   *
   * @param {string} participantId - The unique identifier for the participant.
   */
  createVideoContainer(participantId) {
    // Create a video container for the participant
    const videoContainer = document.createElement('div');
    videoContainer.id = `video-container-${participantId}`;
    videoContainer.className = 'video-container';
    document.getElementById('canvas').appendChild(videoContainer);

    // Add an overlay to display the participant's session ID
    const sessionIdOverlay = document.createElement('div');
    sessionIdOverlay.className = 'session-id-overlay';
    sessionIdOverlay.textContent = participantId;
    videoContainer.appendChild(sessionIdOverlay);

    // Create a video element for the participant
    const videoEl = document.createElement('video');
    videoEl.className = 'video-element';
    videoContainer.appendChild(videoEl);
  }

  /**
   * Creates an audio element for a particular participant. This function is
   * responsible for dynamically generating a standalone audio element that can
   * be used to play audio streams associated with the specified participant.
   * The audio element is appended directly to the document body or a relevant
   * container, thereby preparing it for playback of the participant's audio.
   *
   * @param {string} participantId - A unique identifier corresponding to the participant.
   */
  createAudioElement(participantId) {
    // Create an audio element for the participant
    const audioEl = document.createElement('audio');
    audioEl.id = `audio-${participantId}`;
    document.body.appendChild(audioEl);
  }

  /**
   * Updates the media track (audio or video) source for a specific participant
   * and plays the updated track. It checks if the source track needs to be
   * updated and performs the update if necessary, ensuring playback of the
   * media track.
   *
   * @param {string} trackType - Specifies the type of track to update ('audio'
   * or 'video'), allowing the function to dynamically adapt to the track being
   * processed.
   * @param {Object} track - Contains the media track data, including the
   * `persistentTrack` property which holds the actual MediaStreamTrack to be
   * played or updated.
   * @param {string} participantId - Identifies the participant whose media
   * track is being updated.
   */
    startOrUpdateTrack(trackType, track, participantId) {
      const selector =
        trackType === 'video'
          ? `#video-container-${participantId} video.video-element`
          : `audio-${participantId}`;

      const trackEl =
        trackType === 'video'
          ? document.querySelector(selector)
          : document.getElementById(selector);

      if (!trackEl) {
        console.error(`${trackType} element does not exist for participant: ${participantId}`);
        return;
      }

      const existingTracks = trackEl.srcObject?.getTracks();
      const needsUpdate = !existingTracks?.some(t => t.id === track.persistentTrack.id);

      if (needsUpdate) {
        // 🚨 Use .addTrack() instead if needed
        const stream = trackEl.srcObject || new MediaStream();
        if (!stream.getTracks().some(t => t.id === track.persistentTrack.id)) {
          stream.addTrack(track.persistentTrack);
          trackEl.srcObject = stream;
        }

        trackEl.onloadedmetadata = () => {
          trackEl.play().catch((e) =>
            console.error(`Error playing ${trackType} for ${participantId}`, e)
          );
        };
      }
    }
  /**
   * Shows or hides the video element for a participant, including managing
   * the visibility of the video based on the track state.
   * @param {Object} track - The video track object.
   * @param {string} participantId - The ID of the participant.
   */
  updateVideoUi(track, participantId) {
    let videoEl = document
      .getElementById(`video-container-${participantId}`)
      .querySelector('video.video-element');

    switch (track.state) {
      case 'off':
      case 'interrupted':
      case 'blocked':
        videoEl.style.display = 'none'; // Hide video but keep container
        break;
      case 'playable':
      default:
        // Here we handle all other states the same as we handle 'playable'.
        // In your code, you may choose to handle them differently.
        videoEl.style.display = '';
        break;
    }
  }

  /**
   * Cleans up specified media track types (e.g., 'video', 'audio') for a given
   * participant by stopping the tracks and removing their corresponding
   * elements from the DOM. This is essential for properly managing resources
   * when participants leave or change their track states.
   * @param {Array} trackTypes - An array of track types to destroy, e.g.,
   * ['video', 'audio'].
   * @param {string} participantId - The ID of the participant.
   */
  destroyTracks(trackTypes, participantId) {
    trackTypes.forEach((trackType) => {
      const elementId = `${trackType}-${participantId}`;
      const element = document.getElementById(elementId);
      if (element) {
        element.srcObject = null; // Release media resources
        element.parentNode.removeChild(element); // Remove element from the DOM
      }
    });
  }

  /**
   * Toggles the local video track's mute state.
   */
  toggleCamera() {
    this.call.setLocalVideo(!this.call.localVideo());
  }

  /**
   * Toggles the local audio track's mute state.
   */
  toggleMicrophone() {
    this.call.setLocalAudio(!this.call.localAudio());
  }

  /**
   * Updates the UI to reflect the current states of the local participant's
   * camera and microphone.
   * @param {string} trackType - The type of track, either 'video' for cameras
   * or 'audio' for microphones.
   * @param {Object} trackInfo - The track object.
   */
  updateUiForDevicesState(trackType, trackInfo) {
    // For video, set the camera state
    if (trackType === 'video') {
      document.getElementById('camera-state').textContent = `Camera: ${
        this.call.localVideo() ? 'On' : 'Off'
      }`;
    } else if (trackType === 'audio') {
      // For audio, set the mic state
      document.getElementById('mic-state').textContent = `Mic: ${
        this.call.localAudio() ? 'On' : 'Off'
      }`;
    }
  }

  /**
   * Sets up device selectors for cameras and microphones by dynamically
   * populating them with available devices and attaching event listeners to
   * handle device selection changes.
   */
  async setupDeviceSelectors() {
    // Fetch current input devices settings and an array of available devices.
    const selectedDevices = await this.call.getInputDevices();
    const { devices: allDevices } = await this.call.enumerateDevices();

    // Element references for camera and microphone selectors.
    const selectors = {
      videoinput: document.getElementById('camera-selector'),
      audioinput: document.getElementById('mic-selector'),
    };

    // Prepare selectors by clearing existing options and adding a
    // non-selectable prompt.
    Object.values(selectors).forEach((selector) => {
      selector.innerHTML = '';
      const promptOption = new Option(
        `Select a ${selector.id.includes('camera') ? 'camera' : 'microphone'}`,
        '',
        true,
        true
      );
      promptOption.disabled = true;
      selector.appendChild(promptOption);
    });

    // Create and append options to the selectors based on available devices.
    allDevices.forEach((device) => {
      if (device.label && selectors[device.kind]) {
        const isSelected =
          selectedDevices[device.kind === 'videoinput' ? 'camera' : 'mic']
            .deviceId === device.deviceId;
        const option = new Option(
          device.label,
          device.deviceId,
          isSelected,
          isSelected
        );
        selectors[device.kind].appendChild(option);
      }
    });

    // Listen for user device change requests.
    Object.entries(selectors).forEach(([deviceKind, selector]) => {
      selector.addEventListener('change', async (e) => {
        const deviceId = e.target.value;
        const deviceOptions = {
          [deviceKind === 'videoinput' ? 'videoDeviceId' : 'audioDeviceId']:
            deviceId,
        };
        await this.call.setInputDevicesAsync(deviceOptions);
      });
    });
  }

  /**
   * Updates the UI with the current number of participants.
   * This method combines getting the participant count and updating the UI.
   */
  updateAndDisplayParticipantCount() {
    const participantCount =
      this.call.participantCounts().present +
      this.call.participantCounts().hidden;
    document.getElementById(
      'participant-count'
    ).textContent = `Participants: ${participantCount}`;
  }

  /**
   * Leaves the call and performs necessary cleanup operations like removing
   * video elements.
   */
  async leave() {
    try {
      await this.call.leave();
    document.querySelectorAll('#canvas-participants video, audio').forEach((el) => {
        el.srcObject = null; // Release media resources
        el.remove(); // Remove the element from the DOM
      });
    } catch (e) {
      console.error('Leaving failed', e);
    }
  }
}

/**
 * Main entry point: Setup and event listener bindings after the DOM is fully
 * loaded.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const dailyCallManager = new DailyCallManager();


  // Bind the join call action to the join button.
  document
    .getElementById('join-btn')
    .addEventListener('click', async function () {
      const roomUrl = document.getElementById('room-url').value.trim();
      const joinToken =
        document.getElementById('join-token').value.trim() || null;
      await dailyCallManager.joinRoom(roomUrl, joinToken);
    });

  // Bind the leave call action to the leave button.
  document.getElementById('leave-btn').addEventListener('click', function () {
    dailyCallManager.leave();
  });

  // ✅ Hook up the toggle-screen-size button
  const screenSizeToggle = document.getElementById('toggle-screen-size');
  if (screenSizeToggle) {
    screenSizeToggle.addEventListener('click', () => {
      const sc = document.getElementById('screen-container');
      sc?.classList.toggle('small');
    });
  }

  // ✅ Enable the toggle when joined
  const shareBtn = document.getElementById('share-screen');
  const sizeBtn = document.getElementById('toggle-screen-size');
  if (shareBtn && sizeBtn) {
    shareBtn.addEventListener('click', () => {
      setTimeout(() => {
        sizeBtn.disabled = !shareBtn.textContent.includes('Stop');
      }, 300);
    });
  }
});


  function enableDragging(container) {
    let isDragging = false;
    let offsetX, offsetY;

    container.addEventListener('mousedown', (e) => {
      isDragging = true;
      offsetX = e.clientX - container.offsetLeft;
      offsetY = e.clientY - container.offsetTop;
      container.style.zIndex = 1000; // traz pra frente
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      container.style.left = `${e.clientX - offsetX}px`;
      container.style.top = `${e.clientY - offsetY}px`;
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }
