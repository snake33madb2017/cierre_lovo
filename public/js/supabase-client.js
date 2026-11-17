/**
 * Capa de Datos y Sincronización en Tiempo Real con Supabase
 * Soporta:
 *  - Postgres Changes en tiempo real (lovo_tasks y lovo_shift_state)
 *  - Fotos de verificación comprimidas en tiempo real (photo_url)
 *  - Plantilla de empleados (team_members) y PIN de Encargado (supervisor_pin)
 *  - Histórico de cierres (lovo_shift_history)
 *  - Modo Local Multi-Pestaña (BroadcastChannel) de respaldo
 */
class LoVoRealtimeService {
  constructor() {
    this.supabase = null;
    this.channel = null;
    this.isRealtimeConnected = false;
    this.mode = 'local'; // 'supabase' | 'local'
    this.localBroadcast =
      typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('lovo_local_sync') : null;

    this.callbacks = {
      onTasksChanged: () => {},
      onTaskRealtimeEvent: () => {},
      onShiftStateChanged: () => {},
      onPresenceChanged: () => {},
      onConnectionStatus: () => {}
    };
  }

  on(event, fn) {
    if (this.callbacks[event]) {
      this.callbacks[event] = fn;
    }
  }

  async init(userProfile) {
    const cfg = await window.LoVoConfig.load();

    if (cfg.isConfigured && window.supabase) {
      try {
        this.supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
          realtime: {
            params: {
              eventsPerSecond: 20
            }
          }
        });
        this.mode = 'supabase';
        await this.ensureInitialDataSupabase();
        await this.subscribeSupabaseRealtime(userProfile);
        return { mode: 'supabase', connected: true };
      } catch (err) {
        console.error('Error conectando con Supabase, activando modo local de respaldo:', err);
        this.callbacks.onConnectionStatus({
          mode: 'error',
          message: err.message || 'Error de conexión a Supabase'
        });
      }
    }

    this.mode = 'local';
    this.ensureInitialDataLocal();
    this.setupLocalSync(userProfile);
    this.callbacks.onConnectionStatus({
      mode: 'local',
      message: 'Modo Demo Local (Configura Supabase)'
    });
    return { mode: 'local', connected: false };
  }

  // =========================================================================
  // SUPABASE DATA & REALTIME
  // =========================================================================
  async ensureInitialDataSupabase() {
    const { data: existingTasks, error: tasksErr } = await this.supabase
      .from('lovo_tasks')
      .select('*')
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true });

    if (tasksErr) throw tasksErr;

    if (!existingTasks || existingTasks.length === 0) {
      const seedPayload = window.LoVoConfig.INITIAL_TASKS.map((t) => ({
        order_index: t.order_index,
        title: t.title,
        category: t.category,
        requires_note: t.requires_note,
        is_completed: false,
        assigned_to: '',
        completed_by: '',
        notes: '',
        is_custom: false
      }));
      const { error: insertErr } = await this.supabase.from('lovo_tasks').insert(seedPayload);
      if (insertErr) throw insertErr;
    }

    const { data: shiftRow, error: shiftErr } = await this.supabase
      .from('lovo_shift_state')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (!shiftErr && !shiftRow) {
      await this.supabase.from('lovo_shift_state').insert([
        {
          id: 1,
          general_notes: '',
          closed_by: '',
          is_closed: false
        }
      ]);
    }
  }

  async subscribeSupabaseRealtime(userProfile) {
    if (this.channel) {
      await this.supabase.removeChannel(this.channel);
    }

    const presenceKey = userProfile?.id || `emp_${Math.random().toString(36).slice(2, 8)}`;

    this.channel = this.supabase.channel('lovo-cierre-realtime', {
      config: {
        presence: { key: presenceKey }
      }
    });

    this.channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'lovo_tasks' },
      (payload) => {
        this.callbacks.onTaskRealtimeEvent(payload);
      }
    );

    this.channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'lovo_shift_state' },
      (payload) => {
        if (payload.new) {
          this.callbacks.onShiftStateChanged(payload.new);
        }
      }
    );

    this.channel.on('presence', { event: 'sync' }, () => {
      const state = this.channel.presenceState();
      const onlineUsers = [];
      Object.values(state).forEach((presences) => {
        if (presences && presences.length > 0) {
          onlineUsers.push(presences[0]);
        }
      });
      this.callbacks.onPresenceChanged(onlineUsers);
    });

    this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        this.isRealtimeConnected = true;
        this.callbacks.onConnectionStatus({
          mode: 'supabase',
          message: 'Supabase Realtime Activo'
        });

        if (userProfile && userProfile.name) {
          await this.channel.track({
            id: presenceKey,
            name: userProfile.name,
            role: userProfile.role || 'empleado',
            online_at: new Date().toISOString()
          });
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.isRealtimeConnected = false;
        this.callbacks.onConnectionStatus({
          mode: 'error',
          message: 'Reconectando Realtime...'
        });
      }
    });
  }

  async updatePresence(userProfile) {
    if (this.mode === 'supabase' && this.channel && this.isRealtimeConnected && userProfile?.name) {
      await this.channel.track({
        id: userProfile.id,
        name: userProfile.name,
        role: userProfile.role || 'empleado',
        online_at: new Date().toISOString()
      });
    } else if (this.mode === 'local') {
      this.callbacks.onPresenceChanged([
        {
          id: userProfile?.id || 'local',
          name: userProfile?.name || 'Usuario Local',
          role: userProfile?.role || 'empleado'
        }
      ]);
    }
  }

  // =========================================================================
  // OPERACIONES CRUD (TAREAS, FOTOS, PLANTILLA E HISTORIAL)
  // =========================================================================
  async fetchAllTasks() {
    if (this.mode === 'supabase') {
      const { data, error } = await this.supabase
        .from('lovo_tasks')
        .select('*')
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    }
    return this.getLocalTasks();
  }

  async fetchShiftState() {
    if (this.mode === 'supabase') {
      const { data, error } = await this.supabase
        .from('lovo_shift_state')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (error) throw error;
      return (
        data || {
          id: 1,
          general_notes: '',
          closed_by: '',
          is_closed: false,
          closed_at: null,
          team_members: window.LoVoConfig.DEFAULT_TEAM_MEMBERS,
          supervisor_pin: window.LoVoConfig.SUPERVISOR_PIN
        }
      );
    }
    return this.getLocalShiftState();
  }

  async updateTaskFields(taskId, partialFields) {
    const payload = {
      ...partialFields,
      updated_at: new Date().toISOString()
    };

    if (this.mode === 'supabase') {
      const { data, error } = await this.supabase
        .from('lovo_tasks')
        .update(payload)
        .eq('id', taskId)
        .select()
        .single();

      if (error) {
        // Si la tabla en Supabase aún no tenía la columna photo_url creada, guardamos en localStorage de respaldo sin romper
        if (partialFields.photo_url !== undefined) {
          localStorage.setItem(`lovo_photo_${taskId}`, partialFields.photo_url || '');
          return { id: taskId, ...payload };
        }
        throw error;
      }
      return data;
    }

    const tasks = this.getLocalTasks();
    const idx = tasks.findIndex((t) => t.id === taskId);
    if (idx !== -1) {
      tasks[idx] = { ...tasks[idx], ...payload };
      this.saveLocalTasks(tasks);
      this.notifyLocal('TASK_UPDATED', tasks[idx]);
      return tasks[idx];
    }
    return null;
  }

  /**
   * Crear nueva tarea (Exclusivo para el Rol Encargado)
   */
  async createCustomTask({ title, category, assigned_to, notes }) {
    const newTask = {
      order_index: 900,
      title: title.trim(),
      category: category || 'Imprevistos Madrugada',
      is_completed: false,
      assigned_to: (assigned_to || '').trim(),
      completed_by: '',
      notes: (notes || '').trim(),
      requires_note: false,
      is_custom: true
    };

    if (this.mode === 'supabase') {
      const { data, error } = await this.supabase
        .from('lovo_tasks')
        .insert([newTask])
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const tasks = this.getLocalTasks();
    const created = {
      ...newTask,
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      photo_url: '',
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    tasks.push(created);
    this.saveLocalTasks(tasks);
    this.notifyLocal('TASK_INSERTED', created);
    return created;
  }

  /**
   * Eliminar cualquier tarea (Exclusivo para el Rol Encargado)
   */
  async deleteTask(taskId) {
    if (this.mode === 'supabase') {
      const { error } = await this.supabase
        .from('lovo_tasks')
        .delete()
        .eq('id', taskId);
      if (error) throw error;
      return true;
    }

    const tasks = this.getLocalTasks().filter((t) => t.id !== taskId);
    this.saveLocalTasks(tasks);
    this.notifyLocal('TASK_DELETED', { id: taskId });
    return true;
  }

  async updateShiftState(partialState) {
    const payload = {
      ...partialState,
      updated_at: new Date().toISOString()
    };

    if (this.mode === 'supabase') {
      const { data, error } = await this.supabase
        .from('lovo_shift_state')
        .update(payload)
        .eq('id', 1)
        .select()
        .single();

      if (error) {
        // Respaldo local si team_members o supervisor_pin aún no se añadieron al SQL de Supabase
        const current = this.getLocalShiftState();
        const merged = { ...current, ...payload };
        localStorage.setItem('lovo_local_shift_state', JSON.stringify(merged));
        return merged;
      }
      return data;
    }

    const current = this.getLocalShiftState();
    const updated = { ...current, ...payload };
    localStorage.setItem('lovo_local_shift_state', JSON.stringify(updated));
    this.notifyLocal('SHIFT_UPDATED', updated);
    return updated;
  }

  async recordShiftHistory({ closedBy, generalNotes, tasks }) {
    const completedCount = tasks.filter((t) => t.is_completed).length;
    const entry = {
      id: `hist_${Date.now()}`,
      closed_at: new Date().toISOString(),
      closed_by: closedBy || 'Encargado',
      general_notes: generalNotes || '',
      total_tasks: tasks.length,
      completed_tasks: completedCount,
      tasks_snapshot: tasks.map((t) => ({
        title: t.title,
        category: t.category,
        is_completed: t.is_completed,
        assigned_to: t.assigned_to,
        notes: t.notes
      }))
    };

    // Guardar también en historial local de respaldo
    const localHist = this.getLocalHistory();
    localHist.unshift(entry);
    localStorage.setItem('lovo_local_history', JSON.stringify(localHist.slice(0, 30)));

    if (this.mode === 'supabase') {
      await this.supabase.from('lovo_shift_history').insert([
        {
          closed_at: entry.closed_at,
          closed_by: entry.closed_by,
          general_notes: entry.general_notes,
          total_tasks: entry.total_tasks,
          completed_tasks: entry.completed_tasks,
          tasks_snapshot: entry.tasks_snapshot
        }
      ]);
    }
    return entry;
  }

  async fetchShiftHistory() {
    if (this.mode === 'supabase') {
      const { data, error } = await this.supabase
        .from('lovo_shift_history')
        .select('*')
        .order('closed_at', { ascending: false })
        .limit(15);
      if (!error && data && data.length > 0) {
        return data;
      }
    }
    return this.getLocalHistory();
  }

  async resetShift() {
    if (this.mode === 'supabase') {
      const { error: rpcErr } = await this.supabase.rpc('reset_lovo_shift');
      if (rpcErr) {
        await this.supabase.from('lovo_tasks').delete().eq('is_custom', true);
        await this.supabase
          .from('lovo_tasks')
          .update({
            is_completed: false,
            assigned_to: '',
            completed_by: '',
            notes: '',
            completed_at: null,
            updated_at: new Date().toISOString()
          })
          .neq('title', '___never___');
      }

      // Si el encargado quitó alguna de las 20 tareas base durante el turno, restaurar las 20 tareas base
      const { data: currentTasks } = await this.supabase.from('lovo_tasks').select('title');
      const existingTitles = new Set((currentTasks || []).map((t) => t.title));
      const missingBaseTasks = window.LoVoConfig.INITIAL_TASKS.filter(
        (t) => !existingTitles.has(t.title)
      ).map((t) => ({
        order_index: t.order_index,
        title: t.title,
        category: t.category,
        requires_note: t.requires_note,
        is_completed: false,
        assigned_to: '',
        completed_by: '',
        notes: '',
        is_custom: false
      }));

      if (missingBaseTasks.length > 0) {
        await this.supabase.from('lovo_tasks').insert(missingBaseTasks);
      }

      await this.supabase
        .from('lovo_shift_state')
        .update({
          general_notes: '',
          closed_by: '',
          is_closed: false,
          closed_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);

      return;
    }

    const currentShift = this.getLocalShiftState();
    localStorage.removeItem('lovo_local_tasks');
    this.ensureInitialDataLocal();
    localStorage.setItem(
      'lovo_local_shift_state',
      JSON.stringify({
        ...currentShift,
        general_notes: '',
        closed_by: '',
        is_closed: false,
        closed_at: null,
        updated_at: new Date().toISOString()
      })
    );
    this.notifyLocal('SHIFT_RESET', {});
  }

  // =========================================================================
  // RESPALDO LOCAL (MULTI-PESTAÑA)
  // =========================================================================
  ensureInitialDataLocal() {
    const raw = localStorage.getItem('lovo_local_tasks');
    if (!raw) {
      const seeded = window.LoVoConfig.INITIAL_TASKS.map((t, idx) => ({
        id: `base_${idx + 1}`,
        order_index: t.order_index,
        title: t.title,
        category: t.category,
        is_completed: false,
        assigned_to: '',
        completed_by: '',
        notes: '',
        photo_url: '',
        requires_note: t.requires_note,
        is_custom: false,
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      this.saveLocalTasks(seeded);
    }

    if (!localStorage.getItem('lovo_local_shift_state')) {
      localStorage.setItem(
        'lovo_local_shift_state',
        JSON.stringify({
          id: 1,
          general_notes: '',
          closed_by: '',
          is_closed: false,
          closed_at: null,
          team_members: window.LoVoConfig.DEFAULT_TEAM_MEMBERS,
          supervisor_pin: window.LoVoConfig.SUPERVISOR_PIN,
          updated_at: new Date().toISOString()
        })
      );
    }
  }

  getLocalTasks() {
    try {
      return JSON.parse(localStorage.getItem('lovo_local_tasks') || '[]');
    } catch (_e) {
      return [];
    }
  }

  saveLocalTasks(tasks) {
    localStorage.setItem('lovo_local_tasks', JSON.stringify(tasks));
  }

  getLocalShiftState() {
    try {
      const parsed = JSON.parse(localStorage.getItem('lovo_local_shift_state') || '{}');
      return {
        id: 1,
        general_notes: '',
        closed_by: '',
        is_closed: false,
        team_members: window.LoVoConfig.DEFAULT_TEAM_MEMBERS,
        supervisor_pin: window.LoVoConfig.SUPERVISOR_PIN,
        ...parsed
      };
    } catch (_e) {
      return {
        id: 1,
        general_notes: '',
        is_closed: false,
        team_members: window.LoVoConfig.DEFAULT_TEAM_MEMBERS,
        supervisor_pin: window.LoVoConfig.SUPERVISOR_PIN
      };
    }
  }

  getLocalHistory() {
    try {
      return JSON.parse(localStorage.getItem('lovo_local_history') || '[]');
    } catch (_e) {
      return [];
    }
  }

  setupLocalSync(userProfile) {
    if (this.localBroadcast) {
      this.localBroadcast.onmessage = (event) => {
        const { type, data } = event.data || {};
        if (type === 'TASK_UPDATED') {
          this.callbacks.onTaskRealtimeEvent({ eventType: 'UPDATE', new: data });
        } else if (type === 'TASK_INSERTED') {
          this.callbacks.onTaskRealtimeEvent({ eventType: 'INSERT', new: data });
        } else if (type === 'TASK_DELETED') {
          this.callbacks.onTaskRealtimeEvent({ eventType: 'DELETE', old: data });
        } else if (type === 'SHIFT_UPDATED') {
          this.callbacks.onShiftStateChanged(data);
        } else if (type === 'SHIFT_RESET') {
          this.callbacks.onTasksChanged();
        }
      };
    }

    this.callbacks.onPresenceChanged([
      {
        id: userProfile?.id || 'local',
        name: userProfile?.name || 'Tú',
        role: userProfile?.role || 'empleado'
      }
    ]);
  }

  notifyLocal(type, data) {
    if (this.localBroadcast) {
      this.localBroadcast.postMessage({ type, data });
    }
  }
}

window.lovoRealtime = new LoVoRealtimeService();
