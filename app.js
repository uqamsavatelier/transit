// Timestamp: 2026-06-18 14:49:18 -04:00
// js/app.js

import {
  CONFIG,
  ETATS,
  TYPES_REPARATION,
  SECTEURS,
  APP_PREFIX,
  ETATS_AVERT_GARANTIE,
  etatById,
  etatLabel,
  etatColor,
  typeById,
  typeLabel,
  typeColor,
  formatAppItemCode,
  PRESETS,
  ID_AUTRE,
  secteurColor,
} from './config.js';

import {
  api,
  apiLookupInventory,
  refreshLastCreated,
  refreshLastCreatedFromPodio,
  refreshLastCreatedByInventory,
  apiFetchOverviewHome,
  apiListRepairsCache,
  apiListMesBT,
  apiGetBTById,
} from './api.js';

console.log('[KIOSQUE] app.js chargé');


// ======================
// AUTH / UTILISATEUR
// ======================

// Utilisateur courant (rempli après login)
let CURRENT_USER = null; 
// Exemple : { username: 'Zine', role: 'tech' }

// Clé localStorage pour se souvenir de l'utilisateur
const STORAGE_USER_KEY = 'kiosque_current_user';

// Rôles possibles : 'admin', 'tech', 'viewer'
function setCurrentUser(user) {
  CURRENT_USER = user;
  try {
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
  } catch (e) {
    console.warn('Impossible de sauvegarder l’utilisateur dans localStorage', e);
  }
}


// 🔹 Détection "simple" du mobile
const IS_MOBILE =
  typeof navigator !== 'undefined' &&
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent || ''
  );


function loadCurrentUser() {
  try {
    const raw = localStorage.getItem(STORAGE_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.username || !parsed.role) return null;
    CURRENT_USER = parsed;
    return parsed;
  } catch (e) {
    console.warn('Impossible de charger l’utilisateur depuis localStorage', e);
    return null;
  }
}

// Helpers simples utilisés plus tard
function isAdmin() {
  return CURRENT_USER && CURRENT_USER.role === 'admin';
}
function isTech() {
  return CURRENT_USER && (CURRENT_USER.role === 'tech' || CURRENT_USER.role === 'admin');
}
function isViewer() {
  return CURRENT_USER && CURRENT_USER.role === 'viewer';
}
// ======================
// DÉCONNEXION
// ======================
function logoutKiosque() {
  // On oublie l'utilisateur courant
  CURRENT_USER = null;

  try {
    localStorage.removeItem(STORAGE_USER_KEY);
  } catch (e) {
    console.warn("Impossible de supprimer l'utilisateur du localStorage", e);
  }

  // (optionnel) on nettoie les infos de "dernier bon"
  try {
    localStorage.removeItem('kiosque_lastCreatedItem');
    localStorage.removeItem('kiosque_lastOperationItem');
  } catch (e) {
    console.warn('Impossible de nettoyer les derniers items', e);
  }
  lastCreatedItem = null;
  lastOperationItem = null;

  // On coupe tous les timers (idle + refresh)
  clearKiosqueTimers();

  // On cache le header (et donc le bouton Déconnexion)
  const header = document.querySelector('header');
  if (header) header.style.display = 'none';

  const greet = document.getElementById('kiosque-user-greeting');
  if (greet) {
    greet.textContent = '';
    greet.classList.add('hidden');
  }


  // Retour à l'écran de login
  renderLoginScreen();
}

// 🔹 Si mobile → on change le logo
if (IS_MOBILE) {
  console.log('Kiosque en mode MOBILE');
  CONFIG.LOGO_URL = 'img/scan-symbol-mobile.png'; // mets ici ton logo mobile
} else {
  console.log('Kiosque en mode DESKTOP');
}
// ======================
// ÉCRAN DE CONNEXION
// ======================

