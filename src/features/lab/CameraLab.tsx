import { useEffect, useRef, useState } from 'react';
import { isStandalone } from '../../app/standalone';
import { Button } from '../../ui/Button';
import { errorMessage } from '../../ui/States';
import { useObjectUrl } from '../../ui/useObjectUrl';
import { LabSection } from './LabSection';
import { formatMs, useLabReport } from './report';

function imageSize(file: Blob): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      reject(new Error('No se pudo decodificar la imagen.'));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

export function CameraLab() {
  const { report } = useLabReport();
  const input = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captured, setCaptured] = useState<Blob | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const clickAt = useRef(0);
  const capturedUrl = useObjectUrl(captured);
  const photoUrl = useObjectUrl(photo);
  const mode = isStandalone() ? 'instalada' : 'Safari';

  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { w, h } = await imageSize(file);
      setPhoto(file);
      report('camera-input', {
        title: 'Cámara: input capture',
        status: 'ok',
        lines: [`Modo: ${mode}`, `Foto: ${w}×${h}, ${(file.size / 1024).toFixed(0)} KB, ${file.type || 'tipo desconocido'}`, `Desde pulsar hasta tener la foto: ${formatMs(performance.now() - clickAt.current)}`],
      });
    } catch (e) {
      report('camera-input', { title: 'Cámara: input capture', status: 'fail', lines: [`Modo: ${mode}`, errorMessage(e)] });
    } finally {
      if (input.current) input.current.value = '';
    }
  };

  const startStream = async () => {
    const t0 = performance.now();
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('getUserMedia no está disponible en este modo.');
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } }, audio: false });
      setStream(s);
      if (video.current) {
        video.current.srcObject = s;
        await video.current.play();
      }
      const settings = s.getVideoTracks()[0]?.getSettings();
      report('camera-gum', {
        title: 'Cámara: getUserMedia',
        status: 'info',
        lines: [`Modo: ${mode}`, `Vídeo abierto en ${formatMs(performance.now() - t0)}: ${settings?.width ?? '?'}×${settings?.height ?? '?'}, facingMode=${settings?.facingMode ?? '?'}`, 'Pulsa «Capturar fotograma» para completar la prueba.'],
      });
    } catch (e) {
      report('camera-gum', { title: 'Cámara: getUserMedia', status: 'fail', lines: [`Modo: ${mode}`, `ERROR ${e instanceof DOMException ? e.name : ''}: ${errorMessage(e)}`] });
    }
  };

  const capture = () => {
    const v = video.current;
    if (!v || !stream || v.videoWidth === 0) {
      report('camera-gum', { title: 'Cámara: getUserMedia', status: 'fail', lines: [`Modo: ${mode}`, 'El vídeo no tiene imagen (videoWidth = 0).'] });
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d')?.drawImage(v, 0, 0);
    canvas.toBlob((b) => {
      if (!b) {
        report('camera-gum', { title: 'Cámara: getUserMedia', status: 'fail', lines: [`Modo: ${mode}`, 'No se pudo generar la imagen.'] });
        return;
      }
      setCaptured(b);
      report('camera-gum', {
        title: 'Cámara: getUserMedia',
        status: 'ok',
        lines: [`Modo: ${mode}`, `Fotograma capturado: ${canvas.width}×${canvas.height}, ${(b.size / 1024).toFixed(0)} KB`],
      });
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }, 'image/jpeg', 0.9);
  };

  return (
    <LabSection
      ids={['camera-input', 'camera-gum']}
      anchor="camara"
      title="f) Cámara"
      description="Compara los dos métodos. Repite la prueba con la app instalada (pantalla de inicio): en ese modo algunos iOS han tenido fallos con getUserMedia."
    >
      <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void onPhoto(e.target.files?.[0])} />
      <Button
        block
        onClick={() => {
          clickAt.current = performance.now();
          input.current?.click();
        }}
      >
        Método 1: input capture (cámara del sistema)
      </Button>
      {photoUrl && <img src={photoUrl} alt="Foto tomada con input capture" className="lab-media" />}
      <Button block onClick={stream ? capture : startStream}>
        {stream ? 'Capturar fotograma' : 'Método 2: getUserMedia (vídeo en la app)'}
      </Button>
      <video ref={video} className="lab-media" playsInline muted hidden={!stream} />
      {capturedUrl && !stream && <img src={capturedUrl} alt="Fotograma capturado con getUserMedia" className="lab-media" />}
    </LabSection>
  );
}
