/* ==========================================================================
   ViewMetricaMX — Nissan V-Drive 2026 · Demo 360°
   ========================================================================== */

/* --------------------------------------------------------------------------
   CONFIGURA AQUÍ TU NÚMERO DE WHATSAPP
   Formato: código de país + número, sin espacios ni símbolos.
   Ejemplo Torreón/Gómez Palacio/Lerdo (Coahuila/Durango, MX): "528711234567"
-------------------------------------------------------------------------- */
const WHATSAPP_NUMBER = "AQUI_MI_NUMERO";
const WHATSAPP_MESSAGE = "Hola, vi la demo 360° del Nissan V-Drive y me gustaría conocer cómo podría aplicarse a nuestra agencia.";

/* --------------------------------------------------------------------------
   Posiciones del recorrido 360°
   Nota: no se recibió una foto "centro" — el cuarto panorama disponible
   corresponde a la vista trasera del vehículo, por lo que se etiquetó
   como "TRASERA" en lugar de inventar una posición inexistente.
-------------------------------------------------------------------------- */
const POSITIONS = {
  piloto:   { label: "PILOTO",   file: "assets/piloto_nissan_v_drive_2026_gomez_palacio.jpg",   lon: 160, lat: 0,  fov: 82 },
  copiloto: { label: "COPILOTO", file: "assets/copiloto_nissan_v_drive_2026_gomez_palacio.jpg", lon: 20,  lat: -2, fov: 82 },
  interior: { label: "INTERIOR", file: "assets/interior_nissan_v_drive_2026_gomez_palacio.jpg", lon: 0,   lat: 0,  fov: 84 },
  trasera:  { label: "TRASERA",  file: "assets/trasera_nissan_v_drive_2026_gomez_palacio.jpg",  lon: 0,   lat: 0,  fov: 84 },
};

const FOV_MIN = 32;
const FOV_MAX = 92;
const AUTOROTATE_SPEED = 0.006;   // grados por frame — deliberadamente muy lento
const AUTOROTATE_RESUME_DELAY = 5200; // ms de inactividad antes de retomar

