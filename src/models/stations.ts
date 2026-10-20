export interface Station {
  /** Nombre que se guarda y se muestra. */
  name: string;
  /** Nombre en japonés (kanji). */
  jp: string;
  /** Nombre en inglés/rōmaji con el que Google Maps lo encuentra mejor. */
  en: string;
  city: string;
  aliases?: string[];
}

/**
 * Estaciones habituales de un viaje por Japón (Tokio, Kioto, Osaka, Fuji y alrededores). No es exhaustiva: si falta
 * una, se escribe a mano. Funciona sin conexión.
 */
export const STATIONS: Station[] = [
  { name: 'Tokio', jp: '東京', en: 'Tokyo Station', city: 'Tokio', aliases: ['Tokyo'] },
  { name: 'Shinagawa', jp: '品川', en: 'Shinagawa Station', city: 'Tokio' },
  { name: 'Ueno', jp: '上野', en: 'Ueno Station', city: 'Tokio' },
  { name: 'Shinjuku', jp: '新宿', en: 'Shinjuku Station', city: 'Tokio' },
  { name: 'Shibuya', jp: '渋谷', en: 'Shibuya Station', city: 'Tokio' },
  { name: 'Ikebukuro', jp: '池袋', en: 'Ikebukuro Station', city: 'Tokio' },
  { name: 'Akihabara', jp: '秋葉原', en: 'Akihabara Station', city: 'Tokio' },
  { name: 'Asakusa', jp: '浅草', en: 'Asakusa Station', city: 'Tokio' },
  { name: 'Aeropuerto de Narita', jp: '成田空港', en: 'Narita Airport Station', city: 'Tokio', aliases: ['Narita', 'NRT'] },
  { name: 'Aeropuerto de Haneda', jp: '羽田空港', en: 'Haneda Airport Station', city: 'Tokio', aliases: ['Haneda', 'HND'] },
  { name: 'Shin-Yokohama', jp: '新横浜', en: 'Shin-Yokohama Station', city: 'Yokohama' },
  { name: 'Yokohama', jp: '横浜', en: 'Yokohama Station', city: 'Yokohama' },
  { name: 'Odawara', jp: '小田原', en: 'Odawara Station', city: 'Hakone', aliases: ['Hakone'] },
  { name: 'Hakone-Yumoto', jp: '箱根湯本', en: 'Hakone-Yumoto Station', city: 'Hakone', aliases: ['Hakone'] },
  { name: 'Kamakura', jp: '鎌倉', en: 'Kamakura Station', city: 'Kamakura' },
  { name: 'Atami', jp: '熱海', en: 'Atami Station', city: 'Atami' },
  { name: 'Mishima', jp: '三島', en: 'Mishima Station', city: 'Mishima', aliases: ['Fuji'] },
  { name: 'Shin-Fuji', jp: '新富士', en: 'Shin-Fuji Station', city: 'Fuji', aliases: ['Fuji'] },
  { name: 'Otsuki', jp: '大月', en: 'Otsuki Station', city: 'Fuji', aliases: ['Fuji'] },
  { name: 'Kawaguchiko', jp: '河口湖', en: 'Kawaguchiko Station', city: 'Fuji', aliases: ['Fuji', 'Kawaguchi'] },
  { name: 'Shizuoka', jp: '静岡', en: 'Shizuoka Station', city: 'Shizuoka' },
  { name: 'Nagoya', jp: '名古屋', en: 'Nagoya Station', city: 'Nagoya' },
  { name: 'Maibara', jp: '米原', en: 'Maibara Station', city: 'Maibara' },
  { name: 'Kioto', jp: '京都', en: 'Kyoto Station', city: 'Kioto', aliases: ['Kyoto'] },
  { name: 'Nara', jp: '奈良', en: 'Nara Station', city: 'Nara' },
  { name: 'Uji', jp: '宇治', en: 'Uji Station', city: 'Kioto' },
  { name: 'Fushimi Inari', jp: '伏見稲荷', en: 'Inari Station', city: 'Kioto', aliases: ['Inari'] },
  { name: 'Arashiyama', jp: '嵐山', en: 'Arashiyama Station', city: 'Kioto' },
  { name: 'Shin-Osaka', jp: '新大阪', en: 'Shin-Osaka Station', city: 'Osaka' },
  { name: 'Osaka', jp: '大阪', en: 'Osaka Station', city: 'Osaka' },
  { name: 'Namba', jp: '難波', en: 'Namba Station', city: 'Osaka' },
  { name: 'Tennoji', jp: '天王寺', en: 'Tennoji Station', city: 'Osaka' },
  { name: 'Aeropuerto de Kansai', jp: '関西空港', en: 'Kansai Airport Station', city: 'Osaka', aliases: ['Kansai', 'KIX'] },
  { name: 'Universal Studios Japan', jp: 'ユニバーサルシティ', en: 'Universal City Station', city: 'Osaka', aliases: ['USJ', 'Universal City'] },
  { name: 'Shin-Kobe', jp: '新神戸', en: 'Shin-Kobe Station', city: 'Kobe' },
  { name: 'Sannomiya (Kobe)', jp: '三ノ宮', en: 'Sannomiya Station', city: 'Kobe', aliases: ['Kobe'] },
  { name: 'Himeji', jp: '姫路', en: 'Himeji Station', city: 'Himeji' },
  { name: 'Okayama', jp: '岡山', en: 'Okayama Station', city: 'Okayama' },
  { name: 'Hiroshima', jp: '広島', en: 'Hiroshima Station', city: 'Hiroshima' },
  { name: 'Miyajimaguchi', jp: '宮島口', en: 'Miyajimaguchi Station', city: 'Hiroshima', aliases: ['Miyajima'] },
  { name: 'Hakata (Fukuoka)', jp: '博多', en: 'Hakata Station', city: 'Fukuoka', aliases: ['Fukuoka'] },
  { name: 'Kanazawa', jp: '金沢', en: 'Kanazawa Station', city: 'Kanazawa' },
  { name: 'Nagano', jp: '長野', en: 'Nagano Station', city: 'Nagano' },
  { name: 'Matsumoto', jp: '松本', en: 'Matsumoto Station', city: 'Matsumoto' },
  { name: 'Takayama', jp: '高山', en: 'Takayama Station', city: 'Takayama' },
  { name: 'Nikko (Tobu)', jp: '東武日光', en: 'Tobu-Nikko Station', city: 'Nikko', aliases: ['Nikko'] },
  { name: 'Sendai', jp: '仙台', en: 'Sendai Station', city: 'Sendai' },
  { name: 'Sapporo', jp: '札幌', en: 'Sapporo Station', city: 'Sapporo' },
];

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/** Busca por nombre, ciudad, kanji o nombres alternativos; sin tildes ni mayúsculas. */
export function searchStations(query: string, limit = 8): Station[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  const scored: { s: Station; score: number }[] = [];
  for (const s of STATIONS) {
    const own = [s.name, s.en, s.jp].map(normalize);
    const alias = (s.aliases ?? []).map(normalize);
    const city = normalize(s.city);
    const all = [...own, ...alias, city];
    let score = -1;
    if (own.includes(q)) score = 0;
    else if (alias.includes(q)) score = 1;
    else if (city === q) score = 2;
    else if (all.some((f) => f.startsWith(q))) score = 3;
    else if (all.some((f) => f.includes(q))) score = 4;
    if (score >= 0) scored.push({ s, score });
  }
  scored.sort((a, b) => a.score - b.score || a.s.name.localeCompare(b.s.name, 'es'));
  return scored.slice(0, limit).map((x) => x.s);
}

/** Estación a partir del texto guardado (nombre exacto), para recuperar su nombre en inglés. */
export function stationFromLabel(label: string): Station | null {
  const t = normalize(label);
  return STATIONS.find((s) => normalize(s.name) === t) ?? null;
}

/** Texto para buscar en Google Maps: «Kyoto Station» si se conoce, o lo escrito + «estación». */
export function stationQuery(label: string): string {
  const known = stationFromLabel(label);
  if (known) return known.en;
  const t = label.trim();
  return t ? t : '';
}
