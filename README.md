# Torneo en Vivo (React + Tailwind + Excel)

App web mobile-first para visualizar torneo de fútbol desde Excel (resultados, tabla, fixture, goleadores y fair play).

## ✨ Features

- UI estilo app deportiva (dark mode, cards, navegación inferior en mobile)
- Carga por URL de Excel para producción (sin upload manual)
- Parseo a JSON en cliente con `xlsx` (SheetJS)
- Actualización automática de resultados desde URL
- Filtro por equipo
- Buscador de jugadores
- Historial por fecha/jornada
- Docker listo para desarrollo con hot reload

## 🧱 Stack

- React + Vite
- TailwindCSS
- SheetJS (`xlsx`)
- Docker + Docker Compose

## 🚀 Ejecutar con Docker

1. (Opcional) Crear `.env` desde `.env.example`
2. Levantar entorno:

```bash
docker-compose up --build
```

3. Abrir:

- http://localhost:3000

## 🧪 Ejecutar local sin Docker

```bash
npm install
npm run dev
```

## 📊 Estructura esperada del Excel

Idealmente en hojas separadas (nombres flexibles, se detectan por texto parecido):

1. Resultados / Fecha actual
2. Tabla de posiciones
3. Próxima fecha / Fixture
4. Goleadores
5. Fair Play

### Headers sugeridos

- Resultados: `Local`, `Visitante`, `Goles Local`, `Goles Visitante`, `Horario`, `Cancha`, `Fecha`
- Posiciones: `Equipo`, `PJ`, `G`, `E`, `P`, `GF`, `GC`, `DIF`, `PTS`
- Fixture: `Local`, `Visitante`, `Horario`, `Cancha`, `Fecha`
- Goleadores: `Jugador`, `Equipo`, `Goles`
- Fair Play: `Equipo`, `Fair Play` (o `PTS`)

El parser incluye aliases para variaciones comunes de nombres.

## 🔁 Actualización automática

Configurar en `.env`:

- `VITE_RESULTS_EXCEL_URL=https://tu-dominio/data/resultados.xlsx`
- `VITE_FIXTURE_EXCEL_URL=https://tu-dominio/data/fixture.xlsx`
- `VITE_AUTO_REFRESH_MS=120000`
- `VITE_ENABLE_MANUAL_UPLOAD=false`

Comportamiento:

- `VITE_RESULTS_EXCEL_URL`: se refresca automáticamente en intervalos.
- `VITE_FIXTURE_EXCEL_URL`: se carga una sola vez y se guarda localmente en el navegador.
- `VITE_ENABLE_MANUAL_UPLOAD=false`: oculta los botones de carga manual (recomendado en Internet).

### Opción recomendada para publicar

Serví dos archivos estáticos con URL fija:

- `/data/resultados.xlsx`
- `/data/fixture.xlsx`

Cuando actualices resultados, reemplazás `resultados.xlsx` en el servidor y la app lo toma sola.

## 📁 Archivos clave

- `src/lib/excelParser.js`: parseo y normalización Excel → JSON
- `src/App.jsx`: UI + tabs + filtros + auto-refresh
- `docker-compose.yml`: entorno de desarrollo en contenedor
# torneo-utn