(function init(){

  const stageEl = document.getElementById("viewer-stage");
  const canvas = document.getElementById("pano-canvas");
  const loadingEl = document.getElementById("viewer-loading");
  const loadingLabel = loadingEl.querySelector(".loading-label");
  const fallbackEl = document.getElementById("viewer-fallback");
  const fallbackImg = document.getElementById("fallback-img");
  const dragHint = document.getElementById("drag-hint");
  const posTag = document.getElementById("pos-tag");
  const posButtons = Array.from(document.querySelectorAll(".pos-btn"));

  /* ---- WebGL support check -------------------------------------------- */
  function hasWebGL(){
    try{
      const c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext &&
        (c.getContext("webgl") || c.getContext("experimental-webgl")));
    }catch(e){ return false; }
  }

  if (typeof THREE === "undefined" || !hasWebGL()) {
    const threeOk = typeof THREE !== "undefined";
    const webglOk = hasWebGL();
    console.error("[ViewMetricaMX] Visor 360° no disponible. THREE cargado:", threeOk, "| WebGL soportado:", webglOk);

    // Fallback elegante: se muestra una imagen estática de la primera posición,
    // con el diagnóstico visible en pantalla (sin necesidad de abrir la consola).
    canvas.hidden = true;
    loadingEl.hidden = true;
    fallbackEl.hidden = false;
    fallbackImg.src = POSITIONS.piloto.file;
    const diagP = fallbackEl.querySelector("p");
    if (diagP){
      diagP.textContent =
        `Tu navegador no soporta la vista 360° interactiva. ` +
        `[Diagnóstico: Three.js cargado = ${threeOk} · WebGL soportado = ${webglOk}]`;
    }
    setupPosNavFallbackMode();
    setupCTA();
    setupReveal();
    return;
  }

  /* ---- Three.js setup ---------------------------------------------------
     Cámara al centro de una esfera invertida (se ve desde adentro).
  -------------------------------------------------------------------- */
  let renderer, scene, camera, sphere;
  let currentPos = "piloto";
  let lon = POSITIONS.piloto.lon, lat = POSITIONS.piloto.lat;
  let targetFov = POSITIONS.piloto.fov;

  let isPointerDown = false;
  let onPointerDownX = 0, onPointerDownY = 0;
  let onPointerDownLon = 0, onPointerDownLat = 0;
  let lastInteraction = performance.now();
  let userHasInteracted = false;

  const textureCache = {};
  const loader = new THREE.TextureLoader();

  function buildScene(){
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(targetFov, 16/9, 1, 1100);

    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1); // ver la textura desde adentro

    const material = new THREE.MeshBasicMaterial({ color: 0xff00ff }); // DIAGNÓSTICO: magenta brillante temporal
    sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    canvas.style.outline = "4px solid red"; // DIAGNÓSTICO: confirma visualmente que el canvas ocupa espacio

    resizeRenderer();
    animate();

    // --- Diagnóstico integrado (visible siempre en consola) ---------------
    console.log("[ViewMetricaMX] Three.js version:", THREE.REVISION);
    const gl = renderer.getContext();
    const maxTexSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    console.log("[ViewMetricaMX] Tamaño máximo de textura soportado por tu GPU:", maxTexSize, "px");
    if (maxTexSize < 8192) {
      console.warn("[ViewMetricaMX] ATENCIÓN: tus fotos miden 8000px de ancho y tu GPU soporta hasta " + maxTexSize + "px. Three.js debería reescalarlas automáticamente, pero si el visor sigue en blanco, esto es sospechoso número 1.");
    }
    const cw = stageEl.clientWidth, ch = stageEl.clientHeight;
    console.log("[ViewMetricaMX] Tamaño del contenedor del visor al crear la escena:", cw, "x", ch, "px");
    if (!cw || !ch) {
      console.warn("[ViewMetricaMX] ATENCIÓN: el contenedor del visor mide 0 en algún eje — el canvas puede estar invisible por CSS/layout.");
    }

    const glError = gl.getError();
    console.log("[ViewMetricaMX] Error de WebGL tras el primer render:", glError === gl.NO_ERROR ? "ninguno (OK)" : glError);
    console.log("[ViewMetricaMX] DIAGNÓSTICO: deberías ver una ESFERA MAGENTA BRILLANTE con borde ROJO alrededor del recuadro ahora mismo.");
  }

  function resizeRenderer(){
    const w = stageEl.clientWidth;
    const h = stageEl.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  /* ---- Texture loading with cache + fade ------------------------------ */
  function loadPosition(key, { silent = false } = {}){
    const cfg = POSITIONS[key];
    if (!cfg) return;

    currentPos = key;
    lon = cfg.lon; lat = cfg.lat; targetFov = cfg.fov;
    camera.fov = cfg.fov;
    camera.updateProjectionMatrix();

    posTag.textContent = cfg.label;
    posButtons.forEach(b => {
      const active = b.dataset.pos === key;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-pressed", active ? "true" : "false");
    });

    if (textureCache[key]) {
      applyTexture(textureCache[key]);
      return;
    }

    if (!silent){
      loadingLabel.textContent = `Cargando ${cfg.label.toLowerCase()}…`;
      loadingEl.hidden = false;
    }

    loader.load(
      cfg.file,
      (texture) => {
        const img = texture.image;
        console.log(
          "[ViewMetricaMX] Textura cargada:", cfg.file,
          "| dimensiones reales:", img ? img.width + "x" + img.height : "desconocidas",
          "| relación:", img ? (img.width / img.height).toFixed(2) : "?"
        );
        texture.colorSpace = THREE.SRGBColorSpace || texture.colorSpace;
        texture.minFilter = THREE.LinearFilter;
        textureCache[key] = texture;
        applyTexture(texture);
        loadingEl.hidden = true;
      },
      undefined,
      (err) => {
        console.error("[ViewMetricaMX] ERROR cargando textura:", cfg.file, err);
        loadingLabel.textContent = "No se pudo cargar el panorama.";
      }
    );
  }

  function applyTexture(texture){
    sphere.material.map = texture;
    sphere.material.color.set(0xffffff);
    sphere.material.needsUpdate = true;
  }

  /* ---- Render loop with gentle auto-rotate ----------------------------- */
  function animate(){
    requestAnimationFrame(animate);

    if (!isPointerDown && userHasInteracted &&
        performance.now() - lastInteraction > AUTOROTATE_RESUME_DELAY) {
      lon += AUTOROTATE_SPEED;
    }

    lat = Math.max(-85, Math.min(85, lat));
    const phi = THREE.MathUtils.degToRad(90 - lat);
    const theta = THREE.MathUtils.degToRad(lon);

    const target = new THREE.Vector3(
      500 * Math.sin(phi) * Math.cos(theta),
      500 * Math.cos(phi),
      500 * Math.sin(phi) * Math.sin(theta)
    );
    camera.position.set(0, 0, 0);
    camera.lookAt(target);

    // ease fov toward target for smooth zoom
    if (Math.abs(camera.fov - targetFov) > 0.05){
      camera.fov += (targetFov - camera.fov) * 0.15;
      camera.updateProjectionMatrix();
    }

    renderer.render(scene, camera);
  }

  /* ---- Pointer / touch drag -------------------------------------------- */
  function markInteraction(){
    userHasInteracted = true;
    lastInteraction = performance.now();
    if (!dragHint.classList.contains("is-hidden")){
      dragHint.classList.add("is-hidden");
    }
  }

  function onPointerDown(clientX, clientY){
    isPointerDown = true;
    stageEl.classList.add("is-dragging");
    onPointerDownX = clientX;
    onPointerDownY = clientY;
    onPointerDownLon = lon;
    onPointerDownLat = lat;
  }
  function onPointerMove(clientX, clientY){
    if (!isPointerDown) return;
    lon = (onPointerDownX - clientX) * 0.16 + onPointerDownLon;
    lat = (clientY - onPointerDownY) * 0.16 + onPointerDownLat;
    markInteraction();
  }
  function onPointerUp(){
    isPointerDown = false;
    stageEl.classList.remove("is-dragging");
  }

  // Mouse
  stageEl.addEventListener("mousedown", (e) => { onPointerDown(e.clientX, e.clientY); markInteraction(); });
  window.addEventListener("mousemove", (e) => onPointerMove(e.clientX, e.clientY));
  window.addEventListener("mouseup", onPointerUp);

  // Touch (drag + pinch zoom)
  let pinchStartDist = null;
  let pinchStartFov = null;

  stageEl.addEventListener("touchstart", (e) => {
    markInteraction();
    if (e.touches.length === 1){
      onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
    } else if (e.touches.length === 2){
      isPointerDown = false;
      pinchStartDist = touchDistance(e.touches);
      pinchStartFov = targetFov;
    }
  }, { passive: true });

  stageEl.addEventListener("touchmove", (e) => {
    if (e.touches.length === 1 && isPointerDown){
      onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
    } else if (e.touches.length === 2 && pinchStartDist){
      const dist = touchDistance(e.touches);
      const scale = pinchStartDist / dist;
      targetFov = clamp(pinchStartFov * scale, FOV_MIN, FOV_MAX);
      markInteraction();
    }
  }, { passive: true });

  stageEl.addEventListener("touchend", (e) => {
    if (e.touches.length === 0){ onPointerUp(); pinchStartDist = null; }
  });

  function touchDistance(touches){
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx*dx + dy*dy);
  }
  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

  /* ---- Wheel zoom -------------------------------------------------------*/
  stageEl.addEventListener("wheel", (e) => {
    e.preventDefault();
    markInteraction();
    targetFov = clamp(targetFov + e.deltaY * 0.04, FOV_MIN, FOV_MAX);
  }, { passive: false });

  /* ---- Zoom / recenter / fullscreen buttons ----------------------------*/
  document.getElementById("zoom-in").addEventListener("click", () => {
    markInteraction();
    targetFov = clamp(targetFov - 10, FOV_MIN, FOV_MAX);
  });
  document.getElementById("zoom-out").addEventListener("click", () => {
    markInteraction();
    targetFov = clamp(targetFov + 10, FOV_MIN, FOV_MAX);
  });
  document.getElementById("recenter").addEventListener("click", () => {
    markInteraction();
    const cfg = POSITIONS[currentPos];
    lon = cfg.lon; lat = cfg.lat; targetFov = cfg.fov;
  });
  document.getElementById("fullscreen-btn").addEventListener("click", () => {
    markInteraction();
    if (!document.fullscreenElement){
      (stageEl.requestFullscreen || stageEl.webkitRequestFullscreen || function(){}).call(stageEl);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen || function(){}).call(document);
    }
  });
  window.addEventListener("resize", resizeRenderer);
  document.addEventListener("fullscreenchange", resizeRenderer);

  /* ---- Position navigation ---------------------------------------------*/
  posButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      markInteraction();
      loadPosition(btn.dataset.pos);
    });
  });

  /* ---- Keyboard hint fade after first hero scroll ----------------------*/
  document.getElementById("hero-cta").addEventListener("click", () => {
    setTimeout(() => stageEl.focus?.(), 500);
  });

  /* ---- Boot -------------------------------------------------------------*/
  buildScene();
  loadPosition("piloto", { silent: true });
  loadingEl.hidden = false;
  loadingLabel.textContent = "Preparando panorama…";
  // hide loading once first texture actually resolves
  const checkFirstLoad = setInterval(() => {
    if (textureCache.piloto){
      loadingEl.hidden = true;
      clearInterval(checkFirstLoad);
    }
  }, 100);

  // Hide the drag hint automatically after a while even without interaction
  setTimeout(() => dragHint.classList.add("is-hidden"), 6000);

  setupCTA();
  setupReveal();

})();

