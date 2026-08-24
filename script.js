
/* ==========================================================================
   ViewMetricaMX — Nissan V-Drive 2026 · Demo 360°
   Visor 360° robusto para GitHub Pages + Three.js r128
   ========================================================================== */

/* --------------------------------------------------------------------------
   WHATSAPP
-------------------------------------------------------------------------- */

const WHATSAPP_NUMBER = "AQUI_MI_NUMERO";

const WHATSAPP_MESSAGE =
  "Hola, vi la demo 360° del Nissan V-Drive y me gustaría conocer cómo podría aplicarse a nuestra agencia.";


/* --------------------------------------------------------------------------
   PANORAMAS
-------------------------------------------------------------------------- */

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


const FOV_MIN = 32;
const FOV_MAX = 92;

const AUTOROTATE_SPEED = 0.006;
const AUTOROTATE_RESUME_DELAY = 5200;


/* ==========================================================================
   VISOR
========================================================================== */

(function init() {

  const stageEl = document.getElementById("viewer-stage");
  const canvas = document.getElementById("pano-canvas");

  const loadingEl = document.getElementById("viewer-loading");
  const loadingLabel = loadingEl.querySelector(".loading-label");

  const fallbackEl = document.getElementById("viewer-fallback");
  const fallbackImg = document.getElementById("fallback-img");

  const dragHint = document.getElementById("drag-hint");
  const posTag = document.getElementById("pos-tag");

  const posButtons = Array.from(
    document.querySelectorAll(".pos-btn")
  );


  /* ------------------------------------------------------------------------
     WEBGL
  ------------------------------------------------------------------------ */

  function hasWebGL() {

    try {

      const testCanvas = document.createElement("canvas");

      return !!(
        window.WebGLRenderingContext &&
        (
          testCanvas.getContext("webgl") ||
          testCanvas.getContext("experimental-webgl")
        )
      );

    } catch (error) {

      return false;

    }

  }


  /* ------------------------------------------------------------------------
     FALLBACK
  ------------------------------------------------------------------------ */

  if (typeof THREE === "undefined" || !hasWebGL()) {

    const threeOk = typeof THREE !== "undefined";
    const webglOk = hasWebGL();

    console.error(
      "[ViewMetricaMX] Visor 360° no disponible.",
      "Three.js:",
      threeOk,
      "WebGL:",
      webglOk
    );

    canvas.hidden = true;

    loadingEl.hidden = true;

    fallbackEl.hidden = false;

    fallbackImg.src = POSITIONS.piloto.file;

    const diag = fallbackEl.querySelector("p");

    if (diag) {

      diag.textContent =
        "Vista 360° no disponible. " +
        `[Three.js: ${threeOk ? "OK" : "NO"} · WebGL: ${webglOk ? "OK" : "NO"}]`;

    }

    setupPosNavFallbackMode();
    setupCTA();
    setupReveal();

    return;
  }


  /* ==========================================================================
     THREE.JS
  ========================================================================== */

  let renderer;
  let scene;
  let camera;
  let sphere;

  let currentPos = "piloto";

  let lon = POSITIONS.piloto.lon;
  let lat = POSITIONS.piloto.lat;

  let targetFov = POSITIONS.piloto.fov;

  let isPointerDown = false;

  let pointerStartX = 0;
  let pointerStartY = 0;

  let pointerStartLon = 0;
  let pointerStartLat = 0;

  let lastInteraction = performance.now();

  let userHasInteracted = false;


  const textureCache = {};

  const loader = new THREE.TextureLoader();


  /* ==========================================================================
     BUILD SCENE
  ========================================================================== */

  function buildScene() {

    console.log("[ViewMetricaMX] Inicializando visor 360°...");


    /* ------------------------------------------------------------------------
       RENDERER
    ------------------------------------------------------------------------ */

    renderer = new THREE.WebGLRenderer({

      canvas: canvas,

      antialias: true,

      alpha: false

    });


    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, 2)
    );


    /* ------------------------------------------------------------------------
       SCENE
    ------------------------------------------------------------------------ */

    scene = new THREE.Scene();


    /* ------------------------------------------------------------------------
       CAMERA
    ------------------------------------------------------------------------ */

    camera = new THREE.PerspectiveCamera(

      targetFov,

      16 / 9,

      0.1,

      1100

    );


    camera.position.set(0, 0, 0);


    /* ------------------------------------------------------------------------
       360 SPHERE
       
       IMPORTANTE:
       La esfera NO se escala negativamente.
       El material utiliza THREE.BackSide para visualizar
       la superficie desde el interior.
    ------------------------------------------------------------------------ */

    const geometry = new THREE.SphereGeometry(

      500,

      64,

      48

    );


    const material = new THREE.MeshBasicMaterial({

      color: 0xffffff,

      side: THREE.BackSide

    });


    sphere = new THREE.Mesh(

      geometry,

      material

    );


    sphere.visible = true;


    scene.add(sphere);


    /* ------------------------------------------------------------------------
       FORZAR VISIBILIDAD DEL CANVAS
    ------------------------------------------------------------------------ */

    canvas.hidden = false;

    canvas.style.display = "block";

    fallbackEl.hidden = true;


    /* ------------------------------------------------------------------------
       RESIZE
    ------------------------------------------------------------------------ */

    resizeRenderer();


    /* ------------------------------------------------------------------------
       DIAGNÓSTICO
    ------------------------------------------------------------------------ */

    const gl = renderer.getContext();

    console.log(
      "[ViewMetricaMX] Three.js:",
      THREE.REVISION
    );

    console.log(
      "[ViewMetricaMX] WebGL:",
      gl ? "OK" : "ERROR"
    );

    console.log(
      "[ViewMetricaMX] GPU MAX_TEXTURE_SIZE:",
      gl.getParameter(gl.MAX_TEXTURE_SIZE)
    );

    console.log(
      "[ViewMetricaMX] Contenedor:",
      stageEl.clientWidth,
      "x",
      stageEl.clientHeight
    );

    console.log(
      "[ViewMetricaMX] Sphere visible:",
      sphere.visible
    );

    console.log(
      "[ViewMetricaMX] Scene children:",
      scene.children.length
    );


    /* ------------------------------------------------------------------------
       RENDER LOOP
    ------------------------------------------------------------------------ */

    animate();

  }


  /* ==========================================================================
     RESIZE
  ========================================================================== */

  function resizeRenderer() {

    if (!renderer || !camera) return;


    const width = stageEl.clientWidth;
    const height = stageEl.clientHeight;


    if (!width || !height) return;


    renderer.setSize(

      width,

      height,

      false

    );


    camera.aspect = width / height;

    camera.updateProjectionMatrix();

  }


  /* ==========================================================================
     LOAD PANORAMA
  ========================================================================== */

  function loadPosition(key, options = {}) {

    const cfg = POSITIONS[key];

    if (!cfg) return;


    currentPos = key;


    lon = cfg.lon;

    lat = cfg.lat;

    targetFov = cfg.fov;


    camera.fov = cfg.fov;

    camera.updateProjectionMatrix();


    /* ------------------------------------------------------------------------
       UI
    ------------------------------------------------------------------------ */

    posTag.textContent = cfg.label;


    posButtons.forEach(button => {

      const active = button.dataset.pos === key;

      button.classList.toggle(
        "is-active",
        active
      );

      button.setAttribute(
        "aria-pressed",
        active ? "true" : "false"
      );

    });


    /* ------------------------------------------------------------------------
       CACHE
    ------------------------------------------------------------------------ */

    if (textureCache[key]) {

      applyTexture(textureCache[key]);

      loadingEl.hidden = true;

      fallbackEl.hidden = true;

      canvas.hidden = false;

      return;

    }


    /* ------------------------------------------------------------------------
       LOADING
    ------------------------------------------------------------------------ */

    loadingLabel.textContent =
      `Cargando ${cfg.label.toLowerCase()}…`;

    loadingEl.hidden = false;


    /* ------------------------------------------------------------------------
       LOAD IMAGE
    ------------------------------------------------------------------------ */

    loader.load(

      cfg.file,


      function(texture) {

        console.log(
          "[ViewMetricaMX] Panorama cargado:",
          cfg.file,
          texture.image.width + "x" + texture.image.height
        );


        /* --------------------------------------------------------------------
           Three.js r128 utiliza encoding en lugar de colorSpace.
        -------------------------------------------------------------------- */

        if (
          THREE.sRGBEncoding !== undefined
        ) {

          texture.encoding =
            THREE.sRGBEncoding;

        }


        texture.minFilter =
          THREE.LinearFilter;

        texture.magFilter =
          THREE.LinearFilter;

        texture.generateMipmaps =
          false;


        textureCache[key] =
          texture;


        applyTexture(texture);


        loadingEl.hidden = true;

        fallbackEl.hidden = true;

        canvas.hidden = false;


        console.log(
          "[ViewMetricaMX] Textura aplicada:",
          key
        );

      },


      function(progress) {

        if (
          progress &&
          progress.total
        ) {

          const percent =
            Math.round(
              progress.loaded /
              progress.total *
              100
            );

          loadingLabel.textContent =
            `Cargando panorama ${percent}%…`;

        }

      },


      function(error) {

        console.error(
          "[ViewMetricaMX] ERROR cargando panorama:",
          cfg.file,
          error
        );


        loadingLabel.textContent =
          "No se pudo cargar el panorama.";

      }

    );

  }


  /* ==========================================================================
     APPLY TEXTURE
  ========================================================================== */

  function applyTexture(texture) {

    if (!sphere || !sphere.material) {

      console.error(
        "[ViewMetricaMX] Sphere/material no disponible."
      );

      return;

    }


    sphere.material.map =
      texture;


    sphere.material.color.set(
      0xffffff
    );


    sphere.material.needsUpdate =
      true;


    console.log(
      "[ViewMetricaMX] Textura aplicada al material."
    );

  }


  /* ==========================================================================
     CAMERA / RENDER
  ========================================================================== */

  function animate() {

    requestAnimationFrame(
      animate
    );


    if (
      !isPointerDown &&
      userHasInteracted &&
      performance.now() -
      lastInteraction >
      AUTOROTATE_RESUME_DELAY
    ) {

      lon +=
        AUTOROTATE_SPEED;

    }


    lat = Math.max(
      -85,
      Math.min(
        85,
        lat
      )
    );


    const phi =
      THREE.MathUtils.degToRad(
        90 - lat
      );


    const theta =
      THREE.MathUtils.degToRad(
        lon
      );


    const target =
      new THREE.Vector3(

        500 *
        Math.sin(phi) *
        Math.cos(theta),

        500 *
        Math.cos(phi),

        500 *
        Math.sin(phi) *
        Math.sin(theta)

      );


    camera.position.set(
      0,
      0,
      0
    );


    camera.lookAt(
      target
    );


    /* ------------------------------------------------------------------------
       SMOOTH FOV
    ------------------------------------------------------------------------ */

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


    renderer.render(
      scene,
      camera
    );

  }


  /* ==========================================================================
     INTERACTION
  ========================================================================== */

  function markInteraction() {

    userHasInteracted = true;

    lastInteraction =
      performance.now();


    if (
      !dragHint.classList.contains(
        "is-hidden"
      )
    ) {

      dragHint.classList.add(
        "is-hidden"
      );

    }

  }


  function pointerDown(
    x,
    y
  ) {

    isPointerDown = true;


    stageEl.classList.add(
      "is-dragging"
    );


    pointerStartX = x;

    pointerStartY = y;

    pointerStartLon = lon;

    pointerStartLat = lat;

  }


  function pointerMove(
    x,
    y
  ) {

    if (!isPointerDown) return;


    lon =
      (
        pointerStartX -
        x
      ) * 0.16 +
      pointerStartLon;


    lat =
      (
        y -
        pointerStartY
      ) * 0.16 +
      pointerStartLat;


    markInteraction();

  }


  function pointerUp() {

    isPointerDown =
      false;


    stageEl.classList.remove(
      "is-dragging"
    );

  }


  /* --------------------------------------------------------------------------
     MOUSE
  -------------------------------------------------------------------------- */

  stageEl.addEventListener(
    "mousedown",
    event => {

      pointerDown(
        event.clientX,
        event.clientY
      );

      markInteraction();

    }
  );


  window.addEventListener(
    "mousemove",
    event => {

      pointerMove(
        event.clientX,
        event.clientY
      );

    }
  );


  window.addEventListener(
    "mouseup",
    pointerUp
  );


  /* --------------------------------------------------------------------------
     TOUCH
  -------------------------------------------------------------------------- */

  let pinchStartDistance = null;

  let pinchStartFov = null;


  stageEl.addEventListener(
    "touchstart",
    event => {

      markInteraction();


      if (
        event.touches.length === 1
      ) {

        pointerDown(

          event.touches[0].clientX,

          event.touches[0].clientY

        );

      }


      if (
        event.touches.length === 2
      ) {

        isPointerDown =
          false;


        pinchStartDistance =
          touchDistance(
            event.touches
          );


        pinchStartFov =
          targetFov;

      }

    },
    { passive: true }
  );


  stageEl.addEventListener(
    "touchmove",
    event => {

      if (
        event.touches.length === 1 &&
        isPointerDown
      ) {

        pointerMove(

          event.touches[0].clientX,

          event.touches[0].clientY

        );

      }


      if (
        event.touches.length === 2 &&
        pinchStartDistance
      ) {

        const distance =
          touchDistance(
            event.touches
          );


        const scale =
          pinchStartDistance /
          distance;


        targetFov =
          clamp(

            pinchStartFov *
            scale,

            FOV_MIN,

            FOV_MAX

          );


        markInteraction();

      }

    },
    { passive: true }
  );


  stageEl.addEventListener(
    "touchend",
    event => {

      if (
        event.touches.length === 0
      ) {

        pointerUp();

        pinchStartDistance =
          null;

      }

    }
  );


  function touchDistance(
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


  function clamp(
    value,
    min,
    max
  ) {

    return Math.max(
      min,
      Math.min(
        max,
        value
      )
    );

  }


  /* ==========================================================================
     WHEEL ZOOM
  ========================================================================== */

  stageEl.addEventListener(
    "wheel",
    event => {

      event.preventDefault();

      markInteraction();


      targetFov =
        clamp(

          targetFov +
          event.deltaY *
          0.04,

          FOV_MIN,

          FOV_MAX

        );

    },
    { passive: false }
  );


  /* ==========================================================================
     BUTTONS
  ========================================================================== */

  document
    .getElementById("zoom-in")
    .addEventListener(
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


  document
    .getElementById("zoom-out")
    .addEventListener(
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


  document
    .getElementById("recenter")
    .addEventListener(
      "click",
      () => {

        markInteraction();

        const cfg =
          POSITIONS[currentPos];

        lon =
          cfg.lon;

        lat =
          cfg.lat;

        targetFov =
          cfg.fov;

      }
    );


  /* ==========================================================================
     FULLSCREEN
  ========================================================================== */

  document
    .getElementById("fullscreen-btn")
    .addEventListener(
      "click",
      () => {

        markInteraction();


        if (
          !document.fullscreenElement
        ) {

          const request =
            stageEl.requestFullscreen ||
            stageEl.webkitRequestFullscreen;


          if (request) {

            request.call(
              stageEl
            );

          }

        } else {

          const exit =
            document.exitFullscreen ||
            document.webkitExitFullscreen;


          if (exit) {

            exit.call(
              document
            );

          }

        }

      }
    );


  window.addEventListener(
    "resize",
    resizeRenderer
  );


  document.addEventListener(
    "fullscreenchange",
    resizeRenderer
  );


  /* ==========================================================================
     POSITION NAVIGATION
  ========================================================================== */

  posButtons.forEach(
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


  /* ==========================================================================
     HERO CTA
  ========================================================================== */

  document
    .getElementById("hero-cta")
    .addEventListener(
      "click",
      () => {

        setTimeout(
          () => {

            if (
              stageEl.focus
            ) {

              stageEl.focus();

            }

          },
          500
        );

      }
    );


  /* ==========================================================================
     BOOT
  ========================================================================== */

  buildScene();


  loadPosition(
    "piloto"
  );


  loadingEl.hidden =
    false;


  loadingLabel.textContent =
    "Preparando panorama…";


  setTimeout(
    () => {

      dragHint.classList.add(
        "is-hidden"
      );

    },
    6000
  );


  setupCTA();

  setupReveal();


})();


/* ==========================================================================
   FALLBACK NAVIGATION
========================================================================== */

function setupPosNavFallbackMode() {

  const fallbackImg =
    document.getElementById(
      "fallback-img"
    );


  const posTag =
    document.getElementById(
      "pos-tag"
    );


  document
    .querySelectorAll(
      ".pos-btn"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const key =
              button.dataset.pos;


            const cfg =
              POSITIONS[key];


            if (!cfg) return;


            fallbackImg.src =
              cfg.file;


            posTag.textContent =
              cfg.label;


            document
              .querySelectorAll(
                ".pos-btn"
              )
              .forEach(
                item => {

                  const active =
                    item === button;


                  item.classList.toggle(
                    "is-active",
                    active
                  );


                  item.setAttribute(
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
   WHATSAPP
========================================================================== */

function setupCTA() {

  const cta =
    document.getElementById(
      "whatsapp-cta"
    );


  if (!cta) return;


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
   SCROLL REVEAL
========================================================================== */

function setupReveal() {

  const targets =
    document.querySelectorAll(
      ".section-head, .benefit, .app-item, .commercial-note, .cta-inner"
    );


  targets.forEach(
    element =>
      element.classList.add(
        "reveal"
      )
  );


  if (
    !("IntersectionObserver" in window)
  ) {

    targets.forEach(
      element =>
        element.classList.add(
          "is-visible"
        )
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
    element =>
      observer.observe(
        element
      )
  );

}
