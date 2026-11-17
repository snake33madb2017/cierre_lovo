/**
 * Capa de Datos y Sincronización en Tiempo Real con Supabase
 * Soporta:
 *  - Postgres Changes en tiempo real (lovo_tasks y lovo_shift_state)
 *  - Presence en tiempo real (ver los hasta 15 empleados conectados simultáneamente)
 *  - Modo Local Multi-Pestaña (BroadcastChannel) si aún no se han introducido las claves de Supabase
 */
class LoVoRealtimeService {
  constructor() {
    this.supabase = null;
    this.channel = null;
    this.isRealtimeConnected = false;
    this.mode = 'local'; // 'supabase' | 'local'
    this.localBroadcast = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('lovo_local_sync') : null;

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

    // Modo Local (respaldo inmediato mientras se configura Supabase)
    this.mode = 'local';
    this.ensureInitialDataLocal();
    this.setupLocalSync(userProfile);
    this.callbacks.onConnectionStatus({
      mode: 'local',
      message: 'Modo Demo Local (Configura SUPABASE_URL para multi-dispositivo)'
    });
    return { mode: 'local', connected: false };
  }

  // =========================================================================
  // SUPABASE DATA & REALTIME
  // =========================================================================
  async ensureInitialDataSupabase() {
    // 1. Verificar tareas existentes
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

    // 2. Verificar fila de estado del turno (id = 1)
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

    // Escuchar cambios fila por fila en lovo_tasks sin pisar el trabajo de otros empleados
    this.channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'lovo_tasks' },
      (payload) => {
        this.callbacks.onTaskRealtimeEvent(payload);
      }
    );

    // Escuchar cambios en el estado general del cierre (lovo_shift_state)
    this.channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'lovo_shift_state' },
      (payload) => {
        if (payload.new) {
          this.callbacks.onShiftStateChanged(payload.new);
        }
      }
    );

    // Escuchar presencia de los empleados conectados (hasta 15+ simultáneos)
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
  // OPERACIONES CRUD (TAREAS Y ESTADO DE TURNO)
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
          closed_at: null
        }
      );
    }
    return this.getLocalShiftState();
  }

  /**
   * Actualización atómica de campos específicos de una tarea (evita pisar otros campos)
   */
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
      if (error) throw error;
      return data;
    }

    // Modo local
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
   * Crear nueva tarea imprevista de madrugada
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
   * Eliminar una tarea personalizada de última hora
   */
  async deleteCustomTask(taskId) {
    if (this.mode === 'supabase') {
      const { error } = await this.supabase
        .from('lovo_tasks')
        .delete()
        .eq('id', taskId)
        .eq('is_custom', true);
      if (error) throw error;
      return true;
    }

    const tasks = this.getLocalTasks().filter((t) => t.id !== taskId);
    this.saveLocalTasks(tasks);
    this.notifyLocal('TASK_DELETED', { id: taskId });
    return true;
  }

  /**
   * Actualizar notas generales o cierre oficial del turno
   */
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
      if (error) throw error;
      return data;
    }

    const current = this.getLocalShiftState();
    const updated = { ...current, ...payload };
    localStorage.setItem('lovo_local_shift_state', JSON.stringify(updated));
    this.notifyLocal('SHIFT_UPDATED', updated);
    return updated;
  }

  /**
   * Guardar histórico del cierre en Supabase al emitir el reporte final
   */
  async recordShiftHistory({ closedBy, generalNotes, tasks }) {
    const completedCount = tasks.filter((t) => t.is_completed).length;
    if (this.mode === 'supabase') {
      await this.supabase.from('lovo_shift_history').insert([
        {
          closed_at: new Date().toISOString(),
          closed_by: closedBy || 'Encargado',
          general_notes: generalNotes || '',
          total_tasks: tasks.length,
          completed_tasks: completedCount,
          tasks_snapshot: tasks
        }
      ]);
    }
  }

  /**
   * Reiniciar todas las tareas para comenzar un nuevo turno nocturno
   */
  async resetShift() {
    if (this.mode === 'supabase') {
      // Intentar usar la función RPC si fue creada, o actualización directa
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
      }
      return;
    }

    // Modo Local
    localStorage.removeItem('lovo_local_tasks');
    localStorage.removeItem('lovo_local_shift_state');
    this.ensureInitialDataLocal();
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
      return JSON.parse(localStorage.getItem('lovo_local_shift_state') || '{}');
    } catch (_e) {
      return { id: 1, general_notes: '', is_closed: false };
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
