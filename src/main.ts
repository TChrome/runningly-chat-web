import './style.css';

// Remote system base URL configuration
const hostName: string = "props-revise-fancy.ngrok-free.dev";
const systemUrl: string = `https://${hostName}`;
let currentUserId: string = "";
let currentUserEmail: string = "";

// Elements inside the app
const appEl = document.querySelector('#app') as HTMLElement;

// Injection of full layout
appEl.innerHTML = `
  <div class="app-layout">
    <!-- Left Side Panel (30% approx) -->
    <aside class="left-panel">
      <div class="panel-header">
        <div class="brand">RUNNINGLY AI</div>
        <div class="user-profile">
          <div class="avatar" id="userAvatar"></div>
          <div class="user-info">
            <span class="user-name" id="userName">Loading...</span>
            <span class="user-email" id="userEmail"></span>
          </div>
        </div>
        <div class="action-buttons">
          <button class="panel-btn" id="logoutBtn">Logout</button>
          <button class="panel-btn revoke" id="revokeBtn">Revoke</button>
        </div>
      </div>
      
      <div class="panel-content">
        <div class="section-title">History & Conversions</div>
        <nav class="history-list" id="historyList">
          <div class="history-item" data-video="static/downloads/okta_new.mp4" data-title="Okta Sync Training">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M23 7l-7 5 7 5V7z"></path>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>
            <span class="history-item-label">Okta Sync Training</span>
          </div>
          <div class="history-item" data-video="static/downloads/okta_new.mp4" data-title="Daily Salesforce Extract">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span class="history-item-label">Daily Salesforce Extract</span>
          </div>
          <div class="history-item" data-video="static/downloads/okta_new.mp4" data-title="Automated Report Export">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span class="history-item-label">Automated Report Export</span>
          </div>
        </nav>
      </div>
    </aside>

    <!-- Middle Panel (40% / Flexible Canvas) -->
    <main class="middle-panel" id="middleCanvas">
      <!-- Default welcome screen -->
      <div class="canvas-welcome" id="canvasWelcome">
        <div class="welcome-icon">⚡</div>
        <h2>Premium Control Center</h2>
        <p>Your interactive workspace. Run an automation from the chat box on the right to track progress and stream output videos directly on this canvas.</p>
      </div>
    </main>
    <div class="resizer" id="rightResizer"></div>
    <!-- Right Chat Panel (30%) -->
    <aside class="right-panel">
      <div class="chat-header-bar">
        <div class="chat-title-container">
          <span class="chat-title">Power Automation Chat!</span>
          <span class="chat-subtitle">Powered by Runningly AI</span>
        </div>
        <div class="status-badge online" id="systemStatus">
          <span class="status-dot"></span>
          <span>Online</span>
        </div>
      </div>
      
      <div class="chat-messages-container" id="chatMessages">
        <!-- Welcoming agent message -->
        <div class="chat-bubble bot">
          <span class="bubble-meta">Agent</span>
          <div class="bubble-content" id="welcomeBubbleContent">
            Hello, ${currentUserId}! I am your Runningly AI Assistant. How can I help you automate your workflows today?
          </div>
        </div>
      </div>
      
      <div class="resizer-h" id="inputResizer"></div>
      <div class="chat-input-panel">
        <div class="input-wrapper">
          <textarea class="textarea-field" id="chatInput" placeholder="Type your automation request..." rows="1"></textarea>
          <div class="input-buttons">
            <button class="mic-btn" id="micBtn" title="Speak to chatbot">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 1.75a3.75 3.75 0 013.75 3.75v7a3.75 3.75 0 01-7.5 0v-7A3.75 3.75 0 0112 1.75zm0 17.5v2.25m-6-4.5a6 6 0 0012 0" />
              </svg>
            </button>
            <button class="send-btn" id="sendBtn" title="Send message">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </aside>
  </div>

  <!-- Fullscreen Floating Lightbox Overlay -->
  <div class="popup-overlay" id="popupOverlay">
    <div class="popup-content">
      <button class="close-btn" id="closePopupBtn">&times;</button>
      <video class="popup-video" id="popupVideo" controls autoplay></video>
    </div>
  </div>
`;

