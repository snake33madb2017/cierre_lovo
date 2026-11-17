# 🍸 LoVo Cocktail Club — PWA de Cierre Nocturno en Tiempo Real

Aplicación Web Progresiva (PWA) interactiva y multi-usuario en tiempo real diseñada para el cierre de turno nocturno de la coctelería **LoVo**, lista para desplegar en **Render** y conectada a **Supabase Realtime**.

---

## ✨ Características Principales

1. **Sincronización en Tiempo Real (Supabase Realtime + Presence)**:
   - Hasta **15+ empleados simultáneos** escaneando un código QR desde sus móviles sin pisarse el trabajo.
   - Suscripción a eventos `postgres_changes` (`INSERT`, `UPDATE`, `DELETE`) sobre las tablas `lovo_tasks` y `lovo_shift_state`.
   - Indicador en vivo de compañeros conectados (`Presence`) y destello dorado cuando un compañero actualiza una tarea.
2. **Roles de Acceso Diferenciados**:
   - **Rol Empleado**: Marca tareas completadas, reclama responsabilidad con un toque (*"Yo me encargo"*), añade notas de incidencias y crea tareas personalizadas imprevistas de madrugada.
   - **Rol Encargado / Verificador**: Incluye todo lo anterior más el **Panel de Supervisión Global** (desglose de tareas por empleado, sellado de fecha y hora exacta de cierre, caja de observaciones generales y envío oficial por WhatsApp).
3. **20 Tareas Iniciales Oficiales de LoVo Pre-cargadas**:
   - Incluye las 20 tareas oficiales organizadas por áreas (*Limpieza y Sala*, *Barra y Stock*, *Cabina y Técnica*, *Control y Caja*, *Seguridad y Cierre*) con notas destacadas en `7 Qr (con notas de incidencias)`, `2700€ Aprox (Caja)` y `Otros / Incidencias controladas`.
4. **Reporte Final Automatizado a WhatsApp (`+34 678 14 69 56`)**:
   - Sella la fecha y hora exacta del cierre, guarda una instantánea en `lovo_shift_history` y abre WhatsApp con el mensaje estructurado y listo para enviar al `+34678146956`.
5. **Diseño Mobile-First & PWA Instalable**:
   - Estética nocturna de alta coctelería (negro obsidiana + acentos ámbar/dorado `#D4AF37`), `manifest.json` y Service Worker (`sw.js`).

---

## 📂 Estructura del Proyecto

```text
D:\Cierre Lovo\
├── package.json              # Dependencias y scripts de inicio para Render / Node.js
├── server.js                 # Servidor Express (sirve la PWA e inyecta /api/config)
├── render.yaml               # Blueprint oficial para despliegue automático en Render
├── .env.example              # Plantilla de variables de entorno (SUPABASE_URL, SUPABASE_ANON_KEY)
├── .gitignore                # Archivos ignorados por Git
├── supabase/
│   └── schema.sql            # Script SQL completo (Tablas, RLS, Realtime, Trigger y Seed de 20 tareas)
└── public/
    ├── index.html            # Interfaz Mobile-First (Selección de rol, Checklist, Panel Encargado, QR)
    ├── manifest.json         # Manifiesto PWA instalable
    ├── sw.js                 # Service Worker
    ├── css/
    │   └── styles.css        # Estilos nocturnos LoVo y animaciones Realtime
    ├── js/
    │   ├── config.js         # Carga dinámica de SUPABASE_URL y SUPABASE_ANON_KEY
    │   ├── supabase-client.js# Cliente Supabase Realtime + Presence + Respaldo Local
    │   └── app.js            # Lógica de roles, tareas, supervisión y generador de WhatsApp
    └── icons/
        ├── icon-192.svg      # Icono PWA 192x192
        └── icon-512.svg      # Icono PWA 512x512
```

---

## 🛠️ Paso 1: Configurar la Base de Datos en Supabase

1. Entra en [https://supabase.com](https://supabase.com) y crea un nuevo proyecto (ej. `lovo-cierre`).
2. En el menú lateral izquierdo, abre **SQL Editor** y haz clic en **New Query**.
3. Copia y pega todo el contenido del archivo [`supabase/schema.sql`](./supabase/schema.sql) y pulsa **Run**.
   - Esto creará automáticamente las tablas `lovo_tasks`, `lovo_shift_state` y `lovo_shift_history`, activará **Supabase Realtime**, configurará las políticas **RLS** y cargará las **20 tareas iniciales de LoVo**.
4. Ve a **Project Settings → API** y copia:
   - **Project URL** (`SUPABASE_URL`)
   - **anon public key** (`SUPABASE_ANON_KEY`)

---

## 🚀 Paso 2: Despliegue en Render

1. Sube este directorio a un repositorio de GitHub o GitLab.
2. Entra en [https://dashboard.render.com](https://dashboard.render.com) y selecciona **New + → Web Service** (o **Blueprint** para usar `render.yaml` automáticamente).
3. Configura el servicio:
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. En la pestaña **Environment**, añade las variables de entorno:
   - `SUPABASE_URL` = `https://tu-proyecto.supabase.co`
   - `SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - `WHATSAPP_PHONE` = `34678146956`
5. Una vez desplegado, abre la URL de Render, pulsa el botón **"QR Equipo"** en la esquina superior derecha y compártelo o imprímelo en barra para que los 15 empleados lo escaneen cada noche.

---

## 💻 Ejecución en Local

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar archivo de variables de entorno y rellenar credenciales de Supabase
copy .env.example .env

# 3. Iniciar el servidor
npm start
```
Abre `http://localhost:3000` en tu navegador.
