// js/mobile-scan.js

let codeReader = null;
let scanning = false;
let scanTimeoutId = null;


function openOverlay() {
  const overlay = document.getElementById('mobile-camera-overlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    overlay.classList.add('flex'); // items-center / justify-center
  }
}

function closeOverlay() {
  const overlay = document.getElementById('mobile-camera-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
  }
}

function stopScan() {
      if (scanTimeoutId) {
    clearTimeout(scanTimeoutId);
    scanTimeoutId = null;
  }

  scanning = false;

  const video = document.getElementById('mobile-video');
  if (video && video.srcObject) {
    try {
      const tracks = video.srcObject.getTracks();
      tracks.forEach((t) => t.stop());
    } catch (e) {
      console.warn('Erreur arrêt flux vidéo', e);
    }
    video.srcObject = null;
  }

  if (codeReader) {
    try {
      codeReader.reset();
    } catch (e) {
      console.warn('Erreur reset codeReader', e);
    }
  }

  closeOverlay();
}

async function startScan() {
  const video = document.getElementById('mobile-video');
  if (!video) {
    alert("Impossible de trouver l'élément vidéo pour le scan.");
    return;
  }
    // Vérifier que ZXing est bien chargé
  if (typeof ZXing === 'undefined' || !ZXing.BrowserMultiFormatReader) {
    console.error('ZXing non disponible : vérifier la balise <script> @zxing/library dans index-mobile.html');
    alert(
      "Le module de scan n'est pas disponible.\n" +
      "Vérifiez la connexion internet et la version du script ZXing."
    );
    return;
  }


  openOverlay();
  scanning = true;

  // Important pour iOS
  video.setAttribute('playsinline', 'true');

  const statusEl = document.getElementById('mobile-scan-status');
  if (statusEl) {
    statusEl.textContent =
      'Scan en cours… alignez l’étiquette dans le cadre et rapprochez-vous si nécessaire.';
  }
    // 🔹 Après 10s, on suggère la saisie manuelle
  if (scanTimeoutId) {
    clearTimeout(scanTimeoutId);
    scanTimeoutId = null;
  }
  scanTimeoutId = setTimeout(() => {
    if (!scanning) return;
    if (statusEl) {
      statusEl.textContent =
        "Impossible de lire le code. " +
        "Vous pouvez rapprocher l’étiquette ou saisir le numéro manuellement depuis l’écran d’accueil.";
    }
  }, 10000);

    // Initialisation de ZXing (lecteur multi-format)
    if (!codeReader) {
        try {
        // Beaucoup de versions de ZXing attendent "new BrowserMultiFormatReader()" sans args.
        codeReader = new ZXing.BrowserMultiFormatReader();

        // (Optionnel) si tu veux vraiment forcer certains formats, on pourra
        // utiliser les hints plus tard avec d'autres méthodes, mais pour l'instant
        // on reste sur la config par défaut pour éviter les soucis de compatibilité.
        console.log('[mobile-scan] BrowserMultiFormatReader initialisé');
        } catch (e) {
        console.error('Erreur lors de la création de BrowserMultiFormatReader', e);
        alert("Impossible d'initialiser le lecteur de codes-barres.");
        stopScan();
        return;
        }
    }


  // Contraintes vidéo : caméra arrière, HD, zoom si dispo
  const constraints = {
    video: {
      facingMode: { ideal: 'environment' }, // caméra arrière
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      // Certains navigateurs (surtout Chrome Android) supportent ce zoom numérique.
      // Les autres vont juste ignorer "advanced".
      advanced: [{ zoom: 3.5 }],
    },
  };

  const callback = (result, err) => {
    // Pour debug : vérifier qu'on reçoit bien quelque chose à chaque frame
    // (ça va spammer un peu la console, mais utile pour vérifier sur une vraie machine)
    if (result) {
      console.log('[ZXing callback] result reçu', result.getText());
    } else if (err && !(err instanceof ZXing.NotFoundException)) {
      console.warn('[ZXing callback] err autre que NotFound', err);
    }
    if (!scanning) return;

    if (result) {
      scanning = false;
      const text = result.getText();
      console.log('Code détecté :', text);

      if (statusEl) {
        statusEl.textContent = 'Code détecté, merci !';
      }

      stopScan();

      if (window.kiosqueHandleScan) {
        window.kiosqueHandleScan(text);
      } else {
        alert(`Code scanné : ${text}`);
      }
    } else if (err && !(err instanceof ZXing.NotFoundException)) {
      // NotFoundException = rien trouvé sur cette frame → normal.
      console.warn('Erreur de lecture code-barres', err);
    }
  };

  try {
    if (typeof codeReader.decodeFromConstraints === 'function') {
      // Version moderne de ZXing : on peut passer les contraintes directement
      await codeReader.decodeFromConstraints(constraints, video, callback);
    } else {
      // Fallback : ancienne méthode, moins de contrôle (mais ça continue de marcher)
      await codeReader.decodeFromVideoDevice(null, video, callback);
    }
  } catch (err) {
    console.error('Erreur startScan', err);

    let msg = "Erreur lors de l'accès à la caméra.";
    if (err && err.name === 'NotAllowedError') {
      msg =
        "Accès à la caméra refusé. Autorisez la caméra pour ce site dans les réglages du navigateur.";
    } else if (err && err.name === 'NotFoundError') {
      msg = "Aucune caméra compatible n'a été trouvée sur cet appareil.";
    } else if (err && err.message) {
      msg = "Erreur lors de l'accès à la caméra : " + err.message;
    }

    alert(msg);
    stopScan();
  }
}

// Wiring : bouton fermer + clic en dehors
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const btnClose = document.getElementById('btn-mobile-close');
    if (btnClose) {
      btnClose.onclick = () => {
        stopScan();
      };
    }

    const overlay = document.getElementById('mobile-camera-overlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          stopScan();
        }
      });
    }
  });

  // Expose pour app.js (bouton transparent sur le logo)
  window.mobileStartScan = startScan;
}
