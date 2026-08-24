/* ==========================================================================
   ViewMetricaMX — Nissan V-Drive 2026 · Demo 360°
   Visor panorámico corregido
   ========================================================================== */

/* --------------------------------------------------------------------------
   CONFIGURACIÓN
-------------------------------------------------------------------------- */

const WHATSAPP_NUMBER = "AQUI_MI_NUMERO";

const WHATSAPP_MESSAGE =
  "Hola, vi la demo 360° del Nissan V-Drive y me gustaría conocer cómo podría aplicarse a nuestra agencia.";


/* --------------------------------------------------------------------------
   POSICIONES DEL RECORRIDO
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


/* --------------------------------------------------------------------------
   CONTROLES
-------------------------------------------------------------------------- */

const FOV_MIN = 32;
const FOV_MAX = 92;

const AUTOROTATE_SPEED = 0.006;
const AUTOROTATE_RESUME_DELAY = 5200;


/* ==========================================================================
   INICIO
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
     VERIFICAR WEBGL
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

    } catch (e) {

      return false;

    }

  }


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

    const diagP = fallbackEl.querySelector("p");

    if (diagP) {

      diagP.textContent =
        "Tu navegador no soporta la vista 360° interactiva.";

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


  /* --------------------------------------------------------------------------
     INTERACCIÓN
  -------------------------------------------------------------------------- */

  let isPointerDown = false;

  let onPointerDownX = 0;
  let onPointerDownY = 0;

  let onPointerDownLon = 0;
  let onPointerDownLat = 0;

  let lastInteraction = performance.now();

  let userHasInteracted = false;


  /* --------------------------------------------------------------------------
     TEXTURAS
  -------------------------------------------------------------------------- */

  const textureCache = {};

  const loader = new THREE.TextureLoader();


  /* ==========================================================================
     CONSTRUIR ESCENA
  ========================================================================== */

  function buildScene() {

    renderer = new THREE.WebGLRenderer({

      canvas: canvas,

      antialias: true,

      alpha: false

    });


    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, 2)
    );


    /*
       Importante:
       No utilizamos iluminación porque el material es MeshBasicMaterial.
       La fotografía será mostrada directamente.
    */


    scene = new THREE.Scene();


    camera = new THREE.PerspectiveCamera(

      targetFov,

      16 / 9,

      1,

      1100

    );


    /*
       ESFERA 360°
    */

    const geometry = new THREE.SphereGeometry(
  500,
  60,
  40
);

geometry.scale(1, 1, -1);


    /*
       Material fotográfico.
       
       MeshBasicMaterial evita que la imagen dependa de luces
       de Three.js.
    */

    const material = new THREE.MeshBasicMaterial({

      color: 0xffffff,

      toneMapped: false

    });


    sphere = new THREE.Mesh(

      geometry,

      material

    );


    scene.add(sphere);


    resizeRenderer();

    animate();


    console.log(
      "[ViewMetricaMX] Three.js:",
      THREE.REVISION
    );

    console.log(
      "[ViewMetricaMX] Visor 360° inicializado correctamente."
    );

  }


  /* ==========================================================================
     RESIZE
  ========================================================================== */

  function resizeRenderer() {

    const w = stageEl.clientWidth;
    const h = stageEl.clientHeight;

    if (!w || !h) return;


    renderer.setSize(

      w,

      h,

      false

    );


    camera.aspect = w / h;

    camera.updateProjectionMatrix();

  }


  /* ==========================================================================
     CARGAR PANORAMA
  ========================================================================== */

  function loadPosition(

    key,

    { silent = false } = {}

  ) {

    const cfg = POSITIONS[key];

    if (!cfg) return;


    currentPos = key;


    lon = cfg.lon;

    lat = cfg.lat;

    targetFov = cfg.fov;


    camera.fov = cfg.fov;

    camera.updateProjectionMatrix();


    posTag.textContent = cfg.label;


    posButtons.forEach(btn => {

      const active = btn.dataset.pos === key;

      btn.classList.toggle(

        "is-active",

        active

      );

      btn.setAttribute(

        "aria-pressed",

        active ? "true" : "false"

      );

    });


    /*
       Si ya está en caché, aplicamos directamente.
    */

    if (textureCache[key]) {

      applyTexture(textureCache[key]);

      return;

    }


    if (!silent) {

      loadingLabel.textContent =
        `Cargando ${cfg.label.toLowerCase()}…`;

      loadingEl.hidden = false;

    }


    loader.load(

      cfg.file,


      function(texture) {

        const img = texture.image;


        console.log(

          "[ViewMetricaMX] Panorama cargado:",

          cfg.file,

          img
            ? `${img.width}x${img.height}`
            : "dimensiones desconocidas"

        );


        /*
           Color correcto para fotografías.
        */

        if ("colorSpace" in texture) {

          texture.colorSpace =
            THREE.SRGBColorSpace;

        }


        /*
           Filtro lineal para mejor calidad.
        */

        texture.minFilter =
          THREE.LinearFilter;

        texture.magFilter =
          THREE.LinearFilter;


        texture.generateMipmaps = false;


        /*
           Guardamos en caché.
        */

        textureCache[key] = texture;


        applyTexture(texture);


        loadingEl.hidden = true;

      },


      undefined,


      function(error) {

        console.error(

          "[ViewMetricaMX] Error cargando panorama:",

          cfg.file,

          error

        );


        loadingLabel.textContent =
          "No se pudo cargar el panorama.";

      }

    );

  }


  /* ==========================================================================
     APLICAR TEXTURA
  ========================================================================== */
