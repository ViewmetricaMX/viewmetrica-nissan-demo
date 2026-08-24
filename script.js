/* ==========================================================================
   ViewMetricaMX
   Nissan V-Drive 2026
   Visor panorámico 360°
   ========================================================================== */

import * as THREE from "three";


/* ==========================================================================
   CONFIGURACIÓN
   ========================================================================== */

const WHATSAPP_NUMBER = "AQUI_MI_NUMERO";

const WHATSAPP_MESSAGE =
  "Hola, vi la demo 360° del Nissan V-Drive y me gustaría conocer cómo podría aplicarse a nuestra agencia.";


/* ==========================================================================
   POSICIONES
   ========================================================================== */

const POSITIONS = {

  piloto: {
    label: "PILOTO",
    file: "assets/piloto_nissan_v_drive_2026_gomez_palacio.jpg",
    lon: 160,
    lat: 0,
    fov: 82
  },

  copiloto: {
    label: "COPILOTO",
    file: "assets/copiloto_nissan_v_drive_2026_gomez_palacio.jpg",
    lon: 20,
    lat: -2,
    fov: 82
  },

  interior: {
    label: "INTERIOR",
    file: "assets/interior_nissan_v_drive_2026_gomez_palacio.jpg",
    lon: 0,
    lat: 0,
    fov: 84
  },

  trasera: {
    label: "TRASERA",
    file: "assets/trasera_nissan_v_drive_2026_gomez_palacio.jpg",
    lon: 0,
    lat: 0,
    fov: 84
  }

};


/* ==========================================================================
   CONFIGURACIÓN DEL VISOR
   ========================================================================== */

const FOV_MIN = 32;
const FOV_MAX = 92;

const AUTO_ROTATE_SPEED = 0.006;

const AUTO_ROTATE_DELAY = 5200;


/* ==========================================================================
   ELEMENTOS DOM
   ========================================================================== */

const stage = document.getElementById("viewer-stage");

const canvas = document.getElementById("pano-canvas");

const loading = document.getElementById("viewer-loading");

const loadingLabel =
  loading.querySelector(".loading-label");

const fallback =
  document.getElementById("viewer-fallback");

const fallbackImage =
  document.getElementById("fallback-img");

const fallbackMessage =
  document.getElementById("fallback-message");

const dragHint =
  document.getElementById("drag-hint");

const positionTag =
  document.getElementById("pos-tag");

const positionButtons =
  Array.from(document.querySelectorAll(".pos-btn"));


/* ==========================================================================
   ESTADO
   ========================================================================== */

let renderer = null;

let scene = null;

let camera = null;

let sphere = null;

let material = null;

let geometry = null;

let currentPosition = "piloto";

let longitude = POSITIONS.piloto.lon;

let latitude = POSITIONS.piloto.lat;

let targetFov = POSITIONS.piloto.fov;

let pointerDown = false;

let pointerStartX = 0;

let pointerStartY = 0;

let longitudeStart = 0;

let latitudeStart = 0;

let lastInteraction = performance.now();

let userInteracted = false;

let pinchStartDistance = null;

let pinchStartFov = null;


/* ==========================================================================
   CACHE DE TEXTURAS
   ========================================================================== */

const textureCache = new Map();

const textureLoader = new THREE.TextureLoader();


/* ==========================================================================
   UTILIDADES
   ========================================================================== */

function clamp(value, min, max) {

  return Math.max(
    min,
    Math.min(max, value)
  );

}


function markInteraction() {

  userInteracted = true;

  lastInteraction = performance.now();

  if (dragHint) {

    dragHint.classList.add("is-hidden");

  }

}


/* ==========================================================================
   WEBGL
   ========================================================================== */

function canCreateWebGLRenderer() {

  try {

    const testCanvas =
      document.createElement("canvas");

    const gl =
      testCanvas.getContext("webgl2", {
        antialias: true
      }) ||
      testCanvas.getContext("webgl", {
        antialias: true
      }) ||
      testCanvas.getContext("experimental-webgl", {
        antialias: true
      });

    return !!gl;

  } catch (error) {

    console.error(
      "[ViewMetricaMX] WebGL test failed:",
      error
    );

    return false;

  }

}


