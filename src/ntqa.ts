/**
 * ============================================================================
 * NTQA Intelligent Task Automation & Chat Interface
 * ============================================================================
 * Architecture & Features:
 *  - ChatGPT / Claude-style dynamic transitions (Hero welcome -> Bottom chat bar).
 *  - Left Sidebar: Interactive Task Library + SQLite-backed History Conversations.
 *  - Collapsible Machine Executions: stdout/stderr & JSON logs are isolated in
 *    collapsible drawers with greyed-out monospace typography to eliminate UI clutter.
 *  - Real-time communication with NTQA FastAPI server (port 8000).
 *  - Clean TypeScript codebase with structured state management and error handling.
 */

import './ntqa.css';

// ─────────────────────────────────────────────────────────────────────────────
// Type Definitions & Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface TaskConfig {
  task_name: string;
  description: string;
  command?: string | string[];
  questions?: string[];
  output_schema?: Record<string, any>;
  key_map?: Record<string, string>;
  auto_summarize?: boolean;
  category?: string;
  file_path?: string;
}

export interface TaskRunResult {
  task: string;
  command?: string;
  output?: string;
  error?: string;
  summary?: string;
  status?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  msgType?: 'text' | 'task_prompt' | 'complete' | 'incomplete' | 'ready_to_execute' | 'task_execution' | 'status';
  meta?: {
    tasks?: any[];
    parsed?: any;
    results?: TaskRunResult[];
    [key: string]: any;
  };
  createdAt?: string;
}

export interface ConversationHistorySummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration & State
// ─────────────────────────────────────────────────────────────────────────────

const NTQA_API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://runningly-api.t-chrome.com' : 'http://localhost:8000');

class NTQAState {
  public sessionId: string = '';
  public availableTasks: TaskConfig[] = [];
  public filteredTasks: TaskConfig[] = [];
  public categories: string[] = ['All'];
  public activeCategory: string = 'All';
  public historyList: ConversationHistorySummary[] = [];
  public messages: ChatMessage[] = [];
  public isExecuting: boolean = false;
  public isServerOnline: boolean = false;
  public currentPendingTasks: any[] = [];
  public isHeroMode: boolean = true;
  public activeSidebarTab: 'tasks' | 'history' = 'tasks';
}

const state = new NTQAState();

// ─────────────────────────────────────────────────────────────────────────────
// DOM Elements Initialization
// ─────────────────────────────────────────────────────────────────────────────

const appEl = document.querySelector('#app') as HTMLElement;

