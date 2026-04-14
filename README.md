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

## 🌐 Deploy en GitHub Pages

Ya está incluido el workflow en [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml).

### 1) Configurar Pages

- En GitHub: `Settings` → `Pages`
- `Source`: **GitHub Actions**

### 2) Configurar variables del repositorio

En `Settings` → `Secrets and variables` → `Actions` → `Variables`, crear:

- `VITE_RESULTS_EXCEL_URL`
- `VITE_FIXTURE_EXCEL_URL`
- `VITE_AUTO_REFRESH_MS` (opcional, default `120000`)
- `VITE_ENABLE_MANUAL_UPLOAD` (opcional, default `false`)

### 3) Hacer push

Cada push a `main` o `master` dispara build y deploy automático.

> Nota: para GitHub Pages de proyecto se usa base `/${repo}/` automáticamente con `VITE_BASE_PATH`.

## 🌐 Deploy en GitLab Pages

Se incluye [.gitlab-ci.yml](.gitlab-ci.yml) para publicar `dist` como Pages.

Importante: `.env` está en `.gitignore`, por eso en GitLab CI no existe y la app cae en datos demo.

En GitLab, configurar variables en `Settings` → `CI/CD` → `Variables`:

- `VITE_RESULTS_EXCEL_URL`
- `VITE_FIXTURE_EXCEL_URL`
- `VITE_AUTO_REFRESH_MS` (opcional)
- `VITE_ENABLE_MANUAL_UPLOAD` (opcional)

Luego hacer push a `main` o `master` para redeploy.