/* ==========================================================================
   FALLBACK
   ========================================================================== */

function showFallback(reason = "") {

  console.error(
    "[ViewMetricaMX] El visor 360° no pudo inicializarse.",
    reason
  );

  if (canvas) {

    canvas.hidden = true;

  }

  if (loading) {

    loading.hidden = true;

  }

  if (fallback) {

    fallback.hidden = false;

  }

  if (fallbackImage) {

    fallbackImage.src =
      POSITIONS[currentPosition].file;

  }

  if (fallbackMessage) {

    fallbackMessage.textContent =
      "No fue posible iniciar el visor 360° en este navegador.";

  }

  setupFallbackNavigation();

}


/* ==========================================================================
   INICIALIZAR THREE.JS
   ========================================================================== */

function initializeViewer() {

  if (!canCreateWebGLRenderer()) {

    showFallback(
      "WebGL no está disponible."
    );

    return false;

  }


  try {

    /* ------------------------------------------------------------
       RENDERER
    ------------------------------------------------------------ */

    renderer =
      new THREE.WebGLRenderer({

        canvas: canvas,

        antialias: true,

        alpha: false,

        powerPreference: "high-performance"

      });


    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio || 1,
        2
      )
    );


    /* ------------------------------------------------------------
       COLOR
    ------------------------------------------------------------ */

    if (
      "outputColorSpace" in renderer
    ) {

      renderer.outputColorSpace =
        THREE.SRGBColorSpace;

    }


    /* ------------------------------------------------------------
       SCENE
    ------------------------------------------------------------ */

    scene =
      new THREE.Scene();


    /* ------------------------------------------------------------
       CAMERA
    ------------------------------------------------------------ */

    camera =
      new THREE.PerspectiveCamera(

        targetFov,

        1,

        0.1,

        1100

      );


    camera.position.set(
      0,
      0,
      0
    );


    /* ------------------------------------------------------------
       ESFERA PANORÁMICA

       La esfera se invierte en X para poder verla
       desde el interior.
    ------------------------------------------------------------ */

    geometry =
      new THREE.SphereGeometry(
        500,
        64,
        48
      );


    geometry.scale(
      -1,
      1,
      1
    );


    /* ------------------------------------------------------------
       MATERIAL

       Inicialmente negro para evitar mostrar un color
       artificial mientras carga la fotografía.
    ------------------------------------------------------------ */

    material =
      new THREE.MeshBasicMaterial({

        color: 0xffffff,

        side: THREE.FrontSide

      });


    sphere =
      new THREE.Mesh(
        geometry,
        material
      );


    scene.add(sphere);


    /* ------------------------------------------------------------
       RESIZE
    ------------------------------------------------------------ */

    resizeRenderer();


    /* ------------------------------------------------------------
       EVENTOS
    ------------------------------------------------------------ */

    setupPointerControls();

    setupZoomControls();

    setupPositionNavigation();

    setupFullscreen();

    setupKeyboard();

    setupCTA();

    setupReveal();


    /* ------------------------------------------------------------
       CARGA INICIAL
    ------------------------------------------------------------ */

    loadPosition(
      "piloto"
    );


    /* ------------------------------------------------------------
       ANIMACIÓN
    ------------------------------------------------------------ */

    renderer.setAnimationLoop(
      render
    );


    console.log(
      "[ViewMetricaMX] Three.js iniciado correctamente."
    );

    console.log(
      "[ViewMetricaMX] Three.js revision:",
      THREE.REVISION
    );


    try {

      const gl =
        renderer.getContext();

      console.log(
        "[ViewMetricaMX] MAX_TEXTURE_SIZE:",
        gl.getParameter(
          gl.MAX_TEXTURE_SIZE
        )
      );

    } catch (error) {

      console.warn(
        "[ViewMetricaMX] No se pudo consultar MAX_TEXTURE_SIZE.",
        error
      );

    }


    return true;

  } catch (error) {

    showFallback(error);

    return false;

  }

}