// DOM Selectors
const userNameEl = document.querySelector('#userName') as HTMLElement;
const userEmailEl = document.querySelector('#userEmail') as HTMLElement;
const userAvatarEl = document.querySelector('#userAvatar') as HTMLElement;
const chatMessagesEl = document.querySelector('#chatMessages') as HTMLElement;
const chatInputEl = document.querySelector('#chatInput') as HTMLTextAreaElement;
const sendBtnEl = document.querySelector('#sendBtn') as HTMLButtonElement;
const micBtnEl = document.querySelector('#micBtn') as HTMLButtonElement;
const historyItems = document.querySelectorAll('.history-item');
const middleCanvasEl = document.querySelector('#middleCanvas') as HTMLElement;
const popupOverlayEl = document.querySelector('#popupOverlay') as HTMLElement;
const popupVideoEl = document.querySelector('#popupVideo') as HTMLVideoElement;
const closePopupBtnEl = document.querySelector('#closePopupBtn') as HTMLButtonElement;
const systemStatusEl = document.querySelector('#systemStatus') as HTMLElement;

// Resizable Right Panel Logic
const resizer = document.querySelector('#rightResizer') as HTMLElement;
const appLayout = document.querySelector('.app-layout') as HTMLElement;

let isResizing = false;

resizer.addEventListener('mousedown', (e) => {
  isResizing = true;
  resizer.classList.add('active');
  document.body.style.cursor = 'col-resize';
  e.preventDefault();
});

// Resizable Input Panel Logic
const inputResizer = document.querySelector('#inputResizer') as HTMLElement;
const chatInputPanel = document.querySelector('.chat-input-panel') as HTMLElement;

let isResizingInput = false;

inputResizer.addEventListener('mousedown', (e) => {
  isResizingInput = true;
  inputResizer.classList.add('active');
  document.body.style.cursor = 'row-resize';
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (isResizingInput) {
    const screenHeight = window.innerHeight;
    const inputPanelHeight = screenHeight - e.clientY;
    const maxInputHeight = screenHeight * 0.5;
    const minInputHeight = 80;

    const finalHeight = Math.min(Math.max(inputPanelHeight, minInputHeight), maxInputHeight);
    chatInputPanel.style.height = `${finalHeight}px`;
  }

  if (!isResizing) return;

  const screenWidth = window.innerWidth;
  const rightPanelWidth = screenWidth - e.clientX;
  const maxRightWidth = screenWidth * 0.5;
  const minRightWidth = 300;

  const finalWidth = Math.min(Math.max(rightPanelWidth, minRightWidth), maxRightWidth);
  appLayout.style.gridTemplateColumns = `260px 1fr 6px ${finalWidth}px`;
});

document.addEventListener('mouseup', () => {
  if (isResizing) {
    isResizing = false;
    resizer.classList.remove('active');
    document.body.style.cursor = 'default';
  }
  if (isResizingInput) {
    isResizingInput = false;
    inputResizer.classList.remove('active');
    document.body.style.cursor = 'default';
  }
});

// Register OAuth logouts
(document.querySelector('#logoutBtn') as HTMLElement).addEventListener('click', () => { window.location.href = '/logout'; });
(document.querySelector('#revokeBtn') as HTMLElement).addEventListener('click', () => { window.location.href = '/revoke'; });

// Load Current Logged In User
async function fetchCurrentUser(): Promise<void> {
  try {
    const res = await fetch('/current-user');
    if (res.ok) {
      const user = await res.json();
      currentUserId = user.name || "User";
      currentUserEmail = user.email || "";
      userNameEl.textContent = currentUserId;
      userEmailEl.textContent = currentUserEmail;
      userAvatarEl.textContent = currentUserId.charAt(0).toUpperCase();

      // Update welcoming greeting bubble
      const welcomeBubble = document.querySelector('#welcomeBubbleContent') as HTMLElement;
      if (welcomeBubble) {
        welcomeBubble.textContent = `Hello, ${currentUserId}! I am your Runningly AI Assistant. How can I help you automate your workflows today?`;
      }
    } else {
      // Not authenticated — send to Google login, return here after
      window.location.href = '/google_login?next=' + encodeURIComponent(window.location.href);
    }
  } catch (err) {
    console.warn("Could not fetch session profile, defaulting to mock data.", err);
  }
}
fetchCurrentUser();

