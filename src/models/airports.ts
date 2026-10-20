import { isValidTimeZone } from './datetime';

export interface Airport {
  /** Código IATA */
  code: string;
  city: string;
  name: string;
  country: string;
  tz: string;
  /** Otros nombres con los que se puede buscar (español, local). */
  aliases?: string[];
}

/**
 * Lista local de aeropuertos habituales en un viaje España → Japón (con escalas) y de Japón.
 * No es exhaustiva: si el aeropuerto no aparece, se puede escribir a mano.
 * Funciona sin conexión (va dentro de la app).
 */
export const AIRPORTS: Airport[] = [
  // España
  { code: 'MAD', city: 'Madrid', name: 'Adolfo Suárez Madrid-Barajas', country: 'España', tz: 'Europe/Madrid' },
  { code: 'BCN', city: 'Barcelona', name: 'Josep Tarradellas Barcelona-El Prat', country: 'España', tz: 'Europe/Madrid' },
  { code: 'VLC', city: 'Valencia', name: 'Valencia', country: 'España', tz: 'Europe/Madrid' },
  { code: 'AGP', city: 'Málaga', name: 'Málaga-Costa del Sol', country: 'España', tz: 'Europe/Madrid', aliases: ['Malaga'] },
  { code: 'SVQ', city: 'Sevilla', name: 'Sevilla San Pablo', country: 'España', tz: 'Europe/Madrid' },
  { code: 'BIO', city: 'Bilbao', name: 'Bilbao', country: 'España', tz: 'Europe/Madrid' },
  { code: 'PMI', city: 'Palma de Mallorca', name: 'Son Sant Joan', country: 'España', tz: 'Europe/Madrid', aliases: ['Mallorca'] },
  { code: 'ALC', city: 'Alicante', name: 'Alicante-Elche', country: 'España', tz: 'Europe/Madrid' },
  { code: 'IBZ', city: 'Ibiza', name: 'Ibiza', country: 'España', tz: 'Europe/Madrid' },
  { code: 'TFN', city: 'Tenerife', name: 'Tenerife Norte', country: 'España', tz: 'Atlantic/Canary' },
  { code: 'TFS', city: 'Tenerife', name: 'Tenerife Sur', country: 'España', tz: 'Atlantic/Canary' },
  { code: 'LPA', city: 'Gran Canaria', name: 'Gran Canaria', country: 'España', tz: 'Atlantic/Canary', aliases: ['Las Palmas'] },
  { code: 'SCQ', city: 'Santiago de Compostela', name: 'Rosalía de Castro', country: 'España', tz: 'Europe/Madrid' },
  { code: 'REU', city: 'Reus', name: 'Reus', country: 'España', tz: 'Europe/Madrid', aliases: ['Tarragona', 'Salou'] },
  { code: 'GRO', city: 'Girona', name: 'Girona-Costa Brava', country: 'España', tz: 'Europe/Madrid', aliases: ['Gerona'] },
  { code: 'ZAZ', city: 'Zaragoza', name: 'Zaragoza', country: 'España', tz: 'Europe/Madrid' },
  // Europa
  { code: 'LIS', city: 'Lisboa', name: 'Humberto Delgado', country: 'Portugal', tz: 'Europe/Lisbon', aliases: ['Lisbon'] },
  { code: 'OPO', city: 'Oporto', name: 'Francisco Sá Carneiro', country: 'Portugal', tz: 'Europe/Lisbon', aliases: ['Porto'] },
  { code: 'CDG', city: 'París', name: 'Charles de Gaulle', country: 'Francia', tz: 'Europe/Paris', aliases: ['Paris'] },
  { code: 'ORY', city: 'París', name: 'Orly', country: 'Francia', tz: 'Europe/Paris', aliases: ['Paris'] },
  { code: 'LHR', city: 'Londres', name: 'Heathrow', country: 'Reino Unido', tz: 'Europe/London', aliases: ['London'] },
  { code: 'LGW', city: 'Londres', name: 'Gatwick', country: 'Reino Unido', tz: 'Europe/London', aliases: ['London'] },
  { code: 'DUB', city: 'Dublín', name: 'Dublín', country: 'Irlanda', tz: 'Europe/Dublin', aliases: ['Dublin'] },
  { code: 'AMS', city: 'Ámsterdam', name: 'Schiphol', country: 'Países Bajos', tz: 'Europe/Amsterdam', aliases: ['Amsterdam'] },
  { code: 'BRU', city: 'Bruselas', name: 'Bruselas', country: 'Bélgica', tz: 'Europe/Brussels', aliases: ['Brussels'] },
  { code: 'FRA', city: 'Fráncfort', name: 'Frankfurt', country: 'Alemania', tz: 'Europe/Berlin', aliases: ['Frankfurt', 'Francfort'] },
  { code: 'MUC', city: 'Múnich', name: 'Franz Josef Strauss', country: 'Alemania', tz: 'Europe/Berlin', aliases: ['Munich', 'Munchen'] },
  { code: 'BER', city: 'Berlín', name: 'Brandeburgo', country: 'Alemania', tz: 'Europe/Berlin', aliases: ['Berlin'] },
  { code: 'ZRH', city: 'Zúrich', name: 'Zúrich', country: 'Suiza', tz: 'Europe/Zurich', aliases: ['Zurich'] },
  { code: 'GVA', city: 'Ginebra', name: 'Ginebra', country: 'Suiza', tz: 'Europe/Zurich', aliases: ['Geneva', 'Geneve'] },
  { code: 'VIE', city: 'Viena', name: 'Viena-Schwechat', country: 'Austria', tz: 'Europe/Vienna', aliases: ['Vienna', 'Wien'] },
  { code: 'FCO', city: 'Roma', name: 'Fiumicino', country: 'Italia', tz: 'Europe/Rome', aliases: ['Rome'] },
  { code: 'MXP', city: 'Milán', name: 'Malpensa', country: 'Italia', tz: 'Europe/Rome', aliases: ['Milan'] },
  { code: 'CPH', city: 'Copenhague', name: 'Kastrup', country: 'Dinamarca', tz: 'Europe/Copenhagen', aliases: ['Copenhagen'] },
  { code: 'ARN', city: 'Estocolmo', name: 'Arlanda', country: 'Suecia', tz: 'Europe/Stockholm', aliases: ['Stockholm'] },
  { code: 'OSL', city: 'Oslo', name: 'Gardermoen', country: 'Noruega', tz: 'Europe/Oslo' },
  { code: 'HEL', city: 'Helsinki', name: 'Helsinki-Vantaa', country: 'Finlandia', tz: 'Europe/Helsinki' },
  { code: 'WAW', city: 'Varsovia', name: 'Chopin', country: 'Polonia', tz: 'Europe/Warsaw', aliases: ['Warsaw'] },
  { code: 'PRG', city: 'Praga', name: 'Václav Havel', country: 'Chequia', tz: 'Europe/Prague', aliases: ['Prague'] },
  { code: 'ATH', city: 'Atenas', name: 'Eleftherios Venizelos', country: 'Grecia', tz: 'Europe/Athens', aliases: ['Athens'] },
  { code: 'IST', city: 'Estambul', name: 'Estambul', country: 'Turquía', tz: 'Europe/Istanbul', aliases: ['Istanbul'] },
  { code: 'SAW', city: 'Estambul', name: 'Sabiha Gökçen', country: 'Turquía', tz: 'Europe/Istanbul', aliases: ['Istanbul'] },
  { code: 'SVO', city: 'Moscú', name: 'Sheremetyevo', country: 'Rusia', tz: 'Europe/Moscow', aliases: ['Moscow'] },
  // Oriente Medio y Asia Central
  { code: 'DOH', city: 'Doha', name: 'Hamad', country: 'Catar', tz: 'Asia/Qatar', aliases: ['Qatar'] },
  { code: 'DXB', city: 'Dubái', name: 'Dubái', country: 'Emiratos Árabes Unidos', tz: 'Asia/Dubai', aliases: ['Dubai'] },
  { code: 'AUH', city: 'Abu Dabi', name: 'Zayed', country: 'Emiratos Árabes Unidos', tz: 'Asia/Dubai', aliases: ['Abu Dhabi'] },
  { code: 'TLV', city: 'Tel Aviv', name: 'Ben Gurión', country: 'Israel', tz: 'Asia/Jerusalem' },
  { code: 'CAI', city: 'El Cairo', name: 'El Cairo', country: 'Egipto', tz: 'Africa/Cairo', aliases: ['Cairo'] },
  { code: 'ADD', city: 'Adís Abeba', name: 'Bole', country: 'Etiopía', tz: 'Africa/Addis_Ababa', aliases: ['Addis Ababa'] },
  { code: 'TAS', city: 'Taskent', name: 'Islam Karimov', country: 'Uzbekistán', tz: 'Asia/Tashkent', aliases: ['Tashkent'] },
  // Sur y sudeste de Asia
  { code: 'DEL', city: 'Nueva Delhi', name: 'Indira Gandhi', country: 'India', tz: 'Asia/Kolkata', aliases: ['Delhi', 'New Delhi'] },
  { code: 'BOM', city: 'Bombay', name: 'Chhatrapati Shivaji', country: 'India', tz: 'Asia/Kolkata', aliases: ['Mumbai'] },
  { code: 'CMB', city: 'Colombo', name: 'Bandaranaike', country: 'Sri Lanka', tz: 'Asia/Colombo' },
  { code: 'BKK', city: 'Bangkok', name: 'Suvarnabhumi', country: 'Tailandia', tz: 'Asia/Bangkok' },
  { code: 'DMK', city: 'Bangkok', name: 'Don Mueang', country: 'Tailandia', tz: 'Asia/Bangkok' },
  { code: 'SGN', city: 'Ciudad Ho Chi Minh', name: 'Tan Son Nhat', country: 'Vietnam', tz: 'Asia/Ho_Chi_Minh', aliases: ['Saigon', 'Saigón'] },
  { code: 'HAN', city: 'Hanói', name: 'Noi Bai', country: 'Vietnam', tz: 'Asia/Ho_Chi_Minh', aliases: ['Hanoi'] },
  { code: 'SIN', city: 'Singapur', name: 'Changi', country: 'Singapur', tz: 'Asia/Singapore', aliases: ['Singapore'] },
  { code: 'KUL', city: 'Kuala Lumpur', name: 'Kuala Lumpur', country: 'Malasia', tz: 'Asia/Kuala_Lumpur' },
  { code: 'CGK', city: 'Yakarta', name: 'Soekarno-Hatta', country: 'Indonesia', tz: 'Asia/Jakarta', aliases: ['Jakarta'] },
  { code: 'DPS', city: 'Bali', name: 'Ngurah Rai', country: 'Indonesia', tz: 'Asia/Makassar', aliases: ['Denpasar'] },
  { code: 'MNL', city: 'Manila', name: 'Ninoy Aquino', country: 'Filipinas', tz: 'Asia/Manila' },
  // Asia oriental
  { code: 'HKG', city: 'Hong Kong', name: 'Hong Kong', country: 'Hong Kong', tz: 'Asia/Hong_Kong', aliases: ['Hongkong', 'Honk Kong'] },
  { code: 'MFM', city: 'Macao', name: 'Macao', country: 'Macao', tz: 'Asia/Macau', aliases: ['Macau'] },
  { code: 'PEK', city: 'Pekín', name: 'Capital', country: 'China', tz: 'Asia/Shanghai', aliases: ['Beijing', 'Pekin'] },
  { code: 'PKX', city: 'Pekín', name: 'Daxing', country: 'China', tz: 'Asia/Shanghai', aliases: ['Beijing', 'Pekin'] },
  { code: 'PVG', city: 'Shanghái', name: 'Pudong', country: 'China', tz: 'Asia/Shanghai', aliases: ['Shanghai'] },
  { code: 'SHA', city: 'Shanghái', name: 'Hongqiao', country: 'China', tz: 'Asia/Shanghai', aliases: ['Shanghai'] },
  { code: 'CAN', city: 'Cantón', name: 'Guangzhou Baiyun', country: 'China', tz: 'Asia/Shanghai', aliases: ['Guangzhou', 'Canton'] },
  { code: 'SZX', city: 'Shenzhen', name: 'Bao’an', country: 'China', tz: 'Asia/Shanghai' },
  { code: 'CTU', city: 'Chengdu', name: 'Tianfu / Shuangliu', country: 'China', tz: 'Asia/Shanghai' },
  { code: 'TPE', city: 'Taipéi', name: 'Taoyuan', country: 'Taiwán', tz: 'Asia/Taipei', aliases: ['Taipei', 'Taiwan'] },
  { code: 'ICN', city: 'Seúl', name: 'Incheon', country: 'Corea del Sur', tz: 'Asia/Seoul', aliases: ['Seoul', 'Corea'] },
  { code: 'GMP', city: 'Seúl', name: 'Gimpo', country: 'Corea del Sur', tz: 'Asia/Seoul', aliases: ['Seoul', 'Corea'] },
  { code: 'PUS', city: 'Busan', name: 'Gimhae', country: 'Corea del Sur', tz: 'Asia/Seoul', aliases: ['Pusan'] },
  // Japón
  { code: 'HND', city: 'Tokio', name: 'Haneda', country: 'Japón', tz: 'Asia/Tokyo', aliases: ['Tokyo', '羽田'] },
  { code: 'NRT', city: 'Tokio', name: 'Narita', country: 'Japón', tz: 'Asia/Tokyo', aliases: ['Tokyo', '成田'] },
  { code: 'KIX', city: 'Osaka', name: 'Kansai', country: 'Japón', tz: 'Asia/Tokyo', aliases: ['Kioto', 'Kyoto', '関西'] },
  { code: 'ITM', city: 'Osaka', name: 'Itami', country: 'Japón', tz: 'Asia/Tokyo', aliases: ['伊丹'] },
  { code: 'UKB', city: 'Kobe', name: 'Kobe', country: 'Japón', tz: 'Asia/Tokyo' },
  { code: 'NGO', city: 'Nagoya', name: 'Chubu Centrair', country: 'Japón', tz: 'Asia/Tokyo' },
  { code: 'CTS', city: 'Sapporo', name: 'Nuevo Chitose', country: 'Japón', tz: 'Asia/Tokyo', aliases: ['Hokkaido', 'Hokkaidō'] },
  { code: 'FUK', city: 'Fukuoka', name: 'Fukuoka', country: 'Japón', tz: 'Asia/Tokyo' },
  { code: 'OKA', city: 'Naha', name: 'Naha', country: 'Japón', tz: 'Asia/Tokyo', aliases: ['Okinawa'] },
  { code: 'HIJ', city: 'Hiroshima', name: 'Hiroshima', country: 'Japón', tz: 'Asia/Tokyo' },
  { code: 'SDJ', city: 'Sendai', name: 'Sendai', country: 'Japón', tz: 'Asia/Tokyo' },
  { code: 'KMJ', city: 'Kumamoto', name: 'Kumamoto', country: 'Japón', tz: 'Asia/Tokyo' },
  { code: 'KOJ', city: 'Kagoshima', name: 'Kagoshima', country: 'Japón', tz: 'Asia/Tokyo' },
  { code: 'KMQ', city: 'Komatsu', name: 'Komatsu', country: 'Japón', tz: 'Asia/Tokyo', aliases: ['Kanazawa'] },
  { code: 'TAK', city: 'Takamatsu', name: 'Takamatsu', country: 'Japón', tz: 'Asia/Tokyo' },
  { code: 'MYJ', city: 'Matsuyama', name: 'Matsuyama', country: 'Japón', tz: 'Asia/Tokyo' },
  // América
  { code: 'JFK', city: 'Nueva York', name: 'John F. Kennedy', country: 'EE. UU.', tz: 'America/New_York', aliases: ['New York'] },
  { code: 'EWR', city: 'Nueva York', name: 'Newark', country: 'EE. UU.', tz: 'America/New_York', aliases: ['New York'] },
  { code: 'IAD', city: 'Washington', name: 'Dulles', country: 'EE. UU.', tz: 'America/New_York' },
  { code: 'ORD', city: 'Chicago', name: 'O’Hare', country: 'EE. UU.', tz: 'America/Chicago' },
  { code: 'DFW', city: 'Dallas', name: 'Dallas/Fort Worth', country: 'EE. UU.', tz: 'America/Chicago' },
  { code: 'LAX', city: 'Los Ángeles', name: 'Los Ángeles', country: 'EE. UU.', tz: 'America/Los_Angeles', aliases: ['Los Angeles'] },
  { code: 'SFO', city: 'San Francisco', name: 'San Francisco', country: 'EE. UU.', tz: 'America/Los_Angeles' },
  { code: 'SEA', city: 'Seattle', name: 'Seattle-Tacoma', country: 'EE. UU.', tz: 'America/Los_Angeles' },
  { code: 'HNL', city: 'Honolulu', name: 'Daniel K. Inouye', country: 'EE. UU.', tz: 'Pacific/Honolulu', aliases: ['Hawái', 'Hawaii'] },
  { code: 'YVR', city: 'Vancouver', name: 'Vancouver', country: 'Canadá', tz: 'America/Vancouver' },
  { code: 'YYZ', city: 'Toronto', name: 'Pearson', country: 'Canadá', tz: 'America/Toronto' },
  { code: 'MEX', city: 'Ciudad de México', name: 'Benito Juárez', country: 'México', tz: 'America/Mexico_City', aliases: ['Mexico', 'México DF'] },
  { code: 'BOG', city: 'Bogotá', name: 'El Dorado', country: 'Colombia', tz: 'America/Bogota', aliases: ['Bogota'] },
  { code: 'GRU', city: 'São Paulo', name: 'Guarulhos', country: 'Brasil', tz: 'America/Sao_Paulo', aliases: ['Sao Paulo'] },
  { code: 'EZE', city: 'Buenos Aires', name: 'Ezeiza', country: 'Argentina', tz: 'America/Argentina/Buenos_Aires' },
  { code: 'SCL', city: 'Santiago de Chile', name: 'Arturo Merino Benítez', country: 'Chile', tz: 'America/Santiago' },
  { code: 'LIM', city: 'Lima', name: 'Jorge Chávez', country: 'Perú', tz: 'America/Lima' },
  // Oceanía
  { code: 'SYD', city: 'Sídney', name: 'Kingsford Smith', country: 'Australia', tz: 'Australia/Sydney', aliases: ['Sydney'] },
  { code: 'MEL', city: 'Melbourne', name: 'Tullamarine', country: 'Australia', tz: 'Australia/Melbourne' },
  { code: 'AKL', city: 'Auckland', name: 'Auckland', country: 'Nueva Zelanda', tz: 'Pacific/Auckland' },
];

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .toLowerCase()
    .trim();
}

