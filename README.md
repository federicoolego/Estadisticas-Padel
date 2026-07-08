# 🎾 Pádel · Estadísticas

Dashboard para llevar el registro y las estadísticas de mis partidos y torneos de pádel.
La app funciona en **dos modos** intercambiables desde la UI:

- 🖥️ **Local** — lee los JSON estáticos del repo (`data/*.json`). Solo lectura. Es el modo por defecto y funciona sin depender de nada externo.
- ☁️ **Producción** — lee y escribe contra **Supabase**. Incluye modo administrador con altas, bajas y modificaciones desde la propia UI.

El switch está arriba a la derecha y la preferencia se guarda en `localStorage`.

## 📂 Estructura

```
Estadisticas-Padel/
├── index.html                # Dashboard (KPIs + gráficos + filtros + tabs)
├── css/
│   ├── styles.css            # Estilos base
│   └── admin.css             # Estilos del switch de entorno y modo admin
├── js/
│   ├── env.js                # Switch de entorno + loader unificado
│   ├── supabase-client.js    # Cliente Supabase (solo se instancia en modo Prod)
│   ├── partidos.js           # Tab Partidos: filtros, KPIs, charts, tabla
│   ├── torneos.js            # Tab Torneos: filtros, KPIs, charts, tabla
│   └── admin.js              # Auth + ABM (solo activo en modo Prod)
├── data/
│   ├── partidos.json         # Fuente de datos del modo Local
│   └── torneos.json          # Fuente de datos del modo Local
└── README.md
```

## 📊 Qué muestra

**Tab Partidos**

- **KPIs**: partidos jugados, ganados, perdidos, diferencia, efectividad, mejor y peor racha, racha actual.
- **Gráficos** (Chart.js): partidos y efectividad por año, por mes, por formato y por cancha; top 5 compañeros y top 5 rivales por cantidad de partidos.
- **Filtros**: Año, Mes, Formato, Cancha, Compañero, Rival y Resultado. Todo se recalcula al instante.
- **Tabla** con el detalle completo de partidos.

**Tab Torneos**

- **KPIs**: torneos jugados, 🥇 campeón, 🥈 subcampeón, podios totales, % podios, finales jugadas, semifinales alcanzadas, instancia más frecuente.
- **Gráficos**: torneos y % podios por año, por organizador y por categoría; distribución de instancia máxima alcanzada; top 5 compañeros de torneo.
- **Filtros**: Año, Mes, Organizador, Categoría, Compañero, Puesto.
- **Tabla** con el detalle completo de torneos.

**Otros**

- Botón flotante para **compartir estadísticas por WhatsApp** con imagen PNG generada en el navegador.

## 🖥️ Modo Local (default)

Lee `data/partidos.json` y `data/torneos.json` directamente del repo. Ideal para:

- Ver la app sin depender de Supabase.
- Trabajar offline o si Supabase está caído.
- Deploy puro en GitHub Pages sin backend.

Para cargar un partido o torneo nuevo en modo Local, editá el JSON correspondiente y hacé commit:

```json
{
  "id": 206,
  "fecha": "2026-07-15",
  "mes": 7,
  "anio": 2026,
  "cancha": "NODO",
  "formato": "TURNO",
  "companiero": "Lucho Vitali",
  "rivales": "Chino Mazza - Lauri Lafuente",
  "resultado": "PG",
  "dia": "Miércoles"
}
```

Los combos de filtros se arman solos a partir de los valores presentes.

## ☁️ Modo Producción (Supabase)

Lee y escribe contra Supabase. Ideal para gestionar los datos desde la propia UI sin editar JSON a mano.

**Cómo se cargan datos**: click en 🔒 **Admin** → login → aparecen los botones **➕ Nuevo partido** / **➕ Nuevo torneo** en cada tab, y cada fila de tabla se vuelve clickeable para editar o eliminar.

### Setup inicial de Supabase

1. Crear proyecto en [supabase.com](https://supabase.com) (región South America / São Paulo para latencia baja desde Argentina).
2. En **SQL Editor**, crear las tablas `partidos` y `torneos` con sus políticas RLS (lectura pública, escritura solo autenticados).
3. Importar los datos iniciales desde CSV (Table Editor → Insert → Import data from CSV).
4. Crear un usuario admin en **Authentication → Users → Add user**.
5. En `js/supabase-client.js`, reemplazar las constantes `SUPABASE_URL` y `SUPABASE_ANON_KEY` con las del proyecto (**Project Settings → API**). La `anon key` es pública por diseño; las RLS son las que blindan la escritura.

Una vez configurado, cambiar al modo Producción desde el switch arriba a la derecha.

## ▶️ Cómo verlo localmente

Como se hace `fetch` de recursos, hay que servirlo con un servidor local (no doble clic):

```bash
python -m http.server 8000
# luego abrí http://localhost:8000
```

En GitHub Pages funciona directamente sin configuración extra.

## 🔒 Seguridad

- Las políticas **Row Level Security** (RLS) de Supabase permiten lectura anónima pero restringen escritura a usuarios autenticados.
- La `anon key` va en el frontend porque es pública por diseño. La `service_role key` **nunca** se usa en el cliente.
- El modo Local no expone ningún endpoint de escritura: es HTML/JS estático puro.