/* ==========================================================================
   RESIZE
   ========================================================================== */

function resizeRenderer() {

  if (
    !renderer ||
    !camera ||
    !stage
  ) {

    return;

  }


  const width =
    stage.clientWidth;

  const height =
    stage.clientHeight;


  if (
    width <= 0 ||
    height <= 0
  ) {

    return;

  }


  renderer.setSize(
    width,
    height,
    false
  );


  camera.aspect =
    width / height;


  camera.updateProjectionMatrix();

}


/* ==========================================================================
   CARGA DE TEXTURA
   ========================================================================== */

function loadPosition(
  key
) {

  const config =
    POSITIONS[key];


  if (!config) {

    return;

  }


  currentPosition =
    key;


  longitude =
    config.lon;

  latitude =
    config.lat;

  targetFov =
    config.fov;


  camera.fov =
    config.fov;


  camera.updateProjectionMatrix();


  updatePositionUI(
    key
  );


  /* ------------------------------------------------------------
     TEXTURA EN CACHE
  ------------------------------------------------------------ */

  if (
    textureCache.has(key)
  ) {

    const cachedTexture =
      textureCache.get(key);

    applyTexture(
      cachedTexture
    );

    hideLoading();

    return;

  }


  /* ------------------------------------------------------------
     LOADING
  ------------------------------------------------------------ */

  showLoading(
    `Cargando ${config.label.toLowerCase()}…`
  );


  textureLoader.load(

    config.file,


    /* ----------------------------------------------------------
       SUCCESS
    ---------------------------------------------------------- */

    texture => {

      console.log(
        "[ViewMetricaMX] Panorama cargado:",
        config.file
      );


      if (
        texture.image
      ) {

        console.log(
          "[ViewMetricaMX] Dimensiones:",
          texture.image.width,
          "x",
          texture.image.height
        );

      }


      /* --------------------------------------------------------
         COLOR
      -------------------------------------------------------- */

      if (
        "colorSpace" in texture
      ) {

        texture.colorSpace =
          THREE.SRGBColorSpace;

      }


      /* --------------------------------------------------------
         FILTROS

         LinearFilter evita que Three.js intente generar
         mipmaps innecesarios para fotografías gigantes.
      -------------------------------------------------------- */

      texture.minFilter =
        THREE.LinearFilter;

      texture.magFilter =
        THREE.LinearFilter;

      texture.generateMipmaps =
        false;


      /* --------------------------------------------------------
         CACHE
      -------------------------------------------------------- */

      textureCache.set(
        key,
        texture
      );


      /* --------------------------------------------------------
         APLICAR
      -------------------------------------------------------- */

      applyTexture(
        texture
      );


      hideLoading();

    },


    /* ----------------------------------------------------------
       PROGRESS
    ---------------------------------------------------------- */

    xhr => {

      if (
        xhr &&
        xhr.total > 0
      ) {

        const percentage =
          Math.round(
            (xhr.loaded / xhr.total) * 100
          );


        if (loadingLabel) {

          loadingLabel.textContent =
            `Cargando panorama… ${percentage}%`;

        }

      }

    },


    /* ----------------------------------------------------------
       ERROR
    ---------------------------------------------------------- */

    error => {

      console.error(
        "[ViewMetricaMX] Error cargando panorama:",
        config.file,
        error
      );


      if (loadingLabel) {

        loadingLabel.textContent =
          "No se pudo cargar el panorama.";

      }


      /*
       * IMPORTANTE:
       *
       * No cambiamos automáticamente al fallback.
       *
       * El navegador sí puede tener WebGL perfectamente
       * aunque una fotografía concreta falle.
       */

    }

  );

}


/* ==========================================================================
   APLICAR TEXTURA
   ========================================================================== */

function applyTexture(
  texture
) {

  if (
    !material
  ) {

    return;

  }


  material.map =
    texture;


  material.color.set(
    0xffffff
  );


  material.needsUpdate =
    true;

}


/* ==========================================================================
   LOADING
   ========================================================================== */