// Handle heartbeats & system checking
async function checkSystemHeartbeat(): Promise<void> {
  try {
    const response = await fetch(`${systemUrl}/system-status`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (response.ok) {
      systemStatusEl.className = "status-badge online";
      (systemStatusEl.querySelector('span:not(.status-dot)') as HTMLElement).textContent = "Online";
    } else {
      systemStatusEl.className = "status-badge offline";
      (systemStatusEl.querySelector('span:not(.status-dot)') as HTMLElement).textContent = "Offline";
    }
  } catch (error) {
    systemStatusEl.className = "status-badge offline";
    (systemStatusEl.querySelector('span:not(.status-dot)') as HTMLElement).textContent = "Offline";
  }
}
setInterval(checkSystemHeartbeat, 15000);
checkSystemHeartbeat();

// Load Video in Middle Canvas (History items clicking)
historyItems.forEach(item => {
  item.addEventListener('click', () => {
    historyItems.forEach(el => el.classList.remove('active'));
    item.classList.add('active');

    const videoUrl = item.getAttribute('data-video') || "";
    const title = item.getAttribute('data-title') || "";
    renderVideoFrame(videoUrl, title);
  });
});

// Canvas Render Managers
function renderWelcome(): void {
  middleCanvasEl.innerHTML = `
    <div class="canvas-welcome">
      <div class="welcome-icon">⚡</div>
      <h2>Premium Control Center</h2>
      <p>Your interactive workspace. Run an automation from the chat box on the right to track progress and stream output videos directly on this canvas.</p>
    </div>
  `;
}

function updateOrCreateProgressCard(taskId: string, stage: string = "Initializing...", step: string = "Waiting for tasks...", percent: number = 0): void {
  let cardEl = document.querySelector(`[data-task-id="${taskId}"]`) as HTMLElement;

  if (!cardEl) {
    // Hide onboarding welcome screen if present
    const welcomeEl = document.querySelector('.canvas-welcome');
    if (welcomeEl) welcomeEl.remove();

    // Create the scoped progress card
    const cardHtml = `
      <div class="task-canvas-card" data-task-id="${taskId}">
        <div class="canvas-card">
          <div class="canvas-progress-container" style="margin-bottom: 16px;">
            <div class="canvas-progress-circle" id="circle-${taskId}" style="width: 110px; height: 110px; box-shadow: 0 0 20px var(--accent-glow);">
              <div class="canvas-progress-inner" style="width: 96px; height: 96px;">
                <span class="canvas-progress-text" id="text-${taskId}" style="font-size: 24px;">0%</span>
                <div class="canvas-loading-icon" style="width: 12px; height: 12px; margin-top: 2px;"></div>
              </div>
            </div>
          </div>
          <h3 style="font-size:16px; margin-bottom: 4px;">Running Automation</h3>
          <p class="canvas-progress-stage" id="stage-${taskId}" style="font-size: 13px; margin-bottom: 4px;">${stage}</p>
          <p class="canvas-progress-step" id="step-${taskId}" style="font-size: 11px;">${step}</p>
        </div>
      </div>
    `;
    middleCanvasEl.insertAdjacentHTML('beforeend', cardHtml);
    cardEl = document.querySelector(`[data-task-id="${taskId}"]`) as HTMLElement;
  }

  // Update values
  const circleEl = document.getElementById(`circle-${taskId}`);
  const textEl = document.getElementById(`text-${taskId}`);
  const stageEl = document.getElementById(`stage-${taskId}`);
  const stepEl = document.getElementById(`step-${taskId}`);

  if (circleEl) {
    circleEl.style.background = `conic-gradient(var(--accent) ${percent}%, hsl(230, 15%, 20%) ${percent}%)`;
  }
  if (textEl) textEl.textContent = `${percent}%`;
  if (stageEl) stageEl.textContent = stage;
  if (stepEl) stepEl.textContent = step;
}

function removeProgressCard(taskId: string): void {
  const card = document.querySelector(`[data-task-id="${taskId}"]`) as HTMLElement;
  if (card) {
    card.style.animation = 'scaleUp 0.3s reverse ease-out forwards';
    setTimeout(() => {
      card.remove();
      // If there are no more active cards, show welcome screen again
      if (middleCanvasEl.querySelectorAll('.task-canvas-card').length === 0) {
        renderWelcome();
      }
    }, 300);
  }
}

function renderVideoFrame(videoUrl: string, title: string, taskId?: string): void {
  const videoHtml = `
    <div class="task-canvas-card" ${taskId ? `data-task-id="${taskId}"` : ''}>
      <div class="canvas-card">
        <div class="video-frame-header">
          <span class="video-frame-title" style="font-size: 13px; font-weight: 600; color: var(--text-secondary);">${title}</span>
        </div>
        <div class="video-element-wrapper" id="canvasVideoWrapper_${taskId || 'default'}" style="width: 100%; border-radius: 12px;">
          <video id="canvasVideo_${taskId || 'default'}" preload="auto" style="width: 100%; border-radius: 12px; display: block;">
            <source src="${videoUrl}" type="video/mp4">
          </video>
          <div class="video-overlay-play">
            <svg class="play-icon-svg" viewBox="0 0 24 24" fill="currentColor" style="width: 42px; height: 42px;">
              <path d="M8 5v14l11-7z"></path>
            </svg>
          </div>
        </div>
      </div>
    </div>
  `;

  if (taskId) {
    const card = document.querySelector(`[data-task-id="${taskId}"]`);
    if (card) {
      card.outerHTML = videoHtml;
    } else {
      middleCanvasEl.insertAdjacentHTML('beforeend', videoHtml);
    }
  } else {
    middleCanvasEl.innerHTML = videoHtml;
  }

  const videoWrapper = document.querySelector(`#canvasVideoWrapper_${taskId || 'default'}`) as HTMLElement;
  videoWrapper.addEventListener('click', () => {
    popupVideoEl.src = videoUrl;
    popupOverlayEl.style.display = 'grid';
    popupVideoEl.play();
  });
}

// Lightbox modal closing (fully debugged!)
function closePopup(): void {
  popupOverlayEl.style.display = 'none';
  popupVideoEl.pause();
  popupVideoEl.src = '';
}
closePopupBtnEl.addEventListener('click', closePopup);
popupOverlayEl.addEventListener('click', (e: MouseEvent) => {
  if (e.target === popupOverlayEl) closePopup();
});

// Chat Log Helpers
function appendChatMessage(sender: 'user' | 'bot', content: string): void {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${sender}`;
  bubble.innerHTML = `
    <span class="bubble-meta">${sender === 'user' ? 'You' : 'Agent'}</span>
    <div class="bubble-content">${content}</div>
  `;
  chatMessagesEl.appendChild(bubble);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function appendBotPlaceholderMessage(msgId: string, content: string): void {
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble bot';
  bubble.id = msgId;
  bubble.innerHTML = `
    <span class="bubble-meta">Agent</span>
    <div class="bubble-content" id="content_${msgId}">
      ${content}
    </div>
  `;
  chatMessagesEl.appendChild(bubble);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

// Trigger Progress Websocket (Scoped Task Progress listener)
function initializeProgressWebSocket(taskId: string): void {
  const wsUrl = `wss://${hostName}/ws/progress?task_id=${taskId}`;
  console.log(`Connecting to Task Progress WebSocket: ${wsUrl}`);
  const ws = new WebSocket(wsUrl);

  ws.onmessage = function (event: MessageEvent) {
    const data = JSON.parse(event.data);
    console.log(`WS progress update for taskId [${taskId}]:`, data);

    if (data.progress || data.stage) {
      const stage = data.stage || "Mocking Automation Steps...";
      let step = data.step || "Performing action...";
      const percent = data.progress != null ? Math.round(data.progress) : 0;

      // Check if this is the TRUE final message (100% + contains the result URL)
      const isActuallyFinished = percent >= 100 && step.includes('video_stream');

      if (isActuallyFinished) {
        step = "Finalizing video...";
      }

      // Update or create progress card on the flexible center canvas!
      updateOrCreateProgressCard(taskId, stage, step, percent);

      if (isActuallyFinished) {
        finalizeProgressCard(taskId, data);
      }
    }

    async function finalizeProgressCard(taskId: string, finalData: any) {
      const botMsgId = 'bot_msg_' + taskId;
      const contentEl = document.getElementById(`content_${botMsgId}`) as HTMLElement;

      const remoteUrl = systemUrl + '/' + finalData.step;
      let fileName = "automation_result.mp4";

      // Try to extract the real filename from the URL parameters
      // if (remoteUrl && remoteUrl.includes('vf=')) {
      //   const match = remoteUrl.match(/vf=([^&]+)/);
      //   if (match) fileName = match[1];
      // }

      if (contentEl) contentEl.innerHTML = "✨ Automation finished! Preparing video result...";

      try {
        const cacheRes = await fetch('/download_video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ remote_url: remoteUrl, file_name: fileName })
        });
        const cached = await cacheRes.json();

        if (contentEl) {
          contentEl.innerHTML = `
            <div class="chat-video-bubble">
              <p style="margin:0 0 8px 0; font-weight:500;">✅ Automation finished! Video ready:</p>
              <div class="chat-video-wrapper" id="chat_video_wrap_${taskId}">
                <video id="chat_video_el_${taskId}">
                  <source src="${cached.local_url}" type="video/mp4">
                </video>
                <div class="video-overlay-play">
                  <svg class="play-icon-svg mini" viewBox="0 0 24 24" fill="currentColor" style="width:40px; height:40px;">
                    <path d="M8 5v14l11-7z"></path>
                  </svg>
                </div>
              </div>
            </div>
          `;

          renderVideoFrame(cached.local_url, "Automation Result", taskId);

          document.getElementById(`chat_video_wrap_${taskId}`)?.addEventListener('click', () => {
            popupVideoEl.src = cached.local_url;
            popupOverlayEl.style.display = 'grid';
            popupVideoEl.play();
          });
        }
      } catch (err) {
        console.error("Error finalizing progress card video:", err);
        if (contentEl) contentEl.innerHTML = "❌ Failed to load final video.";
      }
    }
  };

  ws.onerror = function (err: Event) {
    console.error(`WebSocket progress error for task_id ${taskId}:`, err);
  };

  ws.onclose = function () {
    console.log(`WebSocket connection closed for task_id ${taskId}`);
    // We don't remove the card here anymore, because the POST response will replace it with the result.
  };
}

