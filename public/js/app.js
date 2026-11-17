/**
 * Lógica Principal de la PWA "LoVo" — Cierre de Turno Nocturno
 * Estética Oficial Coctelería LoVo (Navy Blue #081933 + Gold #d3a548)
 */
(function () {
  const state = {
    user: {
      id: '',
      name: '',
      role: '' // 'empleado' | 'encargado'
    },
    tasks: [],
    shiftState: {
      id: 1,
      general_notes: '',
      closed_by: '',
      is_closed: false,
      closed_at: null
    },
    onlineUsers: [],
    filterStatus: 'all', // 'all' | 'pending' | 'mine' | 'completed'
    filterCategory: 'all',
    searchQuery: '',
    openNoteTaskIds: new Set(),
    connection: {
      mode: 'local',
      message: 'Conectando...'
    }
  };

  const dom = {};

  function cacheDom() {
    dom.roleScreen = document.getElementById('role-screen');
    dom.appScreen = document.getElementById('app-screen');
    dom.userNameInput = document.getElementById('user-name-input');
    dom.roleSelectButtons = document.querySelectorAll('[data-select-role]');
    dom.roleErrorMsg = document.getElementById('role-error-msg');

    // Cabecera y Estado
    dom.headerUserName = document.getElementById('header-user-name');
    dom.headerUserRoleBadge = document.getElementById('header-user-role-badge');
    dom.btnSwitchRole = document.getElementById('btn-switch-role');
    dom.connectionBadge = document.getElementById('connection-badge');
    dom.connectionText = document.getElementById('connection-text');
    dom.onlineCountBadge = document.getElementById('online-count-badge');
    dom.onlineUsersList = document.getElementById('online-users-list');

    // Progreso
    dom.progressText = document.getElementById('progress-text');
    dom.progressPercent = document.getElementById('progress-percent');
    dom.progressBarFill = document.getElementById('progress-bar-fill');
    dom.statCompleted = document.getElementById('stat-completed');
    dom.statPending = document.getElementById('stat-pending');
    dom.statUnassigned = document.getElementById('stat-unassigned');

    // Filtros y Búsqueda
    dom.filterStatusBtns = document.querySelectorAll('[data-filter-status]');
    dom.categoryPillsContainer = document.getElementById('category-pills');
    dom.searchInput = document.getElementById('task-search-input');

    // Lista de tareas
    dom.tasksContainer = document.getElementById('tasks-container');

    // Formulario de nueva tarea imprevista (Madrugada)
    dom.btnToggleAddTask = document.getElementById('btn-toggle-add-task');
    dom.addTaskDrawer = document.getElementById('add-task-drawer');
    dom.customTaskForm = document.getElementById('custom-task-form');
    dom.customTaskTitle = document.getElementById('custom-task-title');
    dom.customTaskCategory = document.getElementById('custom-task-category');
    dom.customTaskAssignee = document.getElementById('custom-task-assignee');
    dom.customTaskNotes = document.getElementById('custom-task-notes');

    // Panel Exclusivo del Encargado / Verificador
    dom.supervisorSection = document.getElementById('supervisor-section');
    dom.teamBreakdownList = document.getElementById('team-breakdown-list');
    dom.generalNotesInput = document.getElementById('general-notes-input');
    dom.notesSyncIndicator = document.getElementById('notes-sync-indicator');
    dom.closingTimestampDisplay = document.getElementById('closing-timestamp-display');
    dom.whatsappPreviewBox = document.getElementById('whatsapp-preview-box');
    dom.btnRegisterCloseTime = document.getElementById('btn-register-close-time');
    dom.btnSendWhatsapp = document.getElementById('btn-send-whatsapp');
    dom.btnCopyReport = document.getElementById('btn-copy-report');
    dom.btnResetShift = document.getElementById('btn-reset-shift');

    // Modales (QR y Configuración Supabase)
    dom.btnOpenQrModal = document.getElementById('btn-open-qr-modal');
    dom.qrModal = document.getElementById('qr-modal');
    dom.btnCloseQrModal = document.getElementById('btn-close-qr-modal');
    dom.qrImage = document.getElementById('qr-code-img');
    dom.qrUrlText = document.getElementById('qr-url-text');

    dom.btnOpenConfigModal = document.getElementById('btn-open-config-modal');
    dom.btnOpenConfigLogin = document.getElementById('btn-open-config-login');
    dom.installAppBtn = document.getElementById('install-app-btn');
    dom.configModal = document.getElementById('config-modal');
    dom.btnCloseConfigModal = document.getElementById('btn-close-config-modal');
    dom.configSupabaseUrl = document.getElementById('config-supabase-url');
    dom.configSupabaseKey = document.getElementById('config-supabase-key');
    dom.btnSaveConfig = document.getElementById('btn-save-config');

    // Toast
    dom.toastContainer = document.getElementById('toast-container');
  }

  let deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
  });

  // =========================================================================
  // INICIALIZACIÓN
  // =========================================================================
  async function initApp() {
    cacheDom();
    registerServiceWorker();
    loadSavedUserSession();
    bindGlobalEvents();

    window.lovoRealtime.on('onTaskRealtimeEvent', handleRealtimeTaskEvent);
    window.lovoRealtime.on('onTasksChanged', refreshAllData);
    window.lovoRealtime.on('onShiftStateChanged', handleRealtimeShiftState);
    window.lovoRealtime.on('onPresenceChanged', handlePresenceUpdate);
    window.lovoRealtime.on('onConnectionStatus', updateConnectionBadge);

    await window.lovoRealtime.init(state.user);
    await refreshAllData();

    if (state.user.name && state.user.role) {
      enterMainApp();
    }
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js?v=5')
        .then((reg) => {
          reg.update();
        })
        .catch((err) => {
          console.warn('Service Worker opcional no registrado:', err);
        });
    }
  }

  function loadSavedUserSession() {
    const savedId = localStorage.getItem('lovo_user_id') || `emp_${Math.random().toString(36).slice(2, 9)}`;
    const savedName = localStorage.getItem('lovo_user_name') || '';
    const savedRole = localStorage.getItem('lovo_user_role') || '';

    localStorage.setItem('lovo_user_id', savedId);
    state.user = {
      id: savedId,
      name: savedName,
      role: savedRole
    };

    if (dom.userNameInput && savedName) {
      dom.userNameInput.value = savedName;
    }
  }

  function saveUserSession(name, role) {
    state.user.name = name.trim();
    state.user.role = role;
    localStorage.setItem('lovo_user_name', state.user.name);
    localStorage.setItem('lovo_user_role', state.user.role);
    window.lovoRealtime.updatePresence(state.user);
  }

  async function refreshAllData() {
    try {
      const [tasks, shiftState] = await Promise.all([
        window.lovoRealtime.fetchAllTasks(),
        window.lovoRealtime.fetchShiftState()
      ]);

      state.tasks = sortTasks(tasks);
      state.shiftState = shiftState || state.shiftState;

      state.tasks.forEach((t) => {
        if (t.requires_note || (t.notes && t.notes.trim().length > 0)) {
          state.openNoteTaskIds.add(t.id);
        }
      });

      renderAll();
    } catch (err) {
      console.error('Error cargando datos:', err);
      showToast('Error al sincronizar tareas', 'error');
    }
  }

  function sortTasks(tasks) {
    return [...tasks].sort((a, b) => {
      if ((a.order_index || 100) !== (b.order_index || 100)) {
        return (a.order_index || 100) - (b.order_index || 100);
      }
      return new Date(a.created_at || 0) - new Date(b.created_at || 0);
    });
  }

  // =========================================================================
  // MANEJO DE EVENTOS EN TIEMPO REAL (SIN PISARSE ENTRE LOS 15 EMPLEADOS)
  // =========================================================================
  function handleRealtimeTaskEvent(payload) {
    const eventType = payload.eventType;
    const newRow = payload.new;
    const oldRow = payload.old;

    if (eventType === 'INSERT' && newRow) {
      const exists = state.tasks.some((t) => t.id === newRow.id);
      if (!exists) {
        state.tasks = sortTasks([...state.tasks, newRow]);
        if (newRow.requires_note || newRow.notes) {
          state.openNoteTaskIds.add(newRow.id);
        }
        renderAll();
        highlightTaskCard(newRow.id);
      }
    } else if (eventType === 'UPDATE' && newRow) {
      const idx = state.tasks.findIndex((t) => t.id === newRow.id);
      if (idx !== -1) {
        state.tasks[idx] = { ...state.tasks[idx], ...newRow };
      } else {
        state.tasks.push(newRow);
      }
      state.tasks = sortTasks(state.tasks);

      if (newRow.notes && newRow.notes.trim().length > 0) {
        state.openNoteTaskIds.add(newRow.id);
      }

      const activeEl = document.activeElement;
      const isEditingThisTask =
        activeEl &&
        activeEl.closest &&
        activeEl.closest(`[data-task-card="${newRow.id}"]`);

      if (isEditingThisTask) {
        updateProgressAndStats();
        renderSupervisorDashboard();
        syncSingleCardNonFocusedFields(newRow);
      } else {
        renderAll();
        highlightTaskCard(newRow.id);
      }
    } else if (eventType === 'DELETE' && oldRow) {
      state.tasks = state.tasks.filter((t) => t.id !== oldRow.id);
      renderAll();
    }
  }

  function syncSingleCardNonFocusedFields(task) {
    const card = document.querySelector(`[data-task-card="${task.id}"]`);
    if (!card) return;

    card.classList.toggle('task-card-completed', Boolean(task.is_completed));
    const checkbox = card.querySelector('[data-action="toggle-complete"]');
    if (checkbox) {
      checkbox.classList.toggle('checked', Boolean(task.is_completed));
    }

    const assigneeInput = card.querySelector('[data-field="assigned_to"]');
    if (assigneeInput && document.activeElement !== assigneeInput) {
      assigneeInput.value = task.assigned_to || '';
    }

    const noteInput = card.querySelector('[data-field="notes"]');
    if (noteInput && document.activeElement !== noteInput) {
      noteInput.value = task.notes || '';
    }
  }

  function highlightTaskCard(taskId) {
    requestAnimationFrame(() => {
      const card = document.querySelector(`[data-task-card="${taskId}"]`);
      if (card) {
        card.classList.remove('task-realtime-pulse');
        void card.offsetWidth;
        card.classList.add('task-realtime-pulse');
      }
    });
  }

  function handleRealtimeShiftState(newShiftState) {
    state.shiftState = { ...state.shiftState, ...newShiftState };
    if (dom.generalNotesInput && document.activeElement !== dom.generalNotesInput) {
      dom.generalNotesInput.value = state.shiftState.general_notes || '';
    }
    renderSupervisorDashboard();
  }

  function handlePresenceUpdate(onlineUsers) {
    state.onlineUsers = onlineUsers || [];
    if (dom.onlineCountBadge) {
      dom.onlineCountBadge.textContent = `${state.onlineUsers.length} en línea`;
    }
    if (dom.onlineUsersList) {
      dom.onlineUsersList.innerHTML = state.onlineUsers
        .map((u) => {
          const isBoss = u.role === 'encargado';
          return `
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
              isBoss
                ? 'bg-[#d3a548]/20 text-[#d3a548] border border-[#d3a548]/50'
                : 'bg-black/30 text-white/90 border border-white/15'
            }">
              <span class="w-2 h-2 rounded-full ${isBoss ? 'bg-[#d3a548]' : 'bg-[#10b981]'}"></span>
              ${escapeHtml(u.name || 'Compañero')}
              ${isBoss ? '<span class="text-[10px] uppercase tracking-wider text-[#d3a548] font-extrabold">(Encargado)</span>' : ''}
            </span>
          `;
        })
        .join('');
    }
  }

  function updateConnectionBadge(status) {
    state.connection = status;
    if (!dom.connectionBadge || !dom.connectionText) return;

    dom.connectionText.textContent = status.message;
    if (status.mode === 'supabase') {
      dom.connectionBadge.className = 'status-indicator text-[#10b981] border-[#10b981]/40';
    } else if (status.mode === 'local') {
      dom.connectionBadge.className = 'status-indicator text-[#d3a548] border-[#d3a548]/45 cursor-pointer';
    } else {
      dom.connectionBadge.className = 'status-indicator text-[#ef4444] border-[#ef4444]/45 cursor-pointer';
    }
  }

  // =========================================================================
  // PANTALLA DE SELECCIÓN DE ROL E INGRESO
  // =========================================================================
  function enterMainApp() {
    dom.roleScreen.classList.add('hidden');
    dom.appScreen.classList.remove('hidden');

    dom.headerUserName.textContent = state.user.name;
    const isEncargado = state.user.role === 'encargado';

    dom.headerUserRoleBadge.textContent = isEncargado ? 'Encargado / Verificador' : 'Empleado';
    dom.headerUserRoleBadge.className = isEncargado
      ? 'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#d3a548] text-[#081933]'
      : 'px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black/35 text-[#d3a548] border border-[#d3a548]/40';

    if (isEncargado) {
      dom.supervisorSection.classList.remove('hidden');
    } else {
      dom.supervisorSection.classList.add('hidden');
    }

    renderAll();
  }

  function showRoleSelectionScreen() {
    dom.userNameInput.value = state.user.name || '';
    dom.appScreen.classList.add('hidden');
    dom.roleScreen.classList.remove('hidden');
  }

  // =========================================================================
  // RENDERIZADO PRINCIPAL
  // =========================================================================
  function renderAll() {
    updateProgressAndStats();
    renderCategoryPills();
    renderTasksList();
    renderSupervisorDashboard();
  }

  function updateProgressAndStats() {
    const total = state.tasks.length;
    const completed = state.tasks.filter((t) => t.is_completed).length;
    const pending = total - completed;
    const unassigned = state.tasks.filter((t) => !t.assigned_to || !t.assigned_to.trim()).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    if (dom.progressText) dom.progressText.textContent = `${completed} de ${total} tareas completadas`;
    if (dom.progressPercent) dom.progressPercent.textContent = `${percent}%`;
    if (dom.progressBarFill) dom.progressBarFill.style.width = `${percent}%`;

    if (dom.statCompleted) dom.statCompleted.textContent = completed;
    if (dom.statPending) dom.statPending.textContent = pending;
    if (dom.statUnassigned) dom.statUnassigned.textContent = unassigned;
  }

  function renderCategoryPills() {
    if (!dom.categoryPillsContainer) return;
    const categories = ['all', ...new Set(state.tasks.map((t) => t.category || 'Operativa'))];

    dom.categoryPillsContainer.innerHTML = categories
      .map((cat) => {
        const active = state.filterCategory === cat;
        const label = cat === 'all' ? 'Todas las áreas' : cat;
        return `
          <button
            type="button"
            data-category-pill="${escapeHtml(cat)}"
            class="category-pill ${active ? 'active' : ''}"
          >
            ${escapeHtml(label)}
          </button>
        `;
      })
      .join('');
  }

  function getFilteredTasks() {
    return state.tasks.filter((task) => {
      if (state.filterStatus === 'pending' && task.is_completed) return false;
      if (state.filterStatus === 'completed' && !task.is_completed) return false;
      if (state.filterStatus === 'mine') {
        const myName = (state.user.name || '').toLowerCase().trim();
        const assigned = (task.assigned_to || '').toLowerCase().trim();
        if (!myName || !assigned.includes(myName)) return false;
      }

      if (state.filterCategory !== 'all' && task.category !== state.filterCategory) {
        return false;
      }

      if (state.searchQuery.trim()) {
        const q = state.searchQuery.toLowerCase().trim();
        const matchTitle = (task.title || '').toLowerCase().includes(q);
        const matchAssignee = (task.assigned_to || '').toLowerCase().includes(q);
        const matchNotes = (task.notes || '').toLowerCase().includes(q);
        if (!matchTitle && !matchAssignee && !matchNotes) return false;
      }

      return true;
    });
  }

  function renderTasksList() {
    if (!dom.tasksContainer) return;
    const filtered = getFilteredTasks();

    if (filtered.length === 0) {
      dom.tasksContainer.innerHTML = `
        <div class="lovo-glass rounded-2xl p-8 text-center">
          <p class="text-white/70 text-sm">No hay tareas que coincidan con este filtro.</p>
        </div>
      `;
      return;
    }

    const myName = (state.user.name || '').trim();

    dom.tasksContainer.innerHTML = filtered
      .map((task, index) => {
        const isCompleted = Boolean(task.is_completed);
        const assignedTo = (task.assigned_to || '').trim();
        const isAssignedToMe =
          myName && assignedTo.toLowerCase() === myName.toLowerCase();
        const isNoteOpen =
          state.openNoteTaskIds.has(task.id) ||
          Boolean(task.requires_note) ||
          Boolean(task.notes && task.notes.trim());

        const completedTimeStr = task.completed_at
          ? new Date(task.completed_at).toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit'
            })
          : '';

        return `
          <article
            data-task-card="${task.id}"
            class="lovo-glass rounded-2xl p-4 transition-all duration-200 ${
              isCompleted ? 'task-card-completed' : 'hover:border-[#d3a548]'
            }"
          >
            <!-- Fila Superior: Checkbox + Título + Categoría -->
            <div class="flex items-start gap-3.5">
              <button
                type="button"
                data-action="toggle-complete"
                data-task-id="${task.id}"
                aria-label="Marcar tarea como completada"
                class="lovo-checkbox mt-0.5 ${isCompleted ? 'checked' : ''}"
              >
                ${
                  isCompleted
                    ? `<svg class="w-4 h-4 text-[#081933] stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                       </svg>`
                    : ''
                }
              </button>

              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <span class="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                    task.is_custom
                      ? 'bg-[#d3a548]/25 text-[#f0ca75] border border-[#d3a548]/50'
                      : 'bg-black/30 text-[#d3a548] border border-[#d3a548]/30'
                  }">
                    ${escapeHtml(task.category || 'Operativa')}
                    ${task.is_custom ? ' • Imprevisto' : ''}
                  </span>

                  <div class="flex items-center gap-1.5">
                    ${
                      completedTimeStr
                        ? `<span class="text-[11px] text-[#10b981] font-bold flex items-center gap-1">
                             <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                             </svg>
                             ${completedTimeStr}
                           </span>`
                        : `<span class="text-[11px] text-white/50 font-mono">#${task.order_index <= 20 ? task.order_index : index + 1}</span>`
                    }

                    ${
                      task.is_custom
                        ? `<button
                             type="button"
                             data-action="delete-custom"
                             data-task-id="${task.id}"
                             title="Eliminar tarea personalizada"
                             class="text-white/50 hover:text-[#ef4444] p-1 rounded-lg transition"
                           >
                             <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                             </svg>
                           </button>`
                        : ''
                    }
                  </div>
                </div>

                <h3
                  data-action="toggle-complete"
                  data-task-id="${task.id}"
                  class="item-name text-base font-bold leading-snug cursor-pointer select-none ${
                    isCompleted ? 'line-through text-white/50' : 'text-white'
                  }"
                >
                  ${escapeHtml(task.title)}
                </h3>
              </div>
            </div>

            <!-- Fila Intermedia: Asignación de Responsable en Tiempo Real -->
            <div class="mt-3.5 pt-3 border-t border-white/10 flex flex-wrap items-center gap-2">
              <div class="relative flex-1 min-w-[170px]">
                <span class="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[#d3a548]">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                </span>
                <input
                  type="text"
                  data-field="assigned_to"
                  data-task-id="${task.id}"
                  value="${escapeHtml(assignedTo)}"
                  placeholder="Sin responsable asignado..."
                  aria-label="Responsable de la tarea"
                  class="lovo-input w-full pl-8 pr-3 py-1.5 text-xs ${
                    assignedTo ? 'border-[#d3a548]/60 text-[#f0ca75] font-semibold' : ''
                  }"
                />
              </div>

              <!-- Botón rápido "Yo me encargo" -->
              <button
                type="button"
                data-action="claim-task"
                data-task-id="${task.id}"
                class="px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                  isAssignedToMe
                    ? 'bg-[#d3a548] text-[#081933] shadow'
                    : 'bg-black/30 hover:bg-black/50 text-[#d3a548] border border-[#d3a548]/50'
                }"
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"/>
                </svg>
                ${isAssignedToMe ? 'Asignada a mí' : 'Yo me encargo'}
              </button>

              <!-- Botón para desplegar/ocultar nota -->
              <button
                type="button"
                data-action="toggle-note"
                data-task-id="${task.id}"
                class="px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1 ${
                  task.notes && task.notes.trim()
                    ? 'bg-[#d3a548]/20 text-[#d3a548] border-[#d3a548]/50'
                    : 'bg-black/25 text-white/70 border-white/15 hover:text-white'
                }"
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
                Nota
              </button>
            </div>

            <!-- Área de Notas / Incidencias por Tarea -->
            <div
              id="note-box-${task.id}"
              class="${isNoteOpen ? 'mt-2.5' : 'hidden mt-2.5'}"
            >
              <textarea
                rows="2"
                data-field="notes"
                data-task-id="${task.id}"
                placeholder="${
                  task.requires_note
                    ? 'Escribe aquí el detalle obligatorio o incidencias de esta tarea...'
                    : 'Añadir nota o incidencia en tiempo real...'
                }"
                class="lovo-input w-full px-3 py-2 text-xs resize-none"
              >${escapeHtml(task.notes || '')}</textarea>
            </div>
          </article>
        `;
      })
      .join('');
  }

  // =========================================================================
  // PANEL DE SUPERVISIÓN DEL ENCARGADO Y GENERADOR DE WHATSAPP
  // =========================================================================
  function renderSupervisorDashboard() {
    if (state.user.role !== 'encargado') return;

    const mapByEmployee = {};
    state.tasks.forEach((t) => {
      const person = (t.assigned_to || '').trim();
      if (!person) return;
      if (!mapByEmployee[person]) {
        mapByEmployee[person] = { total: 0, completed: 0 };
      }
      mapByEmployee[person].total += 1;
      if (t.is_completed) mapByEmployee[person].completed += 1;
    });

    const entries = Object.entries(mapByEmployee);
    if (dom.teamBreakdownList) {
      if (entries.length === 0) {
        dom.teamBreakdownList.innerHTML = `
          <p class="text-xs text-white/65 italic">Aún no hay empleados asignados a tareas en este turno.</p>
        `;
      } else {
        dom.teamBreakdownList.innerHTML = entries
          .map(([person, stats]) => {
            const allDone = stats.completed === stats.total;
            return `
              <div class="flex items-center justify-between px-3 py-2 rounded-xl bg-black/30 border border-[#d3a548]/25">
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full ${allDone ? 'bg-[#10b981]' : 'bg-[#d3a548]'}"></span>
                  <span class="text-xs font-bold text-white">${escapeHtml(person)}</span>
                </div>
                <span class="text-xs font-mono ${allDone ? 'text-[#10b981] font-extrabold' : 'text-[#d3a548] font-bold'}">
                  ${stats.completed}/${stats.total} hechas
                </span>
              </div>
            `;
          })
          .join('');
      }
    }

    if (dom.closingTimestampDisplay) {
      if (state.shiftState.closed_at) {
        const dt = new Date(state.shiftState.closed_at);
        dom.closingTimestampDisplay.textContent = formatDateTimeEs(dt);
        dom.closingTimestampDisplay.className = 'text-xs font-mono text-[#10b981] font-bold';
      } else {
        dom.closingTimestampDisplay.textContent =
          'Se registrará automáticamente al pulsar "Cerrar Turno y Enviar WhatsApp"';
        dom.closingTimestampDisplay.className = 'text-xs text-[#d3a548] italic';
      }
    }

    if (dom.generalNotesInput && document.activeElement !== dom.generalNotesInput) {
      dom.generalNotesInput.value = state.shiftState.general_notes || '';
    }

    if (dom.whatsappPreviewBox) {
      dom.whatsappPreviewBox.textContent = buildWhatsAppReportText(
        state.shiftState.closed_at ? new Date(state.shiftState.closed_at) : new Date()
      );
    }
  }

  function formatDateTimeEs(dateObj) {
    return dateObj.toLocaleString('es-ES', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  function buildWhatsAppReportText(closingDate) {
    const dtStr = formatDateTimeEs(closingDate || new Date());
    const completed = state.tasks.filter((t) => t.is_completed).length;
    const total = state.tasks.length;
    const supervisorName = state.user.name || state.shiftState.closed_by || 'Encargado';
    const generalNotes = (
      (dom.generalNotesInput && dom.generalNotesInput.value) ||
      state.shiftState.general_notes ||
      ''
    ).trim();

    const lines = [];
    lines.push(`🍸 *REPORTE OFICIAL DE CIERRE — LoVo* 🍸`);
    lines.push(`📅 *Fecha y Hora:* ${dtStr}`);
    lines.push(`👤 *Verificador / Encargado:* ${supervisorName}`);
    lines.push(`📊 *Estado General:* ${completed}/${total} tareas completadas`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`📋 *DETALLE DE TAREAS Y RESPONSABLES:*`);

    state.tasks.forEach((t, idx) => {
      const icon = t.is_completed ? '✅' : '❌';
      const who = (t.assigned_to || '').trim() || 'Sin asignar';
      const note = (t.notes || '').trim();
      let line = `${idx + 1}. ${icon} *${t.title}* — 👤 _${who}_`;
      if (note) {
        line += `\n   📝 Nota: ${note}`;
      }
      lines.push(line);
    });

    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`🗒️ *OBSERVACIONES DEL ENCARGADO (Cajas / Incidencias):*`);
    lines.push(generalNotes ? generalNotes : 'Sin incidencias adicionales registradas.');
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`🔒 *Cierre verificado en tiempo real — Coctelería LoVo*`);

    return lines.join('\n');
  }

  // =========================================================================
  // INTERACCIONES Y EVENTOS DEL USUARIO
  // =========================================================================
  let debounceTimers = {};

  function debounceTaskFieldUpdate(taskId, field, value) {
    const key = `${taskId}_${field}`;
    clearTimeout(debounceTimers[key]);
    debounceTimers[key] = setTimeout(async () => {
      try {
        await window.lovoRealtime.updateTaskFields(taskId, { [field]: value });
        renderSupervisorDashboard();
      } catch (err) {
        console.error('Error guardando campo en tiempo real:', err);
      }
    }, 320);
  }

  function bindGlobalEvents() {
    dom.roleSelectButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const role = btn.getAttribute('data-select-role');
        const name = (dom.userNameInput.value || '').trim();
        if (!name) {
          dom.roleErrorMsg.classList.remove('hidden');
          dom.userNameInput.focus();
          return;
        }
        dom.roleErrorMsg.classList.add('hidden');
        saveUserSession(name, role);
        enterMainApp();
        showToast(`¡CHEERS, ${name}! (${role === 'encargado' ? 'Encargado' : 'Empleado'})`);
      });
    });

    if (dom.btnSwitchRole) {
      dom.btnSwitchRole.addEventListener('click', showRoleSelectionScreen);
    }

    dom.filterStatusBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        state.filterStatus = btn.getAttribute('data-filter-status');
        dom.filterStatusBtns.forEach((b) => {
          const isSelected = b.getAttribute('data-filter-status') === state.filterStatus;
          b.className = isSelected
            ? 'flex-1 py-2 px-3 rounded-lg text-xs font-bold bg-[#d3a548] text-[#081933] shadow transition'
            : 'flex-1 py-2 px-3 rounded-lg text-xs font-semibold text-white/70 hover:text-white transition';
        });
        renderTasksList();
      });
    });

    if (dom.categoryPillsContainer) {
      dom.categoryPillsContainer.addEventListener('click', (e) => {
        const pill = e.target.closest('[data-category-pill]');
        if (!pill) return;
        state.filterCategory = pill.getAttribute('data-category-pill');
        renderCategoryPills();
        renderTasksList();
      });
    }

    if (dom.searchInput) {
      dom.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value || '';
        renderTasksList();
      });
    }

    if (dom.tasksContainer) {
      dom.tasksContainer.addEventListener('click', async (e) => {
        const actionEl = e.target.closest('[data-action]');
        if (!actionEl) return;

        const action = actionEl.getAttribute('data-action');
        const taskId = actionEl.getAttribute('data-task-id');
        const task = state.tasks.find((t) => t.id === taskId);
        if (!task) return;

        if (action === 'toggle-complete') {
          const nextCompleted = !task.is_completed;
          const nowIso = nextCompleted ? new Date().toISOString() : null;
          const nextAssignee =
            nextCompleted && (!task.assigned_to || !task.assigned_to.trim())
              ? state.user.name
              : task.assigned_to;

          task.is_completed = nextCompleted;
          task.completed_at = nowIso;
          task.assigned_to = nextAssignee;
          task.completed_by = nextCompleted ? state.user.name : '';
          renderAll();

          try {
            await window.lovoRealtime.updateTaskFields(taskId, {
              is_completed: nextCompleted,
              completed_at: nowIso,
              assigned_to: nextAssignee,
              completed_by: nextCompleted ? state.user.name : ''
            });
          } catch (_err) {
            showToast('No se pudo actualizar la tarea', 'error');
          }
        } else if (action === 'claim-task') {
          const myName = (state.user.name || '').trim();
          if (!myName) {
            showRoleSelectionScreen();
            return;
          }
          task.assigned_to = myName;
          renderAll();
          try {
            await window.lovoRealtime.updateTaskFields(taskId, { assigned_to: myName });
            showToast(`Tarea asignada a ${myName}`);
          } catch (_err) {
            showToast('Error al reclamar la tarea', 'error');
          }
        } else if (action === 'toggle-note') {
          if (state.openNoteTaskIds.has(taskId)) {
            state.openNoteTaskIds.delete(taskId);
          } else {
            state.openNoteTaskIds.add(taskId);
          }
          const noteBox = document.getElementById(`note-box-${taskId}`);
          if (noteBox) {
            noteBox.classList.toggle('hidden');
            if (!noteBox.classList.contains('hidden')) {
              const textarea = noteBox.querySelector('textarea');
              if (textarea) textarea.focus();
            }
          }
        } else if (action === 'delete-custom') {
          if (!confirm(`¿Eliminar la tarea personalizada "${task.title}"?`)) return;
          state.tasks = state.tasks.filter((t) => t.id !== taskId);
          renderAll();
          await window.lovoRealtime.deleteCustomTask(taskId);
          showToast('Tarea personalizada eliminada');
        }
      });

      dom.tasksContainer.addEventListener('input', (e) => {
        const fieldEl = e.target.closest('[data-field]');
        if (!fieldEl) return;
        const field = fieldEl.getAttribute('data-field');
        const taskId = fieldEl.getAttribute('data-task-id');
        const value = fieldEl.value;

        const task = state.tasks.find((t) => t.id === taskId);
        if (task) {
          task[field] = value;
          updateProgressAndStats();
        }
        debounceTaskFieldUpdate(taskId, field, value);
      });
    }

    if (dom.btnToggleAddTask && dom.addTaskDrawer) {
      dom.btnToggleAddTask.addEventListener('click', () => {
        dom.addTaskDrawer.classList.toggle('hidden');
        if (!dom.addTaskDrawer.classList.contains('hidden')) {
          dom.customTaskAssignee.value = state.user.name || '';
          dom.customTaskTitle.focus();
        }
      });
    }

    if (dom.customTaskForm) {
      dom.customTaskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = (dom.customTaskTitle.value || '').trim();
        if (!title) return;

        const category = dom.customTaskCategory.value || 'Imprevistos Madrugada';
        const assigned_to = (dom.customTaskAssignee.value || state.user.name || '').trim();
        const notes = (dom.customTaskNotes.value || '').trim();

        try {
          const created = await window.lovoRealtime.createCustomTask({
            title,
            category,
            assigned_to,
            notes
          });
          if (!state.tasks.some((t) => t.id === created.id)) {
            state.tasks.push(created);
            if (created.notes) state.openNoteTaskIds.add(created.id);
          }
          dom.customTaskTitle.value = '';
          dom.customTaskNotes.value = '';
          dom.addTaskDrawer.classList.add('hidden');
          renderAll();
          showToast('Tarea imprevista añadida en tiempo real');
        } catch (_err) {
          showToast('No se pudo añadir la tarea', 'error');
        }
      });
    }

    if (dom.generalNotesInput) {
      let shiftNotesTimer = null;
      dom.generalNotesInput.addEventListener('input', (e) => {
        const val = e.target.value;
        state.shiftState.general_notes = val;
        if (dom.whatsappPreviewBox) {
          dom.whatsappPreviewBox.textContent = buildWhatsAppReportText(
            state.shiftState.closed_at ? new Date(state.shiftState.closed_at) : new Date()
          );
        }
        if (dom.notesSyncIndicator) {
          dom.notesSyncIndicator.textContent = 'Sincronizando...';
        }
        clearTimeout(shiftNotesTimer);
        shiftNotesTimer = setTimeout(async () => {
          await window.lovoRealtime.updateShiftState({ general_notes: val });
          if (dom.notesSyncIndicator) {
            dom.notesSyncIndicator.textContent = 'Guardado en tiempo real ✓';
          }
        }, 350);
      });
    }

    if (dom.btnRegisterCloseTime) {
      dom.btnRegisterCloseTime.addEventListener('click', async () => {
        const nowIso = new Date().toISOString();
        state.shiftState.closed_at = nowIso;
        state.shiftState.closed_by = state.user.name || 'Encargado';
        state.shiftState.is_closed = true;
        await window.lovoRealtime.updateShiftState({
          closed_at: nowIso,
          closed_by: state.shiftState.closed_by,
          is_closed: true
        });
        renderSupervisorDashboard();
        showToast('Hora exacta de cierre registrada oficialmente');
      });
    }

    if (dom.btnSendWhatsapp) {
      dom.btnSendWhatsapp.addEventListener('click', async () => {
        const closingDate = new Date();
        const nowIso = closingDate.toISOString();
        const generalNotes = (dom.generalNotesInput?.value || state.shiftState.general_notes || '').trim();

        state.shiftState.closed_at = nowIso;
        state.shiftState.closed_by = state.user.name || 'Encargado';
        state.shiftState.is_closed = true;
        state.shiftState.general_notes = generalNotes;

        try {
          await window.lovoRealtime.updateShiftState({
            closed_at: nowIso,
            closed_by: state.shiftState.closed_by,
            general_notes: generalNotes,
            is_closed: true
          });
          await window.lovoRealtime.recordShiftHistory({
            closedBy: state.shiftState.closed_by,
            generalNotes,
            tasks: state.tasks
          });
        } catch (err) {
          console.warn('Error guardando histórico:', err);
        }

        renderSupervisorDashboard();

        const reportText = buildWhatsAppReportText(closingDate);
        const phone = (window.LoVoConfig.WHATSAPP_PHONE || '34678146956').replace(/\D/g, '');
        const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(reportText)}`;
        window.open(waUrl, '_blank', 'noopener,noreferrer');
      });
    }

    if (dom.btnCopyReport) {
      dom.btnCopyReport.addEventListener('click', async () => {
        const text = buildWhatsAppReportText(
          state.shiftState.closed_at ? new Date(state.shiftState.closed_at) : new Date()
        );
        try {
          await navigator.clipboard.writeText(text);
          showToast('Reporte copiado al portapapeles');
        } catch (_err) {
          showToast('No se pudo copiar automáticamente', 'error');
        }
      });
    }

    if (dom.btnResetShift) {
      dom.btnResetShift.addEventListener('click', async () => {
        const ok = confirm(
          '¿Iniciar un NUEVO TURNO nocturno en LoVo?\n\nTodas las marcas de completado, responsables y notas volverán a su estado inicial para la nueva noche.'
        );
        if (!ok) return;

        await window.lovoRealtime.resetShift();
        state.openNoteTaskIds.clear();
        await refreshAllData();
        showToast('Turno reiniciado para una nueva noche');
      });
    }

    if (dom.btnOpenQrModal && dom.qrModal) {
      dom.btnOpenQrModal.addEventListener('click', () => {
        const currentUrl = window.location.origin;
        dom.qrUrlText.textContent = currentUrl;
        dom.qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&color=081933&bgcolor=F0CA75&data=${encodeURIComponent(
          currentUrl
        )}`;
        dom.qrModal.classList.remove('hidden');
      });
    }
    if (dom.btnCloseQrModal) {
      dom.btnCloseQrModal.addEventListener('click', () => dom.qrModal.classList.add('hidden'));
    }

    if (dom.btnOpenConfigModal && dom.configModal) {
      dom.btnOpenConfigModal.addEventListener('click', () => {
        dom.configSupabaseUrl.value = window.LoVoConfig.SUPABASE_URL || '';
        dom.configSupabaseKey.value = window.LoVoConfig.SUPABASE_ANON_KEY || '';
        dom.configModal.classList.remove('hidden');
      });
    }
    if (dom.btnOpenConfigLogin && dom.configModal) {
      dom.btnOpenConfigLogin.addEventListener('click', () => {
        dom.configSupabaseUrl.value = window.LoVoConfig.SUPABASE_URL || '';
        dom.configSupabaseKey.value = window.LoVoConfig.SUPABASE_ANON_KEY || '';
        dom.configModal.classList.remove('hidden');
      });
    }
    if (dom.installAppBtn) {
      dom.installAppBtn.addEventListener('click', async () => {
        if (deferredInstallPrompt) {
          deferredInstallPrompt.prompt();
          await deferredInstallPrompt.userChoice;
          deferredInstallPrompt = null;
        } else {
          showToast('En iPhone/Android: pulsa Compartir o Menú ⋮ → "Añadir a pantalla de inicio"');
        }
      });
    }
    if (dom.connectionBadge) {
      dom.connectionBadge.addEventListener('click', () => {
        dom.configSupabaseUrl.value = window.LoVoConfig.SUPABASE_URL || '';
        dom.configSupabaseKey.value = window.LoVoConfig.SUPABASE_ANON_KEY || '';
        dom.configModal.classList.remove('hidden');
      });
    }
    if (dom.btnCloseConfigModal) {
      dom.btnCloseConfigModal.addEventListener('click', () => dom.configModal.classList.add('hidden'));
    }
    if (dom.btnSaveConfig) {
      dom.btnSaveConfig.addEventListener('click', async () => {
        const url = dom.configSupabaseUrl.value.trim();
        const key = dom.configSupabaseKey.value.trim();
        window.LoVoConfig.saveManualCredentials(url, key);
        dom.configModal.classList.add('hidden');
        await window.lovoRealtime.init(state.user);
        await refreshAllData();
        showToast(url && key ? 'Conectado a Supabase' : 'Modo Local activado');
      });
    }
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showToast(message, type = 'success') {
    if (!dom.toastContainer) return;
    const toast = document.createElement('div');
    const isErr = type === 'error';
    toast.className = `px-4 py-2.5 rounded-full text-xs font-bold shadow-lg backdrop-blur-md transition-all duration-300 flex items-center justify-center gap-2 ${
      isErr
        ? 'bg-[#ef4444] text-white'
        : 'bg-[#d3a548] text-[#081933] shadow-[#d3a548]/40'
    }`;
    toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
    dom.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2600);
  }

  document.addEventListener('DOMContentLoaded', initApp);
})();