async function renderLoginScreen(messageErreur = '') {
  const app = document.getElementById('app') || document.body;


  // On s’assure que les timers sont stoppés en mode login
  clearKiosqueTimers();

  // On cache le header (plus de bouton Déconnexion)
  const header = document.querySelector('header');
  if (header) header.style.display = 'none';

  const menuRoot = document.getElementById('kiosque-menu-root');
  if (menuRoot) menuRoot.style.display = 'none';



  const errorHtml = messageErreur
    ? `<p class="mb-3 text-red-600 text-sm">${messageErreur}</p>`
    : '';

  app.innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-slate-900">
      <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
        <h1 class="text-2xl font-bold mb-4 text-center">Connexion Kiosque</h1>
        ${errorHtml}
        <form id="login-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1" for="username">
              Nom d'utilisateur
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autocomplete="username"
              class="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring focus:ring-indigo-500"
              required
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1" for="password">
              Mot de passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autocomplete="current-password"
              class="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring focus:ring-indigo-500"
              required
            />
          </div>
          <button
            type="submit"
            class="w-full py-2 rounded-md font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Se connecter
          </button>
        </form>
      </div>
    </div>
  `;

  const form = document.getElementById('login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = (document.getElementById('username').value || '').trim();
    const password = (document.getElementById('password').value || '').trim();
    if (!username || !password) {
      renderLoginScreen('Veuillez entrer un nom d’utilisateur et un mot de passe.');
      return;
    }

      try {
      // Appel à l’Edge function auth-login (URL complète dans CONFIG.AUTH_LOGIN_URL)
      const res = await fetch(CONFIG.AUTH_LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });


      if (!res.ok) {
        renderLoginScreen("Nom d'utilisateur ou mot de passe invalide.");
        return;
      }

      const data = await res.json();
      // On s’attend à un objet du genre : { username: 'Zine', role: 'tech' }
      if (!data || !data.username || !data.role) {
        renderLoginScreen('Réponse serveur invalide.');
        return;
      }

      setCurrentUser({ username: data.username, role: data.role });

      // Une fois connecté → on lance le kiosque normal
      startKiosqueAfterLogin();

    } catch (err) {
      console.error('Erreur login', err);
      renderLoginScreen('Erreur de connexion au serveur.');
    }
  });
}

// ======================
// NOM AFFICHÉ (Bonjour X)
// ======================

// Mappe le username technique vers un prénom lisible
function getFriendlyNameFromUsername(username) {
  if (!username) return '';

  const u = String(username).toLowerCase();

  // 🔹 Adapte ces valeurs aux vrais usernames qui viennent de auth-login
  if (u === 'rivet_n' || u === 'nicholas' || u === 'nick') {
    return 'Nicholas';
  }
  if (u === 'zineddine' || u === 'chergui_z' || u === 'zine') {
    return 'Zineddine';
  }
  if (u === 'maxime' || u === 'clement_m' || u === 'max') {
    return 'Maxime';
  }

  // Fallback : on laisse le username tel quel
  return username;
}

// Met à jour le texte "Bonjour X" dans le header
function updateUserGreeting() {
  const el = document.getElementById('kiosque-user-greeting');
  if (!el) return;

  const user = CURRENT_USER || loadCurrentUser();

  if (!user || !user.username) {
    el.textContent = '';
    el.classList.add('hidden');
    return;
  }

  const friendly = getFriendlyNameFromUsername(user.username);
  el.textContent = friendly ? `Bonjour ${friendly}` : '';
  el.classList.remove('hidden');
}



// ===== CONFIG =====
let lastRepairsList = [];
let lastCreatedItem = null;
let lastInventory = '';
let lastCreatedRefreshTimer = null;
let warrantyWarnedForId = null;
let currentScreen = 'accueil';
let warrantyWatchTimer = null;
let warrantyWatchStartedAt = null;
let lastOperationItem = null;
let homeRepairsSummary = {
  all: [],
  open: [],
  done: [],
  error: '',
};

const TERMINE_CHOICES = [
  { label: 'Terminer la réparation', next: 4 },   // Réparation terminée
  { label: 'Remettre au client',   next: 6 },  // Appareil remis
];

  // Routes attendues côté serveur:
  // POST /repairs/search   { inventory }
  // POST /repairs/create   { inventory, state }
  // POST /repairs/update   { id, state }
  // GET  /repairs/history?inventory=...

// ===== RENDERING HELPERS =====
const app = document.getElementById('app');
let idleTimer = null;
let isManualMode = false;


function clearKiosqueTimers() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  if (lastCreatedRefreshTimer) {
    clearTimeout(lastCreatedRefreshTimer);
    lastCreatedRefreshTimer = null;
  }
}


// 🔹 Forcer le focus sur le champ de scan caché si on est sur l'accueil
function focusHiddenScanner() {
  // On ne force JAMAIS le focus sur mobile (sinon le clavier se rouvre tout seul)
  if (IS_MOBILE) return;

  // Si on est en mode "saisie manuelle", on ne touche pas au focus
  if (isManualMode) return;

  if (app.dataset.screen !== 'accueil') return;
  const hiddenInput = document.getElementById('scan-hidden');
  if (hiddenInput) {
    hiddenInput.focus();
    // hiddenInput.value = '';
  }
}

  

function setScreen(html){
  app.innerHTML = html;
  // Par défaut, on efface le marqueur d'écran courant.
  delete app.dataset.screen;
  armIdle();
}


function armIdle() {
  // Si personne n’est connecté, on ne gère pas l’inactivité
  if (!CURRENT_USER) return;

  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => gotoAccueil(), CONFIG.IDLE_TIMEOUT);
}

function btn(label, opts={}){
    const classes = opts.outline
      ? 'px-6 py-5 rounded-2xl text-xl font-semibold w-full mb-4 border border-black bg-white hover:bg-black/5'
      : 'px-6 py-5 rounded-2xl text-xl font-semibold w-full mb-4 bg-black text-white hover:opacity-90 shadow';
    return `<button ${opts.id?`id="${opts.id}"`:''} class="${classes}">${label}</button>`;
}

function card(inner){
    return `<div class="bg-white rounded-2xl shadow p-6 w-full">${inner}</div>`;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
// 🔹 Nettoie le texte riche Podio (balises <p>, </p>, <br>, etc.)
function cleanRichText(val) {
  if (!val) return '';
  let s = String(val);

  // Remplacer les fins de paragraphes par des sauts de ligne
  s = s.replace(/<\/p>/gi, '\n');

  // Enlever les balises <p ...>
  s = s.replace(/<p[^>]*>/gi, '');

  // Remplacer les <br> par des sauts de ligne
  s = s.replace(/<br\s*\/?>/gi, '\n');

  return s.trim();
}

function mergeRepairCacheItem(raw) {
  const dto = raw?.dto && typeof raw.dto === 'object' ? raw.dto : null;
  return dto ? { ...dto, ...raw } : (raw || {});
}

function getRepairStateId(item) {
  const raw = item?.state ?? item?.etat ?? item?.final_state ?? null;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function getRepairInventory(item) {
  return (
    item?.inventory ??
    item?.inventory_uqam ??
    item?.numeroInventaire ??
    item?.numero_inventaire ??
    item?.no_inventaire ??
    ''
  ).toString().trim();
}

function getRepairReferenceId(item) {
  const raw = item?.app_item_id ?? item?.appItemId ?? item?.id_unique ?? item?.id ?? item?.item_id ?? '';
  return String(raw || '').trim();
}

function getRepairTitleSummary(item) {
  const raw = (
    item?.marque_modele ??
    item?.marqueModele ??
    item?.title ??
    item?.description ??
    ''
  ).toString().trim();

  if (!raw) return 'Titre indisponible';
  if (!raw.includes('|')) return raw;
  return raw.split('|')[0].trim() || raw;
}

function formatRepairDateValue(raw) {
  if (!raw) return '';
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    const exact = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (exact) return exact[1];
  }

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getRepairSecteurLabel(item) {
  return (
    item?.secteur_label ??
    item?.secteurLabel ??
    ''
  ).toString().trim();
}

function getRepairDemandeurLabel(item) {
  return (
    item?.demandeur_nom ??
    item?.demandeurNom ??
    ''
  ).toString().trim();
}

function getRepairCreatedAtValue(item) {
  const candidates = [
    item?.createdAt,
    item?.created_at,
    item?.date_creation,
    item?.open_date,
    item?.updated_at,
    item?.dateCreation,
    item?.creationDate,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const d = new Date(candidate);
    if (!Number.isNaN(d.getTime())) {
      return d;
    }
  }

  return null;
}

function getRepairSortValue(item) {
  const d = getRepairCreatedAtValue(item);
  if (d) return d.getTime();

  const ref = Number(item?.app_item_id ?? item?.appItemId ?? item?.id ?? 0);
  return Number.isFinite(ref) ? ref : 0;
}

function formatRepairShortDate(item) {
  const d = getRepairCreatedAtValue(item);
  if (!d) return 'Date inconnue';

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getRepairAccueilAudienceLabel(item) {
  const secteurIdRaw = item?.secteur ?? item?.secteurId ?? null;
  const secteurId = secteurIdRaw != null ? Number(secteurIdRaw) : NaN;
  const secteurLabel = getRepairSecteurLabel(item);
  const demandeur = getRepairDemandeurLabel(item);
  const isAutre =
    secteurId === ID_AUTRE ||
    /autre membre/i.test(secteurLabel);

  if (isAutre && demandeur) {
    return demandeur;
  }

  if (secteurLabel) {
    return secteurLabel;
  }

  return demandeur || 'Information indisponible';
}

function isOpenRepairForAccueil(item) {
  return getRepairStateId(item) === 1;
}

function isDoneRepairForAccueil(item) {
  return getRepairStateId(item) === 4;
}

function buildHomeRepairsSummary(items) {
  const normalized = items
    .map(mergeRepairCacheItem)
    .filter((it) => it && !it.deleted && !it.isDeleted && !it.archived)
    .sort((a, b) => getRepairSortValue(b) - getRepairSortValue(a));

  return {
    all: normalized,
    open: normalized.filter(isOpenRepairForAccueil).slice(0, 5),
    done: normalized.filter(isDoneRepairForAccueil).slice(0, 5),
    error: '',
  };
}

function renderAccueilListItems(items, emptyLabel) {
  if (!items.length) {
    return `
      <div class="transit-empty-state">
        ${escapeHtml(emptyLabel)}
      </div>
    `;
  }

  return items.map((item) => {
    const ref = escapeHtml(getRepairReferenceId(item));
    const code = escapeHtml(formatAppItemCode(item) || 'Sans code');
    const title = escapeHtml(getRepairTitleSummary(item));
    const audience = escapeHtml(getRepairAccueilAudienceLabel(item));
    const createdDate = escapeHtml(formatRepairShortDate(item));

    return `
      <button
        type="button"
        class="transit-repair-card"
        data-repair-open="${ref}"
      >
        <div class="transit-repair-card__topline">
          <span class="transit-repair-card__code">${code}</span>
        </div>
        <div class="transit-repair-card__title">${title}</div>
        <div class="transit-repair-card__context">${audience}</div>
        <div class="transit-repair-card__meta">
          <span>Date de création</span>
          <span>${createdDate}</span>
        </div>
      </button>
    `;
  }).join('');
}

function renderAccueilColumn(title, accentClass, items, emptyLabel, actionLabel, actionKey, totalCount = items.length) {
  return `
    <section class="transit-side-panel">
      <div class="transit-side-panel__header">
        <h3 class="transit-side-panel__title ${accentClass}">${escapeHtml(title)}</h3>
        <div class="transit-side-panel__count">${totalCount}</div>
      </div>

      <div class="transit-side-panel__body">
        ${renderAccueilListItems(items, emptyLabel)}
      </div>

      <button
        type="button"
        class="transit-side-panel__footer"
        data-repair-list="${escapeHtml(actionKey)}"
      >
        ${escapeHtml(actionLabel)}
      </button>
    </section>
  `;
}

async function openRepairFromSummaryRef(ref) {
  const target = homeRepairsSummary.all.find((item) => getRepairReferenceId(item) === String(ref));
  if (!target) {
    alert("Impossible de retrouver ce dossier.");
    return;
  }

  const inventory = getRepairInventory(target);
  const refId = getRepairReferenceId(target);

  showBusy(true);
  try {
    if (inventory) {
      await onScan(inventory, true);
      return;
    }

    if (refId) {
      const item = await apiGetBTById(refId);
      const inv = getRepairInventory(item);
      if (!inv) {
        alert("Ce bon ne contient aucun numéro d'inventaire.");
        return;
      }
      await onScan(inv, true);
      return;
    }

    alert("Aucune référence exploitable pour ouvrir ce dossier.");
  } catch (err) {
    console.error('Erreur ouverture dossier résumé', err);
    alert("Impossible d'ouvrir ce dossier pour le moment.");
  } finally {
    showBusy(false);
  }
}

function screenRepairsByAccueilState(kind) {
  currentScreen = `accueil-list-${kind}`;

  const isOpen = kind === 'open';
  const items = homeRepairsSummary.all.filter(isOpen ? isOpenRepairForAccueil : isDoneRepairForAccueil);
  const title = isOpen ? 'Tous les dossiers ouverts' : 'Toutes les réparations terminées';
  const subtitle = isOpen
    ? "Les dossiers créés et pas encore reçus."
    : "Les dossiers qui ont atteint l'état Réparation terminée.";
  const idBack = 'back_' + Math.random().toString(36).slice(2);

  const html = `
    <div class="transit-list-shell">
      <div class="transit-list-hero">
        <div>
          <p class="transit-list-hero__eyebrow">${isOpen ? 'Transit - réception' : 'Transit - atelier'}</p>
          <h2 class="transit-list-hero__title">${escapeHtml(title)}</h2>
          <p class="transit-list-hero__subtitle">${escapeHtml(subtitle)}</p>
        </div>
        <div class="transit-list-hero__badge">${items.length}</div>
      </div>

      <div class="transit-list-grid">
        ${items.length ? items.map((item) => `
          <button
            type="button"
            class="transit-repair-card transit-repair-card--full"
            data-repair-open="${escapeHtml(getRepairReferenceId(item))}"
          >
            <div class="transit-repair-card__topline">
              <span class="transit-repair-card__code">${escapeHtml(formatAppItemCode(item) || 'Sans code')}</span>
              <span class="transit-repair-card__meta-inline">
                Inventaire ${escapeHtml(getRepairInventory(item) || 'inconnu')}
              </span>
            </div>
            <div class="transit-repair-card__title">${escapeHtml(getRepairTitleSummary(item))}</div>
            <div class="transit-repair-card__meta">
              <span>${escapeHtml(item?.etat_label || item?.stateLabel || etatLabel(getRepairStateId(item) || 0))}</span>
              <span>${escapeHtml(formatRepairShortDate(item))}</span>
            </div>
          </button>
        `).join('') : `
          <div class="transit-empty-state">Aucun dossier à afficher.</div>
        `}
      </div>

      <div class="mt-6">
        ${btn("Retour à l'accueil", { id: idBack, outline: true })}
      </div>
    </div>
  `;

  setScreen(html);

  document.getElementById(idBack).onclick = () => gotoAccueil();

  document.querySelectorAll('[data-repair-open]').forEach((el) => {
    el.addEventListener('click', () => {
      openRepairFromSummaryRef(el.getAttribute('data-repair-open') || '');
    });
  });
}

function screenAccueil() {
  currentScreen = 'accueil';
  isManualMode = false;

  const idManualBtn = 'manual_' + Math.random().toString(36).slice(2);
  const openTotal = homeRepairsSummary.all.filter(isOpenRepairForAccueil).length;
  const doneTotal = homeRepairsSummary.all.filter(isDoneRepairForAccueil).length;
  const overviewError = homeRepairsSummary.error
    ? `<div class="transit-home-banner">${escapeHtml(homeRepairsSummary.error)}</div>`
    : '';

  const html = `
    <div class="transit-home-shell">
      ${overviewError}

      <div class="transit-home-layout">
        <div class="transit-home-column transit-home-column--side transit-home-column--left">
          ${renderAccueilColumn(
            'Dossiers ouverts',
            'transit-side-panel__eyebrow--open',
            homeRepairsSummary.open,
            openTotal
              ? 'Aucun dossier ouvert parmi les plus récents.'
              : 'Aucun dossier ouvert en ce moment.',
            openTotal > 5 ? `Afficher tous les dossiers ouverts (${openTotal})` : 'Afficher tous les dossiers ouverts',
            'open',
            openTotal
          )}
        </div>

        <section class="transit-home-column transit-home-column--center">
          <div class="transit-scan-panel">
            <div class="transit-scan-panel__header">
              <p class="transit-scan-panel__eyebrow">Transit - réception des réparations</p>
              <h2 class="transit-scan-panel__title">Numérisez le code d'inventaire</h2>
              <p class="transit-scan-panel__subtitle">
                Le kiosque est prêt à ouvrir une fiche existante ou démarrer un nouveau dossier.
              </p>
            </div>

            ${CONFIG.LOGO_URL ? `
              <div class="relative transit-scan-panel__logo-wrap">
                <img
                  src="${CONFIG.LOGO_URL}"
                  alt="Logo scan"
                  class="transit-scan-panel__logo"
                />
                ${
                  IS_MOBILE
                    ? `
                      <button
                        id="btn-mobile-scan"
                        type="button"
                        class="absolute inset-0 w-full h-full mx-auto cursor-pointer bg-transparent"
                        aria-label="Scanner le code avec la caméra du téléphone"
                      ></button>
                    `
                    : ''
                }
              </div>
            ` : ''}

            <div class="transit-scan-panel__actions">
              ${btn('Saisie manuelle', { id: idManualBtn, outline: true })}
            </div>

            <div id="manual-block" class="mt-2 w-full hidden">
              <input
                id="scan-manual"
                class="border rounded-xl p-4 text-2xl w-full mb-2 focus:ring-2 focus:ring-black"
                placeholder="Ex.: 1074531 ou REP1515"
                enterkeyhint="done"
                autocomplete="off"
              />
              <div class="text-gray-500 text-sm mb-3">
                Vous pouvez entrer le numéro d'inventaire ou de réparation au clavier, puis appuyer sur Enter ↵
                ou utiliser le bouton « Rechercher ».
              </div>
              <button
                id="btn-manual-submit"
                type="button"
                class="px-6 py-3 rounded-xl text-xl font-semibold w-full bg-black text-white hover:opacity-90 shadow"
              >
                Rechercher
              </button>
            </div>

            <input
              id="scan-hidden"
              class="opacity-0 h-0 w-0 absolute -left-[9999px]"
              autocomplete="off"
            />
          </div>
        </section>

        <div class="transit-home-column transit-home-column--side transit-home-column--right">
          ${renderAccueilColumn(
            'Réparations terminées',
            'transit-side-panel__eyebrow--done',
            homeRepairsSummary.done,
            doneTotal
              ? 'Aucune réparation terminée parmi les plus récentes.'
              : 'Aucune réparation terminée en ce moment.',
            doneTotal > 5 ? `Afficher toutes les réparations terminées (${doneTotal})` : 'Afficher toutes les réparations terminées',
            'done',
            doneTotal
          )}
        </div>
      </div>
    </div>
  `;

  setScreen(html);
  app.dataset.screen = 'accueil';

  const hiddenInput = document.getElementById('scan-hidden');
  if (hiddenInput) {
    attachScanHandlerScan(hiddenInput);

    if (!IS_MOBILE) {
      hiddenInput.setAttribute('autofocus', 'autofocus');
      focusHiddenScanner();
      setTimeout(focusHiddenScanner, 50);
      setTimeout(focusHiddenScanner, 300);
      setTimeout(focusHiddenScanner, 1000);
    }
  }

  document.querySelectorAll('[data-repair-open]').forEach((el) => {
    el.addEventListener('click', () => {
      openRepairFromSummaryRef(el.getAttribute('data-repair-open') || '');
    });
  });

  document.querySelectorAll('[data-repair-list]').forEach((el) => {
    el.addEventListener('click', () => {
      const kind = el.getAttribute('data-repair-list') || '';
      if (kind === 'open' || kind === 'done') {
        screenRepairsByAccueilState(kind);
      }
    });
  });

  const btnManual = document.getElementById(idManualBtn);
  const manualBlock = document.getElementById('manual-block');
  const manualInput = document.getElementById('scan-manual');
  const btnManualSubmit = document.getElementById('btn-manual-submit');

  let submitManual = null;
  if (manualInput) {
    submitManual = attachScanHandlerManual(manualInput);
  }

  if (btnManual && manualBlock && manualInput) {
    btnManual.onclick = () => {
      isManualMode = !isManualMode;

      const hiddenScanner = document.getElementById('scan-hidden');

      if (isManualMode) {
        manualBlock.classList.remove('hidden');

        if (hiddenScanner) {
          hiddenScanner.blur();
        }

        manualInput.focus();

        if (btnManualSubmit && submitManual) {
          btnManualSubmit.onclick = () => {
            submitManual();
          };
        }
      } else {
        manualBlock.classList.add('hidden');
        manualInput.value = '';
        focusHiddenScanner();
      }
    };
  }

  if (IS_MOBILE) {
    const btnMobileScan = document.getElementById('btn-mobile-scan');
    if (btnMobileScan) {
      btnMobileScan.onclick = () => {
        if (window.mobileStartScan) {
          window.mobileStartScan();
        } else {
          alert("Le mode caméra n'est pas disponible sur ce téléphone.");
        }
      };
    }
  }
}


// ===== SCREENS =====
// ===== SCAN CACHÉ (lecteur code-barres) : accepte admin.page + inventaires =====
function attachScanHandlerScan(input) {
  if (!input) return;

  input.addEventListener('input', () => {
    // ⚠️ On NE filtre PAS ici : on laisse passer admin.page au complet
    // (pas de replace /[^\d]/g)
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const raw   = (input.value || '').trim();
      const lower = raw.toLowerCase();

      if (!raw) return;

      // Commande admin
      if (lower === 'admin.page') {
        console.log('Commande admin.page détectée (scan caché)');
        input.value = '';

        if (isAdmin()) {
          screenAdmin();   // OK seulement pour admin
        } else {
          alert("Accès admin refusé pour cet utilisateur.");
          gotoAccueil();
        }
        return;
      }


      // Sinon : on traite comme un numéro d'inventaire => on garde seulement les chiffres
      const inv = raw.replace(/[^\d]/g, '');
      if (inv) {
        onScan(inv);
      }
      input.value = '';
    }
  });
}

function attachScanHandlerManual(input) {
  if (!input) return () => {};

  const submit = async () => {
    const raw = (input.value || '').trim();
    if (!raw) return;

    // ------- Code admin -------
    if (raw === '9999999') {
      input.value = '';
      if (IS_MOBILE) input.blur();

      if (isAdmin()) {
        screenAdmin();
      } else {
        alert("Accès admin refusé pour cet utilisateur.");
        gotoAccueil();
      }
      return;
    }

    const cleaned = raw.trim();
    const upperNoSpace = cleaned.toUpperCase().replace(/\s+/g, '');
    const digitsOnly = cleaned.replace(/[^\d]/g, '');

    let idUniqueParam = null;

    // ------- Cas 1 : REP/TEST/FAC + chiffres (rep1437, REP 01437, etc.) -------
    // On extrait SEULEMENT les chiffres, pour être sûr d'envoyer "1493" et pas "REP1493".
    let m = upperNoSpace.match(/^(REP|TEST|FAC)0*(\d{1,4})$/);
    if (m) {
      idUniqueParam = m[2]; // ex: "REP01493" → "1493"
    }

    // ------- Cas 2 : seulement 1 à 4 chiffres => ID unique -------
    if (!idUniqueParam && /^\d{1,4}$/.test(digitsOnly) && digitsOnly.length === cleaned.length) {
      idUniqueParam = digitsOnly; // ex: "1493" → "1493"
    }

    console.log('[MANUEL] idUniqueParam =', idUniqueParam, 'raw =', cleaned);


    // Si on a identifié un ID unique → appel /repairs/by-id
    if (idUniqueParam) {
      try {
        showBusy(true);
        const item = await apiGetBTById(idUniqueParam);

        const inv =
          item.inventory ||
          item.inventory_uqam ||
          item.numero_inventaire ||
          item.no_inventaire ||
          '';

        if (!inv) {
          alert(
            "Ce bon a été trouvé dans Podio, " +
            "mais aucun numéro d'inventaire n'est associé. " +
            "Impossible d'ouvrir la fiche depuis cette recherche."
          );
        } else {
          // même flow que le scan de code-barres
          await onScan(inv, true);
        }
      } catch (err) {
        console.error('Erreur recherche par ID unique', err);
        alert("Aucun bon de réparation trouvé.");
      } finally {
        showBusy(false);
      }

      input.value = '';
      if (IS_MOBILE) input.blur();
      return;
    }

    // ------- Sinon : on traite comme INVENTAIRE (≥ 5 chiffres) -------
    const inv = digitsOnly;

    if (inv && inv.length >= 5) {
      onScan(inv);
    } else if (inv) {
      alert("Numéro trop court pour être un inventaire (minimum 5 chiffres).");
    }

    input.value = '';
    if (IS_MOBILE) {
      input.blur();
    }
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  });

  return submit;
}

// ===== Point d'entrée global pour la version mobile (caméra) =====
// Permet à une autre page / script (ex. index-mobile.html + mobile-scan.js)
// d'utiliser EXACTEMENT la même logique que le kiosque classique.
//
// Usage côté mobile :
//   window.kiosqueHandleScan("1070693");
if (typeof window !== 'undefined') {
  window.kiosqueHandleScan = function (code) {
    const inv = String(code || '')
      .replace(/[^\d]/g, '')  // on garde seulement les chiffres
      .trim();

    if (!inv) return;

    // On réutilise toute la logique existante
    // (lookup inventory, écrans, garantie, etc.)
    onScan(inv);
  };
}



/////////////////////////////////   ÉCRAN D'ACCUEIL    //////////////////////////////////////////////
function screenAccueilLegacy_unused() {
currentScreen = 'accueil';
isManualMode = false;
  const idManualBtn = 'manual_' + Math.random().toString(36).slice(2);

  const v = card(`
  <div class="flex flex-col items-center text-center">
    <h2 class="text-3xl font-bold mb-2">Numérisez le code d'inventaire</h2>

            ${CONFIG.LOGO_URL ? `
        <div class="relative mb-4">
          <img
            src="${CONFIG.LOGO_URL}"
            alt="Logo scan"
            class="w-80 h-80 mx-auto object-contain select-none pointer-events-none"
          />
          ${
            IS_MOBILE
              ? `
                <!-- Bouton transparent par-dessus le logo (mobile uniquement) -->
                <button
                  id="btn-mobile-scan"
                  type="button"
                  class="absolute inset-0 w-full h-full mx-auto cursor-pointer bg-transparent"
                  aria-label="Scanner le code avec la caméra du téléphone"
                ></button>
              `
              : ''
          }
        </div>
      ` : ''}


      ${btn('Saisie manuelle', { id: idManualBtn, outline: true })}

            <div id="manual-block" class="mt-4 w-full hidden">
        <input
          id="scan-manual"
          class="border rounded-xl p-4 text-2xl w-full mb-2 focus:ring-2 focus:ring-black"
          placeholder="Ex.: 1074531 ou REP1515"
          enterkeyhint="done"
          autocomplete="off"
        />
        <div class="text-gray-500 text-sm mb-3">
          Vous pouvez entrer le numéro d'inventaire ou de réparation au clavier, puis appuyer sur Enter ↵
          ou utiliser le bouton « Rechercher ».
        </div>
        <button
          id="btn-manual-submit"
          type="button"
          class="px-6 py-3 rounded-xl text-xl font-semibold w-full bg-black text-white hover:opacity-90 shadow"
        >
          Rechercher
        </button>
      </div>


        ${lastOperationItem ? `
        <div class="mt-10 w-full text-left border-t pt-5">
          <button
            id="last-operation-btn"
            type="button"
            class="w-full text-left bg-transparent border-0 p-0 m-0 cursor-pointer"
          >
            <div class="text-lg font-bold mb-2">
              Dernière opération
            </div>

            <div class="text-xl font-semibold mb-3">
              ${formatIdTitre(lastOperationItem)}
            </div>

            <div class="flex flex-wrap gap-2 items-center mb-2">
              ${
                (() => {
                  const s = Number(lastOperationItem.state);
                  if (!s || Number.isNaN(s)) return '';
                  return `
                    <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold text-black ${etatColor(s)}">
                      ${etatLabel(s)}
                    </span>
                    
                  `;
                })()
              }

              ${
                (() => {
                  const tId = Number(
                    lastOperationItem.typeReparation ??
                    lastOperationItem.type_reparation ??
                    lastOperationItem.typeReparationId
                  );

                  if (tId && !Number.isNaN(tId)) {
                    return `
                      <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold text-black ${typeColor(tId)}">
                        ${typeLabel(tId)}
                      </span>
                      
                    `;
                  }
                  const lbl = (
                    lastOperationItem.typeReparationLabel ??
                    lastOperationItem.type_reparation_label ??
                    ''
                  ).toString().trim();

                  if (lbl) {
                    return `
                      <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-gray-400 text-black">
                        ${lbl}
                      </span>
                    `;
                  }
                  return '';
                })()
              }
            </div>
          </button>
        </div>
      ` : ''}



      <input
        id="scan-hidden"
        class="opacity-0 h-0 w-0 absolute -left-[9999px]"
        autocomplete="off"
      />
    </div>
  `);

    setScreen(v);
  app.dataset.screen = 'accueil';

// Clique sur "Dernière opération" = relancer le même flux que le scan
  const lastOpBtn = document.getElementById('last-operation-btn');
  if (lastOpBtn && lastOperationItem) {
    lastOpBtn.onclick = () => {
      const inv =
        lastOperationItem.inventory ??
        lastOperationItem.numeroInventaire ??
        lastOperationItem.numero_inventaire ??
        null;

      if (inv) {
        onScan(inv); // même logique que si on scannait le code-barres
      } else {
        console.warn('Aucun numéro d’inventaire dans lastOperationItem', lastOperationItem);
      }
    };
  }

  // Champ caché pour le scan automatique
  const hiddenInput = document.getElementById('scan-hidden');
  if (hiddenInput) {
    attachScanHandlerScan(hiddenInput);

    // Sur DESKTOP seulement, on joue avec l'autofocus + focus forcé
    if (!IS_MOBILE) {
      hiddenInput.setAttribute('autofocus', 'autofocus');
      focusHiddenScanner();

      // Quelques rappels pour contourner les cas où le focus est “perdu”
      setTimeout(focusHiddenScanner, 50);
      setTimeout(focusHiddenScanner, 300);
      setTimeout(focusHiddenScanner, 1000);
    }
  }

  // Bouton "Saisie manuelle" (toggle)
  const btnManual = document.getElementById(idManualBtn);
  const manualBlock = document.getElementById('manual-block');
  const manualInput = document.getElementById('scan-manual');
  const btnManualSubmit = document.getElementById('btn-manual-submit');

  let submitManual = null;
  if (manualInput) {
    // On attache une seule fois le handler sur le champ manuel
    submitManual = attachScanHandlerManual(manualInput);
  }

  if (btnManual && manualBlock && manualInput) {
    btnManual.onclick = () => {
      isManualMode = !isManualMode;

      const hiddenInput = document.getElementById('scan-hidden');

      if (isManualMode) {
        // ➜ Passer en mode saisie manuelle
        manualBlock.classList.remove('hidden');

        // On s'assure que le scan caché NE garde PAS le focus
        if (hiddenInput) {
          hiddenInput.blur();
        }

        manualInput.focus();

        if (btnManualSubmit && submitManual) {
          btnManualSubmit.onclick = () => {
            submitManual();
          };
        }
      } else {
        // ➜ Revenir en mode scan automatique
        manualBlock.classList.add('hidden');
        manualInput.value = '';

        // On rend le focus au scan caché
        focusHiddenScanner();
      }
    };
  }





  // 🔹 Bouton mobile (overlay transparent sur le logo)
  if (IS_MOBILE) {
    const btnMobileScan = document.getElementById('btn-mobile-scan');
    if (btnMobileScan) {
      btnMobileScan.onclick = () => {
        if (window.mobileStartScan) {
          window.mobileStartScan();
        } else {
          alert("Le mode caméra n'est pas disponible sur ce téléphone.");
        }
      };
    }
  }
}



/////////////////////////////////   ÉCRAN OUI/NON    //////////////////////////////////////////////
function screenOuiNon(question, onYes, onNo){
    const idY = 'btnYes_'+Math.random().toString(36).slice(2);
    const idN = 'btnNo_'+Math.random().toString(36).slice(2);
    setScreen(card(`
      <h2 class="text-2xl font-semibold mb-6">${question}</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        ${btn('Oui',{id:idY})}
        ${btn('Non',{id:idN, outline:true})}
      </div>
    `));
    document.getElementById(idY).onclick = onYes;
    document.getElementById(idN).onclick = onNo;
}
/////////////////////////////////   ÉCRAN CRÉATION DEMANDE    //////////////////////////////////////////////
function screenCreationDemande(inv) {
  const idValider = 'val_' + Math.random().toString(36).slice(2);
  const idCancel  = 'cancel_' + Math.random().toString(36).slice(2);

  setScreen(card(`
    <h2 class="text-2xl font-semibold mb-4">
      Inventaire ${inv} – création d'un bon de réparation
    </h2>

    <div class="space-y-4">
      <!-- Secteur -->
      <div>
        <label class="block text-sm font-semibold mb-1" for="secteur">
          Secteur
        </label>
        <select
          id="secteur"
          class="border rounded-xl px-3 py-2 text-lg w-full"
        >
          ${SECTEURS.map(s => `
            <option value="${s.id}">${s.label}</option>
          `).join('')}
        </select>
      </div>

      <!-- Nom / courriel du demandeur (visible seulement si "Autre membre de la communauté") -->
      <div id="demandeur-block" class="space-y-3 hidden">
        <div>
          <label class="block text-sm font-semibold mb-1" for="demandeur-nom">
            Nom et prénom du demandeur
          </label>
          <input
            id="demandeur-nom"
            class="border rounded-xl px-3 py-2 text-lg w-full"
            autocomplete="off"
          />
        </div>

        <div>
          <label class="block text-sm font-semibold mb-1" for="demandeur-email">
            Courriel du demandeur
          </label>
          <input
            id="demandeur-email"
            type="email"
            class="border rounded-xl px-3 py-2 text-lg w-full"
            autocomplete="off"
          />
        </div>
      </div>

      <!-- Description du problème -->
      <div>
        <label class="block text-sm font-semibold mb-1" for="description-probleme">
          Description du problème
        </label>
        <textarea
          id="description-probleme"
          class="border rounded-xl px-3 py-2 text-lg w-full min-h-[120px]"
          placeholder="Ex.: L'appareil ne s'allume plus, bruit étrange, etc."
        ></textarea>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
        ${btn("Créer le bon de réparation", { id: idValider })}
        ${btn("Annuler", { id: idCancel, outline: true })}
      </div>
    </div>
  `));

  const selSecteur     = document.getElementById('secteur');
  const blockDemandeur = document.getElementById('demandeur-block');
  const inputNom       = document.getElementById('demandeur-nom');
  const inputEmail     = document.getElementById('demandeur-email');
  const inputDesc      = document.getElementById('description-probleme');

  function updateDemandeurVisibility() {
    const secteurId = Number(selSecteur.value || '0');

    if (secteurId === ID_AUTRE) {
      // ➜ "Autre membre de la communauté" : on montre les champs vides
      blockDemandeur.classList.remove('hidden');
      inputNom.value   = "";
      inputEmail.value = "";
    } else {
      // ➜ secteur pré-défini : on cache les champs, mais on pré-remplit en interne
      blockDemandeur.classList.add('hidden');
      const p = PRESETS[secteurId];
      if (p) {
        inputNom.value   = p.nom;
        inputEmail.value = p.courriel;
      } else {
        inputNom.value   = "";
        inputEmail.value = "";
      }
    }
  }

  selSecteur.addEventListener('change', updateDemandeurVisibility);
  updateDemandeurVisibility();  // init

  // Boutons
  document.getElementById(idCancel).onclick = () => gotoAccueil();

  document.getElementById(idValider).onclick = () => {
    const secteurId = Number(selSecteur.value || '0');
    const desc      = (inputDesc.value || "").trim();
    let nomPrenom   = (inputNom.value || "").trim();
    let courriel    = (inputEmail.value || "").trim();

    if (!secteurId) {
      alert("Veuillez sélectionner un secteur.");
      return;
    }

    if (!desc) {
      alert("Veuillez saisir une description du problème.");
      return;
    }

    if (secteurId === ID_AUTRE) {
      // ➜ Nom + courriel obligatoires en mode "Autre membre de la communauté"
      if (!nomPrenom || !courriel) {
        alert("Veuillez saisir le nom, le prénom et le courriel du demandeur.");
        return;
      }
    } else {
      // ➜ on force les valeurs des presets, même si les inputs sont cachés
      const p = PRESETS[secteurId];
      if (p) {
        nomPrenom = p.nom;
        courriel  = p.courriel;
      }
    }

    // Envoi vers l'API kiosque-reparation
    creerBT(inv, {
      secteur: secteurId,     // 🔹 ID numérique envoyé au back
      nomPrenom,
      courriel,
      description: desc,
    });
  };
}



/////////////////////////////////   ÉCRAN LISTE D'ÉTATS    //////////////////////////////////////////////
function screenListeEtats(titre, currentEtatId, onSelect) {
  // On exclut l'état "Demande initiale" (id = 10)
  const options = ETATS.filter(e => e.id !== 10);
  const ids = options.map(() => 'e_' + Math.random().toString(36).slice(2));
  const idBack = 'back_' + Math.random().toString(36).slice(2);

  setScreen(card(`
    <h2 class="text-2xl font-semibold mb-2">${titre}</h2>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
      ${options.map((e, i) => {
        const base = 'px-6 py-5 rounded-2xl text-xl font-semibold w-full mb-1 shadow hover:opacity-90 transition';
        const color = etatColor(e.id);

        const isCurrent = e.id === currentEtatId;

        // Contour gris pour "Annulé" plutôt que rouge
        const ringAnnule = e.id === 7 ? ' ring-2 ring-gray-400' : '';

        // Surbrillance de l'état actuel
        const highlight = isCurrent ? ' border-4 border-black scale-[1.01]' : '';

        const label = isCurrent ? `${e.label} (actuel)` : e.label;

        return `
          <button
            id="${ids[i]}"
            class="${base} ${color} text-black${ringAnnule}${highlight}"
            type="button"
          >
            ${label}
          </button>
        `;
      }).join('')}
    </div>

    ${btn('Retour', { id: idBack, outline: true })}
  `));

  // clic sur un état
  options.forEach((e, i) => {
    document.getElementById(ids[i]).onclick = () => onSelect(e.id);
  });

  // bouton Retour -> retour à l'écran d'accueil (scan)
  document.getElementById(idBack).onclick = () => gotoAccueil();
}


/////////////////////////////////   ÉCRAN TERMINER    //////////////////////////////////////////////
function screenTerminer(onPick, onBack, onChange) {
  const ids = TERMINE_CHOICES.map(() => 't_' + Math.random().toString(36).slice(2));
  const idChange = onChange ? 'chg_' + Math.random().toString(36).slice(2) : null;
  const idB = 'back_' + Math.random().toString(36).slice(2);

  setScreen(card(`
    <h2 class="text-2xl font-semibold mb-6">Terminer la réparation ou remettre au client ?</h2>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
      ${TERMINE_CHOICES.map((c, i) => btn(c.label, { id: ids[i] })).join('')}
    </div>

    ${onChange ? btn("Changer l'état", { id: idChange, outline: true }) : ''}

    ${btn('Retour', { id: idB, outline: true })}
  `));

  TERMINE_CHOICES.forEach((c, i) => {
    document.getElementById(ids[i]).onclick = () => onPick(c.next);
  });

  if (onChange && idChange) {
    document.getElementById(idChange).onclick = onChange;
  }

  document.getElementById(idB).onclick = onBack;
}
/////////////////////////////////   ÉCRAN TERMINER DÉTAILS   ///////////////////////////////////////////
function screenTerminerDetails(item, inv) {
  const idTravail = 'trav_' + Math.random().toString(36).slice(2);
  const idCout    = 'cout_' + Math.random().toString(36).slice(2);
  const idTech    = 'tech_' + Math.random().toString(36).slice(2);
  const idOk      = 'ok_'   + Math.random().toString(36).slice(2);
  const idBack    = 'back_' + Math.random().toString(36).slice(2);

  // Valeurs par défaut
   const travailInitial = cleanRichText(
    item.travailEffectue || item.travail_effectue || ''
  );

  const coutInitial    = '';  // tu peux mettre '5.00' si tu veux une valeur par défaut
  const username       = CURRENT_USER?.username || '';

  setScreen(card(`
    <h2 class="text-2xl font-semibold mb-4">
      Terminer la réparation – ${formatIdTitre(item)}
    </h2>

        <div class="mb-4">
      <label class="block text-sm font-medium mb-1">
        Technicien assigné
      </label>
      <div class="w-full border rounded px-3 py-2 bg-gray-100 text-sm">
        ${escapeHtml(username || 'Non connecté')}
      </div>
    </div>


    <div class="mb-4">
      <label class="block text-sm font-medium mb-1">Travail effectué</label>
      <textarea id="${idTravail}" rows="4"
        class="w-full border rounded px-3 py-2"
      >${escapeHtml(travailInitial)}</textarea>
    </div>

    <div class="mb-6">
      <label class="block text-sm font-medium mb-1">Coût de la réparation (CAD)</label>
      <input id="${idCout}" type="number" step="0.01" min="0"
        class="w-full border rounded px-3 py-2"
        value="${coutInitial}"
      />
    </div>

    <div class="flex gap-3">
      ${btn('Enregistrer et terminer', { id: idOk })}
      ${btn('Retour', { id: idBack, outline: true })}
    </div>
  `));

  const txtTrav = document.getElementById(idTravail);
  const inpCout = document.getElementById(idCout);

    document.getElementById(idOk).onclick = async () => {
    // On force le technicien à l’utilisateur connecté
    const techUsername = username || '';
    const travail      = txtTrav.value || '';
    const coutStr      = inpCout.value || '';

    try {
      const payload = {
        id: item.id,
        state: 4,
        travail_effectue: travail,
        cout_reparation: coutStr,
        tech_username: techUsername,
      };

      const res = await api('/repairs/update', { body: payload });
      if (!res || !res.ok) {
        alert("Erreur lors de la mise à jour de la réparation");
        return;
      }

      // On tente de recharger le dernier bon à partir de l'app_item_id,
      // mais sans casser le flux si ça échoue.
      const appItemId = item.app_item_id ?? item.appItemId ?? item.id;
      if (appItemId) {
        try {
          await refreshLastCreatedFromPodio(appItemId);
        } catch (e) {
          console.warn('refreshLastCreatedFromPodio a échoué', e);
        }
      }

      gotoAccueil();
    } catch (e) {
      console.error(e);
      alert("Erreur réseau / serveur lors de la mise à jour");
    }
  };


  document.getElementById(idBack).onclick = () => {
    // Retour à l'écran Terminer / Remettre
    screenTerminer(
      (code) => {
        if (code === 4) {
          screenTerminerDetails(item, inv);
        } else {
          majEtat(item, code);
        }
      },
      () => onScan(inv)
    );
  };
}


/////////////////////////////////   ÉCRAN REMETTRE    //////////////////////////////////////////////
function screenRemettreOuChanger(item, onRemettre, onChange, onBack) {
  const idRemettre = 'rem_' + Math.random().toString(36).slice(2);
  const idChange   = 'chg_' + Math.random().toString(36).slice(2);
  const idBack     = 'back_' + Math.random().toString(36).slice(2);

  const rawEtat = item?.state;
  const etatId  = typeof rawEtat === 'number' ? rawEtat : Number(rawEtat);

  const rawType = item?.typeReparation ??
                  item?.type_reparation ??
                  item?.typeReparationId ??
                  null;
  const tId = rawType != null ? Number(rawType) : NaN;

  const sousGarantie = isSousGarantie(item);
  const showWarrantyWarning =
    sousGarantie && ETATS_AVERT_GARANTIE.includes(etatId);

  const code       = formatAppItemCode(item);
  const titreLigne = item.title || '';

  const secteurIdRaw =
    item.secteurId ??
    item.secteur_id ??
    item.secteur ??
    null;
  const secteurId =
    secteurIdRaw != null ? Number(secteurIdRaw) : NaN;
  const secteurLabel =
    item.secteurLabel ??
    item.secteur_label ??
    '';

  const demandeurNom =
    item.demandeurNom ??
    item.demandeur_nom ??
    '';
  const demandeurEmail =
    item.demandeurEmail ??
    item.demandeur_email ??
    '';
  const travailEffectue = cleanRichText(
      item.travailEffectue ??
      item.travail_effectue ??
      ''
    );


  const secteurClientHtml = (() => {
    // Si on a un secteur ≠ "Autre membre de la communauté"
    if (!Number.isNaN(secteurId) && secteurId && secteurId !== ID_AUTRE && secteurLabel) {
  return `
    <div class="inline-block px-3 py-1 rounded-full text-sm font-medium text-black ${secteurColor(secteurId)}">
      ${secteurLabel}
    </div>
  `;
}


    const nom   = (demandeurNom   || '').trim();
    const email = (demandeurEmail || '').trim();

    if (nom || email) {
      return `
        <div class="text-sm">
          ${nom   ? `<div>${nom}</div>` : ''}
          ${email ? `<div class="text-gray-600">${email}</div>` : ''}
        </div>
      `;
    }

    return `<div class="text-sm text-gray-500">Non spécifié</div>`;
  })();

  setScreen(card(`
    <div class="space-y-5">

      <!-- ID + titre -->
      <div>
        <div class="text-3xl font-bold mb-1">
          ${code || formatAppItemCode(item)}
        </div>
        ${
          titreLigne
            ? `<div class="text-lg text-gray-700">${titreLigne}</div>`
            : ''
        }
      </div>

      <!-- État + Type de réparation -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <!-- État -->
        <div>
          <div class="text-sm font-semibold text-black mb-1">
            État
          </div>
          <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold text-black ${etatColor(etatId)}">
            ${etatLabel(etatId)}
          </span>
        </div>

        <!-- Type de réparation -->
        <div>
          <div class="text-sm font-semibold text-black mb-1">
            Type de réparation
          </div>
          ${
            tId && !Number.isNaN(tId)
              ? `
                <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold text-black ${typeColor(tId)}">
                  ${typeLabel(tId)}
                </span>
              `
              : `
                <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-gray-400 text-black">
                  ${
                    (item.typeReparationLabel ??
                     item.type_reparation_label ??
                     'Non spécifié')
                  }
                </span>
              `
          }
        </div>
      </div>

      <!-- Secteur / Client -->
      <div>
        <div class="text-sm font-semibold text-black mb-1">
          Secteur / Client
        </div>
        ${secteurClientHtml}
      </div>

      <!-- Description du problème -->
      <div>
        <div class="text-sm font-semibold text-black mb-1">
          Description du problème
        </div>
        <div class="text-gray-800 text-sm whitespace-pre-line">
          ${
            item.description
              ? String(item.description)
              : '<span class="text-gray-500">Aucune description</span>'
          }
        </div>
      </div>
    <!-- Description du travail effectué -->
            <div>
        <div class="text-sm font-semibold text-black mb-1">
          Description du travail effectué
        </div>
        <div class="text-gray-800 text-sm whitespace-pre-line">
          ${
            travailEffectue
              ? escapeHtml(travailEffectue)
              : '<span class="text-gray-500">Aucune description</span>'
          }
        </div>
      </div>



      <!-- Avertissement garantie -->
      ${
        showWarrantyWarning
          ? `
          <div class="p-3 rounded-xl bg-red-100 text-red-800 font-semibold text-center">
            Appareil sous garantie&nbsp;!
          </div>
          `
          : ''
      }

      <!-- Boutons d’action -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        ${btn('Remettre au client', { id: idRemettre })}
        ${!isViewer() ? btn("Changer l'état", { id: idChange, outline: true }) : ''}
      </div>

      ${btn('Retour', { id: idBack, outline: true })}

    </div>
  `));

  document.getElementById(idRemettre).onclick = onRemettre;

  if (!isViewer()) {
    const btnChange = document.getElementById(idChange);
    if (btnChange) {
      btnChange.onclick = onChange;
    }
  }

  document.getElementById(idBack).onclick = onBack;

}


/////////////////////////////////   ÉCRAN BT CRÉÉ!    //////////////////////////////////////////////
function screenCreationSuccess(item) {
  const idBack = 'back_' + Math.random().toString(36).slice(2);

  // Cacher le header
  const header = document.querySelector('header');
  if (header) header.style.display = 'none';

  const code   = formatAppItemCode(item);
  const titre  = item.title || '';
  const inv    = item.inventory || lastInventory || '';

  const etatId = typeof item.state === 'number' ? item.state : Number(item.state);
  const etatTxt = etatId ? etatLabel(etatId) : '—';

  // On affiche le code "type" brut; on pourra raffiner plus tard
    const typeTxt = item.typeReparationLabel
    ? `Type : ${item.typeReparationLabel}`
    : (item.typeReparation != null ? `Type : ${item.typeReparation}` : '');


  setScreen(`
    <div class="min-h-[60vh] flex flex-col items-center justify-center text-center">
      <h2 class="text-3xl font-bold mb-4">
        Bon de réparation créé
      </h2>

      <p class="mb-3 text-xl">
        Bon de réparation
        ${code ? `<span class="font-semibold">${code}</span>` : ''}
        pour l'appareil
        <span class="font-semibold">${inv}</span>
        créé avec succès !
      </p>

      <p class="text-sm text-gray-600 mb-8">
        Retour automatique à l'écran d'accueil dans 5&nbsp;secondes.
      </p>

      ${btn("Retour à l'accueil maintenant", { id: idBack, outline: true })}
    </div>
  `);

const timeoutId = setTimeout(() => {
  // Retour auto à l'accueil, avec refresh à 3s
  gotoAccueil();
}, 5000);

document.getElementById(idBack).onclick = () => {
  clearTimeout(timeoutId);
  // Retour immédiat à l'accueil, avec refresh à 3s
  gotoAccueil();
};


}


function formatIdTitre(item) {
  const code  = formatAppItemCode(item);  // TEST048
  const titre = item.title || '';

  const parts = [];
  if (code)  parts.push(code);
  if (titre) parts.push(titre);

  return parts.join(' | ');
}

function isSousGarantie(item) {
  if (!item) return false;

  // 1) Bool envoyé par le backend (nouveau format snake_case OU ancien camelCase)
  if (typeof item.is_under_warranty === 'boolean') {
    return item.is_under_warranty;
  }
  if (typeof item.isUnderWarranty === 'boolean') {
    return item.isUnderWarranty;
  }

  // 2) Fallback date de fin de garantie : plusieurs variantes possibles
  const end =
    item.warranty_end ||
    item.warrantyEnd ||
    item.dateFinGarantie ||
    item.garantieFin ||
    null;

  if (!end) return false;

  const d = new Date(end);
  if (Number.isNaN(d.getTime())) return false;

  const today = new Date();
  return d >= new Date(today.getFullYear(), today.getMonth(), today.getDate());
}
async function afficherMesBT() {
  try {
    // On utilise d'abord l'utilisateur en mémoire,
    // sinon on tente de le recharger depuis localStorage (kiosque_current_user)
    const user = CURRENT_USER || loadCurrentUser();

    const username = user?.username || "";

    if (!username) {
      setScreen(card(`
        <h2 class="text-2xl font-semibold mb-3">Mes BT</h2>
        <p class="text-red-600">
          Impossible de déterminer votre nom d'utilisateur (username).
          Vérifiez la connexion au kiosque.
        </p>
      `));
      return;
    }

    setScreen(card(`
      <h2 class="text-2xl font-semibold mb-3">Mes BT</h2>
      <p>Chargement de vos BT en cours...</p>
    `));

    const items = await apiListMesBT(username);


    if (!items.length) {
      setScreen(card(`
        <h2 class="text-2xl font-semibold mb-3">Mes BT</h2>
        <p>Aucun BT ne vous est actuellement assigné.</p>
      `));
      return;
    }

    const rows = items.map((it) => {
      const id = it.id_unique || it.app_item_id || it.item_id;
      const marqueModeleRaw = it.marque_modele || '';
      const inv = it.inventory || '';
      const etat = it.etat_label || '';
      const fermeture = it.close_date || '';

      // ID au format REP0925 (4 chiffres, zéros à gauche)
      const idDisplay = id != null
        ? `REP${String(id).padStart(4, '0')}`
        : '';

      // 1) Retirer tout ce qui vient après "|"
      //    ex : "Fender Bassman | 1070693" -> "Fender Bassman"
      let marqueModele = marqueModeleRaw;
      if (marqueModele.includes('|')) {
        marqueModele = marqueModele.split('|')[0].trim();
      }

      return `
            <tr class="border-t">
              <td class="px-2 py-1 whitespace-nowrap font-mono text-sm">${idDisplay}</td>
              <td class="px-2 py-1 text-sm">${marqueModele}</td>
              <td class="px-2 py-1 whitespace-nowrap text-sm">${inv}</td>
              <td class="px-2 py-1 whitespace-nowrap text-sm">${etat}</td>
              <td class="px-2 py-1 whitespace-nowrap text-sm">${fermeture}</td>
            </tr>
          `;
    }).join('');

    const html = `
      <h2 class="text-2xl font-semibold mb-3">Mes BT</h2>
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="border-b bg-gray-50">
            <tr>
              <th class="px-2 py-1">ID</th>
              <th class="px-2 py-1">Marque et modèle</th>
              <th class="px-2 py-1">No inventaire</th>
              <th class="px-2 py-1">Statut</th>
              <th class="px-2 py-1">Date de fermeture</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;

    setScreen(card(html));
  } catch (err) {
    console.error('Erreur afficherMesBT:', err);
    setScreen(card(`
      <h2 class="text-2xl font-semibold mb-3">Mes BT</h2>
      <p class="text-red-600">Erreur lors du chargement de vos BT.</p>
    `));
  }
}