appEl.innerHTML = `
  <div class="ntqa-layout" id="ntqaLayout">
    <!-- Left Sidebar: Tasks & SQLite History -->
    <aside class="ntqa-sidebar" id="ntqaSidebar">
      <div class="sidebar-header">
        <div class="sidebar-brand-row">
          <div class="sidebar-brand">
            <div class="brand-icon-badge">⚡</div>
            <div class="brand-text">NTQA Hub</div>
          </div>
          <div class="server-status-pill" id="serverStatusPill">
            <span class="status-dot"></span>
            <span id="serverStatusText">Connecting...</span>
          </div>
        </div>

        <button class="btn-new-chat" id="btnNewChat">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>New Conversation</span>
        </button>
      </div>

      <!-- Tab Switcher -->
      <div class="sidebar-tabs">
        <button class="tab-btn active" id="tabBtnTasks" data-tab="tasks">
          <span>Available Tasks</span>
          <span class="tab-badge" id="tasksCountBadge">0</span>
        </button>
        <button class="tab-btn" id="tabBtnHistory" data-tab="history">
          <span>Past Chats</span>
          <span class="tab-badge" id="historyCountBadge">0</span>
        </button>
      </div>

      <!-- Tab Content Area -->
      <div class="sidebar-pane" id="sidebarPane">
        <!-- Search bar -->
        <div class="sidebar-search-box">
          <span class="sidebar-search-icon">🔍</span>
          <input type="text" id="sidebarSearchInput" placeholder="Filter tasks or history..." />
        </div>

        <!-- Import cURL / Add Task Button -->
        <button class="btn-import-curl" id="btnOpenImportModal">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>Import cURL / AI Task</span>
        </button>

        <!-- Category / Pack Filter Pills -->
        <div class="task-category-bar" id="taskCategoryBar">
          <!-- Dynamically populated -->
        </div>

        <!-- Task List View -->
        <div class="task-list" id="taskListContainer">
          <!-- Dynamically populated -->
        </div>

        <!-- History List View -->
        <div class="history-list-view" id="historyListContainer" style="display: none;">
          <!-- Dynamically populated from SQLite -->
        </div>
      </div>

      <!-- Sidebar Footer -->
      <div class="sidebar-footer">
        <div class="sqlite-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
          </svg>
          <span>SQLite</span> Storage
        </div>
        <button class="btn-clear-all" id="btnClearHistory" title="Clear all conversation history">Clear History</button>
      </div>
    </aside>

    <!-- Resizer Divider -->
    <div class="ntqa-resizer" id="sidebarResizer"></div>

    <!-- Main Panel: Starts with Claude/ChatGPT Hero then converts to Active Chat -->
    <main class="ntqa-main-panel" id="mainPanel">
      <!-- Top Bar -->
      <header class="ntqa-topbar">
        <div class="topbar-title-group">
          <div class="session-badge" id="currentSessionBadge">
            <span>Session:</span>
            <strong id="sessionTitleDisplay">New Session</strong>
          </div>
        </div>
        <div class="topbar-actions">
          <button class="topbar-btn" id="btnTopImportModal" title="Import cURL or CLI command into a task">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14"></path>
            </svg>
            <span>Import cURL</span>
          </button>
          <button class="topbar-btn" id="btnRefreshTasks" title="Refresh task library from server">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
            <span>Sync Tasks</span>
          </button>
        </div>
      </header>

      <!-- Center Hero Container (Visible when conversation is new/empty) -->
      <div class="hero-view-container" id="heroContainer">
        <div class="hero-logo-box">
          <div class="hero-icon">🤖</div>
          <h1 class="hero-title">Intelligent Task Automation</h1>
          <p class="hero-subtitle">
            Describe what you need in plain English. NTQA will identify the task, prompt for missing parameters, and execute automated commands safely.
          </p>
        </div>

        <!-- Quick Start Task Prompt Chips -->
        <div class="hero-suggestions-grid" id="suggestionsGrid">
          <div class="suggestion-card" data-prompt="Calculate trip start and end dates for next week for 5 days">
            <div class="suggestion-header">
              <span class="suggestion-icon">📅</span>
              <span class="suggestion-title">Calculate Future Dates</span>
            </div>
            <div class="suggestion-desc">Get trip timeframe dates for next week or month.</div>
          </div>

          <div class="suggestion-card" data-prompt="Find Okta user by email or login for tarek@example.com">
            <div class="suggestion-header">
              <span class="suggestion-icon">👤</span>
              <span class="suggestion-title">Lookup Okta User</span>
            </div>
            <div class="suggestion-desc">Search an Okta directory profile by user email.</div>
          </div>

          <div class="suggestion-card" data-prompt="Create a new Okta group called QA-Engineers">
            <div class="suggestion-header">
              <span class="suggestion-icon">👥</span>
              <span class="suggestion-title">Create Okta Group</span>
            </div>
            <div class="suggestion-desc">Provision a new Okta group with description.</div>
          </div>

          <div class="suggestion-card" data-prompt="Run cmd with args /c dir">
            <div class="suggestion-header">
              <span class="suggestion-icon">⚙️</span>
              <span class="suggestion-title">Execute System Program</span>
            </div>
            <div class="suggestion-desc">Execute an automated CLI command with arguments.</div>
          </div>
        </div>
      </div>

      <!-- Active Chat Stream (Visible when conversation starts) -->
      <div class="chat-stream-container" id="chatStreamContainer" style="display: none;">
        <!-- Messages & Collapsible Task Execution Cards are rendered here -->
      </div>

      <!-- Sticky Floating Prompt Input Box (Claude / ChatGPT style) -->
      <div class="prompt-dock-container">
        <div class="prompt-dock-inner">
          <div class="prompt-card" id="promptCard">
            <textarea
              class="prompt-textarea"
              id="promptInput"
              placeholder="Ask NTQA to execute a task or enter automation instructions..."
              rows="1"
            ></textarea>
            <div class="prompt-footer">
              <div class="prompt-actions-left">
                <div class="badge-model-info">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="m9 12 2 2 4-4"></path>
                  </svg>
                  <span>NTQA + Gemini Engine</span>
                </div>
              </div>
              <div class="prompt-actions-right">
                <button class="btn-icon-round" id="btnMic" title="Voice input">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="23"></line>
                    <line x1="8" y1="23" x2="16" y2="23"></line>
                  </svg>
                </button>
                <button class="btn-send-main" id="btnSend" title="Send instruction (Enter)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>

  <!-- Modal: Import cURL / Add Task -->
  <div class="modal-overlay" id="importTaskModal">
    <div class="modal-container">
      <div class="modal-header">
        <div class="modal-title-row">
          <span class="modal-icon">✨</span>
          <span class="modal-title">AI Task Builder (cURL, CLI or Prompt)</span>
        </div>
        <button class="modal-close-btn" id="btnCloseImportModal">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">
            cURL Command, CLI Snippet, or Detailed Prompt
            <span>Provide raw command OR describe what the script should do</span>
          </label>
          <textarea
            class="form-textarea"
            id="modalCommandInput"
            placeholder="Option A (cURL): curl -X POST https://api.okta.com/api/v1/users -d '...'&#10;Option B (Prompt): Create a task that checks all AWS S3 buckets in us-east-1 and returns buckets without server-side encryption enabled."
          ></textarea>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Task Pack / Category</label>
            <input type="text" class="form-input" id="modalCategoryInput" placeholder="e.g. Okta, AWS, GitHub, System, Database" value="Custom" />
          </div>
          <div class="form-group">
            <label class="form-label">Optional Task Name</label>
            <input type="text" class="form-input" id="modalTaskNameInput" placeholder="e.g. Audit S3 Bucket Encryption" />
          </div>
        </div>

        <button class="btn-primary" id="btnGenerateTaskAI" style="width: 100%; justify-content: center;">
          <span>⚡ Auto-Generate Task Schema with Gemini</span>
        </button>

        <div class="form-group" id="modalPreviewGroup" style="display: none;">
          <label class="form-label">
            Generated Task Schema (JSON Preview / Edit)
            <span>Review parameters & \${answerN} bindings</span>
          </label>
          <textarea class="form-textarea" id="modalJsonPreview" style="min-height: 140px;"></textarea>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" id="btnCancelImportModal">Cancel</button>
        <button class="btn-primary" id="btnSaveTaskToLibrary" disabled>
          <span>💾 Save to Task Library</span>
        </button>
      </div>
    </div>
  </div>
`;

// ─────────────────────────────────────────────────────────────────────────────
// DOM Selectors
// ─────────────────────────────────────────────────────────────────────────────

const serverStatusPill = document.querySelector('#serverStatusPill') as HTMLElement;
const serverStatusText = document.querySelector('#serverStatusText') as HTMLElement;
const btnNewChat = document.querySelector('#btnNewChat') as HTMLButtonElement;
const tabBtnTasks = document.querySelector('#tabBtnTasks') as HTMLButtonElement;
const tabBtnHistory = document.querySelector('#tabBtnHistory') as HTMLButtonElement;
const tasksCountBadge = document.querySelector('#tasksCountBadge') as HTMLElement;
const historyCountBadge = document.querySelector('#historyCountBadge') as HTMLElement;
const sidebarSearchInput = document.querySelector('#sidebarSearchInput') as HTMLInputElement;
const taskCategoryBar = document.querySelector('#taskCategoryBar') as HTMLElement;
const taskListContainer = document.querySelector('#taskListContainer') as HTMLElement;
const historyListContainer = document.querySelector('#historyListContainer') as HTMLElement;
const btnClearHistory = document.querySelector('#btnClearHistory') as HTMLButtonElement;
const btnOpenImportModal = document.querySelector('#btnOpenImportModal') as HTMLButtonElement;
const btnTopImportModal = document.querySelector('#btnTopImportModal') as HTMLButtonElement;
const sidebarResizer = document.querySelector('#sidebarResizer') as HTMLElement;
const ntqaLayout = document.querySelector('#ntqaLayout') as HTMLElement;
const sessionTitleDisplay = document.querySelector('#sessionTitleDisplay') as HTMLElement;
const btnRefreshTasks = document.querySelector('#btnRefreshTasks') as HTMLButtonElement;
const heroContainer = document.querySelector('#heroContainer') as HTMLElement;
const chatStreamContainer = document.querySelector('#chatStreamContainer') as HTMLElement;
const promptInput = document.querySelector('#promptInput') as HTMLTextAreaElement;
const btnSend = document.querySelector('#btnSend') as HTMLButtonElement;
const btnMic = document.querySelector('#btnMic') as HTMLButtonElement;
const suggestionsGrid = document.querySelector('#suggestionsGrid') as HTMLElement;

