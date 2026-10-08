# Research: GPU compositor

**Question:** how should Scrim move from its DOM/CSS renderer to a GPU compositor that offers blend modes, effects driven by state, mesh warping and multi-projector edge blending, while keeping 1080p and 4K video reliable in Chrome and Edge?

**Status:** research only, as of October 2026. Items marked _(unverified)_ come from background knowledge and were not checked against a live source.

## Where Scrim is today

`apps/web/src/render/Stage.tsx` draws one output:

- **Layers:** image, video, text, counter and state layers are absolutely positioned elements in the output's pixel space, and the canvas is scaled to fit its window.
- **Fades:** a `requestAnimationFrame` loop applies fades and blackout straight to the DOM. A 250 ms timer covers hidden windows.
- **Keystone:** a four-corner pin applied as a CSS `matrix3d` (`render/cornerPin.ts`).
- **Engine:** the pure engine describes fades as tweens and media as clocks, and every renderer interpolates them. That is what makes a second renderer feasible: it consumes exactly the same state.

Each layer belongs to **one output** (`layer.outputId`), and its position is in that output's pixels. There is no shared canvas spanning several outputs.

## Summary

- **Separate three stages, as every media server does:**
  1. compositing layers on a **canvas**;
  2. choosing which part of the canvas each output shows (**slices**);
  3. **warping and blending** per projector, last.
- **Scrim needs a show-format v2** for this. Blending two projectors into one image needs a canvas that spans both.
- **A small custom WebGL2 renderer** is the low-risk start. A WebGPU backend can come later for zero-copy video when several 4K streams are needed.
- **Warping:**
  - corner pin, implemented without the two-triangle seam;
  - mesh warp for curved surfaces;
  - Bezier warp later.
- **Edge blending** follows Paul Bourke's curve, with gamma correction and black-level compensation, in one final pass.
- **Effects** can use ISF, the portable shader format of VDMX, Resolume and MadMapper, with parameters bound to Scrim state values.
- **Text** is drawn with Canvas 2D into a texture.
- **The DOM renderer stays** as the fallback, and for the editor and thumbnails.

## 1. How media servers structure output

| Product            | Model                                                                                                                                                                                                                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Resolume Arena** | The composition is a canvas. In Advanced Output, each **Screen** is a physical output with **Slices**. A slice has an **input selection** (a rectangle or polygon of the composition) and an **output transform** (where it lands). Slices support Bezier and mesh warp, masks and edge blend. |
| **MadMapper**      | **Surfaces** (quad, triangle, mesh, masks), each with an **input** rectangle (source crop) and an **output** shape. Quads get a grid warp. Edge blend per output.                                                                                                                              |
| **Millumin**       | Layers composite onto a board. Outputs carry mapping (quad or mesh warp) and edge blending.                                                                                                                                                                                                    |
| **QLab (video)**   | Cues are placed in a virtual stage. **Surfaces** map regions of it to displays, with corner pin or grid warp, edge blend and masks.                                                                                                                                                            |
| **Watchout**       | A virtual stage, with displays as rectangles on it that carry soft-edge and warp settings.                                                                                                                                                                                                     |
| **disguise (d3)**  | Content is mapped onto a 3D model of the stage. Outputs are virtual projectors or cameras looking at it.                                                                                                                                                                                       |
| **TouchDesigner**  | No built-in mapper. Community components (Stoner for corner pin and mesh, kantanMapper for surfaces) sit between the composite and the output window.                                                                                                                                          |
| **HeavyM**         | Shape-first: draw shapes on the projected surface, then assign media to them.                                                                                                                                                                                                                  |

**Common model:** a **composition (canvas)**, then **input mapping** (which part of the canvas), then **output mapping** (where it lands, with warp and blend). Keystone is the simplest output mapping.

**Proposed Scrim model:**

```
Canvas   { id, name, width, height, background }        ← layers live here
Output   { id, name, width, height, slices[], blend }   ← one physical display or projector
Slice    { canvasId, input: Rect, warp: CornerPin | Mesh | Bezier, mask? }
```

- **Today's shows migrate cleanly:** each current output becomes one canvas plus one output with a single full-size slice, and its corner pin moves onto that slice.
- **Two projectors blended into one wide image:** one canvas, two outputs, each with a slice covering half the canvas plus the overlap.

## 2. Warping

### Corner pin (homography)

A 3×3 matrix maps each point of the source rectangle to the target quad:

```
x' = (h1·x + h2·y + h3) / (h7·x + h8·y + 1)
y' = (h4·x + h5·y + h6) / (h7·x + h8·y + 1)
```