function showLoading(
  message
) {

  if (!loading) {

    return;

  }


  loading.hidden =
    false;


  if (loadingLabel) {

    loadingLabel.textContent =
      message;

  }

}


function hideLoading() {

  if (loading) {

    loading.hidden =
      true;

  }

}


/* ==========================================================================
   RENDER
   ========================================================================== */

function render() {

  if (
    !renderer ||
    !scene ||
    !camera
  ) {

    return;

  }


  /* ------------------------------------------------------------
     AUTORROTACIÓN SUAVE

     Solo comienza después de que el usuario haya interactuado.
  ------------------------------------------------------------ */

  if (

    !pointerDown &&

    userInteracted &&

    performance.now() -
      lastInteraction >
      AUTO_ROTATE_DELAY

  ) {

    longitude +=
      AUTO_ROTATE_SPEED;

  }


  latitude =
    clamp(
      latitude,
      -85,
      85
    );


  /* ------------------------------------------------------------
     CONVERSIÓN ESFÉRICA
  ------------------------------------------------------------ */

  const phi =
    THREE.MathUtils.degToRad(
      90 - latitude
    );


  const theta =
    THREE.MathUtils.degToRad(
      longitude
    );


  const distance =
    500;


  const target =
    new THREE.Vector3(

      distance *
        Math.sin(phi) *
        Math.cos(theta),

      distance *
        Math.cos(phi),

      distance *
        Math.sin(phi) *
        Math.sin(theta)

    );


  /* ------------------------------------------------------------
     CÁMARA SIEMPRE EN EL CENTRO
  ------------------------------------------------------------ */

  camera.position.set(
    0,
    0,
    0
  );


  camera.lookAt(
    target
  );


  /* ------------------------------------------------------------
     ZOOM SUAVE
  ------------------------------------------------------------ */

  if (
    Math.abs(
      camera.fov -
      targetFov
    ) > 0.05
  ) {

    camera.fov +=
      (
        targetFov -
        camera.fov
      ) * 0.15;


    camera.updateProjectionMatrix();

  }


  /* ------------------------------------------------------------
     RENDER
  ------------------------------------------------------------ */

  renderer.render(
    scene,
    camera
  );

}


/* ==========================================================================
   CONTROLES DE PUNTERO
   ========================================================================== */

function setupPointerControls() {

  stage.addEventListener(
    "pointerdown",
    event => {

      if (
        event.pointerType === "mouse" &&
        event.button !== 0
      ) {

        return;

      }


      pointerDown =
        true;


      pointerStartX =
        event.clientX;


      pointerStartY =
        event.clientY;


      longitudeStart =
        longitude;


      latitudeStart =
        latitude;


      markInteraction();


      stage.classList.add(
        "is-dragging"
      );


      try {

        stage.setPointerCapture(
          event.pointerId
        );

      } catch (error) {}

    }
  );


  stage.addEventListener(
    "pointermove",
    event => {

      if (
        !pointerDown
      ) {

        return;

      }


      const deltaX =
        event.clientX -
        pointerStartX;


      const deltaY =
        event.clientY -
        pointerStartY;


      longitude =
        longitudeStart -
        deltaX * 0.16;


      latitude =
        latitudeStart +
        deltaY * 0.16;


      markInteraction();

    }
  );


  stage.addEventListener(
    "pointerup",
    finishPointer
  );


  stage.addEventListener(
    "pointercancel",
    finishPointer
  );


  stage.addEventListener(
    "pointerleave",
    event => {

      if (
        event.pointerType === "mouse" &&
        pointerDown
      ) {

        finishPointer();

      }

    }
  );


  function finishPointer() {

    pointerDown =
      false;


    stage.classList.remove(
      "is-dragging"
    );

  }

}


/* ==========================================================================
   TOUCH PINCH ZOOM
   ========================================================================== */

stage.addEventListener(
  "touchstart",
  event => {

    if (
      event.touches.length !== 2
    ) {

      return;

    }


    pinchStartDistance =
      getTouchDistance(
        event.touches
      );


    pinchStartFov =
      targetFov;


    markInteraction();

  },
  {
    passive: true
  }
);