// Modal Elements
const importTaskModal = document.querySelector('#importTaskModal') as HTMLElement;
const btnCloseImportModal = document.querySelector('#btnCloseImportModal') as HTMLButtonElement;
const btnCancelImportModal = document.querySelector('#btnCancelImportModal') as HTMLButtonElement;
const btnGenerateTaskAI = document.querySelector('#btnGenerateTaskAI') as HTMLButtonElement;
const btnSaveTaskToLibrary = document.querySelector('#btnSaveTaskToLibrary') as HTMLButtonElement;
const modalCommandInput = document.querySelector('#modalCommandInput') as HTMLTextAreaElement;
const modalCategoryInput = document.querySelector('#modalCategoryInput') as HTMLInputElement;
const modalTaskNameInput = document.querySelector('#modalTaskNameInput') as HTMLInputElement;
const modalPreviewGroup = document.querySelector('#modalPreviewGroup') as HTMLElement;
const modalJsonPreview = document.querySelector('#modalJsonPreview') as HTMLTextAreaElement;


// ─────────────────────────────────────────────────────────────────────────────
// API Methods & SQLite Operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all registered tasks from NTQA FastAPI server.
 */
async function loadAvailableTasks(): Promise<void> {
  try {
    const res = await fetch(`${NTQA_API_BASE}/tasks`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    state.availableTasks = data.tasks || [];
    state.filteredTasks = [...state.availableTasks];
    state.categories = ['All', ...(data.categories || [])];
    tasksCountBadge.textContent = state.availableTasks.length.toString();
    renderCategoryBar();
    renderTasksList();
    setServerStatus(true);
  } catch (err) {
    console.error('Failed to load tasks from NTQA service:', err);
    setServerStatus(false);
  }
}

/**
 * Fetch past conversation history list from SQLite database.
 */
async function loadHistoryList(): Promise<void> {
  try {
    const res = await fetch(`${NTQA_API_BASE}/history`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    state.historyList = data.conversations || [];
    historyCountBadge.textContent = state.historyList.length.toString();
    renderHistoryList();
  } catch (err) {
    console.error('Failed to load history from SQLite:', err);
  }
}

/**
 * Load a full conversation by its ID from SQLite and display its messages.
 */
async function openConversation(convoId: string): Promise<void> {
  try {
    const res = await fetch(`${NTQA_API_BASE}/history/${convoId}`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();

    state.sessionId = data.id;
    sessionTitleDisplay.textContent = data.title || 'Past Session';
    state.messages = (data.messages || []).map((m: any) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      msgType: m.msg_type,
      meta: m.meta,
      createdAt: m.created_at
    }));

    setHeroMode(state.messages.length === 0);
    renderChatStream();
    renderHistoryList();
  } catch (err) {
    console.error('Error opening conversation:', err);
  }
}

/**
 * Delete a conversation from SQLite.
 */
async function deleteConversation(convoId: string): Promise<void> {
  try {
    const res = await fetch(`${NTQA_API_BASE}/history/${convoId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Status ${res.status}`);

    if (state.sessionId === convoId) {
      startNewConversation();
    }
    await loadHistoryList();
  } catch (err) {
    console.error('Error deleting conversation from SQLite:', err);
  }
}

/**
 * Clear all conversation history in SQLite.
 */
async function clearAllHistory(): Promise<void> {
  if (!confirm('Are you sure you want to clear all conversation history from the SQLite database?')) {
    return;
  }
  try {
    const res = await fetch(`${NTQA_API_BASE}/history`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    startNewConversation();
    await loadHistoryList();
  } catch (err) {
    console.error('Error clearing history:', err);
  }
}

/**
 * Post user message to NTQA /chat endpoint.
 */
async function sendChatMessage(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed || state.isExecuting) return;

  // Switch UI from Hero mode to Active Chat mode
  if (state.isHeroMode) {
    setHeroMode(false);
  }

  // Ensure we have a session ID
  if (!state.sessionId) {
    state.sessionId = generateUUID();
    sessionTitleDisplay.textContent = trimmed.length > 25 ? trimmed.substring(0, 25) + '...' : trimmed;
  }

  // Add user message to UI state immediately
  const userMsg: ChatMessage = {
    id: generateUUID(),
    role: 'user',
    content: trimmed,
    msgType: 'text'
  };
  state.messages.push(userMsg);
  renderChatStream();
  scrollToBottom();

  // Clear input box
  promptInput.value = '';
  adjustTextareaHeight(promptInput);

  // Show typing / processing indicator
  state.isExecuting = true;
  updateSendButtonState();

  try {
    const res = await fetch(`${NTQA_API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: trimmed,
        session_id: state.sessionId
      })
    });

    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const data = await res.json();

    if (data.session_id) {
      state.sessionId = data.session_id;
    }

    // Handle bot response based on status
    if (data.status === 'complete') {
      state.currentPendingTasks = data.tasks || [];
      state.messages.push({
        id: generateUUID(),
        role: 'assistant',
        content: data.message,
        msgType: 'complete',
        meta: { tasks: data.tasks }
      });
    } else if (data.status === 'ready_to_execute') {
      state.messages.push({
        id: generateUUID(),
        role: 'assistant',
        content: data.message,
        msgType: 'ready_to_execute',
        meta: { tasks: data.tasks }
      });
      // Execute tasks immediately
      await executeTasks(data.tasks, data.pause);
    } else {
      state.messages.push({
        id: generateUUID(),
        role: 'assistant',
        content: data.message,
        msgType: 'incomplete',
        meta: { parsed: data.parsed }
      });
    }

    renderChatStream();
    scrollToBottom();
    await loadHistoryList();
  } catch (err: any) {
    console.error('Chat error:', err);
    state.messages.push({
      id: generateUUID(),
      role: 'assistant',
      content: `⚠️ Failed to reach NTQA service. Please make sure NTQA API is running at ${NTQA_API_BASE}.\nError: ${err.message}`,
      msgType: 'status'
    });
    renderChatStream();
  } finally {
    state.isExecuting = false;
    updateSendButtonState();
  }
}

/**
 * Execute automated tasks via NTQA /execute endpoint.
 */
async function executeTasks(tasks: any[], pause: boolean = false): Promise<void> {
  if (!tasks || tasks.length === 0) return;

  state.isExecuting = true;
  updateSendButtonState();

  // Temporary status message
  const execMsgId = generateUUID();
  state.messages.push({
    id: execMsgId,
    role: 'assistant',
    content: `⚙️ Executing ${tasks.length} task(s)...`,
    msgType: 'status'
  });
  renderChatStream();
  scrollToBottom();

  try {
    const res = await fetch(`${NTQA_API_BASE}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tasks: tasks,
        pause: pause,
        session_id: state.sessionId
      })
    });

    if (!res.ok) throw new Error(`Execution error HTTP ${res.status}`);
    const data = await res.json();

    // Replace the status message with rich collapsible machine execution card
    state.messages = state.messages.filter(m => m.id !== execMsgId);

    state.messages.push({
      id: generateUUID(),
      role: 'assistant',
      content: `Execution finished for ${data.results?.length || 0} task(s).`,
      msgType: 'task_execution',
      meta: { results: data.results || [] }
    });

    // Check if any completed task yielded a downloadable file and trigger direct in-browser download
    if (Array.isArray(data.results)) {
      for (const taskRes of data.results) {
        let parsedMeta: any = null;
        if (taskRes.output) {
          try {
            parsedMeta = JSON.parse(taskRes.output);
          } catch {
            for (const line of taskRes.output.split('\n').reverse()) {
              const l = line.trim();
              if (l.startsWith('{') && l.endsWith('}')) {
                try { parsedMeta = JSON.parse(l); break; } catch {}
              }
            }
          }
        }
        if (parsedMeta && (parsedMeta.download_file || parsedMeta.download_url)) {
          const dlFile = parsedMeta.download_file || parsedMeta.file_name || 'download';
          const dlUrl = parsedMeta.download_url || `/download?file=${encodeURIComponent(dlFile)}`;
          // Direct in-browser download trigger (same tab, no new window)
          const dlLink = document.createElement('a');
          dlLink.href = dlUrl;
          dlLink.download = dlFile;
          dlLink.style.display = 'none';
          document.body.appendChild(dlLink);
          dlLink.click();
          document.body.removeChild(dlLink);
        }
      }
    }

    renderChatStream();
    scrollToBottom();
    await loadHistoryList();
  } catch (err: any) {
    console.error('Task execution failed:', err);
    state.messages = state.messages.filter(m => m.id !== execMsgId);
    state.messages.push({
      id: generateUUID(),
      role: 'assistant',
      content: `❌ Task execution failed: ${err.message}`,
      msgType: 'status'
    });
    renderChatStream();
  } finally {
    state.isExecuting = false;
    updateSendButtonState();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UI Renderers & Component Builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render category filter chips (Task Packs).
 */
function renderCategoryBar(): void {
  if (!taskCategoryBar) return;
  const cats = Array.from(new Set(['All', ...state.availableTasks.map(t => t.category || 'General')]));
  state.categories = cats;

  taskCategoryBar.innerHTML = cats.map(cat => {
    const isActive = state.activeCategory === cat;
    return `<button class="category-chip ${isActive ? 'active' : ''}" data-cat="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`;
  }).join('');

  taskCategoryBar.querySelectorAll('.category-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeCategory = btn.getAttribute('data-cat') || 'All';
      renderCategoryBar();
      renderTasksList();
    });
  });
}