- **Solving it:** four point pairs give eight linear equations (Direct Linear Transform), solved with an 8×8 Gaussian elimination. Use a least-squares solve if more points are given.
- **Exactness:** it is exact for flat surfaces. Scrim already computes it in `render/cornerPin.ts`.
- **The two-triangle seam:**
  - A GPU draws a quad as two triangles with _affine_ texture interpolation.
  - A trapezoid is not an affine image of a rectangle, so the picture kinks along the diagonal.
  - Fixes, in order of robustness:
    1. **Per pixel:** draw a full-output quad and map each pixel back through the inverse matrix H⁻¹ to find its source coordinate. This is exact.
    2. **Projective texture coordinates:** pass `(u·q, v·q, q)` per vertex and divide in the fragment shader.
    3. **Subdivision:** an N×N mesh makes the error sub-pixel.

### Mesh (grid) warp

- **What:** a control grid, typically 4×4 to 32×32 points, interpolated bilinearly or bicubically (Catmull-Rom) onto a finer render mesh (e.g. 64×64).
- **Use:** curved or uneven surfaces such as scenery flats, columns or cycloramas.
- **Changing density:** it should re-sample the current warp, not reset it.

### Bezier warp

Bezier patches, each with 4×4 control points (or handles on a coarse grid), evaluated onto a fine mesh. They curve more smoothly than a mesh warp, which suits cylinders and domes. Resolume offers it. Scrim can leave it for later.

### Calibration UX that works in practice

- **Handles:** large drag handles. Hold Shift or Alt for fine drag.
- **Nudging:** arrow keys (1 px; Shift: 10 px).
- **Density:** controls that keep the current shape.
- **Test patterns:** grid, crosshair, colour bars, corner markers and a numbered identify overlay. Scrim already has Identify.
- **Per-output memory:** calibration is saved per output, with undo and reset.
- **Remote operation:** calibration happens on the projector, so the handles must be operable from the operator machine while the output window shows the pattern full screen.

## 3. Edge blending

