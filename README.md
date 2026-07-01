# 🎾 Pádel · Historial de Partidos

Dashboard estático para llevar el registro y las estadísticas de mis partidos de pádel.
Los datos viven en un único JSON que voy alimentando a mano; el dashboard los lee y
calcula todos los KPIs y gráficos en el navegador.

## 📂 Estructura

```
padel/
├── index.html          # Dashboard (KPIs + gráficos + filtros)
├── css/
│   └── styles.css      # Estilos
├── js/
│   └── app.js          # Carga del JSON, filtros y gráficos (Chart.js)
├── data/
│   └── partidos.json   # ⬅️ FUENTE DE DATOS: acá cargo cada partido
└── README.md
```

## 📊 Qué muestra

- **KPIs**: partidos jugados, ganados, perdidos, diferencia y efectividad.
- **Gráficos** (Chart.js): balance ganados/perdidos, efectividad por mes,
  resultados por formato, resultados por cancha, y ranking de efectividad
  por compañero y por rival.
- **Filtros**: Compañero, Rival, Año, Mes, Cancha y Formato. Todo se recalcula al instante.

## ➕ Cómo cargar un partido nuevo

Editá `data/partidos.json` y agregá un objeto al array:

```json
{
  "id": 204,
  "fecha": "2026-07-05",
  "mes": 7,
  "anio": 2026,
  "cancha": "NODO",
  "formato": "TURNO",
  "companiero": "Lucho Vitali",
  "rivales": "Chino Mazza - Lauri Lafuente",
  "resultado": "PG",
  "dia": "Sábado"
}
```

| Campo        | Descripción                              |
|--------------|------------------------------------------|
| `id`         | Número correlativo del partido           |
| `fecha`      | `YYYY-MM-DD`                             |
| `mes`        | Número de mes (1–12)                      |
| `anio`       | Año                                      |
| `cancha`     | Nombre de la cancha                      |
| `formato`    | TURNO / TURNO MIXTO / TORNEO / etc.      |
| `companiero` | Compañero de ese partido                 |
| `rivales`    | Pareja rival (o `null`)                  |
| `resultado`  | `"PG"` (ganado) o `"PP"` (perdido)       |
| `dia`        | Día de la semana                         |

Los desplegables de filtros se arman solos a partir de los valores del JSON,
así que no hace falta tocar nada más.

## ▶️ Cómo verlo localmente

Como el dashboard hace `fetch` del JSON, abrí con un servidor local (no con doble clic):

```bash
python -m http.server 8000
# luego abrí http://localhost:8000
```

En GitHub Pages funciona directamente sin configuración extra.