/**
 * Render task library cards in the left sidebar grouped by category.
 */
function renderTasksList(): void {
  const query = sidebarSearchInput.value.toLowerCase().trim();
  const filtered = state.availableTasks.filter(t => {
    const matchesQuery = t.task_name.toLowerCase().includes(query) || t.description.toLowerCase().includes(query);
    const matchesCategory = state.activeCategory === 'All' || (t.category || 'General').toLowerCase() === state.activeCategory.toLowerCase();
    return matchesQuery && matchesCategory;
  });

  if (filtered.length === 0) {
    taskListContainer.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 24px 8px; font-size: 13px;">
        No tasks found in pack "${escapeHtml(state.activeCategory)}" ${query ? `matching "${escapeHtml(query)}"` : ''}
      </div>
    `;
    return;
  }

  // Group by category
  const groups: Record<string, TaskConfig[]> = {};
  filtered.forEach(task => {
    const cat = task.category || 'General';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(task);
  });

  taskListContainer.innerHTML = Object.entries(groups).map(([catName, tasks]) => {
    const cardsHtml = tasks.map(task => {
      const questionsHtml = (task.questions || [])
        .map(q => `<span class="question-chip">${escapeHtml(q.replace(/\*+$/, ''))}</span>`)
        .join('');

      return `
        <div class="task-card" data-task-name="${escapeHtml(task.task_name)}">
          <div class="task-card-header">
            <span class="task-card-title">${escapeHtml(task.task_name)}</span>
            <div style="display: flex; gap: 4px; align-items: center;">
              <span class="task-card-category">${escapeHtml(task.category || 'Task')}</span>
              <span class="task-pill">${task.command ? 'CLI' : 'APP'}</span>
            </div>
          </div>
          <p class="task-card-desc">${escapeHtml(task.description)}</p>
          ${questionsHtml ? `<div class="task-card-questions">${questionsHtml}</div>` : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="task-pack-group">
        <div class="task-pack-header">
          <span>📦 ${escapeHtml(catName)}</span>
          <span class="task-pack-count">${tasks.length}</span>
        </div>
        ${cardsHtml}
      </div>
    `;
  }).join('');

  // Attach click events to insert task prompt
  taskListContainer.querySelectorAll('.task-card').forEach(card => {
    card.addEventListener('click', () => {
      const taskName = card.getAttribute('data-task-name') || '';
      promptInput.value = `I want to run "${taskName}". Please ask me for any required details.`;
      promptInput.focus();
      adjustTextareaHeight(promptInput);
    });
  });
}

// ────────────────── Import cURL / Add Task Modal Logic ──────────────────

function openImportModal(): void {
  importTaskModal.classList.add('active');
  modalCommandInput.value = '';
  modalTaskNameInput.value = '';
  modalCategoryInput.value = state.activeCategory !== 'All' ? state.activeCategory : 'Custom';
  modalPreviewGroup.style.display = 'none';
  modalJsonPreview.value = '';
  btnSaveTaskToLibrary.disabled = true;
  modalCommandInput.focus();
}

function closeImportModal(): void {
  importTaskModal.classList.remove('active');
}

async function handleGenerateTaskFromModal(): Promise<void> {
  const snippet = modalCommandInput.value.trim();
  if (!snippet) {
    alert('Please enter a cURL command or CLI snippet first.');
    return;
  }

  btnGenerateTaskAI.disabled = true;
  btnGenerateTaskAI.innerHTML = '<span>⏳ Generating with Gemini...</span>';

  try {
    const res = await fetch(`${NTQA_API_BASE}/tasks/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command_snippet: snippet,
        task_name: modalTaskNameInput.value.trim() || undefined,
        category: modalCategoryInput.value.trim() || 'Custom'
      })
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.detail || `HTTP ${res.status}`);
    }

    const data = await res.json();
    modalPreviewGroup.style.display = 'flex';
    modalJsonPreview.value = JSON.stringify(data.task, null, 2);
    btnSaveTaskToLibrary.disabled = false;
  } catch (err: any) {
    alert(`Failed to generate task schema: ${err.message}`);
  } finally {
    btnGenerateTaskAI.disabled = false;
    btnGenerateTaskAI.innerHTML = '<span>⚡ Auto-Generate Task Schema with Gemini</span>';
  }
}