/////////////////////////////////   ÉCRAN ADMIN    //////////////////////////////////////////////
function screenAdmin() {
  currentScreen = 'admin';

  const idBtnReport = 'rep_' + Math.random().toString(36).slice(2);
  const idBack      = 'back_' + Math.random().toString(36).slice(2);

  setScreen(card(`
    <div class="flex flex-col gap-6">
      <h2 class="text-3xl font-bold mb-2">Mode administrateur</h2>

      <p class="text-lg text-gray-700 mb-4">
        Vous êtes en mode administrateur
      </p>

      <div class="space-y-3">
        <p class="text-sm text-gray-600">
          À partir d'ici, vous pouvez générer des rapports sur les bons de réparation
          (terminés, annulés, remis, non réparables, etc.) par année financière.
        </p>
      </div>

      <div class="mt-4 space-y-3">
        ${btn("Émettre un rapport", { id: idBtnReport })}
        <!-- Plus tard : d'autres boutons admin ici -->
      </div>

      <div class="mt-6">
        ${btn("Retour à l'accueil", { id: idBack, outline: true })}
      </div>
    </div>
  `));

  // Bouton "Émettre un rapport" -> page de sélection du rapport
  document.getElementById(idBtnReport).onclick = () => {
    screenAdminReportSelection();
  };

  // Retour à l'accueil
  document.getElementById(idBack).onclick = () => gotoAccueil();
}
/////////////////////////////////   ÉCRAN ADMIN – SÉLECTION RAPPORT    //////////////////////////////////
function screenAdminReportSelection() {
  currentScreen = 'admin-report-select';

    const idYear    = 'finyear_' + Math.random().toString(36).slice(2);
  const idType    = 'rtype_'   + Math.random().toString(36).slice(2);
  const idEtats   = 'rstate_'  + Math.random().toString(36).slice(2);
  const idRun     = 'run_'     + Math.random().toString(36).slice(2);
  const idBack    = 'back_'    + Math.random().toString(36).slice(2);

  setScreen(card(`
    <h2 class="text-2xl font-semibold mb-4">Émettre un rapport</h2>

    <p class="text-gray-700 mb-6">
      Choisissez l'année financière, le <span class="font-semibold">type</span> et les
      <span class="font-semibold">états</span} des réparations à inclure.
    </p>

    <div class="space-y-4">
      <!-- Année financière -->
      <div>
        <label for="${idYear}" class="block text-sm font-semibold mb-1">
          Année financière
        </label>
        <select
          id="${idYear}"
          class="border rounded-xl px-3 py-2 text-lg w-full"
        >
          <option value="">-- Sélectionner --</option>
          <option value="2023-2024">2023-2024</option>
          <option value="2024-2025">2024-2025</option>
          <option value="2025-2026">2025-2026</option>
        </select>
      </div>

      <!-- Type (Interne / Externe ...) -->
      <div>
        <label for="${idType}" class="block text-sm font-semibold mb-1">
          Type de réparation
        </label>
        <select
          id="${idType}"
          class="border rounded-xl px-3 py-2 text-lg w-full"
        >
          <option value="all">Tous</option>
          <option value="interne">Interne</option>
          <option value="externe_hors_garantie">Externe hors garantie</option>
          <option value="externe_sous_garantie">Externe sous garantie</option>
        </select>
      </div>

      <!-- États -->
      <div>
        <label for="${idEtats}" class="block text-sm font-semibold mb-1">
          États des réparations
        </label>
        <select
          id="${idEtats}"
          class="border rounded-xl px-3 py-2 text-lg w-full"
        >
          <option value="all">Tous (tous les états)</option>
          <option value="finaux">
            Réparations terminées
            (Réparation terminée, Appareil remis, Annulé, Appareil non réparable)
          </option>
          <option value="en_cours">
            Réparations en cours (tous les autres états)
          </option>
        </select>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
      ${btn("Continuer", { id: idRun })}
      ${btn("Retour", { id: idBack, outline: true })}
    </div>
  `));

    const selYear  = document.getElementById(idYear);
    const selType  = document.getElementById(idType);
    const selEtats = document.getElementById(idEtats);
    const btnRun   = document.getElementById(idRun);
    const btnBack  = document.getElementById(idBack);

    btnRun.onclick = () => {
      const year  = (selYear.value  || "").trim();
      const type  = (selType.value  || "").trim() || "all";
      const etats = (selEtats.value || "").trim() || "all";

      if (!year) {
        alert("Veuillez sélectionner une année financière.");
        return;
      }

      const params = new URLSearchParams({
        financial_year: year,
        type,
        etats,
      });

      const url = `${CONFIG.STATS_REPORT_URL}?${params.toString()}`;

      // Télécharge le CSV dans le même onglet
      window.location.href = url;
      // ou, si tu préfères nouvel onglet :
      // window.open(url, '_blank');
    };

    btnBack.onclick = () => {
      screenAdmin();
    };

}



