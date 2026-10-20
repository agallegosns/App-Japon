import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import { formatTimestamp } from '../../models/datetime';
import { formatBytes } from '../../storage/persistence';
import { Button } from '../../ui/Button';
import { errorMessage } from '../../ui/States';
import { labDb, type LabFile } from './labDb';
import { LabSection } from './LabSection';
import { labMapStyle } from './mapStyle';
import { assetUrl } from './offlineAssets';
import { formatMs, useLabReport } from './report';

const FILE_KEY = 'kyoto-centro.pmtiles';
const FILE_PATH = `offline/${FILE_KEY}`;
const SOURCE_KEY = 'nihon-local-kyoto';
// Centro de Kioto (estación ↔ Gion)
const CENTER: [number, number] = [135.768, 35.0];

export function MapLab() {
  const { report } = useLabReport();
  const [busy, setBusy] = useState<string | null>(null);
  const [stored, setStored] = useState<LabFile | null>(null);
  const [showMap, setShowMap] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    labDb().files.get(FILE_KEY).then((f) => setStored(f ?? null)).catch(() => setStored(null));
  }, []);

  const download = async () => {
    setBusy('Descargando extracto…');
    const t0 = performance.now();
    try {
      const res = await fetch(assetUrl(FILE_PATH), { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status} al descargar ${FILE_PATH}. ¿Se generó el extracto en el último despliegue?`);
      const blob = await res.blob();
      const header = new Uint8Array(await blob.slice(0, 7).arrayBuffer());
      if (String.fromCharCode(...header) !== 'PMTiles') throw new Error('El archivo descargado no es un PMTiles válido.');
      const file: LabFile = { key: FILE_KEY, blob, size: blob.size, savedAt: Date.now(), source: FILE_PATH };
      await labDb().files.put(file);
      const back = await labDb().files.get(FILE_KEY);
      if (!back || back.blob.size !== blob.size) throw new Error('El archivo no se pudo releer de IndexedDB.');
      setStored(back);
      report('map-download', {
        title: 'Mapas: descarga del extracto',
        status: 'ok',
        lines: [`${FILE_PATH}: ${formatBytes(blob.size)} descargado en ${formatMs(performance.now() - t0)} y guardado en IndexedDB.`],
      });
    } catch (e) {
      report('map-download', { title: 'Mapas: descarga del extracto', status: 'fail', lines: [`ERROR: ${errorMessage(e)}`] });
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    if (!showMap || !stored || !container.current) return;
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    const el = container.current;
    const t0 = performance.now();
    const lines: string[] = [`Conexión: ${navigator.onLine ? 'sí' : 'no (modo avión)'}`, `Archivo local: ${formatBytes(stored.size)} (guardado ${formatTimestamp(stored.savedAt)})`];
    report('map-render', { title: 'Mapas: render desde archivo local', status: 'running', lines: [...lines] });

    (async () => {
      const [maplibre, { PMTiles, Protocol }, workerUrl] = await Promise.all([
        import('maplibre-gl'),
        import('pmtiles'),
        import('maplibre-gl/dist/maplibre-gl-worker.mjs?url').then((m: { default: string }) => m.default),
      ]);
      if (cancelled) return;
      maplibre.setWorkerUrl(workerUrl);
      let reads = 0;
      let bytesRead = 0;
      const blob = stored.blob;
      // Fuente PMTiles que lee rangos del Blob guardado en IndexedDB: no toca la red.
      const source = {
        getKey: () => SOURCE_KEY,
        getBytes: async (offset: number, length: number) => {
          reads++;
          const data = await blob.slice(offset, offset + length).arrayBuffer();
          bytesRead += data.byteLength;
          return { data };
        },
      };
      const protocol = new Protocol();
      protocol.add(new PMTiles(source));
      maplibre.addProtocol('pmtiles', protocol.tile);
      const map = new maplibre.Map({
        container: el,
        style: labMapStyle(`pmtiles://${SOURCE_KEY}`),
        center: CENTER,
        zoom: 14,
        attributionControl: { compact: false },
      });
      cleanup = () => {
        map.remove();
        maplibre.removeProtocol('pmtiles');
      };
      map.on('error', (ev) => {
        lines.push(`Error de MapLibre: ${errorMessage(ev.error)}`);
      });
      map.once('idle', () => {
        if (cancelled) return;
        const roads = map.querySourceFeatures('protomaps', { sourceLayer: 'roads' }).length;
        const buildings = map.querySourceFeatures('protomaps', { sourceLayer: 'buildings' }).length;
        const ok = roads > 0 && reads > 0;
        report('map-render', {
          title: 'Mapas: render desde archivo local',
          status: ok ? 'ok' : 'fail',
          lines: [
            ...lines,
            `Primer render completo en ${formatMs(performance.now() - t0)}`,
            `Lecturas del archivo local: ${reads} (${formatBytes(bytesRead)})`,
            `Elementos visibles: ${roads} tramos de calle, ${buildings} edificios`,
            ok ? 'El mapa se dibuja leyendo solo del archivo guardado en el dispositivo.' : 'No se dibujó ningún elemento.',
          ],
        });
      });
    })().catch((e: unknown) => {
      report('map-render', { title: 'Mapas: render desde archivo local', status: 'fail', lines: [...lines, `ERROR: ${errorMessage(e)}`] });
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [showMap, stored, report]);

  return (
    <LabSection
      ids={['map-download', 'map-render']}
      anchor="mapas"
      title="d) Mapas sin conexión (MapLibre + PMTiles)"
      description="Descarga un extracto pequeño del centro de Kioto (OpenStreetMap vía Protomaps), lo guarda en IndexedDB y lo dibuja con un protocolo propio que lee del archivo local. Repite «Mostrar mapa» en modo avión."
    >
      <div className="spread">
        <span>Extracto en el dispositivo</span>
        <strong>{stored ? formatBytes(stored.size) : 'No'}</strong>
      </div>
      <Button variant="primary" block disabled={!!busy} onClick={download}>
        {busy ?? 'Descargar extracto de Kioto'}
      </Button>
      <Button block disabled={!stored} onClick={() => setShowMap((v) => !v)}>
        {showMap ? 'Ocultar mapa' : 'Mostrar mapa desde el archivo local'}
      </Button>
      {showMap && <div ref={container} className="lab-map" role="img" aria-label="Mapa de prueba del centro de Kioto" />}
      <p className="muted small">Datos © colaboradores de OpenStreetMap, licencia ODbL. Teselas generadas con Protomaps.</p>
    </LabSection>
  );
}