async function handleSaveTaskFromModal(): Promise<void> {
  let parsedTask: any;
  try {
    parsedTask = JSON.parse(modalJsonPreview.value);
  } catch (err) {
    alert('Invalid JSON in schema preview. Please fix JSON syntax before saving.');
    return;
  }

  btnSaveTaskToLibrary.disabled = true;
  btnSaveTaskToLibrary.innerHTML = '<span>💾 Saving...</span>';

  try {
    const res = await fetch(`${NTQA_API_BASE}/tasks/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: parsedTask,
        category: modalCategoryInput.value.trim() || parsedTask.category || 'Custom'
      })
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.detail || `HTTP ${res.status}`);
    }

    await loadAvailableTasks();
    closeImportModal();
    alert(`✅ Task "${parsedTask.task_name}" saved successfully into the task library!`);
  } catch (err: any) {
    alert(`Failed to save task: ${err.message}`);
  } finally {
    btnSaveTaskToLibrary.disabled = false;
    btnSaveTaskToLibrary.innerHTML = '<span>💾 Save to Task Library</span>';
  }
}

/**
 * Render SQLite conversation history items in the sidebar.
 */
function renderHistoryList(): void {
  const query = sidebarSearchInput.value.toLowerCase().trim();
  const filtered = state.historyList.filter(h =>
    h.title.toLowerCase().includes(query) ||
    (h.last_message && h.last_message.toLowerCase().includes(query))
  );

  if (filtered.length === 0) {
    historyListContainer.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 24px 8px; font-size: 13px;">
        No conversations in SQLite database.
      </div>
    `;
    return;
  }

  historyListContainer.innerHTML = filtered.map(item => {
    const isActive = item.id === state.sessionId;
    const dateFormatted = new Date(item.updated_at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
      <div class="history-item ${isActive ? 'active' : ''}" data-convo-id="${item.id}">
        <div class="history-info">
          <span class="history-title">${escapeHtml(item.title || 'Untitled Session')}</span>
          <div class="history-meta">
            <span>${dateFormatted}</span>
            <span>•</span>
            <span>${item.message_count} msg</span>
          </div>
        </div>
        <button class="btn-delete-history" data-delete-id="${item.id}" title="Delete session">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;
  }).join('');

  // Attach item selection and deletion events
  historyListContainer.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.btn-delete-history')) return; // Delete button clicked
      const convoId = el.getAttribute('data-convo-id');
      if (convoId) openConversation(convoId);
    });
  });

  historyListContainer.querySelectorAll('.btn-delete-history').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const convoId = btn.getAttribute('data-delete-id');
      if (convoId) deleteConversation(convoId);
    });
  });
}

function formatParamLabel(rawKey: string): string {
  let cleaned = rawKey.replace(/\*$/, '').trim();
  // Strip verbose prompt instructions in parentheses if present
  cleaned = cleaned.replace(/\s*\([^)]*\)/g, '').trim();
  if (cleaned.endsWith('?')) {
    cleaned = cleaned.slice(0, -1).trim();
  }
  return cleaned || rawKey;
}

