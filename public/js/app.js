/**
 * Lógica Principal de la PWA "LoVo" — Cierre de Turno Nocturno (v6)
 * Incluye:
 *  - Punto 1: PIN de seguridad para el Rol Encargado
 *  - Punto 3: Fotos de verificación desde cámara comprimidas en tiempo real
 *  - Punto 5: Selector rápido de empleados en 1 toque + Gestión de plantilla
 *  - Punto 6: Animación "CHEERS!" (Login y 100% completado) + Historial de cierres
 *  - Permisos: Solo el Encargado puede agregar o quitar tareas de la lista
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
      closed_at: null,
      team_members: [],
      supervisor_pin: '1234'
    },
    history: [],
    onlineUsers: [],
    filterStatus: 'all', // 'all' | 'pending' | 'mine' | 'completed'
    filterCategory: 'all',
    searchQuery: '',
    openNoteTaskIds: new Set(),
    activeCameraTaskId: null,
    activePhotoModalTaskId: null,
    celebrated100: false,
    connection: {
      mode: 'local',
      message: 'Conectando...'
    }
  };

  const dom = {};

  function cacheDom() {
    dom.roleScreen = document.getElementById('role-screen');
    dom.appScreen = document.getElementById('app-screen');
    dom.loginFormWrapper = document.getElementById('login-form-wrapper');
    dom.loginCheersBox = document.getElementById('login-cheers-box');
    dom.cheersUserName = document.getElementById('cheers-user-name');
    dom.cheersUserRole = document.getElementById('cheers-user-role');

    dom.quickEmployeeChips = document.getElementById('quick-employee-chips');
    dom.teamMembersDatalist = document.getElementById('team-members-datalist');
    dom.userNameInput = document.getElementById('user-name-input');
    dom.supervisorPinGroup = document.getElementById('supervisor-pin-group');
    dom.supervisorPinInput = document.getElementById('supervisor-pin-input');
    dom.roleSelectButtons = document.querySelectorAll('[data-select-role]');
    dom.roleErrorMsg = document.getElementById('role-error-msg');

    // Cámara oculta y Modal de Foto (Punto 3)
    dom.hiddenCameraInput = document.getElementById('hidden-camera-input');
    dom.photoModal = document.getElementById('photo-modal');
    dom.photoModalTitle = document.getElementById('photo-modal-title');
    dom.photoModalImg = document.getElementById('photo-modal-img');
    dom.btnClosePhotoModal = document.getElementById('btn-close-photo-modal');
    dom.btnClosePhotoModalBottom = document.getElementById('btn-close-photo-modal-bottom');
    dom.btnDeletePhoto = document.getElementById('btn-delete-photo');

    // Modal Celebración 100% (Punto 6)
    dom.cheers100Modal = document.getElementById('cheers-100-modal');
    dom.btnCloseCheers100 = document.getElementById('btn-close-cheers-100');

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
    dom.statPhotos = document.getElementById('stat-photos');

    // Filtros y Búsqueda
    dom.filterStatusBtns = document.querySelectorAll('[data-filter-status]');
    dom.categoryPillsContainer = document.getElementById('category-pills');
    dom.searchInput = document.getElementById('task-search-input');

    // Lista de tareas
    dom.tasksContainer = document.getElementById('tasks-container');

    // Formulario de Agregar Tarea (Exclusivo Encargado)
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
    dom.supervisorTeamChips = document.getElementById('supervisor-team-chips');
    dom.addTeamMemberForm = document.getElementById('add-team-member-form');
    dom.newTeamMemberInput = document.getElementById('new-team-member-input');
    dom.changeSupervisorPinInput = document.getElementById('change-supervisor-pin-input');
    dom.btnSaveSupervisorPin = document.getElementById('btn-save-supervisor-pin');
    dom.generalNotesInput = document.getElementById('general-notes-input');
    dom.notesSyncIndicator = document.getElementById('notes-sync-indicator');
    dom.closingTimestampDisplay = document.getElementById('closing-timestamp-display');
    dom.whatsappPreviewBox = document.getElementById('whatsapp-preview-box');
    dom.btnRegisterCloseTime = document.getElementById('btn-register-close-time');
    dom.btnSendWhatsapp = document.getElementById('btn-send-whatsapp');
    dom.btnCopyReport = document.getElementById('btn-copy-report');
    dom.btnResetShift = document.getElementById('btn-reset-shift');
    dom.shiftHistoryList = document.getElementById('shift-history-list');

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
      enterMainApp(false);
    }
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js?v=6')
        .then((reg) => reg.update())
        .catch((err) => console.warn('Service Worker opcional no registrado:', err));
    }
  }

  function loadSavedUserSession() {
    const savedId =
      localStorage.getItem('lovo_user_id') || `emp_${Math.random().toString(36).slice(2, 9)}`;
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

  function getTeamMembers() {
    const list = state.shiftState?.team_members;
    if (Array.isArray(list) && list.length > 0) {
      return list;
    }
    const localSaved = localStorage.getItem('lovo_team_members');
    if (localSaved) {
      try {
        const parsed = JSON.parse(localSaved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (_e) {}
    }
    return window.LoVoConfig.DEFAULT_TEAM_MEMBERS || [];
  }

  function getActiveSupervisorPin() {
    const fromShift = state.shiftState?.supervisor_pin;
    const fromLocal = localStorage.getItem('lovo_supervisor_pin');
    return String(fromShift || fromLocal || window.LoVoConfig.SUPERVISOR_PIN || '1234').trim();
  }

  async function refreshAllData() {
    try {
      const [tasks, shiftState, history] = await Promise.all([
        window.lovoRealtime.fetchAllTasks(),
        window.lovoRealtime.fetchShiftState(),
        window.lovoRealtime.fetchShiftHistory()
      ]);

      // Recuperar fotos de respaldo local si alguna se guardó antes de migrar SQL
      const enrichedTasks = (tasks || []).map((t) => {
        const fallbackPhoto = localStorage.getItem(`lovo_photo_${t.id}`) || '';
        return {
          ...t,
          photo_url: t.photo_url || fallbackPhoto
        };
      });

      state.tasks = sortTasks(enrichedTasks);
      state.shiftState = { ...state.shiftState, ...(shiftState || {}) };
      state.history = history || [];

      state.tasks.forEach((t) => {
        if (t.requires_note || (t.notes && t.notes.trim().length > 0)) {
          state.openNoteTaskIds.add(t.id);
        }
      });

      renderQuickEmployeeSelectors();
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
  // PUNTO 5: SELECTOR RÁPIDO DE EMPLEADOS HABITUALES
  // =========================================================================
  function renderQuickEmployeeSelectors() {
    const members = getTeamMembers();
    const currentName = (dom.userNameInput?.value || state.user.name || '').trim().toLowerCase();

    if (dom.quickEmployeeChips) {
      dom.quickEmployeeChips.innerHTML = members
        .map((name) => {
          const isSelected = currentName === name.toLowerCase();
          return `
            <button
              type="button"
              data-quick-name="${escapeHtml(name)}"
              class="px-2.5 py-1 rounded-full text-xs font-bold transition ${
                isSelected
                  ? 'bg-[#d3a548] text-[#081933] shadow'
                  : 'bg-black/35 text-white/85 border border-[#d3a548]/35 hover:border-[#d3a548]'
              }"
            >
              ${escapeHtml(name)}
            </button>
          `;
        })
        .join('');
    }

    if (dom.teamMembersDatalist) {
      dom.teamMembersDatalist.innerHTML = members
        .map((name) => `<option value="${escapeHtml(name)}"></option>`)
        .join('');
    }
  }

  // =========================================================================
  // MANEJO DE EVENTOS EN TIEMPO REAL
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
    renderQuickEmployeeSelectors();
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
      dom.connectionBadge.className =
        'status-indicator text-[#d3a548] border-[#d3a548]/45 cursor-pointer';
    } else {
      dom.connectionBadge.className =
        'status-indicator text-[#ef4444] border-[#ef4444]/45 cursor-pointer';
    }
  }

  // =========================================================================
  // PANTALLA DE SELECCIÓN DE ROL + ANIMACIÓN "CHEERS!" (PUNTO 1 y PUNTO 6)
  // =========================================================================
  function enterMainApp(withCheersAnimation = true) {
    const isEncargado = state.user.role === 'encargado';

    const finalizeEnter = () => {
      dom.roleScreen.classList.add('hidden');
      dom.loginFormWrapper.classList.remove('hidden');
      dom.loginCheersBox.classList.add('hidden');
      dom.appScreen.classList.remove('hidden');

      dom.headerUserName.textContent = state.user.name;
      dom.headerUserRoleBadge.textContent = isEncargado ? 'Encargado / Verificador' : 'Empleado';
      dom.headerUserRoleBadge.className = isEncargado
        ? 'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#d3a548] text-[#081933]'
        : 'px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black/35 text-[#d3a548] border border-[#d3a548]/40';

      // EXCLUSIVO ENCARGADO: Botón Agregar Tarea y Panel de Supervisión
      if (isEncargado) {
        dom.supervisorSection.classList.remove('hidden');
        dom.btnToggleAddTask.classList.remove('hidden');
        dom.btnToggleAddTask.classList.add('flex');
      } else {
        dom.supervisorSection.classList.add('hidden');
        dom.btnToggleAddTask.classList.add('hidden');
        dom.btnToggleAddTask.classList.remove('flex');
        dom.addTaskDrawer.classList.add('hidden');
      }

      renderAll();
    };

    if (withCheersAnimation && dom.loginCheersBox && dom.loginFormWrapper) {
      dom.cheersUserName.textContent = state.user.name;
      dom.cheersUserRole.textContent = isEncargado
        ? 'Acceso Verificado como Encargado 🛡️'
        : 'Acceso de Equipo activado en tiempo real';
      dom.loginFormWrapper.classList.add('hidden');
      dom.loginCheersBox.classList.remove('hidden');
      if (navigator.vibrate) navigator.vibrate(40);
      setTimeout(finalizeEnter, 950);
    } else {
      finalizeEnter();
    }
  }

  function showRoleSelectionScreen() {
    dom.userNameInput.value = state.user.name || '';
    dom.supervisorPinInput.value = '';
    dom.supervisorPinGroup.classList.add('hidden');
    dom.roleErrorMsg.classList.add('hidden');
    renderQuickEmployeeSelectors();
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
    const photosCount = state.tasks.filter((t) => t.photo_url && t.photo_url.trim().length > 0).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    if (dom.progressText) dom.progressText.textContent = `${completed} de ${total} tareas completadas`;
    if (dom.progressPercent) dom.progressPercent.textContent = `${percent}%`;
    if (dom.progressBarFill) dom.progressBarFill.style.width = `${percent}%`;

    if (dom.statCompleted) dom.statCompleted.textContent = completed;
    if (dom.statPending) dom.statPending.textContent = pending;
    if (dom.statUnassigned) dom.statUnassigned.textContent = unassigned;
    if (dom.statPhotos) dom.statPhotos.textContent = photosCount;

    // Punto 6: Si se alcanza el 100% de tareas completadas, lanzar "¡CHEERS!"
    if (total > 0 && completed === total && !state.celebrated100) {
      state.celebrated100 = true;
      if (dom.cheers100Modal) {
        dom.cheers100Modal.classList.remove('hidden');
      }
      if (navigator.vibrate) {
        navigator.vibrate([80, 50, 120]);
      }
    } else if (completed < total) {
      state.celebrated100 = false;
    }
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
    const isEncargado = state.user.role === 'encargado';

    dom.tasksContainer.innerHTML = filtered
      .map((task, index) => {
        const isCompleted = Boolean(task.is_completed);
        const assignedTo = (task.assigned_to || '').trim();
        const hasPhoto = Boolean(task.photo_url && task.photo_url.trim().length > 0);
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
            <!-- Fila Superior: Checkbox + Título + Categoría + Botón Quitar (SOLO ENCARGADO) -->
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
                    ${task.is_custom ? ' • Añadida' : ''}
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
                      /* EXCLUSIVO ENCARGADO: Quitar cualquier tarea */
                      isEncargado
                        ? `<button
                             type="button"
                             data-action="delete-task"
                             data-task-id="${task.id}"
                             title="Quitar tarea de la lista (Exclusivo Encargado)"
                             class="text-white/55 hover:text-[#ef4444] px-1.5 py-0.5 rounded-lg border border-transparent hover:border-[#ef4444]/40 text-[11px] font-semibold transition flex items-center gap-0.5"
                           >
                             <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                             </svg>
                             <span class="hidden sm:inline">Quitar</span>
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

            <!-- Fila Intermedia: Asignación de Responsable + Foto Cámara + Nota -->
            <div class="mt-3.5 pt-3 border-t border-white/10 flex flex-wrap items-center gap-2">
              <div class="relative flex-1 min-w-[155px]">
                <span class="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[#d3a548]">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                </span>
                <input
                  type="text"
                  list="team-members-datalist"
                  data-field="assigned_to"
                  data-task-id="${task.id}"
                  value="${escapeHtml(assignedTo)}"
                  placeholder="Sin responsable..."
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
                class="px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                  isAssignedToMe
                    ? 'bg-[#d3a548] text-[#081933] shadow'
                    : 'bg-black/30 hover:bg-black/50 text-[#d3a548] border border-[#d3a548]/50'
                }"
              >
                ${isAssignedToMe ? '✓ Mía' : '🤚 Yo'}
              </button>

              <!-- Punto 3: Botón de Cámara para subir Foto de Verificación -->
              <button
                type="button"
                data-action="capture-photo"
                data-task-id="${task.id}"
                title="Tomar foto de verificación con la cámara"
                class="px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1 ${
                  hasPhoto
                    ? 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/50'
                    : 'bg-black/25 text-white/75 border-white/15 hover:text-[#d3a548] hover:border-[#d3a548]/40'
                }"
              >
                📷 ${hasPhoto ? 'Cambiar' : 'Foto'}
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
                📝 Nota
              </button>
            </div>

            <!-- Punto 3: Miniatura de la Foto de Verificación si existe -->
            ${
              hasPhoto
                ? `<div class="mt-2.5 flex items-center justify-between p-2 rounded-xl bg-black/35 border border-[#d3a548]/35">
                     <div class="flex items-center gap-2.5">
                       <img
                         src="${task.photo_url}"
                         alt="Verificación"
                         data-action="view-photo"
                         data-task-id="${task.id}"
                         class="w-11 h-11 rounded-lg object-cover border border-[#d3a548] cursor-pointer"
                       />
                       <div>
                         <p class="text-xs font-bold text-[#f0ca75]">📷 Evidencia fotográfica adjunta</p>
                         <button
                           type="button"
                           data-action="view-photo"
                           data-task-id="${task.id}"
                           class="text-[11px] text-[#d3a548] underline font-semibold"
                         >
                           Ampliar foto de verificación
                         </button>
                       </div>
                     </div>
                   </div>`
                : ''
            }

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
  // PANEL DE SUPERVISIÓN DEL ENCARGADO, PLANTILLA E HISTORIAL
  // =========================================================================
  function renderSupervisorDashboard() {
    if (state.user.role !== 'encargado') return;

    // 1. Rendimiento por Empleado
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

    // 2. Plantilla de Empleados Habituales (Punto 5)
    if (dom.supervisorTeamChips) {
      const members = getTeamMembers();
      dom.supervisorTeamChips.innerHTML = members
        .map(
          (name) => `
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-black/35 text-[#f0ca75] border border-[#d3a548]/40">
            <span>${escapeHtml(name)}</span>
            <button
              type="button"
              data-remove-member="${escapeHtml(name)}"
              class="text-white/60 hover:text-[#ef4444] font-bold"
              title="Quitar de la lista rápida"
            >
              ✕
            </button>
          </span>
        `
        )
        .join('');
    }

    if (
      dom.changeSupervisorPinInput &&
      document.activeElement !== dom.changeSupervisorPinInput
    ) {
      dom.changeSupervisorPinInput.value = getActiveSupervisorPin();
    }

    // 3. Fecha y Hora de Cierre
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

    // 4. Punto 6: Historial de Cierres Anteriores
    renderShiftHistoryList();
  }

  function renderShiftHistoryList() {
    if (!dom.shiftHistoryList) return;
    if (!state.history || state.history.length === 0) {
      dom.shiftHistoryList.innerHTML = `
        <p class="text-xs text-white/60 italic">Aún no hay cierres registrados en el historial.</p>
      `;
      return;
    }

    dom.shiftHistoryList.innerHTML = state.history
      .map((item) => {
        const dtStr = item.closed_at ? formatDateTimeEs(new Date(item.closed_at)) : '';
        return `
          <div class="p-3 rounded-xl bg-black/30 border border-[#d3a548]/25 flex flex-col gap-1">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-bold text-[#d3a548]">📅 ${escapeHtml(dtStr)}</span>
              <span class="text-xs font-mono font-bold text-[#10b981]">
                ${item.completed_tasks || 0}/${item.total_tasks || 0} hechas
              </span>
            </div>
            <p class="text-[11px] text-white/80">
              👤 Verificado por: <strong>${escapeHtml(item.closed_by || 'Encargado')}</strong>
            </p>
            ${
              item.general_notes
                ? `<p class="text-[11px] text-white/65 italic mt-0.5">🗒️ "${escapeHtml(item.general_notes)}"</p>`
                : ''
            }
          </div>
        `;
      })
      .join('');
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
    const photosCount = state.tasks.filter((t) => t.photo_url && t.photo_url.trim().length > 0).length;
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
    lines.push(`📊 *Estado General:* ${completed}/${total} tareas completadas (${photosCount} con foto 📷)`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`📋 *DETALLE DE TAREAS Y RESPONSABLES:*`);

    state.tasks.forEach((t, idx) => {
      const icon = t.is_completed ? '✅' : '❌';
      const who = (t.assigned_to || '').trim() || 'Sin asignar';
      const note = (t.notes || '').trim();
      const photoTag = t.photo_url && t.photo_url.trim() ? ' 📷' : '';
      let line = `${idx + 1}. ${icon} *${t.title}*${photoTag} — 👤 _${who}_`;
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
  // PUNTO 3: COMPRESIÓN DE FOTO EN CANVAS PARA TIEMPO REAL
  // =========================================================================
  function compressImageFile(file, maxWidth = 720, quality = 0.65) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.onerror = reject;
        img.src = ev.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
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
    // Punto 5: Clic en un chip de empleado rápido en la pantalla de Login
    if (dom.quickEmployeeChips) {
      dom.quickEmployeeChips.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-quick-name]');
        if (!chip) return;
        const name = chip.getAttribute('data-quick-name');
        dom.userNameInput.value = name;
        dom.roleErrorMsg.classList.add('hidden');
        renderQuickEmployeeSelectors();
      });
    }

    // Selección de Rol + Validación de PIN de Encargado (Punto 1)
    dom.roleSelectButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const role = btn.getAttribute('data-select-role');
        const name = (dom.userNameInput.value || '').trim();

        if (!name) {
          dom.roleErrorMsg.textContent = '⚠️ Selecciona o escribe tu nombre antes de entrar';
          dom.roleErrorMsg.classList.remove('hidden');
          dom.userNameInput.focus();
          return;
        }

        // Si elige Encargado, verificar el PIN de seguridad
        if (role === 'encargado') {
          if (dom.supervisorPinGroup.classList.contains('hidden')) {
            dom.supervisorPinGroup.classList.remove('hidden');
            dom.roleErrorMsg.textContent =
              '🔐 Introduce el PIN de Encargado y vuelve a pulsar "ENTRAR COMO ENCARGADO"';
            dom.roleErrorMsg.classList.remove('hidden');
            dom.supervisorPinInput.focus();
            return;
          }

          const enteredPin = (dom.supervisorPinInput.value || '').trim();
          const validPin = getActiveSupervisorPin();
          if (enteredPin !== validPin) {
            dom.roleErrorMsg.textContent = '❌ PIN de Encargado incorrecto';
            dom.roleErrorMsg.classList.remove('hidden');
            dom.supervisorPinInput.focus();
            return;
          }
        }

        dom.roleErrorMsg.classList.add('hidden');
        saveUserSession(name, role);
        enterMainApp(true);
      });
    });

    if (dom.btnSwitchRole) {
      dom.btnSwitchRole.addEventListener('click', showRoleSelectionScreen);
    }

    // Filtros por Estado
    dom.filterStatusBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        state.filterStatus = btn.getAttribute('data-filter-status');
        dom.filterStatusBtns.forEach((b) => {
          const isSelected = b.getAttribute('data-filter-status') === state.filterStatus;
          b.className = isSelected
            ? 'flex-1 py-2 px-3 rounded-lg text-xs font-bold bg-[#d3a548] text-[#081933] shadow transition'
            : 'flex-1 py-2 px-3 rounded-lg text-xs font-semibold text-white/75 hover:text-white transition';
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

    // Acciones en la lista de tareas
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
        } else if (action === 'capture-photo') {
          // Punto 3: Abrir cámara del móvil para esta tarea
          state.activeCameraTaskId = taskId;
          dom.hiddenCameraInput.value = '';
          dom.hiddenCameraInput.click();
        } else if (action === 'view-photo') {
          // Punto 3: Ver foto de verificación en grande
          if (!task.photo_url) return;
          state.activePhotoModalTaskId = taskId;
          dom.photoModalTitle.textContent = task.title;
          dom.photoModalImg.src = task.photo_url;
          dom.photoModal.classList.remove('hidden');
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
        } else if (action === 'delete-task') {
          // EXCLUSIVO ENCARGADO: Quitar tarea
          if (state.user.role !== 'encargado') {
            showToast('Solo el Encargado puede quitar tareas', 'error');
            return;
          }
          if (!confirm(`¿Quitar la tarea "${task.title}" del cierre de hoy?`)) return;
          state.tasks = state.tasks.filter((t) => t.id !== taskId);
          renderAll();
          await window.lovoRealtime.deleteTask(taskId);
          showToast('Tarea quitada por el Encargado');
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

    // Punto 3: Procesar foto tomada desde la cámara del móvil
    if (dom.hiddenCameraInput) {
      dom.hiddenCameraInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        const taskId = state.activeCameraTaskId;
        if (!file || !taskId) return;

        showToast('Procesando y sincronizando foto 📷...');
        try {
          const compressedDataUrl = await compressImageFile(file, 720, 0.65);
          const task = state.tasks.find((t) => t.id === taskId);
          if (task) {
            task.photo_url = compressedDataUrl;
            // Si aún no estaba marcada como hecha, marcarla y asignar al usuario actual
            if (!task.is_completed) {
              task.is_completed = true;
              task.completed_at = new Date().toISOString();
              if (!task.assigned_to || !task.assigned_to.trim()) {
                task.assigned_to = state.user.name;
              }
            }
            renderAll();
            await window.lovoRealtime.updateTaskFields(taskId, {
              photo_url: compressedDataUrl,
              is_completed: task.is_completed,
              completed_at: task.completed_at,
              assigned_to: task.assigned_to
            });
            showToast('Foto de verificación subida en tiempo real ✓');
          }
        } catch (err) {
          console.error('Error al comprimir foto:', err);
          showToast('Error al procesar la foto', 'error');
        }
      });
    }

    // Modal Visor de Foto
    const closePhotoModal = () => {
      dom.photoModal.classList.add('hidden');
      state.activePhotoModalTaskId = null;
    };
    if (dom.btnClosePhotoModal) dom.btnClosePhotoModal.addEventListener('click', closePhotoModal);
    if (dom.btnClosePhotoModalBottom)
      dom.btnClosePhotoModalBottom.addEventListener('click', closePhotoModal);

    if (dom.btnDeletePhoto) {
      dom.btnDeletePhoto.addEventListener('click', async () => {
        const taskId = state.activePhotoModalTaskId;
        if (!taskId) return;
        const task = state.tasks.find((t) => t.id === taskId);
        if (!task) return;
        if (!confirm('¿Borrar la foto de verificación de esta tarea?')) return;
        task.photo_url = '';
        localStorage.removeItem(`lovo_photo_${taskId}`);
        closePhotoModal();
        renderAll();
        await window.lovoRealtime.updateTaskFields(taskId, { photo_url: '' });
        showToast('Foto eliminada');
      });
    }

    // Modal Celebración 100% (Punto 6)
    if (dom.btnCloseCheers100) {
      dom.btnCloseCheers100.addEventListener('click', () => {
        dom.cheers100Modal.classList.add('hidden');
      });
    }

    // EXCLUSIVO ENCARGADO: Agregar tarea
    if (dom.btnToggleAddTask && dom.addTaskDrawer) {
      dom.btnToggleAddTask.addEventListener('click', () => {
        if (state.user.role !== 'encargado') {
          showToast('Solo el Encargado puede agregar tareas', 'error');
          return;
        }
        dom.addTaskDrawer.classList.toggle('hidden');
        if (!dom.addTaskDrawer.classList.contains('hidden')) {
          dom.customTaskTitle.focus();
        }
      });
    }

    if (dom.customTaskForm) {
      dom.customTaskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (state.user.role !== 'encargado') {
          showToast('Solo el Encargado puede agregar tareas', 'error');
          return;
        }
        const title = (dom.customTaskTitle.value || '').trim();
        if (!title) return;

        const category = dom.customTaskCategory.value || 'Imprevistos Madrugada';
        const assigned_to = (dom.customTaskAssignee.value || '').trim();
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
          dom.customTaskAssignee.value = '';
          dom.customTaskNotes.value = '';
          dom.addTaskDrawer.classList.add('hidden');
          renderAll();
          showToast('Tarea agregada por el Encargado');
        } catch (_err) {
          showToast('No se pudo agregar la tarea', 'error');
        }
      });
    }

    // Punto 5: Gestión de Plantilla de Empleados por el Encargado
    if (dom.addTeamMemberForm) {
      dom.addTeamMemberForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newName = (dom.newTeamMemberInput.value || '').trim();
        if (!newName) return;
        const current = getTeamMembers();
        if (!current.some((n) => n.toLowerCase() === newName.toLowerCase())) {
          const updated = [...current, newName];
          state.shiftState.team_members = updated;
          localStorage.setItem('lovo_team_members', JSON.stringify(updated));
          dom.newTeamMemberInput.value = '';
          renderQuickEmployeeSelectors();
          renderSupervisorDashboard();
          await window.lovoRealtime.updateShiftState({ team_members: updated });
          showToast(`${newName} añadido a la plantilla rápida`);
        }
      });
    }

    if (dom.supervisorTeamChips) {
      dom.supervisorTeamChips.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-remove-member]');
        if (!btn) return;
        const nameToRemove = btn.getAttribute('data-remove-member');
        const updated = getTeamMembers().filter((n) => n !== nameToRemove);
        state.shiftState.team_members = updated;
        localStorage.setItem('lovo_team_members', JSON.stringify(updated));
        renderQuickEmployeeSelectors();
        renderSupervisorDashboard();
        await window.lovoRealtime.updateShiftState({ team_members: updated });
        showToast(`${nameToRemove} quitado de la lista rápida`);
      });
    }

    // Punto 1: Cambiar PIN de Encargado
    if (dom.btnSaveSupervisorPin) {
      dom.btnSaveSupervisorPin.addEventListener('click', async () => {
        const newPin = (dom.changeSupervisorPinInput.value || '').trim();
        if (!newPin || newPin.length < 4) {
          showToast('El PIN debe tener al menos 4 caracteres', 'error');
          return;
        }
        state.shiftState.supervisor_pin = newPin;
        localStorage.setItem('lovo_supervisor_pin', newPin);
        await window.lovoRealtime.updateShiftState({ supervisor_pin: newPin });
        showToast(`Nuevo PIN de Encargado guardado: ${newPin}`);
      });
    }

    // Notas Generales del Encargado
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
        const generalNotes = (
          dom.generalNotesInput?.value ||
          state.shiftState.general_notes ||
          ''
        ).trim();

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
          state.history = await window.lovoRealtime.fetchShiftHistory();
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
          '¿Iniciar un NUEVO TURNO nocturno en LoVo?\n\nSe restaurarán las 20 tareas oficiales y se limpiarán las marcas, fotos y notas para la nueva noche.'
        );
        if (!ok) return;

        await window.lovoRealtime.resetShift();
        state.openNoteTaskIds.clear();
        state.celebrated100 = false;
        await refreshAllData();
        showToast('Checklist restaurado para una nueva noche');
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
          showToast(
            'En iPhone/Android: pulsa Compartir o Menú ⋮ → "Añadir a pantalla de inicio"'
          );
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
      dom.btnCloseConfigModal.addEventListener('click', () =>
        dom.configModal.classList.add('hidden')
      );
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