function applyTexture(texture) {

  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  texture.repeat.x = 1;
  texture.offset.x = 0;

  if ("colorSpace" in texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }

  sphere.material.map = texture;
  sphere.material.color.set(0xffffff);
  sphere.material.needsUpdate = true;
}


  /* ==========================================================================
     RENDER LOOP
  ========================================================================== */

  function animate() {

    requestAnimationFrame(animate);


    /*
       Rotación automática después de unos segundos.
    */

    if (

      !isPointerDown &&

      userHasInteracted &&

      performance.now() -
      lastInteraction >
      AUTOROTATE_RESUME_DELAY

    ) {

      lon += AUTOROTATE_SPEED;

    }


    /*
       Limitar inclinación vertical.
    */

    lat = Math.max(

      -85,

      Math.min(85, lat)

    );


    /*
       Conversión de coordenadas.
    */

    const phi =
      THREE.MathUtils.degToRad(

        90 - lat

      );


    const theta =
      THREE.MathUtils.degToRad(

        lon

      );


    const target = new THREE.Vector3(

      500 *
      Math.sin(phi) *
      Math.cos(theta),

      500 *
      Math.cos(phi),

      500 *
      Math.sin(phi) *
      Math.sin(theta)

    );


    /*
       Cámara al centro de la esfera.
    */

    camera.position.set(

      0,

      0,

      0

    );


    camera.lookAt(target);


    /*
       Zoom suave.
    */

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
     INTERACCIÓN
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


  function onPointerDown(

    clientX,

    clientY

  ) {

    isPointerDown = true;


    stageEl.classList.add(
      "is-dragging"
    );


    onPointerDownX = clientX;

    onPointerDownY = clientY;


    onPointerDownLon = lon;

    onPointerDownLat = lat;

  }


  function onPointerMove(

    clientX,

    clientY

  ) {

    if (!isPointerDown) return;


    lon =
      (
        onPointerDownX -
        clientX
      ) * 0.16 +
      onPointerDownLon;


    lat =
      (
        clientY -
        onPointerDownY
      ) * 0.16 +
      onPointerDownLat;


    markInteraction();

  }


  function onPointerUp() {

    isPointerDown = false;


    stageEl.classList.remove(
      "is-dragging"
    );

  }


  /* ==========================================================================
     MOUSE
  ========================================================================== */

  stageEl.addEventListener(

    "mousedown",

    function(e) {

      onPointerDown(

        e.clientX,

        e.clientY

      );

      markInteraction();

    }

  );


  window.addEventListener(

    "mousemove",

    function(e) {

      onPointerMove(

        e.clientX,

        e.clientY

      );

    }

  );


  window.addEventListener(

    "mouseup",

    onPointerUp

  );


  /* ==========================================================================
     TOUCH
  ========================================================================== */

  let pinchStartDist = null;

  let pinchStartFov = null;


  stageEl.addEventListener(

    "touchstart",

    function(e) {

      markInteraction();


      if (e.touches.length === 1) {

        onPointerDown(

          e.touches[0].clientX,

          e.touches[0].clientY

        );

      }

      else if (e.touches.length === 2) {

        isPointerDown = false;

        pinchStartDist =
          touchDistance(e.touches);

        pinchStartFov =
          targetFov;

      }

    },

    { passive: true }

  );


  stageEl.addEventListener(

    "touchmove",

    function(e) {

      if (

        e.touches.length === 1 &&

        isPointerDown

      ) {

        onPointerMove(

          e.touches[0].clientX,

          e.touches[0].clientY

        );

      }


      else if (

        e.touches.length === 2 &&

        pinchStartDist

      ) {

        const dist =
          touchDistance(e.touches);


        const scale =
          pinchStartDist / dist;


        targetFov =
          clamp(

            pinchStartFov * scale,

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

    function(e) {

      if (e.touches.length === 0) {

        onPointerUp();

        pinchStartDist = null;

      }

    }

  );


  function touchDistance(touches) {

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

      Math.min(max, value)

    );

  }


  /* ==========================================================================
     RUEDA DEL MOUSE
  ========================================================================== */

  stageEl.addEventListener(

    "wheel",

    function(e) {

      e.preventDefault();

      markInteraction();


      targetFov = clamp(

        targetFov +
        e.deltaY * 0.04,

        FOV_MIN,

        FOV_MAX

      );

    },

    { passive: false }

  );


  /* ==========================================================================
     ZOOM IN
  ========================================================================== */

  document
    .getElementById("zoom-in")
    .addEventListener(

      "click",

      function() {

        markInteraction();


        targetFov = clamp(

          targetFov - 10,

          FOV_MIN,

          FOV_MAX

        );

      }

    );


  /* ==========================================================================
     ZOOM OUT
  ========================================================================== */

  document
    .getElementById("zoom-out")
    .addEventListener(

      "click",

      function() {

        markInteraction();


        targetFov = clamp(

          targetFov + 10,

          FOV_MIN,

          FOV_MAX

        );

      }

    );


  /* ==========================================================================
     RECENTER
  ========================================================================== */

  document
    .getElementById("recenter")
    .addEventListener(

      "click",

      function() {

        markInteraction();


        const cfg =
          POSITIONS[currentPos];


        lon = cfg.lon;

        lat = cfg.lat;

        targetFov = cfg.fov;

      }

    );


  /* ==========================================================================
     FULLSCREEN
  ========================================================================== */

  document
    .getElementById("fullscreen-btn")
    .addEventListener(

      "click",

      function() {

        markInteraction();


        if (!document.fullscreenElement) {

          const requestFullscreen =
            stageEl.requestFullscreen ||
            stageEl.webkitRequestFullscreen;


          if (requestFullscreen) {

            requestFullscreen.call(
              stageEl
            );

          }

        }

        else {

          const exitFullscreen =
            document.exitFullscreen ||
            document.webkitExitFullscreen;


          if (exitFullscreen) {

            exitFullscreen.call(
              document
            );

          }

        }

      }

    );


  /* ==========================================================================
     RESIZE
  ========================================================================== */

  window.addEventListener(

    "resize",

    resizeRenderer

  );


  document.addEventListener(

    "fullscreenchange",

    resizeRenderer

  );


  /* ==========================================================================
     NAVEGACIÓN ENTRE POSICIONES
  ========================================================================== */

  posButtons.forEach(

    function(btn) {

      btn.addEventListener(

        "click",

        function() {

          markInteraction();

          loadPosition(
            btn.dataset.pos
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

      function() {

        setTimeout(

          function() {

            if (stageEl.focus) {

              stageEl.focus();

            }

          },

          500

        );

      }

    );


  /* ==========================================================================
     INICIO
  ========================================================================== */

  buildScene();


  loadPosition(

    "piloto",

    { silent: true }

  );


  loadingEl.hidden = false;


  loadingLabel.textContent =
    "Preparando panorama…";


  const checkFirstLoad =
    setInterval(

      function() {

        if (textureCache.piloto) {

          loadingEl.hidden = true;

          clearInterval(
            checkFirstLoad
          );

        }

      },

      100

    );


  setTimeout(

    function() {

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
   FALLBACK
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
    .querySelectorAll(".pos-btn")
    .forEach(

      function(btn) {

        btn.addEventListener(

          "click",

          function() {

            const key =
              btn.dataset.pos;


            const cfg =
              POSITIONS[key];


            if (!cfg) return;


            fallbackImg.src =
              cfg.file;


            posTag.textContent =
              cfg.label;


            document
              .querySelectorAll(".pos-btn")
              .forEach(

                function(b) {

                  const active =
                    b === btn;


                  b.classList.toggle(
                    "is-active",
                    active
                  );


                  b.setAttribute(

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
   REVEAL
========================================================================== */

function setupReveal() {

  const targets =
    document.querySelectorAll(

      ".section-head, " +
      ".benefit, " +
      ".app-item, " +
      ".commercial-note, " +
      ".cta-inner"

    );


  targets.forEach(

    function(el) {

      el.classList.add(
        "reveal"
      );

    }

  );


  if (
    !("IntersectionObserver" in window)
  ) {

    targets.forEach(

      function(el) {

        el.classList.add(
          "is-visible"
        );

      }

    );

    return;

  }


  const io =
    new IntersectionObserver(

      function(entries) {

        entries.forEach(

          function(entry) {

            if (
              entry.isIntersecting
            ) {

              entry.target.classList.add(
                "is-visible"
              );


              io.unobserve(
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

    function(el) {

      io.observe(el);

    }

  );

}