function renderTaskCards(tasks: any[], msgIndex: number): string {
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) return '';

  const taskCards = tasks.map((t, tIdx) => {
    const taskName = t.task || 'Task';
    const data = t.data || {};
    const entries = Object.entries(data);

    const paramPills = entries.map(([k, v]) => {
      const cleanKey = formatParamLabel(k);
      return `
        <div class="param-item-row">
          <span class="param-label-text">${escapeHtml(cleanKey)}:</span>
          <span
            class="param-val-pill"
            data-action="edit-param"
            data-msg-idx="${msgIndex}"
            data-task-idx="${tIdx}"
            data-param-key="${escapeHtml(k)}"
            data-param-val="${escapeHtml(String(v))}"
            title="Click to edit parameter"
          >
            ✏️ ${escapeHtml(String(v))}
          </span>
        </div>
      `;
    }).join('');

    return `
      <div
        class="workflow-card"
        draggable="true"
        data-msg-idx="${msgIndex}"
        data-task-idx="${tIdx}"
      >
        <div class="workflow-card-top">
          <div class="workflow-title-box">
            <span class="drag-grip" title="Drag to reorder step">⠿</span>
            <span class="step-badge">Step ${tIdx + 1}</span>
            <span class="workflow-task-title">⚙️ ${escapeHtml(taskName)}</span>
          </div>
          <div class="workflow-controls">
            <button
              class="btn-card-ctrl"
              data-action="move-up"
              data-msg-idx="${msgIndex}"
              data-task-idx="${tIdx}"
              title="Move step up"
              ${tIdx === 0 ? 'disabled' : ''}
            >▲</button>
            <button
              class="btn-card-ctrl"
              data-action="move-down"
              data-msg-idx="${msgIndex}"
              data-task-idx="${tIdx}"
              title="Move step down"
              ${tIdx === tasks.length - 1 ? 'disabled' : ''}
            >▼</button>
            <button
              class="btn-card-ctrl btn-delete"
              data-action="delete-task"
              data-msg-idx="${msgIndex}"
              data-task-idx="${tIdx}"
              title="Remove step"
            >✕</button>
          </div>
        </div>

        <div class="workflow-params-list">
          ${paramPills || '<div style="color: var(--text-muted); font-size: 12px; padding: 4px;">No parameters required</div>'}
        </div>
      </div>
    `;
  }).join('');

  // Available tasks picker options
  const taskOptionsHtml = state.availableTasks.map(avail => {
    return `
      <div
        class="picker-item-option"
        data-action="select-add-task"
        data-msg-idx="${msgIndex}"
        data-task-name="${escapeHtml(avail.task_name)}"
      >
        <span>${escapeHtml(avail.task_name)}</span>
        <span class="picker-item-cat">${escapeHtml(avail.category || 'Task')}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="workflow-container">
      <div class="workflow-header-row">
        <span>Workflow Sequence (${tasks.length} Steps) • Drag to Reorder</span>
      </div>

      <div class="workflow-cards-list" id="workflowList_${msgIndex}">
        ${taskCards}
      </div>

      <div class="workflow-actions-footer">
        <div class="add-step-picker-box">
          <button class="btn-add-step-pill" id="btnToggleAddStep_${msgIndex}">
            <span>+ Add Step to Workflow</span>
          </button>
          <div class="step-picker-popover" id="stepPickerPopover_${msgIndex}">
            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); padding: 4px 6px; text-transform: uppercase;">Select Task to Insert</div>
            ${taskOptionsHtml}
          </div>
        </div>

        <button class="btn-execute-now" id="btnRunNow_${msgIndex}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          <span>Run Tasks Now</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Render the main chat stream with messages and collapsible machine outputs.
 */
function renderChatStream(): void {
  if (state.messages.length === 0) {
    chatStreamContainer.innerHTML = '';
    return;
  }

  chatStreamContainer.innerHTML = state.messages.map((msg, index) => {
    if (msg.role === 'user') {
      return `
        <div class="msg-row user-row">
          <div class="msg-body">
            <div class="user-bubble">${escapeHtml(msg.content)}</div>
          </div>
          <div class="msg-avatar user-avatar">U</div>
        </div>
      `;
    }

    // Assistant / Machine response rendering
    let innerContentHtml = '';

    if (msg.msgType === 'task_execution' && msg.meta?.results) {
      // ─── Collapsible Machine Execution Section ───────────────────────
      const results: TaskRunResult[] = msg.meta.results;
      const executionCardsHtml = results.map(res => {
        const hasError = res.status ? res.status === 'error' : (!!res.error && !res.output);
        const statusClass = hasError ? 'error' : 'success';
        const statusText = hasError ? 'Failed' : 'Executed Successfully';

        let downloadInfo: { url: string; filename: string } | null = null;
        if (res.output) {
          try {
            const p = JSON.parse(res.output);
            if (p.download_file || p.download_url) {
              const fn = p.download_file || p.file_name || 'download';
              downloadInfo = { url: p.download_url || `/download?file=${encodeURIComponent(fn)}`, filename: fn };
            }
          } catch {
            for (const l of res.output.split('\n').reverse()) {
              const str = l.trim();
              if (str.startsWith('{') && str.endsWith('}')) {
                try {
                  const p = JSON.parse(str);
                  if (p.download_file || p.download_url) {
                    const fn = p.download_file || p.file_name || 'download';
                    downloadInfo = { url: p.download_url || `/download?file=${encodeURIComponent(fn)}`, filename: fn };
                    break;
                  }
                } catch {}
              }
            }
          }
        }

        return `
          <div class="machine-execution-card">
            <div class="execution-summary-header" onclick="this.parentElement.classList.toggle('open')">
              <div class="header-left">
                <span class="accordion-arrow">▶</span>
                <span class="task-run-name">${escapeHtml(res.task)}</span>
              </div>
              <span class="status-pill-exec ${statusClass}">${statusText}</span>
            </div>

            ${res.summary ? `
              <div class="execution-ai-summary">
                <div class="ai-summary-label">Summary & Insights</div>
                <div>${escapeHtml(res.summary)}</div>
              </div>
            ` : ''}

            ${downloadInfo ? `
              <div style="margin: 8px 12px; padding: 8px 12px; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 6px; display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 13px; font-weight: 500; color: var(--text-primary);">📥 Ready: <strong>${escapeHtml(downloadInfo.filename)}</strong></span>
                <a href="${escapeHtml(downloadInfo.url)}" download="${escapeHtml(downloadInfo.filename)}" style="padding: 4px 10px; background: var(--accent); color: #fff; border-radius: 5px; text-decoration: none; font-size: 12px; font-weight: 600; cursor: pointer;">Download</a>
              </div>
            ` : ''}

            <!-- Collapsible Raw Logs Drawer (Greyed out font) -->
            <div class="execution-details-drawer">
              ${res.command ? `
                <div class="cli-command-block">
                  <div class="cli-label">Executed Command</div>
                  <pre class="cli-code">${escapeHtml(res.command)}</pre>
                </div>
              ` : ''}

              ${res.output ? `
                <div class="raw-output-block">
                  <div class="raw-output-header">
                    <span class="cli-label">Raw Output (stdout)</span>
                    <button class="btn-copy-code" onclick="navigator.clipboard.writeText(decodeURIComponent('${encodeURIComponent(res.output)}'))">Copy</button>
                  </div>
                  <pre class="raw-output-code">${escapeHtml(res.output)}</pre>
                </div>
              ` : ''}

              ${res.error ? `
                <div class="raw-output-block">
                  <div class="raw-output-header">
                    <span class="cli-label" style="color: var(--accent-red);">Errors (stderr)</span>
                  </div>
                  <pre class="raw-output-code" style="color: hsl(0, 75%, 70%);">${escapeHtml(res.error)}</pre>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');

      innerContentHtml = `
        <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">
          ${escapeHtml(msg.content)}
        </div>
        ${executionCardsHtml}
      `;
    } else if (msg.meta?.tasks && Array.isArray(msg.meta.tasks) && msg.meta.tasks.length > 0) {
      // ─── Task Ready for Execution ─────────────────────────────────
      innerContentHtml = `
        <div style="color: var(--text-primary); font-size: 14.5px;">
          ${escapeHtml(msg.content)}
        </div>
        ${renderTaskCards(msg.meta.tasks, index)}
      `;
    } else {
      // Check if msg.content itself is a JSON string of tasks
      let inlineTasks: any[] | null = null;
      try {
        const trimmed = msg.content.trim();
        if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
          const parsed = JSON.parse(trimmed);
          inlineTasks = Array.isArray(parsed) ? parsed : [parsed];
          if (!inlineTasks.every(t => typeof t === 'object' && t !== null && 'task' in t)) {
            inlineTasks = null;
          }
        }
      } catch (e) {
        inlineTasks = null;
      }

      if (inlineTasks && inlineTasks.length > 0) {
        if (!msg.meta) msg.meta = {};
        msg.meta.tasks = inlineTasks;
        state.currentPendingTasks = inlineTasks;
        innerContentHtml = `
          <div style="color: var(--text-primary); font-size: 14.5px; font-weight: 500;">
            All required questions are answered. Ready to execute.
          </div>
          ${renderTaskCards(inlineTasks, index)}
        `;
      } else {
        // Standard interactive assistant message
        innerContentHtml = `
          <div style="color: var(--text-primary);">${formatAssistantText(msg.content)}</div>
        `;
      }
    }

    return `
      <div class="msg-row">
        <div class="msg-avatar bot-avatar">⚡</div>
        <div class="msg-body">
          <div class="msg-sender-name">NTQA Assistant</div>
          <div class="bot-bubble">
            ${innerContentHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');

  attachWorkflowCardListeners();
}

/**
 * Attach Drag-and-Drop, Move Up/Down, Delete, Add Step, and Edit Parameter event handlers.
 */
function attachWorkflowCardListeners(): void {
  // 1. Run Tasks Now Buttons
  state.messages.forEach((msg, msgIdx) => {
    const tasks = msg.meta?.tasks;
    if (tasks && tasks.length > 0) {
      const runBtn = document.querySelector(`#btnRunNow_${msgIdx}`);
      if (runBtn) {
        runBtn.addEventListener('click', () => {
          executeTasks(tasks, false);
        });
      }

      // Add Step Popover toggle
      const addStepBtn = document.querySelector(`#btnToggleAddStep_${msgIdx}`);
      const popover = document.querySelector(`#stepPickerPopover_${msgIdx}`);
      if (addStepBtn && popover) {
        addStepBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          popover.classList.toggle('active');
        });
      }
    }
  });

  // Close popovers on outside click
  document.addEventListener('click', () => {
    document.querySelectorAll('.step-picker-popover.active').forEach(p => p.classList.remove('active'));
  });

  // 2. Select Add Task Option
  document.querySelectorAll('[data-action="select-add-task"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const msgIdx = parseInt(el.getAttribute('data-msg-idx') || '-1', 10);
      const taskName = el.getAttribute('data-task-name') || '';
      if (msgIdx >= 0 && taskName && state.messages[msgIdx]?.meta?.tasks) {
        const found = state.availableTasks.find(t => t.task_name === taskName);
        const defaultData: Record<string, string> = {};
        if (found && found.questions) {
          found.questions.forEach(q => {
            defaultData[q] = '';
          });
        }
        state.messages[msgIdx].meta!.tasks.push({
          task: taskName,
          data: defaultData
        });
        state.currentPendingTasks = state.messages[msgIdx].meta!.tasks;
        renderChatStream();
      }
    });
  });

  // 3. Move Step Up
  document.querySelectorAll('[data-action="move-up"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const msgIdx = parseInt(btn.getAttribute('data-msg-idx') || '-1', 10);
      const taskIdx = parseInt(btn.getAttribute('data-task-idx') || '-1', 10);
      if (msgIdx >= 0 && taskIdx > 0 && state.messages[msgIdx]?.meta?.tasks) {
        const tasks = state.messages[msgIdx].meta!.tasks;
        const temp = tasks[taskIdx];
        tasks[taskIdx] = tasks[taskIdx - 1];
        tasks[taskIdx - 1] = temp;
        state.currentPendingTasks = tasks;
        renderChatStream();
      }
    });
  });

  // 4. Move Step Down
  document.querySelectorAll('[data-action="move-down"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const msgIdx = parseInt(btn.getAttribute('data-msg-idx') || '-1', 10);
      const taskIdx = parseInt(btn.getAttribute('data-task-idx') || '-1', 10);
      if (msgIdx >= 0 && taskIdx >= 0 && state.messages[msgIdx]?.meta?.tasks) {
        const tasks = state.messages[msgIdx].meta!.tasks;
        if (taskIdx < tasks.length - 1) {
          const temp = tasks[taskIdx];
          tasks[taskIdx] = tasks[taskIdx + 1];
          tasks[taskIdx + 1] = temp;
          state.currentPendingTasks = tasks;
          renderChatStream();
        }
      }
    });
  });

  // 5. Delete Step
  document.querySelectorAll('[data-action="delete-task"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const msgIdx = parseInt(btn.getAttribute('data-msg-idx') || '-1', 10);
      const taskIdx = parseInt(btn.getAttribute('data-task-idx') || '-1', 10);
      if (msgIdx >= 0 && taskIdx >= 0 && state.messages[msgIdx]?.meta?.tasks) {
        const tasks = state.messages[msgIdx].meta!.tasks;
        tasks.splice(taskIdx, 1);
        state.currentPendingTasks = tasks;
        renderChatStream();
      }
    });
  });

  // 6. Edit Parameter Inline
  document.querySelectorAll('[data-action="edit-param"]').forEach(pill => {
    pill.addEventListener('click', () => {
      const msgIdx = parseInt(pill.getAttribute('data-msg-idx') || '-1', 10);
      const taskIdx = parseInt(pill.getAttribute('data-task-idx') || '-1', 10);
      const paramKey = pill.getAttribute('data-param-key') || '';
      const currentVal = pill.getAttribute('data-param-val') || '';

      if (msgIdx >= 0 && taskIdx >= 0 && paramKey && state.messages[msgIdx]?.meta?.tasks) {
        const newVal = prompt(`Edit parameter value for "${formatParamLabel(paramKey)}":`, currentVal);
        if (newVal !== null && newVal !== currentVal) {
          state.messages[msgIdx].meta!.tasks[taskIdx].data[paramKey] = newVal;
          state.currentPendingTasks = state.messages[msgIdx].meta!.tasks;
          renderChatStream();
        }
      }
    });
  });

  // 7. Drag and Drop Reordering Handlers
  let draggedCard: HTMLElement | null = null;
  let dragSrcMsgIdx = -1;
  let dragSrcTaskIdx = -1;

  document.querySelectorAll('.workflow-card').forEach(cardEl => {
    const card = cardEl as HTMLElement;

    card.addEventListener('dragstart', (e: DragEvent) => {
      draggedCard = card;
      dragSrcMsgIdx = parseInt(card.getAttribute('data-msg-idx') || '-1', 10);
      dragSrcTaskIdx = parseInt(card.getAttribute('data-task-idx') || '-1', 10);
      card.classList.add('dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', `${dragSrcMsgIdx}:${dragSrcTaskIdx}`);
      }
    });

    card.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
      if (!draggedCard || draggedCard === card) return;
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

      const rect = card.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (e.clientY < midY) {
        card.classList.add('drop-above');
        card.classList.remove('drop-below');
      } else {
        card.classList.add('drop-below');
        card.classList.remove('drop-above');
      }
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drop-above', 'drop-below');
    });

    card.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      card.classList.remove('drop-above', 'drop-below');
      if (!draggedCard || draggedCard === card) return;

      const targetMsgIdx = parseInt(card.getAttribute('data-msg-idx') || '-1', 10);
      const targetTaskIdx = parseInt(card.getAttribute('data-task-idx') || '-1', 10);

      if (dragSrcMsgIdx === targetMsgIdx && dragSrcMsgIdx >= 0 && state.messages[dragSrcMsgIdx]?.meta?.tasks) {
        const tasks = state.messages[dragSrcMsgIdx].meta!.tasks;
        const [movedItem] = tasks.splice(dragSrcTaskIdx, 1);

        const rect = card.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const insertIdx = e.clientY < midY ? targetTaskIdx : targetTaskIdx + 1;
        const finalIdx = dragSrcTaskIdx < insertIdx ? insertIdx - 1 : insertIdx;

        tasks.splice(finalIdx, 0, movedItem);
        state.currentPendingTasks = tasks;
        renderChatStream();
      }
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.workflow-card').forEach(c => c.classList.remove('drop-above', 'drop-below', 'dragging'));
      draggedCard = null;
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// UI Mode & Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Toggle between Hero view and Active Chat view.
 */
