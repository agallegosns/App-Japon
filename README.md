# Nihon Trip

App personal (PWA) para organizar y vivir un viaje a Japón: reservas con sus documentos, itinerario por días y
ciudades, dirección en japonés a pantalla completa, traductor con cámara y copias de seguridad.
Las reservas, los documentos y el itinerario funcionan **sin conexión**; el traductor y el mapa necesitan Internet.

**Dirección de la app:** https://agallegosns.github.io/App-Japon/

Pensada para iPhone (Safari) instalada en la pantalla de inicio. No tiene servidor ni cuentas: los datos solo
existen en cada iPhone y en las copias de seguridad que hagas.

## Instalar en el iPhone

1. Abre la dirección de arriba en **Safari**.
2. Botón **Compartir** → **Añadir a pantalla de inicio** → **Añadir**.
3. Abre la app **siempre desde el icono** (no desde Safari). Si la abres desde Safari verás el aviso
   «Instala la app para que tus datos se conserven».
4. La primera vez, con conexión, espera unos segundos: la app se guarda entera para funcionar sin conexión.
   Puedes comprobarlo en **Viaje → icono de nube → Preparar Japón sin conexión**.

## Uso

- **Viaje (inicio):** nombre, cuenta atrás, día y ciudad actuales, próxima actividad y reserva, accesos
  rápidos, información pendiente, aviso de copia de seguridad y estado sin conexión.
- **Trenes:** las reservas de «Tren / transporte» se guardan por trayectos (con transbordos): estaciones con buscador,
  tren o servicio, **tipo de billete** (Suica, asiento reservado, sin reserva, pase), **vagón y asiento**, y horas locales.
  Con Suica no se pide asiento. El día del tren sale como «Día de traslado» (azul) y «Hoy te mueves de Tokio a Kioto».
- **Itinerario:** días del viaje con su ciudad; paradas con hora, ubicación, reserva asociada y estado.
  Reordena arrastrando el asa o con las flechas. Avisa de solapes de horario y de datos que faltan.
- **Reservas:** vuelos, alojamientos, restaurantes, entradas, trenes y otros. Los vuelos admiten escalas (un tramo
  por despegue) con buscador de aeropuertos y cálculo de la duración de cada escala. Adjunta PDF o capturas y
  ábrelos a pantalla completa. Por seguridad no hay campo de localizador ni de códigos QR. El **precio** se
  convierte solo entre yenes y euros. Los **alojamientos** tienen sección de **tasas** (por persona y noche o importe
  total, pagadas o por pagar). «Cómo llegar» abre la ruta en Google Maps.
- **Itinerario:** cada día tiene una cabecera con el número de día, la ciudad y dónde duermes (por check-in/check-out o
  elegido a mano). Los días con vuelo se marcan en rojo con un avión y muestran un bloque «Día de vuelo» con ruta,
  horas locales y escalas. Una **actividad** es algo que hacéis ese día (visita, comida, traslado), con hora y lugar.
  Las reservas del día (restaurantes, entradas, trenes) salen aparte. Botón del calendario arriba a la derecha.
- **Yenes y euros:** conversor en el inicio (botón «Yenes»). La cotización se actualiza sola con conexión (BCE) y se
  guarda en el móvil; también puedes escribir la que te aplique tu banco. Sin conexión usa la última guardada.
- **Inicio:** un **calendario de una semana** (botón «Ver el mes completo» para desplegarlo). Cada día marca si hay vuelo, tren, actividades,
  reservas o cambio de hotel, y debajo se ve automáticamente la agenda del día seleccionado (hoy, o el primer día con plan antes del
  viaje) con un resumen («3 actividades · 1 vuelo»). Más abajo, atajos, «Lo próximo y lo pendiente» y una barra de estado.
- **Compartir con tu pareja:** Ajustes → «Compartir con tu pareja». Un móvil crea un **código secreto** y el otro lo escribe: desde
  ese momento lo que añadáis (reservas, actividades, trenes, documentos…) aparece en los dos. Los datos viajan **cifrados**; el servidor
  (un Worker gratuito de Cloudflare propio) solo guarda datos ilegibles. Se sincroniza solo al abrir la app, al recuperar la conexión y
  poco después de cada cambio. Sin conexión, cada móvil sigue funcionando y se pone al día al volver.
- **Menú superior:** el botón **¥ ⇄ €** está en todas las pantallas y abre el conversor sin salir de donde estás.
- **Traductor:** cámara japonés → español. Necesita Internet (la foto no sale del móvil; solo el texto reconocido
  se envía a MyMemory, límite gratuito ≈ 5 000 caracteres/día).
