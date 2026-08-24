# Demo 360° — Nissan V-Drive 2026 · ViewMetricaMX

Proyecto estático (HTML/CSS/JS + Three.js vía CDN). Sin backend, sin base de datos, sin login.

## ⚠️ Dos cosas que debes saber antes de enviarlo

1. **La imagen "piloto" no es equirectangular.**
   Las fotos `copiloto`, `interior` y `trasera` son 8000×4000 px (proporción 2:1, panorama 360° real).
   La foto `piloto` es 4000×2250 px (16:9, foto normal, probablemente exportada distinto desde la app de tu Insta360). Al proyectarla sobre la esfera se verá deformada/recortada en los polos. **Antes de mandar la demo al vendedor, vuelve a exportar esa toma como equirectangular 2:1** desde la app Insta360 y reemplaza el archivo en `assets/piloto_nissan_v_drive_2026_gomez_palacio.jpg` (mismo nombre, mismas dimensiones que las otras tres).

2. **No había foto "centro".**
   Subiste `piloto`, `copiloto`, `interior` y una llamada `trasera` — no una de "centro". Usé esas 4 reales y el botón de la cuarta posición dice **TRASERA** (no "CENTRO"), porque es lo que la foto realmente muestra. Si prefieres mostrar una vista central, súbela y dime para actualizar el botón y el archivo referenciado en `script.js` (objeto `POSITIONS`).

## Cómo cambiar el número de WhatsApp

Abre `script.js` y edita esta línea, cerca del inicio del archivo:

```js
const WHATSAPP_NUMBER = "AQUI_MI_NUMERO";
```

Reemplázala por tu número con código de país, sin espacios ni símbolos, por ejemplo:

```js
const WHATSAPP_NUMBER = "528711234567";
```

## Publicarlo gratis

**Opción A — Netlify (arrastrar y soltar, la más simple)**
1. Entra a https://app.netlify.com/drop
2. Arrastra la carpeta completa `viewmetrica-nissan-demo` (o su contenido) a la zona de "drop".
3. Netlify te da una URL pública al instante (algo como `nombre-aleatorio.netlify.app`).
4. Opcional: crea una cuenta gratuita para poder editar el nombre del sitio y volver a subir cambios.

**Opción B — GitHub Pages**
1. Crea un repositorio nuevo en GitHub (puede ser público).
2. Sube estos archivos (`index.html`, `style.css`, `script.js`, carpeta `assets/`) a la raíz del repo.
3. Ve a *Settings → Pages*, en "Source" selecciona la rama `main` y carpeta `/root`.
4. Guarda; en un par de minutos tu demo estará en `https://tu-usuario.github.io/tu-repo/`.

**Opción C — Vercel**
1. Entra a https://vercel.com/new
2. Sube la carpeta del proyecto (o conéctala desde GitHub).
3. Vercel detecta que es un sitio estático y lo publica automáticamente.

En cualquiera de las tres, no necesitas configurar build ni backend — es HTML/CSS/JS puro.

## Estructura del proyecto

```
viewmetrica-nissan-demo/
├── index.html
├── style.css
├── script.js
└── assets/
    ├── piloto_nissan_v_drive_2026_gomez_palacio.jpg
    ├── copiloto_nissan_v_drive_2026_gomez_palacio.jpg
    ├── interior_nissan_v_drive_2026_gomez_palacio.jpg
    └── trasera_nissan_v_drive_2026_gomez_palacio.jpg
```

## Notas técnicas

- El visor 360° usa Three.js (r128, vía CDN) proyectando cada JPG equirectangular sobre una esfera invertida, con la cámara en el centro — no son imágenes planas dentro de un contenedor.
- Arrastre con mouse/touch, zoom con rueda/pellizco/botones, pantalla completa y recentrado están implementados manualmente (sin dependencias adicionales de Three.js/examples).
- Auto-rotación: solo se activa tras ~5 segundos sin interacción, a velocidad muy baja, y se detiene de inmediato al tocar/arrastrar.
- Fallback: si el navegador no soporta WebGL, se muestra la fotografía como imagen estática con la misma navegación por posición.
- Las 4 imágenes se mantuvieron sin alterar (solo se copiaron con nombre de archivo corregido); no se generaron miniaturas de baja calidad.
- Peso actual de las imágenes: cada una pesa entre ~2.2 y ~4.2 MB. Esto es razonable para calidad de demo, pero si el vendedor la abrirá con datos móviles lentos, vale la pena comprimir cada JPG (calidad ~80, mismo tamaño en px) antes de publicarlo.
