/**
 * Configuración global y constantes de "LoVo" Cierre Nocturno
 */
window.LoVoConfig = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  WHATSAPP_PHONE: '34678146956',

  // Lista oficial de las 20 tareas iniciales de LoVo
  INITIAL_TASKS: [
    { order_index: 1,  title: 'Cuartos hechos', category: 'Limpieza y Sala', requires_note: false },
    { order_index: 2,  title: 'Neveras recargadas', category: 'Barra y Stock', requires_note: false },
    { order_index: 3,  title: 'DJ organizado y casado', category: 'Cabina y Técnica', requires_note: false },
    { order_index: 4,  title: 'Barras limpias', category: 'Barra y Stock', requires_note: false },
    { order_index: 5,  title: 'Tapetes lavados', category: 'Barra y Stock', requires_note: false },
    { order_index: 6,  title: 'Basuras sacadas', category: 'Limpieza y Sala', requires_note: false },
    { order_index: 7,  title: 'Office lista', category: 'Limpieza y Sala', requires_note: false },
    { order_index: 8,  title: '7 Qr (con notas de incidencias)', category: 'Control y Caja', requires_note: true },
    { order_index: 9,  title: 'Vacíos listos', category: 'Barra y Stock', requires_note: false },
    { order_index: 10, title: 'Cartones afuera', category: 'Limpieza y Sala', requires_note: false },
    { order_index: 11, title: 'Taburetes arriba', category: 'Limpieza y Sala', requires_note: false },
    { order_index: 12, title: 'Mesas limpias', category: 'Limpieza y Sala', requires_note: false },
    { order_index: 13, title: 'Ordenador apagado', category: 'Cabina y Técnica', requires_note: false },
    { order_index: 14, title: 'Datáfonos cargando', category: 'Cabina y Técnica', requires_note: false },
    { order_index: 15, title: 'Leds apagados', category: 'Cabina y Técnica', requires_note: false },
    { order_index: 16, title: 'Puerta abajo y cerrada de la salida de emergencia', category: 'Seguridad y Cierre', requires_note: false },
    { order_index: 17, title: 'Puerta asegurada', category: 'Seguridad y Cierre', requires_note: false },
    { order_index: 18, title: '2700€ Aprox (Caja)', category: 'Control y Caja', requires_note: true },
    { order_index: 19, title: 'Otros / Incidencias controladas', category: 'Control y Caja', requires_note: true },
    { order_index: 20, title: 'Nadie ha olvidado nada', category: 'Seguridad y Cierre', requires_note: false }
  ],

  async load() {
    // 1. Intentar cargar desde el endpoint del servidor en Render (/api/config)
    try {
      const response = await fetch('/api/config', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        if (data.SUPABASE_URL) this.SUPABASE_URL = data.SUPABASE_URL.trim();
        if (data.SUPABASE_ANON_KEY) this.SUPABASE_ANON_KEY = data.SUPABASE_ANON_KEY.trim();
        if (data.WHATSAPP_PHONE) this.WHATSAPP_PHONE = data.WHATSAPP_PHONE.trim();
      }
    } catch (_err) {
      // Si se sirve como estático puro sin Node.js, continúa con localStorage
    }

    // 2. Permitir sobreescritura manual guardada en el navegador (Modal de Configuración)
    const savedUrl = localStorage.getItem('lovo_supabase_url');
    const savedKey = localStorage.getItem('lovo_supabase_anon_key');
    if (!this.SUPABASE_URL && savedUrl) this.SUPABASE_URL = savedUrl.trim();
    if (!this.SUPABASE_ANON_KEY && savedKey) this.SUPABASE_ANON_KEY = savedKey.trim();

    return {
      supabaseUrl: this.SUPABASE_URL,
      supabaseAnonKey: this.SUPABASE_ANON_KEY,
      whatsappPhone: this.WHATSAPP_PHONE,
      isConfigured: Boolean(this.SUPABASE_URL && this.SUPABASE_ANON_KEY)
    };
  },

  saveManualCredentials(url, anonKey) {
    localStorage.setItem('lovo_supabase_url', (url || '').trim());
    localStorage.setItem('lovo_supabase_anon_key', (anonKey || '').trim());
    this.SUPABASE_URL = (url || '').trim();
    this.SUPABASE_ANON_KEY = (anonKey || '').trim();
  },

  clearManualCredentials() {
    localStorage.removeItem('lovo_supabase_url');
    localStorage.removeItem('lovo_supabase_anon_key');
  }
};