function setHeroMode(hero: boolean): void {
  state.isHeroMode = hero;
  if (hero) {
    heroContainer.style.display = 'flex';
    chatStreamContainer.style.display = 'none';
  } else {
    heroContainer.style.display = 'none';
    chatStreamContainer.style.display = 'flex';
  }
}

/**
 * Start a brand new conversation session.
 */
function startNewConversation(): void {
  state.sessionId = generateUUID();
  state.messages = [];
  sessionTitleDisplay.textContent = 'New Session';
  setHeroMode(true);
  renderChatStream();
  renderHistoryList();
  promptInput.value = '';
  promptInput.focus();
}

/**
 * Update server online status pill.
 */
function setServerStatus(online: boolean): void {
  state.isServerOnline = online;
  if (online) {
    serverStatusPill.className = 'server-status-pill';
    serverStatusText.textContent = 'Online';
  } else {
    serverStatusPill.className = 'server-status-pill offline';
    serverStatusText.textContent = 'Offline (port 8000)';
  }
}

/**
 * Update Send button enabled / loading state.
 */
function updateSendButtonState(): void {
  btnSend.disabled = state.isExecuting;
}

/**
 * Adjust textarea height dynamically like ChatGPT / Claude.
 */
function adjustTextareaHeight(textarea: HTMLTextAreaElement): void {
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
}