///////////////////////////////////// ON SCAN ////////////////////////////////////////////////////
// ===== LOGIQUE =====
async function onScan(inv, skipWarning = false) {
  lastInventory = inv;
  showBusy(true);

  try {
    const data = await apiLookupInventory(inv);

    // Aucun dossier -> proposer de créer un BT
    if (!data.found) {
      screenOuiNon(
        `Inventaire ${inv} introuvable. Créer un nouveau bon de réparation ?`,
        //() => creerBT(inv),
        () => screenCreationDemande(inv),
        () => gotoAccueil()
      );
      return;
    }

    const item   = data.latest;

    // ➜ Dernière opération = dernier élément scanné trouvé
    lastOperationItem = item;
    try {
      localStorage.setItem('kiosque_lastOperationItem', JSON.stringify(lastOperationItem));
    } catch (e) {
      console.warn('Impossible de sauver kiosque_lastOperationItem', e);
    }
    // 🔄 Sync cache en arrière-plan (sans bloquer l'UI)
    callCacheSync(item);



    const rawEtat = item?.state;
    const etatId = typeof rawEtat === 'number' ? rawEtat : Number(rawEtat);

    const rawType = item?.typeReparation ??
                    item?.type_reparation ??
                    item?.typeReparationId ??
                    null;
    const tId = rawType != null ? Number(rawType) : NaN;



    console.log('onScan inv=', inv, 'etat brute=', rawEtat, 'etatId=', etatId, 'item=', item);

    // Sous garantie ?
    const sousGarantie = isSousGarantie(item);

    // Si pas sous garantie, on peut éventuellement surveiller (si tu utilises encore ce mécanisme)
    if (!sousGarantie) {
    }

    // Si state n'est pas exploitable => fallback "générique"
    if (!etatId || Number.isNaN(etatId)) {
      console.warn('État inconnu, on passe par le flux générique');
      const idChange = 'chg_'  + Math.random().toString(36).slice(2);
      const idTerm   = 'term_' + Math.random().toString(36).slice(2);
      const idBack   = 'back_' + Math.random().toString(36).slice(2);

      if (isViewer()) {
        // 🔹 En mode kiosque : aucun changement d’état possible
        setScreen(card(`
          <h2 class="text-2xl font-semibold mb-2">${formatIdTitre(item)}</h2>
          <div class="text-gray-600 mb-6">État actuel (brut) : ${item.state}</div>
          ${btn('Retour', { id: idBack, outline: true })}
        `));

        document.getElementById(idBack).onclick = () => gotoAccueil();
        return;
      }

      // 🔹 Tech / admin : comportement complet
      setScreen(card(`
        <h2 class="text-2xl font-semibold mb-2">${formatIdTitre(item)}</h2>
        <div class="text-gray-600 mb-6">État actuel (brut) : ${item.state}</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          ${btn("Changer l'état", { id: idChange })}
          ${btn('Terminer / Remettre', { id: idTerm, outline: true })}
        </div>
        ${btn('Retour', { id: idBack, outline: true })}
      `));


      document.getElementById(idChange).onclick =
        () => screenListeEtats(
          `Changer l'état du bon ${formatAppItemCode(item)}`,
          etatId,
          (code) => majEtat(item, code)
        );

      document.getElementById(idTerm).onclick =
        () => screenTerminer(
          (code) => majEtat(item, code),
          () => onScan(inv)
        );

      document.getElementById(idBack).onclick = () => gotoAccueil();
      return;
    }

    // ========= CAS 1 : Dossier ouvert (1) -> Accusé de réception ? =========
    if (etatId === 1 || etatId === 10) { // Dossier ouvert

      // En mode kiosque (viewer) : on PEUT seulement accuser la réception (→ 5)
      // et sinon on retourne à l'accueil.
      if (isViewer()) {
        screenOuiNon(
          `${formatIdTitre(item)} — ${etatLabel(etatId)}. Accuser la réception ?`,
          () => majEtat(item, 5),
          () => gotoAccueil()
        );
      } else {
        // Tech / admin : comportement complet (accusé ou changement d'état)
        screenOuiNon(
          `${formatIdTitre(item)} — ${etatLabel(etatId)}. Accuser la réception ?`,
          () => majEtat(item, 5),
          () => screenListeEtats(
            `Changer l'état du bon ${formatAppItemCode(item)}`,
            etatId,
            (code) => majEtat(item, code)
          )
        );
      }


    // ========= CAS 2 : Appareil non-réparable (8) =========
    } else if (etatId === 8) {
      screenOuiNon(
        `${formatIdTitre(item)} — Appareil déclaré non réparable. Créer un nouveau bon quand même ?`,
        //() => creerBT(item.inventory || inv),
        () => screenCreationDemande(inv),
        () => gotoAccueil()
      );

    // ========= CAS : Réparation terminée (4) =========
    } else if (etatId === 4) {
      // Ici, l'item est déjà "Réparation terminée"
      // On propose : Remettre au client OU changer l'état
      screenRemettreOuChanger(
        item,
        // Remettre au client : état "Appareil remis" (6)
        () => majEtat(item, 6),
        // Changer l'état : liste sans "Demande initiale"
        () => screenListeEtats(
          `Changer l'état du bon ${formatAppItemCode(item)}`,
          etatId,
          (code) => majEtat(item, code)
        ),
        // Retour
        () => gotoAccueil()
      );

    // ========= CAS 3 : Appareil remis (6) =========
    } else if (etatId === 6 || etatId === 7) {
      const inv2    = item.inventory || inv;
      const idCreate = 'create_' + Math.random().toString(36).slice(2);
      const idOld    = 'old_'    + Math.random().toString(36).slice(2);
      const idCancel = 'cancel_' + idCreate;

      setScreen(card(`
        <h2 class="text-2xl font-semibold mb-1">
          ${formatIdTitre(item)}
        </h2>
        <div class="mb-3">
          <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold text-black ${etatColor(etatId)}">
            ${etatLabel(etatId)}
          </span>
          <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold text-black ${typeColor(tId)}">
            ${typeLabel(tId)}
          </span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          ${btn('Créer un nouveau BT',    { id: idCreate })}
          ${btn('Voir les anciens bons', { id: idOld, outline: true })}
        </div>
        ${btn('Annuler', { id: idCancel, outline: true })}
      `));

      document.getElementById(idCreate).onclick = () => screenCreationDemande(inv2);

      document.getElementById(idOld).onclick = async () => {
        showBusy(true);
        try {
          const res = await api(`/repairs/history?inventory=${encodeURIComponent(inv2)}`, { method: 'GET' });
          screenHistorique(res.items, () => gotoAccueil());
        } catch (e) {
          console.error(e);
          alert("Erreur lors de la lecture de l'historique");
          gotoAccueil();
        } finally {
          showBusy(false);
        }
      };

      document.getElementById(idCancel).onclick = () => gotoAccueil();

    // ========= CAS GÉNÉRIQUE : tous les autres états =========
    } else {
      const idChange = 'chg_'  + Math.random().toString(36).slice(2);
      const idTerm   = 'term_' + Math.random().toString(36).slice(2);
      const idBack   = 'back_' + Math.random().toString(36).slice(2);

      // Faut-il afficher l'avertissement "Appareil sous garantie !" ?
      const showWarrantyWarning =
        sousGarantie && ETATS_AVERT_GARANTIE.includes(etatId);

          const code       = formatAppItemCode(item);
      const titreLigne = item.title || '';

      const secteurIdRaw =
        item.secteurId ??
        item.secteur_id ??
        item.secteur ??
        null;
      const secteurId =
        secteurIdRaw != null ? Number(secteurIdRaw) : NaN;
      const secteurLabel =
        item.secteurLabel ??
        item.secteur_label ??
        '';

      const demandeurNom =
        item.demandeurNom ??
        item.demandeur_nom ??
        '';
      const demandeurEmail =
        item.demandeurEmail ??
        item.demandeur_email ??
        '';

      const secteurClientHtml = (() => {
        // Si on a un secteur ≠ "Autre membre de la communauté"
        if (!Number.isNaN(secteurId) && secteurId && secteurId !== ID_AUTRE && secteurLabel) {
  return `
    <div class="inline-block px-3 py-1 rounded-full text-sm font-medium text-black ${secteurColor(secteurId)}">
      ${secteurLabel}
    </div>
  `;
}


        const nom   = (demandeurNom   || '').trim();
        const email = (demandeurEmail || '').trim();

        if (nom || email) {
          return `
            <div class="text-sm">
              ${nom   ? `<div>${nom}</div>` : ''}
              ${email ? `<div class="text-gray-600">${email}</div>` : ''}
            </div>
          `;
        }

        return `<div class="text-sm text-gray-500">Non spécifié</div>`;
      })();
        setScreen(card(`
        <div class="space-y-5">

          <!-- ID + titre -->
          <div>
            <div class="text-3xl font-bold mb-1">
              ${code || formatAppItemCode(item)}
            </div>
            ${
              titreLigne
                ? `<div class="text-lg text-gray-700">${titreLigne}</div>`
                : ''
            }
          </div>

          <!-- État + Type de réparation -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- État -->
            <div>
              <div class="text-sm font-semibold text-black mb-1">
                État
              </div>
              <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold text-black ${etatColor(etatId)}">
                ${etatLabel(etatId)}
              </span>
            </div>

            <!-- Type de réparation -->
            <div>
              <div class="text-sm font-semibold text-black mb-1">
                Type de réparation
              </div>
              ${
                tId && !Number.isNaN(tId)
                  ? `
                    <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold text-black ${typeColor(tId)}">
                      ${typeLabel(tId)}
                    </span>
                  `
                  : `
                    <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-gray-400 text-black">
                      ${
                        (item.typeReparationLabel ??
                         item.type_reparation_label ??
                         'Non spécifié')
                      }
                    </span>
                  `
              }
            </div>
          </div>

          <!-- Secteur / Client -->
          <div>
            <div class="text-sm font-semibold text-black mb-1">
              Secteur / Client
            </div>
            ${secteurClientHtml}
          </div>

          <!-- Description du problème -->
          <div>
            <div class="text-sm font-semibold text-black mb-1">
              Description du problème
            </div>
            <div class="text-gray-800 text-sm whitespace-pre-line">
              ${
                item.description
                  ? String(item.description)
                  : '<span class="text-gray-500">Aucune description</span>'
              }
            </div>
          </div>

          <!-- Avertissement garantie -->
          ${
            showWarrantyWarning
              ? `
              <div class="p-3 rounded-xl bg-red-100 text-red-800 font-semibold text-center">
                Appareil sous garantie&nbsp;!
              </div>
              `
              : ''
          }

          <!-- Boutons d’action -->
          ${
            isViewer()
              ? btn('Retour', { id: idBack, outline: true })
              : `
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  ${btn("Changer l'état", { id: idChange })}
                  ${btn('Terminer / Remettre', { id: idTerm, outline: true })}
                </div>

                ${btn('Retour', { id: idBack, outline: true })}
              `
          }
        </div>
      `));

        if (!isViewer()) {
        const btnChange = document.getElementById(idChange);
        const btnTerm   = document.getElementById(idTerm);

        if (btnChange) {
          btnChange.onclick =
            () => screenListeEtats(
              `Changer l'état du bon ${formatAppItemCode(item)}`,
              etatId,
              (code) => majEtat(item, code)
            );
        }

        if (btnTerm) {
          btnTerm.onclick =
            () => screenTerminer(
              (code) => {
                if (code === 4) {
                  // Terminer la réparation → écran détails
                  screenTerminerDetails(item, inv);
                } else {
                  // Remettre au client (6) ou autre → simple changement d’état
                  majEtat(item, code);
                }
              },
              () => onScan(inv)
            );
        }

      }

      document.getElementById(idBack).onclick = () => gotoAccueil();

    }

  } catch (e) {
    console.error(e);
    alert('Erreur API. Voir console.');
    gotoAccueil();
  } finally {
    showBusy(false);
  }
}

