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
- **Itinerario:** días del viaje con su ciudad; paradas con hora, ubicación, reserva asociada y estado.
  Reordena arrastrando el asa o con las flechas. Avisa de solapes de horario y de datos que faltan.
- **Reservas:** vuelos, alojamientos, restaurantes, entradas, trenes y otros. Los vuelos admiten escalas (un tramo
  por despegue) con buscador de aeropuertos y cálculo de la duración de cada escala. Adjunta PDF o capturas y
  ábrelos a pantalla completa. «Mostrar dirección en japonés» la enseña en letra muy grande. Por seguridad no
  hay campo de localizador ni de códigos QR.
- **Itinerario:** cada día muestra el alojamiento de esa noche (por check-in/check-out o elegido a mano) y los
  avisos de check-in/check-out.
- **Traductor:** cámara japonés → español. Necesita Internet (la foto no sale del móvil; solo el texto reconocido
  se envía a MyMemory, límite gratuito ≈ 5 000 caracteres/día).
- **Mapa:** en desarrollo; necesitará Internet.
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