/* --------------------------------------------------------------------------
   Fallback mode navigation (no WebGL): swap the flat preview image
-------------------------------------------------------------------------- */
function setupPosNavFallbackMode(){
  const fallbackImg = document.getElementById("fallback-img");
  const posTag = document.getElementById("pos-tag");
  document.querySelectorAll(".pos-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.pos;
      const cfg = POSITIONS[key];
      if (!cfg) return;
      fallbackImg.src = cfg.file;
      posTag.textContent = cfg.label;
      document.querySelectorAll(".pos-btn").forEach(b => {
        b.classList.toggle("is-active", b === btn);
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      });
    });
  });
}

/* --------------------------------------------------------------------------
   WhatsApp CTA
-------------------------------------------------------------------------- */
function setupCTA(){
  const cta = document.getElementById("whatsapp-cta");
  if (!cta) return;
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
  cta.setAttribute("href", url);
  cta.setAttribute("target", "_blank");
  cta.setAttribute("rel", "noopener noreferrer");
}

/* --------------------------------------------------------------------------
   Subtle reveal-on-scroll for section content
-------------------------------------------------------------------------- */
function setupReveal(){
  const targets = document.querySelectorAll(
    ".section-head, .benefit, .app-item, .commercial-note, .cta-inner"
  );
  targets.forEach(el => el.classList.add("reveal"));

  if (!("IntersectionObserver" in window)){
    targets.forEach(el => el.classList.add("is-visible"));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting){
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  targets.forEach(el => io.observe(el));
}