async function majEtat(item, state) {
  showBusy(true);
  try {
    // 1) Mise à jour de l'état dans Podio via kiosque-reparation
    const res = await api('/repairs/update', { body: { id: item.id, state } });

    const updated = res && res.item
      ? res.item
      : { ...item, state };

    // 2) Appel stats/update (sans casser le kiosque si ça plante)
    try {
      await api('/stats/update', {
        body: {
          app_item_id: updated.app_item_id ?? updated.appItemId ?? updated.id,
          final_state: updated.state,
          dto: updated
        }
      });
    } catch (e) {
      console.warn('stats/update a échoué (majEtat)', e);
    }

    // 3) Mettre à jour "Dernière opération"
    lastOperationItem = updated;
    try {
      localStorage.setItem(
        'kiosque_lastOperationItem',
        JSON.stringify(updated)
      );
    } catch (e) {
      console.warn('Impossible de sauver kiosque_lastOperationItem', e);
    }

    // 🔄 Sync cache avec la version mise à jour
    callCacheSync(updated);


    gotoAccueil();
  } catch (e) {
    console.error(e);
    alert("Échec de la mise à jour de l'état");
    gotoAccueil();
  } finally {
    showBusy(false);
  }
}
async function callCacheSync(dto) {
  if (!CONFIG.CACHE_SYNC_API) return;

  try {
    await fetch(CONFIG.CACHE_SYNC_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dto }),
    });
  } catch (e) {
    console.warn('cache-sync a échoué', e);
  }
}