/**
 * Scroll chat stream to bottom.
 */
function scrollToBottom(): void {
  setTimeout(() => {
    chatStreamContainer.scrollTop = chatStreamContainer.scrollHeight;
  }, 50);
}

/**
 * Format questions or highlighted parameters nicely.
 */
function formatAssistantText(text: string): string {
  if (!text) return '';
  // Check if text has question bullet points
  const lines = text.split('\n');
  return lines.map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('*') || trimmed.startsWith('-') || /^\d+\./.test(trimmed)) {
      return `<div class="question-item"><span class="question-bullet">•</span><span>${escapeHtml(trimmed.replace(/^[*-\d.]\s*/, ''))}</span></div>`;
    }
    return `<div>${escapeHtml(trimmed)}</div>`;
  }).join('');
}

/**
 * Simple HTML escape to prevent XSS.
 */
function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate a random UUID v4.
 */
function generateUUID(): string {
  if (crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Listeners & Interactions
// ─────────────────────────────────────────────────────────────────────────────

// Send button click
btnSend.addEventListener('click', () => {
  sendChatMessage(promptInput.value);
});

// Prompt input Enter key
promptInput.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage(promptInput.value);
  }
});

// Auto-expand textarea on typing
promptInput.addEventListener('input', () => {
  adjustTextareaHeight(promptInput);
});

// New Chat button
btnNewChat.addEventListener('click', () => {
  startNewConversation();
});

// Refresh Tasks button
btnRefreshTasks.addEventListener('click', async () => {
  await loadAvailableTasks();
});

// Import cURL Modal open/close/generate/save
btnOpenImportModal.addEventListener('click', openImportModal);
btnTopImportModal.addEventListener('click', openImportModal);
btnCloseImportModal.addEventListener('click', closeImportModal);
btnCancelImportModal.addEventListener('click', closeImportModal);
btnGenerateTaskAI.addEventListener('click', handleGenerateTaskFromModal);
btnSaveTaskToLibrary.addEventListener('click', handleSaveTaskFromModal);

importTaskModal.addEventListener('click', (e) => {
  if (e.target === importTaskModal) closeImportModal();
});

// Clear All History button
btnClearHistory.addEventListener('click', async () => {
  await clearAllHistory();
});

// Tab Switcher (Tasks vs SQLite History)
tabBtnTasks.addEventListener('click', () => {
  tabBtnTasks.classList.add('active');
  tabBtnHistory.classList.remove('active');
  taskListContainer.style.display = 'flex';
  historyListContainer.style.display = 'none';
  state.activeSidebarTab = 'tasks';
});

tabBtnHistory.addEventListener('click', async () => {
  tabBtnHistory.classList.add('active');
  tabBtnTasks.classList.remove('active');
  historyListContainer.style.display = 'flex';
  taskListContainer.style.display = 'none';
  state.activeSidebarTab = 'history';
  await loadHistoryList();
});

// Filter input in sidebar
sidebarSearchInput.addEventListener('input', () => {
  if (state.activeSidebarTab === 'tasks') {
    renderTasksList();
  } else {
    renderHistoryList();
  }
});

// Quick suggestion chips on Hero view
suggestionsGrid.querySelectorAll('.suggestion-card').forEach(card => {
  card.addEventListener('click', () => {
    const prompt = card.getAttribute('data-prompt') || '';
    if (prompt) {
      promptInput.value = prompt;
      sendChatMessage(prompt);
    }
  });
});

// Resizer logic for adjustable sidebar width
let isResizing = false;
sidebarResizer.addEventListener('mousedown', (e) => {
  isResizing = true;
  sidebarResizer.classList.add('active');
  document.body.style.cursor = 'col-resize';
  e.preventDefault();
});

window.addEventListener('mousemove', (e) => {
  if (!isResizing) return;
  const newWidth = Math.max(240, Math.min(e.clientX, 520));
  ntqaLayout.style.gridTemplateColumns = `${newWidth}px 6px 1fr`;
});

window.addEventListener('mouseup', () => {
  if (isResizing) {
    isResizing = false;
    sidebarResizer.classList.remove('active');
    document.body.style.cursor = '';
  }
});

// Speech Recognition (Mic button)
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  let isRecording = false;

  btnMic.addEventListener('click', () => {
    if (isRecording) {
      recognition.stop();
      return;
    }
    recognition.start();
  });

  recognition.onstart = () => {
    isRecording = true;
    btnMic.classList.add('recording');
  };

  recognition.onresult = (event: any) => {
    const transcript = event.results[0][0].transcript;
    promptInput.value = (promptInput.value ? promptInput.value + ' ' : '') + transcript;
    adjustTextareaHeight(promptInput);
  };

  recognition.onend = () => {
    isRecording = false;
    btnMic.classList.remove('recording');
  };

  recognition.onerror = () => {
    isRecording = false;
    btnMic.classList.remove('recording');
  };
} else {
  btnMic.style.display = 'none';
}

// ─────────────────────────────────────────────────────────────────────────────
// App Initialization
// ─────────────────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  startNewConversation();
  await loadAvailableTasks();
  await loadHistoryList();
}

init();