// Form Submission & Send Message
async function sendMessage(): Promise<void> {
  const messageText = chatInputEl.value.trim();
  if (!messageText) return;

  chatInputEl.value = '';
  appendChatMessage('user', messageText);

  const taskId = 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
  console.log(`Generated job parameters. Scope ID: ${taskId}`);

  const botMsgId = 'bot_msg_' + taskId;

  // Append standard bot typing/placeholder bubble right away scoped to this taskId!
  appendBotPlaceholderMessage(botMsgId, `
    <div class="typing-dots" id="dots_${botMsgId}">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `);

  // Begin WebSocket progression tracking on Middle Canvas
  initializeProgressWebSocket(taskId);

  const formData = new FormData();
  formData.append('text', messageText);
  formData.append('task_id', taskId);

  // --- MOCK MODE FOR TESTING ---
  const lowerMsg = messageText.toLowerCase();
  if (lowerMsg === 'test video' || lowerMsg === 'test text') {
    console.log(`Mock Mode: Simulating ${lowerMsg} completion...`);

    // Simulate progress increments
    let progress = 0;
    const interval = setInterval(() => {
      progress += 2;
      updateOrCreateProgressCard(taskId, "Mocking Automation...", "Processing steps...", progress);
      if (progress >= 100) {
        clearInterval(interval);
        finalizeMock();
      }
    }, 800);

    async function finalizeMock() {
      const contentEl = document.getElementById(`content_${botMsgId}`) as HTMLElement;

      if (lowerMsg === 'test video') {
        const mockFileName = "okta_new.mp4";
        const mockRemoteUrl = "https://props-revise-fancy.ngrok-free.dev/video_feed?vp=YzpcdG1wXHJ1bm5pbmdseS1haVxva3RhX3RyYWluaW5nXDIwMjYtMDYtMDJfMTUtNDktMDM=&vf=okta_new.mp4";

        if (contentEl) contentEl.innerHTML = "✨ [MOCK] Downloading sample video...";

        const cacheRes = await fetch('/download_video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ remote_url: mockRemoteUrl, file_name: mockFileName })
        });
        const cached = await cacheRes.json();

        if (contentEl) {
          contentEl.innerHTML = `
            <div class="chat-video-bubble">
              <p style="margin:0 0 8px 0; font-weight:500;">✅ [MOCK] Automation finished! Video ready:</p>
              <div class="chat-video-wrapper" id="chat_video_wrap_${taskId}">
                <video id="chat_video_el_${taskId}">
                  <source src="${cached.local_url}" type="video/mp4">
                </video>
                <div class="video-overlay-play">
                  <svg class="play-icon-svg mini" viewBox="0 0 24 24" fill="currentColor" style="width:40px; height:40px;">
                    <path d="M8 5v14l11-7z"></path>
                  </svg>
                </div>
              </div>
            </div>
          `;
          renderVideoFrame(cached.local_url, "Mock Video Result", taskId);
          document.getElementById(`chat_video_wrap_${taskId}`)?.addEventListener('click', () => {
            popupVideoEl.src = cached.local_url;
            popupOverlayEl.style.display = 'grid';
            popupVideoEl.play();
          });
        }
      } else {
        // Mock Text Result
        if (contentEl) {
          contentEl.innerHTML = "✅ [MOCK] Automation finished! Here is your report:<br><br>1. Data extracted successfully.<br>2. Validation passed.<br>3. System updated.";
        }
        // Replace progress card with a "Success" card on canvas
        const card = document.querySelector(`[data-task-id="${taskId}"]`);
        if (card) {
          card.innerHTML = `
            <div class="canvas-card success" style="text-align:center;">
              <div style="font-size: 40px; margin-bottom: 10px;">✅</div>
              <h3 style="margin:0;">Task Complete</h3>
              <p style="font-size: 13px; opacity: 0.8;">The automation finished successfully.</p>
            </div>
          `;
          //setTimeout(() => removeProgressCard(taskId), 5000);
        }
      }
    }
    return;
  }
  // --- END MOCK MODE ---

  try {
    const response = await fetch(`${systemUrl}/chat-ai`, {
      method: 'POST',
      body: formData,
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });

    console.log(`Response received for ${taskId}: status ${response.status}`);
    if (!response.ok) throw new Error(`Server responded with error status: ${response.status}`);
    const json = await response.json();
    console.log(`Full JSON payload for ${taskId}:`, json);

    const contentEl = document.getElementById(`content_${botMsgId}`) as HTMLElement;

    // Check if the response contains download files or videos
    if (json.Generated_Content && json.Generated_Content.file_name) {
      const remoteFileName = json.Generated_Content.file_name;
      const remoteUrl = `${systemUrl}/video_feed?vf=${remoteFileName}`;

      if (contentEl) {
        contentEl.innerHTML = "✨ Automation finished! Preparing video result...";
      }

      const cacheRes = await fetch('/download_video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remote_url: remoteUrl, file_name: remoteFileName })
      });

      if (!cacheRes.ok) throw new Error("CORS Cache proxy returned error status");
      const cached = await cacheRes.json();

      // Update the right chat bubble with final video player and details!
      if (contentEl) {
        contentEl.innerHTML = `
          <div class="chat-video-bubble">
            <p style="margin:0 0 8px 0; font-weight:500;">✅ Automation finished! Video ready:</p>
            <div class="chat-video-wrapper" id="chat_video_wrap_${taskId}">
              <video id="chat_video_el_${taskId}">
                <source src="${cached.local_url}" type="video/mp4">
              </video>
              <div class="video-overlay-play">
                <svg class="play-icon-svg mini" viewBox="0 0 24 24" fill="currentColor" style="width:40px; height:40px;">
                  <path d="M8 5v14l11-7z"></path>
                </svg>
              </div>
            </div>
          </div>
        `;

        // REPLACE PROGRESS CARD ON CANVAS WITH VIDEO (Parity with Mock)
        renderVideoFrame(cached.local_url, "Automation Result", taskId);

        // Bind cinema click event to the newly rendered chat video wrapper!
        (document.getElementById(`chat_video_wrap_${taskId}`) as HTMLElement).addEventListener('click', () => {
          popupVideoEl.src = cached.local_url;
          popupOverlayEl.style.display = 'grid';
          popupVideoEl.play();
        });
      }
    }
    else if (json.download_file) {
      const remoteUrl = `${systemUrl}/download_file?vf=${json.download_file}`;

      if (contentEl) {
        contentEl.innerHTML = "📁 Preparing document output, starting download cache proxy...";
      }

      const cacheRes = await fetch('/download_video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remote_url: remoteUrl, file_name: json.download_file })
      });

      if (!cacheRes.ok) throw new Error("Cache proxy error");
      const cached = await cacheRes.json();

      if (contentEl) {
        contentEl.innerHTML = `📥 Download complete! Click to save: <a href="${cached.local_url}" download class="fancy-link" style="color:var(--accent); font-weight:600; text-decoration:underline;">${json.download_file}</a>`;
      }
      // Show success on canvas
      const card = document.querySelector(`[data-task-id="${taskId}"]`);
      if (card) {
        card.innerHTML = `
          <div class="canvas-card success" style="text-align:center;">
            <div style="font-size: 40px; margin-bottom: 10px;">✅</div>
            <h3 style="margin:0;">File Ready</h3>
            <p style="font-size: 13px; opacity: 0.8;">The document has been generated.</p>
          </div>
        `;
      }
    } else {
      // General conversational response (Instant, matching mock)
      if (contentEl) {
        contentEl.innerHTML = '';

        let rawText = json.question || json.answer || json.message || "Automation process closed without yielding a media file.";

        // Port exact formatting from old project:
        let m = rawText
          .replaceAll('- **', '*')
          .replaceAll('* **', '*')
          .replaceAll(':**', ': ')
          .replaceAll('**:', ': ');

        let index = 0, count = 0;
        function typeCharacter() {
          const char = m.charAt(index);
          if (char === '\n') {
            contentEl.innerHTML += '<br>';
          } else if (char === '**') {
            contentEl.innerHTML += ('&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + (++count) + '.&nbsp;&nbsp;');
          } else {
            contentEl.innerHTML += char;
          }
          index++;

          if (index < m.length) {
            const delay = char === ' ' ? 60 : 30; // Double speed for spaces!
            setTimeout(typeCharacter, delay);
          }
          chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
        }
        typeCharacter();
      }
      // Show success on canvas for text response
      const card = document.querySelector(`[data-task-id="${taskId}"]`);
      if (card) {
        card.innerHTML = `
          <div class="canvas-card success" style="text-align:center;">
            <div style="font-size: 40px; margin-bottom: 10px;">✅</div>
            <h3 style="margin:0;">Response Ready</h3>
            <p style="font-size: 13px; opacity: 0.8;">The agent has finished the request.</p>
          </div>
        `;
      }
    }

  } catch (error) {
    console.error("Pipeline failure:", error);
    const contentEl = document.getElementById(`content_${botMsgId}`) as HTMLElement;
    if (contentEl) {
      contentEl.textContent = "❌ An error occurred during automation scheduling. Please try again.";
    }
    // Only remove card on actual failure
    removeProgressCard(taskId);
  }
}

// Bind enter keys and buttons
sendBtnEl.addEventListener('click', sendMessage);
micBtnEl.addEventListener('click', speak);

async function speak(): Promise<void> {
  try {
    const res = await fetch(`${systemUrl}/speak`, {
      method: 'GET',
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (!res.ok) throw new Error('Network response was not ok.');
    const data = await res.json();
    chatInputEl.value = data.said;
    // Auto-adjust height to match content
    chatInputEl.style.height = 'auto';
    chatInputEl.style.height = chatInputEl.scrollHeight + 'px';
  } catch (error) {
    console.error('Mic/Speak Error:', error);
  }
}

// Port exact consecutive Enter key handler from runningly-chat
let lastKey: string | null = null;

chatInputEl.addEventListener('input', () => {
  chatInputEl.style.height = 'auto';
  chatInputEl.style.height = chatInputEl.scrollHeight + 'px';
});

chatInputEl.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    if (lastKey === 'Enter') {
      // Two consecutive Enter keys detected -> Send message
      e.preventDefault();
      sendMessage();
      lastKey = null;
    } else {
      lastKey = 'Enter';
    }
  } else {
    lastKey = null;
  }
});