async function creerBT(inv, extra = {}) {
  showBusy(true);
  try {
    // 1) Création via kiosque-reparation
    const body = {
      inventory: inv,
      state: 5,      // 5 = "Appareil reçu"
      ...extra       // secteur, nomPrenom, courriel, description
    };

    const res = await api('/repairs/create', { body });

    if (!res || !res.ok || !res.item) {
      throw new Error('Réponse invalide de /repairs/create');
    }

    // 2) On tente de recharger l’item complet via podio-lookup
    let dto = res.item;
    try {
      const lookup = await apiLookupInventory(inv);
      if (lookup && lookup.found && lookup.latest) {
        dto = lookup.latest;
      }
    } catch (e) {
      console.warn('lookup après création a échoué, on garde res.item', e);
    }

    // 3) Appel stats/update pour enregistrer l'entrée dans la DB de stats
    try {
      await api('/stats/update', {
        body: {
          app_item_id: dto.app_item_id ?? dto.appItemId ?? dto.id,
          final_state: dto.state ?? 5,
          dto
        }
      });

    } catch (e) {
      console.warn('stats/update a échoué (creerBT)', e);
    }

    // 4) Dernier bon créé + dernière opération
    lastCreatedItem   = dto;
    lastOperationItem = dto;
    try {
      localStorage.setItem('kiosque_lastCreatedItem', JSON.stringify(dto));
      localStorage.setItem('kiosque_lastOperationItem', JSON.stringify(dto));
    } catch (e) {
      console.warn('Impossible de sauver lastCreatedItem/lastOperationItem', e);
    }

    // 🔄 Sync cache avec la version complète du DTO
    callCacheSync(dto);


    // 5) Navigation selon la garantie
    if (isSousGarantie(dto)) {
      warrantyWarnedForId = dto.id ?? dto.appItemId ?? null;
    } else {
      screenCreationSuccess(dto);
    }

  } catch (e) {
    console.error(e);
    alert('Échec création BT');
    gotoAccueil();
  } finally {
    showBusy(false);
  }
}