/** Texto que se guarda en el vuelo: «Hong Kong (HKG)». El código distingue aeropuertos de una misma ciudad. */
export function airportLabel(a: Airport): string {
  return `${a.city} (${a.code})`;
}

function haystack(a: Airport): string[] {
  return [a.code, a.city, a.name, a.country, ...(a.aliases ?? [])].map(normalize);
}

/**
 * Busca por código IATA, ciudad, nombre, país o nombres alternativos; sin tildes ni mayúsculas.
 * Los resultados que empiezan por el texto van antes. Máximo `limit` resultados.
 */
export function searchAirports(query: string, limit = 8): Airport[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  const scored: { a: Airport; score: number }[] = [];
  for (const a of AIRPORTS) {
    const fields = haystack(a);
    let score = -1;
    if (fields[0] === q) score = 0;
    else if (fields.some((f) => f === q)) score = 1;
    else if (fields.some((f) => f.startsWith(q))) score = 2;
    else if (fields.some((f) => f.includes(q))) score = 3;
    if (score >= 0) scored.push({ a, score });
  }
  scored.sort((x, y) => x.score - y.score || x.a.city.localeCompare(y.a.city, 'es') || x.a.code.localeCompare(y.a.code));
  return scored.slice(0, limit).map((s) => s.a);
}

/** Aeropuerto a partir de un texto como «Hong Kong (HKG)» (para recuperar su zona horaria). */
export function airportFromLabel(label: string): Airport | null {
  const m = /\(([A-Z]{3})\)\s*$/.exec(label.trim());
  if (!m) return null;
  return AIRPORTS.find((a) => a.code === m[1]) ?? null;
}

/** Comprobación interna usada en los tests. */
export function invalidAirportTimeZones(): string[] {
  return AIRPORTS.filter((a) => !isValidTimeZone(a.tz)).map((a) => a.code);
}