When two projectors overlap, the overlap is twice as bright. Edge blending fades each projector across the overlap so they add up to one even image. These formulas follow [Paul Bourke's notes](https://paulbourke.net/miscellaneous/edgeblend/).

**Blend curve.** For position `x` from 0 to 1 across the overlap:

```
f(x) = 0.5 · (2x)^p              for 0 ≤ x ≤ 0.5
f(x) = 1 − 0.5 · (2(1 − x))^p    for 0.5 ≤ x ≤ 1
```

- One projector is multiplied by `f(x)` and the other by `1 − f(x)`.
- `p` sets the curve shape: 1 is linear, and higher values give a softer middle.

**Gamma.**

- **Why:** projectors are not linear. A pixel value of 0.5 gives much less than half the light.
- **How:** apply the weight in linear light, so the two projectors' _light_ adds to 1:

  ```
  out = colour · f(x)^(1/γ)        γ ≈ 2.2, tunable per colour channel
  ```

**Black level.**

- **Why:** projectors leak light even at black, so in dark scenes the overlap is visibly brighter than the rest.
- **How:** raise the black outside the overlap to match:

  ```
  out = out · (1 − L) + L
  ```

  `L` is the extra leak to match, tuned per channel by eye. Resolume exposes similar controls ("black level", "gamma", "power").

**Masks.** A per-output mask image can replace the formula. That allows arbitrary or measured curves, and masking around scenery.

**Order.** All of this happens per output in one final shader pass:

1. sample the canvas through the slice's warp;
2. multiply by the blend weight, in linear light;
3. add the black-level lift;
4. apply the mask.

## 4. Choosing the GPU API

### Support (October 2026)

| API        | Chrome / Edge         | Safari         | Firefox                                                      |
| ---------- | --------------------- | -------------- | ------------------------------------------------------------ |
| **WebGL2** | Yes                   | Yes            | Yes                                                          |
| **WebGPU** | Yes, since 113 (2023) | Yes, Safari 26 | Windows since 141; Apple Silicon later; Linux _(unverified)_ |

Scrim already requires Chrome or Edge for its outputs (Window Management, Web MIDI), so both APIs are available there. Check on the actual show hardware: GPU blocklists can disable either.

### Video textures

| Approach                                                     | Cost                                                                                                                                                                                                                                         |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **WebGL2** `texImage2D(video)` / `texSubImage2D`             | Copies each frame. Chromium often does a fast GPU-to-GPU copy, but there is no zero-copy path. Fine for one or two 1080p videos, expensive for several 4K ones.                                                                              |
| **WebGPU** `device.importExternalTexture({ source: video })` | Near zero-copy, and the YUV→RGB conversion happens in the sampler. The texture is valid only for the current task, so it is re-imported each frame. It is sampled with `textureSampleBaseClampToEdge`: no mipmaps, limited sampling options. |
| **WebCodecs `VideoFrame`**                                   | Full decode control and exact frames, but needs a demuxer such as mp4box.js. Worth it later for frame-accurate scrubbing; not needed first.                                                                                                  |

- **Frame callbacks:** `requestVideoFrameCallback` reports each new frame with its media time. A renderer can upload only when a frame actually changed, and count dropped frames against Scrim's media clock.
- **Decoding:** it is done in hardware (VideoToolbox on macOS, D3D11 on Windows). Limits:
  - the number of decoder instances, and GPU memory, are the real ceilings;
  - H.264 and HEVC decode in hardware;
  - ProRes does not play in browsers.

### Other platform details

- **Colour:**
  - The canvas is sRGB by default, and video (BT.709) is converted by the browser.
  - WebGPU can configure `display-p3`.
  - HDR canvas output is still experimental, so avoid it.
- **Alpha:** keep every texture premultiplied. Convert straight-alpha PNGs on upload (`UNPACK_PREMULTIPLY_ALPHA_WEBGL`).
- **GPU choice:**
  - Request `powerPreference: 'high-performance'` (WebGL context attribute, or `requestAdapter` in WebGPU).
  - Some platforms ignore it and follow OS settings.
- **Context loss:**
  - WebGL: handle `webglcontextlost` (call `preventDefault`) and `webglcontextrestored`.
  - WebGPU: watch `device.lost`, then request a new adapter and device.
  - All GPU resources must be rebuildable from engine state, which Scrim's pure engine already provides.
- **Workers:**
  - `OffscreenCanvas` rendering in a worker works for both APIs.
  - `<video>` elements are not available in workers, so video would have to come through `VideoFrame`s.
  - Rendering on the main thread is simpler and enough while output windows run nothing else.
- **Frame pacing:**
  - `requestAnimationFrame` follows the refresh rate of the display the window is on. Mixed refresh rates across projectors cause judder, so match them in the OS.
  - No browser API locks to vsync beyond this.
- **Full screen on another display:** use the Window Management API (`getScreenDetails()`, then `requestFullscreen({ screen })`), which Scrim already uses.

## 5. Libraries

| Option                             | For                                                                                                                                                                  | Against                                                                                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PixiJS v8**                      | WebGPU and WebGL backends, fast 2D batching, video textures, filters, blend modes (advanced ones via an extension), meshes, tree-shakable.                           | Its scene graph and filter passes work against a custom per-output pipeline (canvas → slices → warp → blend). Upgrades are tied to its release cycle. |
| **three.js** (WebGPURenderer, TSL) | Very capable, and has node materials.                                                                                                                                | Large, 3D-first. Overkill unless we want disguise-style 3D stage mapping.                                                                             |
| **Babylon.js**                     | Full engine.                                                                                                                                                         | Even larger.                                                                                                                                          |
| **twgl / ogl / regl**              | Thin WebGL helpers, single-digit to tens of KB.                                                                                                                      | WebGL only, so no path to WebGPU.                                                                                                                     |
| **Custom WebGL2 renderer**         | The draw list is simple: textured quads, a few render targets, one output pass. About 1–2k lines with full control over shaders, blending, warping and context loss. | We own the code, including a future WebGPU backend.                                                                                                   |

Open-source references:

- **Maptastic:** CSS `matrix3d` corner pin of DOM elements, like Scrim today.
- **Splash** (Société des arts technologiques (SAT), Montréal, C++): multi-projector warp and blend, a good reference for the concepts.
- **MapMap** (Qt): mesh mapping.

Several WebGL warp demos exist but were not reviewed. Lightact is closed source.

## 6. Effects and blend modes

### ISF (Interactive Shader Format)

- **What:** [ISF](https://isf.video) is a GLSL fragment shader with a JSON header in a leading comment:
  - **`INPUTS`:** float, colour, bool, point2D, image, long;
  - **`PASSES`:** multi-pass effects.
- **Built-in names:** `TIME`, `RENDERSIZE`, `isf_FragNormCoord`, `IMG_THIS_PIXEL(name)`.
- **Who uses it:** VDMX, Resolume and MadMapper, which come with a large library of effects and generators.
- **Porting:** ISF shaders target an older GLSL dialect and need light translation to GLSL ES 3.00 (and to WGSL for a WebGPU backend).
- **In the editor:** each effect's controls (sliders, colour pickers) can be generated from its `INPUTS`.
- **Other formats:**
  - **Shadertoy-style** shaders (`mainImage`, `iTime`, `iResolution`, `iChannelN`) are easy to wrap too.
  - **FFGL** is a native plugin API and cannot run in a browser.

### Binding effects to state

Scrim's interactive moments set state values, such as vote tallies and slider averages. Effects bind to them through a declared mapping:

```ts
{ uniform: 'hue', from: { varId: 'voteRatio' }, range: [0, 1], curve: 'easeInOut', smoothing: 0.5 }
```

- **Smoothing:** values arrive in steps (relay totals every 200 ms), so the renderer smooths them.
- **Deliberate changes:** these go through engine tweens, as fades do today. A new `effect` action could fade a parameter to a value over a duration.

### Blend modes (premultiplied alpha; S = source, D = destination)

| Mode       | Formula                                                                   | How                     |
| ---------- | ------------------------------------------------------------------------- | ----------------------- |
| Normal     | `S + D·(1 − Sa)`                                                          | Fixed-function blending |
| Add        | `S + D` (clamped)                                                         | Fixed-function blending |
| Screen     | `S + D − S·D`                                                             | Fixed-function blending |
| Multiply   | `S·D + S·(1 − Da) + D·(1 − Sa)`                                           | Shader                  |
| Overlay    | per channel: `D ≤ 0.5 ? 2·S·D : 1 − 2·(1 − S)·(1 − D)` (un-premultiplied) | Shader                  |
| Difference | `abs(S − D)`                                                              | Shader                  |

Shader blends read the destination from a second render target ("ping-pong"), because WebGL2 cannot read the framebuffer it is writing to. The simplest design does all blends that way.

## 7. Text

| Approach                                          | For                                                                                                                                                           | Against                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Canvas 2D → texture**                           | Uses the browser's own font shaping, so right-to-left and complex scripts (Persian, Arabic) render correctly. Text changes rarely, so re-drawing it is cheap. | Must re-draw on text, size or output-scale change, and wait for `document.fonts.ready`. |
| **SDF / MSDF fonts** (msdfgen, troika-three-text) | Scales and animates smoothly.                                                                                                                                 | Build tooling, and weak shaping for complex scripts.                                    |

Recommendation: Canvas 2D to texture. Keep the DOM renderer as the reference for text and layout.

## 8. Reliability

- **Fallback:**
  - Keep both renderers behind one interface, so switching is one setting.
  - Fall back to DOM automatically if the GPU context does not come back within a few seconds, or if frames keep dropping.
- **Monitoring:**
  - Count late frames (rAF interval over 1.5× the display interval), `getVideoPlaybackQuality().droppedVideoFrames`, and missing `requestVideoFrameCallback` frames.
  - Report them in the output heartbeat `status`, which the operator already sees.
- **Memory budget:**
  - A 4K RGBA texture is about 33 MB.
  - Cap texture counts, and release textures for layers that won't appear soon.
- **Preloading:** Scrim already mounts every layer from the start. Keep video decoders primed: seek to the start frame before the cue.
- **No compile stutter:** compile every shader at load and draw one off-screen frame with each.
  - WebGL2: use `KHR_parallel_shader_compile`.
  - WebGPU: use `createRenderPipelineAsync`.
- **Tests:**
  - Playwright pixel-hash tests running both renderers on the same show and state.
  - Context-loss simulation (`WEBGL_lose_context`, `device.destroy()`).
  - A soak test with the target number of videos.
  - A rehearsal checklist on the real show machine.

## 9. Recommendation

1. **Show format v2.**
   - Canvas, outputs, slices (input rectangle plus warp), and per-output blend settings.
   - A migration from v1: one canvas and one full slice per old output.
2. **Renderer interface** shared by the DOM renderer and a new **custom WebGL2 compositor**:
   - render layers to the canvas with blend modes and effects;
   - one output pass per output: warp by inverse homography or mesh, then edge blend in linear light, black level and mask.
3. **Calibration mode** on the operator machine: handles, nudging, grid density, test patterns and Identify.
4. **Effects:** a few built-in effects first (colour, blur, key, vignette). ISF import, with parameters bound to state values, as a follow-up.
5. **Text** via Canvas 2D textures.
6. **WebGPU backend** behind the same interface later, for `importExternalTexture` when several 4K videos are needed.
7. **DOM renderer stays** for the editor, thumbnails, and as the automatic fallback.

## Sources

- Resolume, Advanced Output guide: [resolume.com](https://resolume.com/support/en/advanced_output_guide)
- QLab documentation (video, surfaces): [qlab.app/docs](https://qlab.app/docs/)
- Paul Bourke, edge blending with commodity projectors: [paulbourke.net](https://paulbourke.net/miscellaneous/edgeblend/)
- TouchDesigner projectorBlend palette component: [docs.derivative.ca](https://docs.derivative.ca/Palette:projectorBlend)
- WebGPU implementation status: [github.com/gpuweb/gpuweb/wiki](https://github.com/gpuweb/gpuweb/wiki/implementation-status)
- WebGPU external textures: [w3.org/TR/webgpu](https://www.w3.org/TR/webgpu/#external-texture)
- Window Management API: [developer.chrome.com](https://developer.chrome.com/docs/capabilities/web-apis/window-management)
- PixiJS v8 launch: [pixijs.com](https://pixijs.com/blog/pixi-v8-launches)
- ISF: [isf.video](https://isf.video)