function gotoAccueil(delayRefreshMs) {
  // Si personne n’est connecté → on ne va PAS à l’accueil,
  // on reste en mode login.
  if (!CURRENT_USER) {
      const header = document.querySelector('header');
      if (header) header.style.display = 'flex';

      const menuRoot = document.getElementById('kiosque-menu-root');
      if (menuRoot) {
        menuRoot.style.display = 'block';
      }

    clearKiosqueTimers();
    renderLoginScreen();
    return;
  }

  const header = document.querySelector('header');
  if (header) header.style.display = 'flex';

  screenAccueil();

  // Sécurité supplémentaire : on insiste pour redonner le focus au scan caché
  setTimeout(focusHiddenScanner, 50);
  setTimeout(focusHiddenScanner, 300);
  setTimeout(focusHiddenScanner, 1000);

  scheduleRefreshDernierBon(delayRefreshMs);   // par défaut 5s si non fourni
}


function scheduleRefreshDernierBon(delayMs) {
  // Si plus d’utilisateur → on ne programme pas de refresh
  if (!CURRENT_USER) return;

  if (lastCreatedRefreshTimer) {
    clearTimeout(lastCreatedRefreshTimer);
    lastCreatedRefreshTimer = null;
  }

  const delay = typeof delayMs === 'number' ? delayMs : 0; // défaut 5s

  lastCreatedRefreshTimer = setTimeout(() => {
    loadLastFromRepairsListAndMaybeWarn();
  }, delay);
}



