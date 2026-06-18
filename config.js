// js/config.js

// ===== CONFIG GÉNÉRALE =====
export const CONFIG = {
  REPAIRS_CACHE_API: "https://mimjugutzdolfkfpchzc.functions.supabase.co/repairs-cache-latest",
  CACHE_SYNC_API:   "https://mimjugutzdolfkfpchzc.functions.supabase.co/cache-sync",
  LOOKUP_BASE: "https://mimjugutzdolfkfpchzc.functions.supabase.co/podio-lookup",
  API_BASE: "https://mimjugutzdolfkfpchzc.functions.supabase.co/kiosque-reparation",
  STATS_REPORT_URL: 'https://mimjugutzdolfkfpchzc.functions.supabase.co/kiosque-reparation/stats/report',
  AUTH_LOGIN_URL: 'https://mimjugutzdolfkfpchzc.supabase.co/functions/v1/auth-login',
  USE_MOCK: false,
  IDLE_TIMEOUT: 300000,
  LOGO_URL: "img/scan-symbol.png",
  MOBILE_CAMERA_ENABLED: true,
  MOBILE_LOGO_URL: "img/scan-symbol-mobile.png",

};

// ===== ÉTATS DISPONIBLES (adapter aux libellés exacts de Podio) =====
export const ETATS = [
  { id: 10,  label: 'Demande initiale',                           color: 'bg-[#EBEBEB]' },
  { id: 1,  label: 'Dossier ouvert',                              color: 'bg-[#FFC2C2]' },
  { id: 5,  label: 'Appareil reçu',                               color: 'bg-[#F9EFB6]' },
  { id: 2,  label: 'En cours',                                    color: 'bg-[#6EC0FF]' },
  { id: 3,  label: 'En attente de pièces',                        color: 'bg-[#FFD039]' },
  { id: 11,  label: 'En traitement pour l\'externe',              color: 'bg-[#FFCCA9]' },
  { id: 9,  label: 'Envoyé à l\'externe',                         color: 'bg-[#FF8229]' },
  { id: 12,  label: 'En attente de l\'appareil de remplacement',  color: 'bg-[#D9C7FF]' },
  { id: 4,  label: 'Réparation terminée',                         color: 'bg-[#31B8C2]' },
  { id: 6, label: 'Appareil remis',                               color: 'bg-[#86DB5E]' },
  { id: 7, label: 'Annulé',                                       color: 'bg-[#EBEBEB]' },
  { id: 8, label: 'Appareil non-réparable',                       color: 'bg-[#C0C0C0]' },
];

// États pour lesquels on veut afficher l'avertissement "Appareil sous garantie !"
// Appareil reçu, En cours, En attente de pièces, En traitement... , Envoyé à l'externe, En attente de l'a...
export const ETATS_AVERT_GARANTIE = [5, 2, 3, 11, 9, 12];

// ===== TYPES DE RÉPARATIONS DISPONIBLES =====
export const TYPES_REPARATION = [
  { id: 1, label: 'Interne',                                color: 'bg-[#FFD039]' },
  { id: 2, label: 'Externe hors garantie',                  color: 'bg-[#FFC2C2]' },
  { id: 3, label: 'Externe sous garantie',                  color: 'bg-[#FF5A5A]' },
];

// ===== SECTEURS =====
export const SECTEURS = [
  { id: 4, label: 'SEA est',                                color: 'bg-[#6EC0FF]' },
  { id: 5, label: 'SEA ouest',                              color: 'bg-[#C29EFF]' },
  { id: 2, label: 'Comptoir J-2391',                        color: 'bg-[#86DB5E]' },
  { id: 3, label: 'Comptoir cinéma',                        color: 'bg-[#31B8C2]' },
  { id: 6, label: 'CCC',                                    color: 'bg-[#FFD039]' },
  { id: 7, label: 'Production',                             color: 'bg-[#FF8229]' },
  { id: 1, label: 'Autre membre de la communauté',          color: 'bg-[#B1EDEA]' },
  { id: 8, label: 'Atelier',                                color: 'bg-[#FF5A5A]' },
];

// ➜ valeurs pré-définies par secteur (clé = ID NUMÉRIQUE DU SECTEUR)
export const PRESETS = {
  4: { nom: "SEA est",                     courriel: "savsea@uqam.ca" },
  5: { nom: "SEA ouest",                   courriel: "sav-ouest@uqam.ca" },
  2: { nom: "Comptoir J-2391",             courriel: "comptoir.audiovisuel@uqam.ca" },
  3: { nom: "Comptoir cinéma",             courriel: "comptoir.cinema@uqam.ca" },
  6: { nom: "CCC",                         courriel: "ccc@uqam.ca" },
  7: { nom: "Production",                  courriel: "pilotte.david@uqam.ca" },
  8: { nom: "Atelier",                  courriel: "audiovisuel.atelier@uqam.ca" },
  // 1 = "Autre membre de la communauté" → pas de preset
};

export const ID_AUTRE = 1; // doit correspondre à SECTEURS.find(label === "Autre membre...").id

export const APP_PREFIX = 'REP'; // pour l'app "Test - Pont Hector/Podio"

// ===== HELPERS DE MAPPING =====
export function etatById(id) {
  return ETATS.find(e => e.id === id);
}
export function etatLabel(id) {
  return etatById(id)?.label ?? `Code ${id}`;
}
export function etatColor(id) {
  return etatById(id)?.color ?? 'bg-gray-700';
}

export function typeById(id) {
  return TYPES_REPARATION.find(t => t.id === id);
}
export function typeLabel(id) {
  return typeById(id)?.label ?? `Type ${id}`;
}
export function typeColor(id) {
  return typeById(id)?.color ?? 'bg-gray-500';
}
export function secteurById(id) {
  const n = Number(id);
  return SECTEURS.find(s => s.id === n) || null;
}

export function secteurLabel(id) {
  const s = secteurById(id);
  return s?.label ?? `Secteur ${id}`;
}

export function secteurColor(id) {
  const s = secteurById(id);
  return s?.color ?? 'bg-gray-200';
}


// TEST000 → TEST001
export function formatAppItemCode(itemOrId) {
  const raw =
    (itemOrId && (itemOrId.app_item_id ?? itemOrId.appItemId ?? itemOrId.id)) ??
    itemOrId ??
    null;

  const n = raw != null ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return '';

  const num = String(n).padStart(4, '0'); // 1 -> 001, 12 -> 012...
  return `${APP_PREFIX}${num}`;
}
