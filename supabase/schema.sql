-- ============================================================================
-- ESQUEMA SQL PARA SUPABASE - COCTELERÍA "LoVo" (CIERRE DE TURNO NOCTURNO)
-- ============================================================================
-- Instrucciones:
-- 1. Abre tu proyecto en https://supabase.com
-- 2. Ve a "SQL Editor" -> "New Query"
-- 3. Pega todo este contenido y pulsa "Run"
-- ============================================================================

-- Extensión para generar UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABLA DE TAREAS EN TIEMPO REAL (lovo_tasks)
CREATE TABLE IF NOT EXISTS public.lovo_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_index INTEGER NOT NULL DEFAULT 100,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Operativa',
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    assigned_to TEXT NOT NULL DEFAULT '',
    completed_by TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    requires_note BOOLEAN NOT NULL DEFAULT FALSE,
    is_custom BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TABLA DE ESTADO GLOBAL DEL TURNO ACTUAL (lovo_shift_state)
CREATE TABLE IF NOT EXISTS public.lovo_shift_state (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
    general_notes TEXT NOT NULL DEFAULT '',
    closed_by TEXT NOT NULL DEFAULT '',
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    closed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABLA DE HISTÓRICO DE CIERRES (lovo_shift_history)
CREATE TABLE IF NOT EXISTS public.lovo_shift_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_by TEXT NOT NULL DEFAULT '',
    general_notes TEXT NOT NULL DEFAULT '',
    total_tasks INTEGER NOT NULL DEFAULT 0,
    completed_tasks INTEGER NOT NULL DEFAULT 0,
    tasks_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- ============================================================================
-- TRIGGERS PARA ACTUALIZAR updated_at AUTOMÁTICAMENTE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lovo_tasks_updated_at ON public.lovo_tasks;
CREATE TRIGGER trg_lovo_tasks_updated_at
BEFORE UPDATE ON public.lovo_tasks
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_lovo_shift_state_updated_at ON public.lovo_shift_state;
CREATE TRIGGER trg_lovo_shift_state_updated_at
BEFORE UPDATE ON public.lovo_shift_state
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- CONFIGURACIÓN DE ROW LEVEL SECURITY (RLS) PARA ACCESO POR QR (15 EMPLEADOS)
-- ============================================================================
ALTER TABLE public.lovo_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lovo_shift_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lovo_shift_history ENABLE ROW LEVEL SECURITY;

-- Políticas abiertas para rol anon/authenticated (acceso inmediato por QR)
DROP POLICY IF EXISTS "Acceso total en tiempo real a lovo_tasks" ON public.lovo_tasks;
CREATE POLICY "Acceso total en tiempo real a lovo_tasks"
ON public.lovo_tasks
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total en tiempo real a lovo_shift_state" ON public.lovo_shift_state;
CREATE POLICY "Acceso total en tiempo real a lovo_shift_state"
ON public.lovo_shift_state
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total a lovo_shift_history" ON public.lovo_shift_history;
CREATE POLICY "Acceso total a lovo_shift_history"
ON public.lovo_shift_history
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- ============================================================================
-- HABILITAR SUPABASE REALTIME (SINCRONIZACIÓN INSTANTÁNEA)
-- ============================================================================
ALTER TABLE public.lovo_tasks REPLICA IDENTITY FULL;
ALTER TABLE public.lovo_shift_state REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'lovo_tasks'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.lovo_tasks;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'lovo_shift_state'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.lovo_shift_state;
    END IF;
END $$;

-- ============================================================================
-- DATOS INICIALES: LAS 20 TAREAS OFICIALES DE CIERRE DE "LoVo"
-- ============================================================================
INSERT INTO public.lovo_shift_state (id, shift_date, general_notes, is_closed)
VALUES (1, CURRENT_DATE, '', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Insertar las 20 tareas base solo si la tabla está vacía
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.lovo_tasks LIMIT 1) THEN
        INSERT INTO public.lovo_tasks (order_index, title, category, requires_note, is_custom, notes) VALUES
        (1,  'Cuartos hechos', 'Limpieza y Sala', FALSE, FALSE, ''),
        (2,  'Neveras recargadas', 'Barra y Stock', FALSE, FALSE, ''),
        (3,  'DJ organizado y casado', 'Cabina y Técnica', FALSE, FALSE, ''),
        (4,  'Barras limpias', 'Barra y Stock', FALSE, FALSE, ''),
        (5,  'Tapetes lavados', 'Barra y Stock', FALSE, FALSE, ''),
        (6,  'Basuras sacadas', 'Limpieza y Sala', FALSE, FALSE, ''),
        (7,  'Office lista', 'Limpieza y Sala', FALSE, FALSE, ''),
        (8,  '7 Qr (con notas de incidencias)', 'Control y Caja', TRUE, FALSE, ''),
        (9,  'Vacíos listos', 'Barra y Stock', FALSE, FALSE, ''),
        (10, 'Cartones afuera', 'Limpieza y Sala', FALSE, FALSE, ''),
        (11, 'Taburetes arriba', 'Limpieza y Sala', FALSE, FALSE, ''),
        (12, 'Mesas limpias', 'Limpieza y Sala', FALSE, FALSE, ''),
        (13, 'Ordenador apagado', 'Cabina y Técnica', FALSE, FALSE, ''),
        (14, 'Datáfonos cargando', 'Cabina y Técnica', FALSE, FALSE, ''),
        (15, 'Leds apagados', 'Cabina y Técnica', FALSE, FALSE, ''),
        (16, 'Puerta abajo y cerrada de la salida de emergencia', 'Seguridad y Cierre', FALSE, FALSE, ''),
        (17, 'Puerta asegurada', 'Seguridad y Cierre', FALSE, FALSE, ''),
        (18, '2700€ Aprox (Caja)', 'Control y Caja', TRUE, FALSE, ''),
        (19, 'Otros / Incidencias controladas', 'Control y Caja', TRUE, FALSE, ''),
        (20, 'Nadie ha olvidado nada', 'Seguridad y Cierre', FALSE, FALSE, '');
    END IF;
END $$;

-- ============================================================================
-- FUNCIÓN RPC PARA REINICIAR EL TURNO PARA UNA NUEVA NOCHE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reset_lovo_shift()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Eliminar tareas personalizadas de madrugada del turno anterior
    DELETE FROM public.lovo_tasks WHERE is_custom = TRUE;

    -- Reiniciar el estado de las 20 tareas base de LoVo
    UPDATE public.lovo_tasks
    SET
        is_completed = FALSE,
        assigned_to = '',
        completed_by = '',
        notes = '',
        completed_at = NULL,
        updated_at = NOW();

    -- Reiniciar el estado global del turno
    UPDATE public.lovo_shift_state
    SET
        shift_date = CURRENT_DATE,
        general_notes = '',
        closed_by = '',
        is_closed = FALSE,
        closed_at = NULL,
        updated_at = NOW()
    WHERE id = 1;
END;
$$;