async function loadLastFromRepairsListAndMaybeWarn() {
  try {
    const [rawItems, overview] = await Promise.all([
      apiListRepairsCache(200),
      apiFetchOverviewHome(5),
    ]);

    lastRepairsList = rawItems.map(mergeRepairCacheItem);

    const combinedOverviewItems = [...(overview.open || []), ...(overview.done || [])];
    const byRef = new Map();
    combinedOverviewItems.forEach((item) => {
      const ref = getRepairReferenceId(item);
      if (ref) {
        byRef.set(ref, item);
      }
    });

    homeRepairsSummary = {
      all: Array.from(byRef.values()),
      open: Array.isArray(overview.open) ? overview.open : [],
      done: Array.isArray(overview.done) ? overview.done : [],
      error: '',
    };

    if (!lastRepairsList.length) {
      if (app.dataset.screen === 'accueil') {
        screenAccueil();
      }
      return;
    }

    const merged = lastRepairsList[0];

    lastCreatedItem = merged;
    lastOperationItem = merged;

    try {
      localStorage.setItem('kiosque_lastCreatedItem', JSON.stringify(merged));
      localStorage.setItem('kiosque_lastOperationItem', JSON.stringify(merged));
    } catch (e) {
      console.warn('Impossible de sauver kiosque_lastCreatedItem / kiosque_lastOperationItem (merged)', e);
    }

    if (app.dataset.screen === 'accueil') {
      screenAccueil();
    }
  } catch (e) {
    console.error('loadLastFromRepairsListAndMaybeWarn error', e);
    homeRepairsSummary = {
      ...homeRepairsSummary,
      error: "Impossible de charger les dossiers récents pour l'accueil.",
    };

    if (app.dataset.screen === 'accueil') {
      screenAccueil();
    }
  }
}

async function loadLastFromRepairsListAndMaybeWarnLegacy_unused() {
  try {
    const res = await fetch(CONFIG.REPAIRS_CACHE_API, { method: 'GET' });
    if (!res.ok) {
      console.warn('REPAIRS_CACHE_API status', res.status);
      return;
    }

    const data = await res.json();
    let items = Array.isArray(data.items) ? data.items.slice() : [];
    if (!items.length) return;

    // Filtrage éventuel (si ton backend marque certains bons comme supprimés/archivés)
    items = items.filter(it => !it.deleted && !it.isDeleted && !it.archived);

    if (!items.length) return;

    // On trie du plus récent au plus vieux.
    // Hypothèse : appItemId (ou id) augmente dans le temps.
    items.sort((a, b) => {
      const aId = Number(a.appItemId ?? a.id ?? 0);
      const bId = Number(b.appItemId ?? b.id ?? 0);
      return bId - aId; // desc
    });

    // CANDIDAT "dernier bon" depuis la liste
    const lastFromList = items[0];

    // 🔹 Si la colonne dto est présente, on l'utilise comme base "enrichie",
    //    mais on laisse TOUJOURS la ligne DB écraser (state, type, etc.).
    const rawDto = lastFromList.dto;
    const dto =
      rawDto && typeof rawDto === 'object'
        ? rawDto
        : null;

    // Important : la DB (lastFromList) gagne toujours sur dto
    const merged = dto
      ? { ...dto, ...lastFromList }
      : lastFromList;

    // On met simplement à jour nos variables globales à partir de ce snapshot,
    // sans ré-injecter d'anciens objets par-dessus.
    lastCreatedItem   = merged;
    lastOperationItem = merged;

    try {
      localStorage.setItem('kiosque_lastCreatedItem',   JSON.stringify(merged));
      localStorage.setItem('kiosque_lastOperationItem', JSON.stringify(merged));
    } catch (e) {
      console.warn('Impossible de sauver kiosque_lastCreatedItem / kiosque_lastOperationItem (merged)', e);
    }

    // Si on est VRAIMENT sur l’écran d’accueil, on redessine
    if (app.dataset.screen === 'accueil') {
      screenAccueil();
    }



  } catch (e) {
    console.error('loadLastFromRepairsListAndMaybeWarn error', e);
  }
}

  // ===== Busy Overlay =====
  let busy = false;
  function showBusy(v){
    busy = v;
    let o = document.getElementById('busy');
    if (v){
      if (!o){
        o = document.createElement('div');
        o.id = 'busy';
        o.className = 'fixed inset-0 bg-black/20 grid place-items-center';
        o.innerHTML = '<div class="bg-white rounded-2xl shadow px-6 py-4 text-lg">Veuillez patienter…</div>';
        document.body.appendChild(o);
      }
    } else if (o) { o.remove(); }
  }

['pointerdown','keydown'].forEach(ev => window.addEventListener(ev, armIdle));


/* 🔹 IMPORTANT : relire le dernier bon créé AVANT d'appeler gotoAccueil() */
try {
  const raw = localStorage.getItem('kiosque_lastCreatedItem');
  if (raw) {
    lastCreatedItem = JSON.parse(raw);
    console.log('lastCreatedItem rechargé au démarrage :', lastCreatedItem);
  }
} catch (e) {
  console.warn('Impossible de lire kiosque_lastCreatedItem', e);
}
try {
  const rawOp = localStorage.getItem('kiosque_lastOperationItem');
  if (rawOp) {
    lastOperationItem = JSON.parse(rawOp);
    console.log('lastOperationItem rechargé au démarrage :', lastOperationItem);
  }
} catch (e) {
  console.warn('Impossible de lire kiosque_lastOperationItem', e);
}
// =====================
// Menu hamburger (UI)
// =====================

function handleMenuAction(action) {
  switch (action) {
    case 'home':
      console.log('[MENU] Accueil');
      // Retour à l'écran principal
      gotoAccueil();
      break;

    case 'bt-associes':
      console.log('[MENU] Mes BT');
      if (isViewer()) {
        alert("Cette section n'est pas disponible pour le compte kiosque.");
        break;
      }
      afficherMesBT();
      break;


    case 'rapports':
      console.log('[MENU] Rapports');
      // Rapports = ton écran admin / rapports
      if (isAdmin()) {
        screenAdminReportSelection(); // va directement à la sélection de rapport
      } else {
        alert("Seuls les administrateurs peuvent accéder aux rapports.");
      }
      break;

    case 'logout':
      console.log('[MENU] Déconnexion');
      // On réutilise ta vraie logique de déconnexion
      logoutKiosque();
      break;

    default:
      console.warn('[MENU] Action inconnue :', action);
  }
}

function updateMenuForRole() {
  const user = CURRENT_USER || loadCurrentUser();
  const role = user?.role || null;

  // Boutons du menu (dans le panel)
  const btnHome    = document.querySelector('[data-menu-action="home"]');
  const btnMesBT   = document.querySelector('[data-menu-action="bt-associes"]');
  const btnRapport = document.querySelector('[data-menu-action="rapports"]');
  const btnLogout  = document.querySelector('[data-menu-action="logout"]');

  const isViewerRole = role === 'viewer';

  if (isViewerRole) {
    // 🔹 Kiosque / viewer : on cache tout sauf Déconnexion
    if (btnHome)    btnHome.classList.add('hidden');
    if (btnMesBT)   btnMesBT.classList.add('hidden');
    if (btnRapport) btnRapport.classList.add('hidden');
    if (btnLogout)  btnLogout.classList.remove('hidden');
  } else {
    // 🔹 Tech / admin : tout est visible (si présent dans le DOM)
    if (btnHome)    btnHome.classList.remove('hidden');
    if (btnMesBT)   btnMesBT.classList.remove('hidden');
    if (btnRapport) btnRapport.classList.remove('hidden');
    if (btnLogout)  btnLogout.classList.remove('hidden');
  }
}




// ======================
// POINT D'ENTRÉE
// ======================

function startKiosqueAfterLogin() {
  console.log('Utilisateur connecté :', CURRENT_USER);

  const header = document.querySelector('header');
  if (header) header.style.display = 'flex';

  const menuRoot = document.getElementById('kiosque-menu-root');
  if (menuRoot) {
    menuRoot.style.display = 'block';
  }

  // 🔹 Bonjour Nicholas / Zineddine / Maxime
  updateUserGreeting();

  // 🔹 Ajuster les entrées du menu selon le rôle (viewer / tech / admin)
  updateMenuForRole();

  gotoAccueil();
}



// ======================
// POINT D'ENTRÉE SANS DOMContentLoaded
// ======================

(function initKiosque() {
  console.log('[KIOSQUE] initKiosque');

  // 1) Décider quoi afficher (#app) en fonction de l'utilisateur
  const user = loadCurrentUser();
  if (user) {
    console.log('[KIOSQUE] Connexion restaurée pour', user);
    // loadCurrentUser() met déjà CURRENT_USER à jour
    startKiosqueAfterLogin();
  } else {
    renderLoginScreen();
  }

  // 2) Wiring du menu hamburger
  const btnToggle = document.getElementById('kiosque-menu-toggle');
  const panel     = document.getElementById('kiosque-menu-panel');
  const menuRoot  = document.getElementById('kiosque-menu-root');

  if (!btnToggle || !panel || !menuRoot) {
    console.warn('[MENU] éléments non trouvés dans le DOM', {
      btnToggle: !!btnToggle,
      panel: !!panel,
      menuRoot: !!menuRoot,
    });
    return;
  }

  // Si personne n’est connecté au démarrage → cacher le menu
  if (!user) {
    menuRoot.style.display = 'none';
  }

  // Bouton hamburger → ouvrir/fermer le panel
  btnToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.toggle('hidden');
  });

  // Adapter les entrées de menu selon le rôle (viewer / tech / admin)
  updateMenuForRole();

  // Click sur une entrée du menu
  panel.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-menu-action]');
    if (!btn) return;

    const action = btn.getAttribute('data-menu-action');
    panel.classList.add('hidden'); // referme le menu
    handleMenuAction(action);
  });

  // Fermer le menu si on clique ailleurs
  document.addEventListener('click', (e) => {
    if (!menuRoot) return;
    if (!menuRoot.contains(e.target)) {
      panel.classList.add('hidden');
    }
  });
})();

