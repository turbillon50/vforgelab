# MIA · VForgeLab — interfaz PWA

Tres pantallas: ALIX, Energía y BranchKiller. Adaptación de los materiales originales de Védika y de la jerarquía del profesor del EXCI. Ver DESIGN-SOURCES.md.

## Revisar el diseño

`preview.html` es una copia autónoma y navegable de las tres pantallas. No hace llamadas al servidor, no recibe tokens y no inventa datos ni respuestas de ALIX. Se genera desde las mismas pantallas y estilos del producto.

## Interfaz conectada

Servir `index.html` y sus archivos en `/mia/` del mismo origen que el runtime. La ruta por defecto de API es `/mia`; se puede cambiar con `data-api-base` en `body`. El host debe servir los archivos estáticos, manifiesto e iconos; no basta con que Flask sirva solo index.html.

- POST `/mia/api/chat`: `{mensaje,historial}` → `{ok,texto}`.
- GET `/mia/api/energia`: `{ok,disco,ram,load,daemon,procesos}`.
- GET `/mia/api/branches`: `{ok,worktrees:[{worktree,mb,limpio}]}`.

Se conserva el contrato real del runtime existente de MIA. Todas las peticiones utilizan `x-sala-token`, introducido por el propietario y guardado solo en sessionStorage. Ninguna llave de Nebius llega al frontend. Tokens en URLs no se usan.

La navegación y el diseño pueden revisarse sin conectar el servidor. Energía se actualiza cada 15 segundos solo cuando está visible; errores marcan la lectura como anterior. El chat conserva el historial únicamente durante la sesión de la página, no promete persistencia nueva. Pegar y enviar adjuntos no se incluye en este runtime de tres áreas.

BranchKiller permite escanear, filtrar y revisar. La eliminación no se habilita porque el backend actual no verifica procesos activos ni commits sin publicar. No se ejecutaron borrados.

## PWA

Manifest e iconos PNG 192/512 y SVG. El service worker almacena únicamente el shell; nunca API, conversaciones, tokens ni telemetría. Necesita HTTPS o localhost para instalarse. Las fuentes externas tienen fallback del sistema.

## Estado de verificación

- Sintaxis app.js y sw.js comprobada con Node.
- IDs únicos, referencias DOM, assets enlazados y manifiesto comprobados.
- Backend MIA → Nebius → Nemotron comprobado por separado: HTTP200, texto MIA_NEBIUS_OK, 0.67 segundos (medición única).
- Pendientes: recorrido navegador → API con esta interfaz; QA visual de las tres pantallas; instalación PWA real. El servicio de vista previa de este entorno no está disponible y el navegador no permite abrir archivos locales.

No se desplegó ni se cambió la configuración de producción.

## Relación con el backend nuevo de VForgeLab

El backend `src/server.mjs` de este repositorio tiene un contrato diferente y usa una credencial de servicio. Esta interfaz conserva el contrato `/mia` del runtime existente; no entrega `VFORGELAB_API_KEY` al navegador ni declara que el backend nuevo esté conectado. Integrarlo requiere un adaptador de sesión verificada en el servidor y endpoints de lectura de telemetría/escaneo. La vista de diseño no depende de ese adaptador.

## Vercel release

Vercel serves this directory at the project root. The three explicit /mia/api routes forward to the existing MIA runtime on sala.vforge.site, retaining owner authentication and keeping provider credentials on the backend. Deletion is not exposed. This release does not yet bridge the UI to the separate persistent src/server.mjs API.