- **Mapa:** en desarrollo; necesitará Internet.
- **Avisos:** Ajustes → «Avisos en el iPhone» pasa el itinerario y las reservas al Calendario del iPhone con avisos
  (30 min antes de cada actividad, 1 h antes de check-in/out y reservas, 3 h antes de cada vuelo). Funciona sin
  conexión. No hay notificaciones push (requieren un servidor).
- **Ajustes:** copia de seguridad, importar copia, almacenamiento, actualizaciones, Laboratorio y borrado.

### Copias de seguridad

Ajustes → **Exportar copia completa** genera un único `.zip` con todo (también los adjuntos) y abre la hoja de
compartir: **Guardar en Archivos** (iCloud Drive) o **AirDrop** al otro iPhone. Para restaurar o pasar los
datos al otro iPhone: Ajustes → **Importar copia** → elegir el `.zip` → ver la vista previa → **Combinar** o
**Reemplazar**. Haz una copia al menos cada 14 días y siempre tras añadir documentos.

### Actualizaciones

Cuando haya una versión nueva verás «Actualización disponible». Se aplica solo al pulsar **Actualizar**; la
app nunca se recarga sola y las actualizaciones no tocan tus datos.

## Estado

| Fase | Estado |
| --- | --- |
| 1. Base y Laboratorio de viabilidad | Hecha. Pruebas reales pendientes de ejecutar en los iPhone. |
| 2. Interfaz y navegación | Hecha. |
| 3. Reservas, itinerario y almacenamiento | Hecha. Pendiente de verificar en dispositivo. |
| v0.4.0: escalas, aeropuertos, alojamiento por día, sin códigos | Hecha. Probada en CI; pendiente de verificar en dispositivo. |
| Traductor con cámara | Hecho. La cámara, el OCR y la traducción en línea están pendientes de verificar en iPhone. |
| Mapa | Pendiente (con conexión). |

Detalle en [TASKS.md](TASKS.md) y decisiones técnicas en [ARCHITECTURE.md](ARCHITECTURE.md).

## No hacer nunca

- **No renombrar el usuario de GitHub ni el repositorio.** La dirección de la app cambiaría y el iPhone la
  trataría como otra app: los datos guardados quedarían en la dirección antigua, inaccesibles.
- **No poner el repositorio en privado.** GitHub Pages gratuito dejaría de publicar la app.
- **No borrar el icono de la app de la pantalla de inicio sin haber hecho antes una copia de seguridad.**
  En iPhone, borrar el icono borra también todos los datos de la app.
- No borrar los datos de Safari («Borrar historial y datos de sitios web») sin copia previa.
- No subir al repositorio copias de seguridad, PDF, capturas ni datos reales del viaje.
- No desactivar GitHub Pages ni cambiar su origen («GitHub Actions») en Settings → Pages.
- No borrar la rama `offline-assets` (contiene el extracto de mapa de prueba del Laboratorio).

## Checklist de congelación antes del viaje

Hacer 1–2 semanas antes de salir, con los dos iPhone:

1. Pedir a Claude que **congele la versión**: no se publican más cambios hasta la vuelta, salvo un fallo grave.
2. En cada iPhone, abrir la app desde el icono con conexión y aplicar «Actualizar» si aparece el aviso.
3. Comprobar en Ajustes que la versión es la misma en los dos iPhone.
4. Ajustes → Almacenamiento: «Almacenamiento persistente: Concedido».
5. Viaje → Preparar Japón sin conexión → **todo en verde**.
6. Abrir cada PDF y cada imagen adjunta de las reservas al menos una vez.
7. Activar **modo avión**, cerrar la app del todo, volver a abrirla y repetir el punto 5 y 6.
8. Exportar una copia de seguridad en cada iPhone y guardarla en Archivos/iCloud Drive.
9. Importar la copia de un iPhone en el otro (Combinar) si se quiere tener los mismos datos.
10. Durante el viaje: copia de seguridad cada pocos días y siempre tras añadir documentos.

## Licencias y atribución

- Mapas (prueba del Laboratorio): datos © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright),
  licencia ODbL; teselas generadas con [Protomaps](https://protomaps.com).
- Traducción (prueba): modelos OPUS-MT de Helsinki-NLP (CC-BY 4.0).
- OCR: Tesseract (Apache 2.0) vía Tesseract.js. Fuente Noto Sans JP (SIL OFL 1.1). Iconos Lucide (ISC).

## Desarrollo

El desarrollo lo hace Claude Code siguiendo [CLAUDE.md](CLAUDE.md). Cada push a `main` ejecuta typecheck,
lint, tests y build en GitHub Actions y, si todo está en verde, publica en GitHub Pages.
