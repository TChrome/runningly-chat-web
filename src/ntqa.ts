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
}

export interface TaskRunResult {
  task: string;
  command?: string;
  output?: string;
  error?: string;
  summary?: string;
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

const NTQA_API_BASE = 'http://localhost:8000';

class NTQAState {
  public sessionId: string = '';
  public availableTasks: TaskConfig[] = [];
  public filteredTasks: TaskConfig[] = [];
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
const taskListContainer = document.querySelector('#taskListContainer') as HTMLElement;
const historyListContainer = document.querySelector('#historyListContainer') as HTMLElement;
const btnClearHistory = document.querySelector('#btnClearHistory') as HTMLButtonElement;
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
    tasksCountBadge.textContent = state.availableTasks.length.toString();
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
 * Render task library cards in the left sidebar.
 */
function renderTasksList(): void {
  const query = sidebarSearchInput.value.toLowerCase().trim();
  const filtered = state.availableTasks.filter(t =>
    t.task_name.toLowerCase().includes(query) ||
    t.description.toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    taskListContainer.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 24px 8px; font-size: 13px;">
        No tasks found matching "${escapeHtml(query)}"
      </div>
    `;
    return;
  }

  taskListContainer.innerHTML = filtered.map(task => {
    const questionsHtml = (task.questions || [])
      .map(q => `<span class="question-chip">${escapeHtml(q.replace(/\*+$/, ''))}</span>`)
      .join('');

    return `
      <div class="task-card" data-task-name="${escapeHtml(task.task_name)}">
        <div class="task-card-header">
          <span class="task-card-title">${escapeHtml(task.task_name)}</span>
          <span class="task-pill">${task.command ? 'CLI' : 'APP'}</span>
        </div>
        <p class="task-card-desc">${escapeHtml(task.description)}</p>
        ${questionsHtml ? `<div class="task-card-questions">${questionsHtml}</div>` : ''}
      </div>
    `;
  }).join('');

  // Attach click events to insert task prompt or run
  taskListContainer.querySelectorAll('.task-card').forEach(card => {
    card.addEventListener('click', () => {
      const taskName = card.getAttribute('data-task-name') || '';
      promptInput.value = `I want to run "${taskName}". Please ask me for any required details.`;
      promptInput.focus();
      adjustTextareaHeight(promptInput);
    });
  });
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

function renderTaskCards(tasks: any[], index: number): string {
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) return '';
  const taskCards = tasks.map(t => {
    const taskName = t.task || 'Task';
    const data = t.data || {};
    const entries = Object.entries(data);
    const paramPills = entries.map(([k, v]) => {
      const cleanKey = formatParamLabel(k);
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 12.5px; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-subtle); flex-wrap: wrap;">
          <span style="color: var(--text-secondary); font-weight: 500; flex: 1 1 200px; line-height: 1.4;">${escapeHtml(cleanKey)}:</span>
          <span style="color: var(--accent-cyan); font-family: monospace; font-size: 12.5px; font-weight: 600; background: hsla(185, 80%, 45%, 0.12); padding: 4px 10px; border-radius: 6px; border: 1px solid hsla(185, 80%, 45%, 0.25); white-space: nowrap; word-break: keep-all; flex-shrink: 0; max-width: 100%; overflow-x: auto;">${escapeHtml(String(v))}</span>
        </div>
      `;
    }).join('');

    return `
      <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 12px 14px; margin-top: 8px;">
        <div style="display: flex; align-items: center; gap: 8px; font-weight: 600; color: var(--text-primary); font-size: 13.5px; margin-bottom: 8px;">
          <span style="color: var(--accent-blue);">⚙️</span>
          <span>${escapeHtml(taskName)}</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${paramPills || '<div style="color: var(--text-tertiary); font-size: 12px;">No parameters required</div>'}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div style="margin-top: 10px;">
      <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-tertiary); font-weight: 600;">
        Configured Tasks (${tasks.length})
      </div>
      <div style="display: flex; flex-direction: column; gap: 6px;">
        ${taskCards}
      </div>
      <div class="task-action-bar" style="margin-top: 12px;">
        <button class="btn-execute-now" id="btnRunNow_${index}">
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
        const hasError = !!res.error;
        const statusClass = hasError ? 'error' : 'success';
        const statusText = hasError ? 'Failed' : 'Executed Successfully';

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

  // Attach dynamic "Run Tasks Now" button clicks
  state.messages.forEach((msg, index) => {
    let tasksToRun = msg.meta?.tasks;
    if ((!tasksToRun || tasksToRun.length === 0) && msg.content) {
      try {
        const trimmed = msg.content.trim();
        if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
          const parsed = JSON.parse(trimmed);
          const candidate = Array.isArray(parsed) ? parsed : [parsed];
          if (candidate.every(t => typeof t === 'object' && t !== null && 'task' in t)) {
            tasksToRun = candidate;
          }
        }
      } catch (e) {}
    }

    if (tasksToRun && tasksToRun.length > 0) {
      const btn = document.querySelector(`#btnRunNow_${index}`);
      if (btn) {
        btn.addEventListener('click', () => {
          executeTasks(tasksToRun!, false);
        });
      }
    }
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