stage.addEventListener(
  "touchmove",
  event => {

    if (
      event.touches.length !== 2 ||
      !pinchStartDistance
    ) {

      return;

    }


    const distance =
      getTouchDistance(
        event.touches
      );


    if (
      distance <= 0
    ) {

      return;

    }


    const scale =
      pinchStartDistance /
      distance;


    targetFov =
      clamp(
        pinchStartFov * scale,
        FOV_MIN,
        FOV_MAX
      );


    markInteraction();

  },
  {
    passive: true
  }
);


stage.addEventListener(
  "touchend",
  event => {

    if (
      event.touches.length < 2
    ) {

      pinchStartDistance =
        null;

      pinchStartFov =
        null;

    }

  },
  {
    passive: true
  }
);


function getTouchDistance(
  touches
) {

  const dx =
    touches[0].clientX -
    touches[1].clientX;


  const dy =
    touches[0].clientY -
    touches[1].clientY;


  return Math.sqrt(
    dx * dx +
    dy * dy
  );

}


/* ==========================================================================
   ZOOM CON RUEDA
   ========================================================================== */

stage.addEventListener(
  "wheel",
  event => {

    event.preventDefault();

    markInteraction();


    targetFov =
      clamp(
        targetFov +
          event.deltaY * 0.04,
        FOV_MIN,
        FOV_MAX
      );

  },
  {
    passive: false
  }
);


/* ==========================================================================
   BOTONES DE ZOOM
   ========================================================================== */

function setupZoomControls() {

  const zoomIn =
    document.getElementById(
      "zoom-in"
    );


  const zoomOut =
    document.getElementById(
      "zoom-out"
    );


  const recenter =
    document.getElementById(
      "recenter"
    );


  if (zoomIn) {

    zoomIn.addEventListener(
      "click",
      () => {

        markInteraction();


        targetFov =
          clamp(
            targetFov - 10,
            FOV_MIN,
            FOV_MAX
          );

      }
    );

  }


  if (zoomOut) {

    zoomOut.addEventListener(
      "click",
      () => {

        markInteraction();


        targetFov =
          clamp(
            targetFov + 10,
            FOV_MIN,
            FOV_MAX
          );

      }
    );

  }


  if (recenter) {

    recenter.addEventListener(
      "click",
      () => {

        markInteraction();


        const config =
          POSITIONS[
            currentPosition
          ];


        longitude =
          config.lon;


        latitude =
          config.lat;


        targetFov =
          config.fov;

      }
    );

  }

}


/* ==========================================================================
   NAVEGACIÓN ENTRE POSICIONES
   ========================================================================== */

function setupPositionNavigation() {

  positionButtons.forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          markInteraction();


          loadPosition(
            button.dataset.pos
          );

        }
      );

    }
  );

}


function updatePositionUI(
  key
) {

  const config =
    POSITIONS[key];


  if (positionTag) {

    positionTag.textContent =
      config.label;

  }


  positionButtons.forEach(
    button => {

      const active =
        button.dataset.pos === key;


      button.classList.toggle(
        "is-active",
        active
      );


      button.setAttribute(
        "aria-pressed",
        active
          ? "true"
          : "false"
      );

    }
  );

}


/* ==========================================================================
   FULLSCREEN
   ========================================================================== */

function setupFullscreen() {

  const button =
    document.getElementById(
      "fullscreen-btn"
    );


  if (!button) {

    return;

  }


  button.addEventListener(
    "click",
    async () => {

      markInteraction();


      try {

        if (
          !document.fullscreenElement
        ) {

          if (
            stage.requestFullscreen
          ) {

            await stage.requestFullscreen();

          } else if (
            stage.webkitRequestFullscreen
          ) {

            stage.webkitRequestFullscreen();

          }

        } else {

          if (
            document.exitFullscreen
          ) {

            await document.exitFullscreen();

          } else if (
            document.webkitExitFullscreen
          ) {

            document.webkitExitFullscreen();

          }

        }

      } catch (error) {

        console.warn(
          "[ViewMetricaMX] Fullscreen no disponible:",
          error
        );

      }

    }
  );


  document.addEventListener(
    "fullscreenchange",
    () => {

      setTimeout(
        resizeRenderer,
        100
      );

    }
  );

}


