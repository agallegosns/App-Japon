/** Textos japoneses genéricos de las imágenes de prueba del OCR (public/lab/). */
export const OCR_SAMPLES = {
  horizontal: {
    image: 'lab/ocr-horizontal.png',
    lang: 'jpn',
    lines: ['東京駅 中央口', '営業時間 10:00〜20:00', 'お手洗いは二階です'],
  },
  vertical: {
    image: 'lab/ocr-vertical.png',
    lang: 'jpn_vert',
    lines: ['京都の古い寺', '静かな庭園'],
  },
} as const;

export const TRANSLATION_SAMPLES = ['駅はどこですか？', 'この電車は京都に行きますか？', 'お会計をお願いします。', '営業時間は午前十時から午後八時までです。'];