/* ==========================================================================
   TECLADO
   ========================================================================== */

function setupKeyboard() {

  stage.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "ArrowLeft"
      ) {

        longitude += 5;

        markInteraction();

      }


      if (
        event.key === "ArrowRight"
      ) {

        longitude -= 5;

        markInteraction();

      }


      if (
        event.key === "ArrowUp"
      ) {

        latitude -= 5;

        markInteraction();

      }


      if (
        event.key === "ArrowDown"
      ) {

        latitude += 5;

        markInteraction();

      }


      if (
        event.key === "+" ||
        event.key === "="
      ) {

        targetFov =
          clamp(
            targetFov - 5,
            FOV_MIN,
            FOV_MAX
          );

        markInteraction();

      }


      if (
        event.key === "-" ||
        event.key === "_"
      ) {

        targetFov =
          clamp(
            targetFov + 5,
            FOV_MIN,
            FOV_MAX
          );

        markInteraction();

      }

    }
  );

}


/* ==========================================================================
   FALLBACK NAVIGATION
   ========================================================================== */

function setupFallbackNavigation() {

  positionButtons.forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          const key =
            button.dataset.pos;


          const config =
            POSITIONS[key];


          if (!config) {

            return;

          }


          currentPosition =
            key;


          if (fallbackImage) {

            fallbackImage.src =
              config.file;

          }


          if (positionTag) {

            positionTag.textContent =
              config.label;

          }


          positionButtons.forEach(
            button2 => {

              const active =
                button2 === button;


              button2.classList.toggle(
                "is-active",
                active
              );


              button2.setAttribute(
                "aria-pressed",
                active
                  ? "true"
                  : "false"
              );

            }
          );

        }
      );

    }
  );

}


/* ==========================================================================
   CTA WHATSAPP
   ========================================================================== */

function setupCTA() {

  const cta =
    document.getElementById(
      "whatsapp-cta"
    );


  if (!cta) {

    return;

  }


  const url =
    `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
      WHATSAPP_MESSAGE
    )}`;


  cta.setAttribute(
    "href",
    url
  );


  cta.setAttribute(
    "target",
    "_blank"
  );


  cta.setAttribute(
    "rel",
    "noopener noreferrer"
  );

}


/* ==========================================================================
   REVEAL
   ========================================================================== */

function setupReveal() {

  const targets =
    document.querySelectorAll(
      ".section-head, .benefit, .app-item, .commercial-note, .cta-inner"
    );


  targets.forEach(
    element => {

      element.classList.add(
        "reveal"
      );

    }
  );


  if (
    !("IntersectionObserver" in window)
  ) {

    targets.forEach(
      element => {

        element.classList.add(
          "is-visible"
        );

      }
    );

    return;

  }


  const observer =
    new IntersectionObserver(
      entries => {

        entries.forEach(
          entry => {

            if (
              entry.isIntersecting
            ) {

              entry.target.classList.add(
                "is-visible"
              );


              observer.unobserve(
                entry.target
              );

            }

          }
        );

      },
      {
        threshold: 0.15
      }
    );


  targets.forEach(
    element => {

      observer.observe(
        element
      );

    }
  );

}


/* ==========================================================================
   RESIZE GLOBAL
   ========================================================================== */

window.addEventListener(
  "resize",
  resizeRenderer
);


/* ==========================================================================
   HERO CTA
   ========================================================================== */

const heroCTA =
  document.getElementById(
    "hero-cta"
  );


if (heroCTA) {

  heroCTA.addEventListener(
    "click",
    () => {

      setTimeout(
        () => {

          try {

            stage.focus();

          } catch (error) {}

        },
        500
      );

    }
  );

}


/* ==========================================================================
   INICIO
   ========================================================================== */

console.log(
  "[ViewMetricaMX] Iniciando visor 360°..."
);


initializeViewer();  const fallbackImg = document.getElementById("fallback-img");
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
