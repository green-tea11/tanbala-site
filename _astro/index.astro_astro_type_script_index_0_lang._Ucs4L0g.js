import{t as e}from"./stage.6TvCGv1I.js";var t=`#version 300 es
layout(location = 0) in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,n=`#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D u_state;
uniform vec2 u_texel;
uniform vec2 u_size;
uniform float u_c2;
uniform float u_damp;
uniform float u_shift;
uniform float u_sponge;
uniform float u_edge;   // how much of the wave the very edge keeps each step
uniform int u_srcCount;
uniform vec4 u_src[8];
uniform float u_srcPhase[8];
uniform int u_obsCount;
uniform vec4 u_obs[6];
uniform float u_obsKind[6];

float at(vec2 c) { return texture(u_state, c * u_texel).r; }

void main() {
  vec2 cell = gl_FragCoord.xy;
  vec2 c = cell - vec2(0.0, u_shift);
  vec4 s = texture(u_state, c * u_texel);
  float h = s.r;
  float lap = at(c + vec2(1.0, 0.0)) + at(c - vec2(1.0, 0.0)) + at(c + vec2(0.0, 1.0)) + at(c - vec2(0.0, 1.0)) - 4.0 * h;
  float hn = (2.0 * h - s.g + u_c2 * lap) * u_damp;

  for (int i = 0; i < 8; i++) {
    if (i >= u_srcCount) break;
    vec4 src = u_src[i];
    vec2 d = cell - src.xy;
    hn += src.z * exp(-dot(d, d) / (src.w * src.w)) * sin(u_srcPhase[i]);
  }

  // a soft sponge along the edge, so the wave leaves instead of bouncing off the glass
  vec2 edge = min(cell, u_size - cell);
  hn *= mix(u_edge, 1.0, smoothstep(0.0, u_sponge, min(edge.x, edge.y)));

  // the energy a tag reads goes with the wave: none inside metal, and in water it drains as fast as the wave does,
  // so a tag on metal or in water is silent at once instead of living on the energy of the material before
  float keep = 1.0;
  for (int i = 0; i < 6; i++) {
    if (i >= u_obsCount) break;
    vec4 b = u_obs[i];
    if (cell.x >= b.x && cell.x <= b.z && cell.y >= b.y && cell.y <= b.w) {
      if (u_obsKind[i] < 1.5) { hn = 0.0; h = 0.0; keep = 0.0; }   // metal: a fixed surface, the wave reflects
      else { hn *= 0.82; h *= 0.82; keep = min(keep, 0.82); }       // water: the wave is soaked up
    }
  }

  float en = max(s.b * 0.988, abs(hn)) * keep;
  o = vec4(hn, h, en, 1.0);
}`,r=`
uniform sampler2D u_state;
uniform vec2 u_texel;
uniform float u_sub;
uniform float u_gain;
uniform vec3 u_spec;
uniform float u_specK;
uniform float u_shadeK;
uniform float u_specPow;
uniform float u_slope;
uniform float u_omega;
vec4 surf(vec2 uv) {
  float h = texture(u_state, uv).r;
  float hx = texture(u_state, uv + vec2(u_texel.x, 0.0)).r - texture(u_state, uv - vec2(u_texel.x, 0.0)).r;
  float hy = texture(u_state, uv + vec2(0.0, u_texel.y)).r - texture(u_state, uv - vec2(0.0, u_texel.y)).r;
  return vec4(h, hx, hy, 0.0);
}
// how far the water swings here, from its height and how fast it moves: steady along a passing wave, no flicker
float swing(vec2 uv) {
  vec2 s = texture(u_state, uv).rg;
  float v = (s.r - s.g) / max(u_omega, 1e-3);
  return sqrt(s.r * s.r + v * v);
}
// the swing averaged over a few cells around, so the quiet lines of a standing wave do not show as streaks
float swingSoft(vec2 uv) {
  float sum = 0.0;
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) sum += swing(uv + vec2(float(i), float(j)) * u_texel * 3.0);
  return sum / 9.0;
}
// a soft knee: grows with the swing and never flattens into a block
float knee(float a) { return a / (a + 0.25); }
float specOf(vec2 g) {
  vec3 n = normalize(vec3(-g.x * u_slope, -g.y * u_slope, 1.0));
  vec3 L = normalize(vec3(-0.42, 0.62, 0.66));
  return pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), u_specPow);
}
float shadeOf(vec2 g) {
  vec3 n = normalize(vec3(-g.x * u_slope, -g.y * u_slope, 1.0));
  vec3 L = normalize(vec3(-0.42, 0.62, 0.66));
  return dot(n, L) - L.z;
}`,i=`#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
${r}
uniform vec3 u_ground;
uniform vec3 u_crest;
uniform float u_crestK;
void main() {
  vec2 uv = v_uv - vec2(0.0, u_sub * u_texel.y);
  vec4 s = surf(uv);
  float crest = smoothstep(0.015, 0.32, s.x);
  vec3 col = mix(u_ground, u_crest, clamp(crest * u_crestK * u_gain, 0.0, 1.0));
  col += u_spec * specOf(s.yz) * u_specK * u_gain + vec3(shadeOf(s.yz) * u_shadeK * u_gain);
  o = vec4(col, 1.0);
}`,a=`#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
${r}
uniform vec3 u_ground;
uniform vec3 u_crest;
uniform float u_crestK;
void main() {
  vec2 uv = v_uv - vec2(0.0, u_sub * u_texel.y);
  float g = knee(swingSoft(uv));
  o = vec4(mix(u_ground, u_crest, clamp(g * u_crestK * u_gain, 0.0, 1.0)), 1.0);
}`,o=`#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
${r}
uniform vec3 u_ground;
uniform vec3 u_crest;
uniform float u_crestK;
void main() {
  vec2 uv = v_uv - vec2(0.0, u_sub * u_texel.y);
  float a = swing(uv);
  float n = texture(u_state, uv).r / max(a, 1e-4);
  float k = knee(swingSoft(uv));
  float band = smoothstep(0.2, 0.95, n) * k;
  o = vec4(mix(u_ground, u_crest, clamp((band * 0.85 + k * 0.25) * u_crestK * u_gain, 0.0, 1.0)), 1.0);
}`,s=`#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
${r}
uniform vec3 u_crest;
uniform float u_crestK;
uniform vec3 u_hole;   // a clear circle, centre and radius in canvas px (radius < 0: none): the glow rings what is there
uniform vec2 u_halo;   // where the glow starts and where it is full, on the knee of the swing
uniform vec4 u_cone;   // a cone the glow is shown in: its tip (canvas px) and its direction (unit; zero: no cone)
uniform vec2 u_coneCos; // the cosine of its half-angle where the glow is whole, and where it is gone
void main() {
  vec2 uv = v_uv - vec2(0.0, u_sub * u_texel.y);
  // only the body of the wave is drawn, nearly opaque: its faint fringe, laid thin over the reader's teal, would mix
  // with it into a grey haze instead of reading as the wave's own colour
  float g = clamp(smoothstep(u_halo.x, u_halo.y, knee(swingSoft(uv))) * u_crestK * u_gain, 0.0, 1.0);
  if (dot(u_cone.zw, u_cone.zw) > 0.5) {
    vec2 d = normalize(gl_FragCoord.xy - u_cone.xy + vec2(1e-4));
    g *= smoothstep(u_coneCos.y, u_coneCos.x, dot(d, u_cone.zw));
  }
  if (u_hole.z >= 0.0) g *= smoothstep(u_hole.z, u_hole.z * 1.25 + 4.0, distance(gl_FragCoord.xy, u_hole.xy));
  o = vec4(u_crest * g, g);
}`,c=`#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
${r}
uniform vec3 u_crest;
uniform float u_crestK;
uniform vec2 u_halo;   // the height at which a crest starts to show, and where it is full
void main() {
  vec2 uv = v_uv - vec2(0.0, u_sub * u_texel.y);
  float h = texture(u_state, uv).r;
  float g = clamp(smoothstep(u_halo.x, u_halo.y, h) * u_crestK * u_gain, 0.0, 1.0);
  o = vec4(u_crest * g, g);
}`,l=`#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
${r}
uniform sampler2D u_image;
uniform vec4 u_cover;     // xy = scale, zw = offset (object-fit: cover)
uniform float u_bend;
uniform vec3 u_tintCol;
uniform float u_tintK;
void main() {
  vec2 uv = v_uv - vec2(0.0, u_sub * u_texel.y);
  vec4 s = surf(uv);
  vec2 iuv = v_uv * u_cover.xy + u_cover.zw + s.yz * u_bend;
  vec3 img = texture(u_image, vec2(iuv.x, 1.0 - iuv.y)).rgb;
  float crest = smoothstep(0.02, 0.3, abs(s.x));
  vec3 col = mix(img, u_tintCol, crest * u_tintK * u_gain);
  col += u_spec * specOf(s.yz) * u_specK * u_gain + vec3(shadeOf(s.yz) * u_shadeK * u_gain);
  o = vec4(col, 1.0);
}`,u=`#version 300 es
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec4 a_box;
layout(location = 2) in vec2 a_extra;
uniform vec2 u_view;
uniform vec2 u_cellPx;
uniform vec2 u_grid;
uniform float u_sub;
uniform sampler2D u_state;
uniform float u_probe;
out vec2 v_local;
out float v_energy;
out float v_alpha;
void main() {
  float cs = cos(a_extra.x), sn = sin(a_extra.x);
  vec2 off = a_corner * a_box.zw * 0.5;
  vec2 p = a_box.xy + vec2(off.x * cs - off.y * sn, off.x * sn + off.y * cs);
  vec2 cell = vec2(a_box.x / u_cellPx.x, (u_view.y - a_box.y) / u_cellPx.y - u_sub);
  v_energy = texture(u_state, (cell + 0.5) / u_grid).b;
  v_local = a_corner;
  v_alpha = a_extra.y;
  if (u_probe > 0.5) {
    gl_PointSize = 1.0;
    gl_Position = vec4((float(gl_InstanceID) + 0.5) / u_probe * 2.0 - 1.0, 0.0, 0.0, 1.0);
  } else {
    gl_Position = vec4(p.x / u_view.x * 2.0 - 1.0, 1.0 - p.y / u_view.y * 2.0, 0.0, 1.0);
  }
}`,d=`#version 300 es
precision highp float;
in vec2 v_local;
in float v_energy;
in float v_alpha;
out vec4 o;
uniform vec3 u_cold;
uniform vec3 u_wire;
uniform vec3 u_hot;
uniform vec2 u_aa;
uniform float u_probe;

float box(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }

void main() {
  float lit = smoothstep(0.035, 0.16, v_energy);
  if (u_probe > 0.5) { o = vec4(lit, v_energy * 4.0, 0.0, 1.0); return; }
  vec2 p = v_local;
  float aa = max(u_aa.x, u_aa.y);
  float body = 1.0 - smoothstep(-aa, aa, box(p, vec2(1.0, 1.0), 0.28));
  // a dipole across the label and the chip in its middle: reads as a tag, not as letters
  float arm = (1.0 - smoothstep(0.0, aa * 1.4, abs(p.y) - 0.09)) * step(abs(p.x), 0.82);
  float chip = 1.0 - smoothstep(-aa, aa, box(p, vec2(0.13, 0.3), 0.04));
  float wire = clamp(max(arm, chip), 0.0, 1.0) * body;
  vec3 col = mix(u_cold, u_cold + (u_hot - u_cold) * 0.22, lit);
  col = mix(col, mix(u_wire, u_hot, lit), wire);
  o = vec4(col, body * v_alpha);
}`,f=12,p=4,m=6,h=.45,g=160,_=.2,v=e=>{let t=parseInt(e.replace(`#`,``),16);return[(t>>16&255)/255,(t>>8&255)/255,(t&255)/255]},y=class{ok=!1;canvas;gl;progStep;progSurf;progTag;quad;tagVao;tagBuf;tagData=new Float32Array(960);tex=[];fbo=[];imgTex=null;cover=[1,1,0,0];probeFbo;pbo;fence=null;probeBytes=new Uint8Array(640);probeMap=[];loc=new Map;cur=0;cell=p;steps=3;c2=.32;omega=.2;gridW=0;gridH=0;sponge=22;viewW=0;viewH=0;dpr=1;lastScroll=0;pendingShift=0;phase=0;impulses=[];frame=0;lastStep=-1e9;running=!1;visible=!0;covered=!1;raf=0;rect={left:0,top:0,sx:1,sy:1};opts;c;sourceLayers=[];obstacleLayers=[];tagLayers=[];hole=null;cone=null;damp=.9988;listeners=[];constructor(e,r){this.canvas=e,this.opts={mode:`field`,bend:.9,fixed:!1,wavelength:74,damp:.9988,sponge:22,look:`light`,steps:3,c2:.32,specPow:48,slope:5,edge:.86,...r},this.damp=this.opts.damp;let f=this.opts.theme;this.c={ground:v(f.ground),crest:v(f.crest),spec:v(f.spec),cold:v(f.cold),wire:v(f.wire),hot:v(f.hot),tint:v(f.tint??f.crest)};let p=!!this.opts.overlay,m=e.getContext(`webgl2`,{antialias:!1,alpha:p,depth:!1,stencil:!1,premultipliedAlpha:p,powerPreference:`high-performance`});if(m&&m.getExtension(`EXT_color_buffer_float`)){this.gl=m;try{this.progStep=this.program(t,n);let e={light:i,glow:a,rings:o},f=r.look===`light`?c:s;this.progSurf=this.program(t,this.opts.mode===`refract`?l:p?f:e[this.opts.look]),this.progTag=this.program(u,d)}catch{return}if(this.buildGeometry(),this.resize(),this.ok=!0,this.opts.mode===`refract`&&this.opts.image&&this.loadImage(this.opts.image),!this.opts.fixed){new IntersectionObserver(([e])=>{this.visible=e.isIntersecting},{rootMargin:`80px`}).observe(e);let t=0;new ResizeObserver(()=>{window.clearTimeout(t),t=window.setTimeout(()=>this.resize(),120)}).observe(e)}}}onAnswer(e){this.listeners.push(e)}pulse(e,t,n=1.2,r=2.6){this.impulses.length<4&&this.impulses.push({x:e,y:t,amp:n,radius:r})}setCovered(e){this.covered=e}get stiffness(){return this.c2/Math.min(this.opts.c2,h)}get carrier(){return this.phase}clear(){if(!this.ok)return;let e=this.gl;for(let t of this.fbo)e.bindFramebuffer(e.FRAMEBUFFER,t),e.clearColor(0,0,0,1),e.clear(e.COLOR_BUFFER_BIT);e.bindFramebuffer(e.FRAMEBUFFER,null)}start(){if(!this.ok||this.running)return;this.running=!0,this.lastScroll=window.scrollY;let e=t=>{this.raf=requestAnimationFrame(e),this.tick(t)};this.raf=requestAnimationFrame(e)}stop(){this.running=!1,cancelAnimationFrame(this.raf)}resize(){if(!this.gl)return;let e=this.gl,t=window.matchMedia(`(max-width: 767px)`).matches;this.cell=t?m:p;let n=Math.min(this.opts.c2,h),r=Math.sqrt(n)*p*this.opts.steps;this.steps=t?Math.max(1,Math.round(r/(Math.sqrt(n)*m))):this.opts.steps,this.c2=t?Math.min(h,(r/(m*this.steps))**2):n,this.dpr=Math.min(window.devicePixelRatio||1,t?1.5:1.75),this.viewW=Math.max(1,this.canvas.clientWidth),this.viewH=Math.max(1,this.canvas.clientHeight),this.canvas.width=Math.round(this.viewW*this.dpr),this.canvas.height=Math.round(this.viewH*this.dpr),this.gridW=Math.ceil(this.viewW/this.cell),this.gridH=Math.ceil(this.viewH/this.cell),this.sponge=Math.min(this.opts.sponge,Math.min(this.gridW,this.gridH)*_),this.omega=2*Math.PI*Math.sqrt(this.c2)*this.cell/this.opts.wavelength;for(let t of this.tex)e.deleteTexture(t);for(let t of this.fbo)e.deleteFramebuffer(t);this.tex=[],this.fbo=[];for(let t=0;t<2;t++){let t=e.createTexture();e.bindTexture(e.TEXTURE_2D,t),e.texImage2D(e.TEXTURE_2D,0,e.RGBA16F,this.gridW,this.gridH,0,e.RGBA,e.HALF_FLOAT,null),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE);let n=e.createFramebuffer();e.bindFramebuffer(e.FRAMEBUFFER,n),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,t,0),e.clearColor(0,0,0,1),e.clear(e.COLOR_BUFFER_BIT),this.tex.push(t),this.fbo.push(n)}e.bindFramebuffer(e.FRAMEBUFFER,null),this.fitCover()}loadImage(e){let t=()=>{let t=this.gl;this.imgTex=t.createTexture(),t.bindTexture(t.TEXTURE_2D,this.imgTex),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,t.RGBA,t.UNSIGNED_BYTE,e),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.MIRRORED_REPEAT),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.MIRRORED_REPEAT),this.fitCover()};e.complete&&e.naturalWidth?t():e.addEventListener(`load`,t,{once:!0})}fitCover(){let e=this.opts.image;if(!e||!e.naturalWidth)return;let t=e.naturalWidth/e.naturalHeight,n=this.viewW/this.viewH,[r,i]=this.opts.focus??[.5,.5];if(n>t){let e=t/n;this.cover=[1,e,0,(1-e)*(1-i)]}else{let e=n/t;this.cover=[e,1,(1-e)*r,0]}}program(e,t){let n=this.gl,r=(e,t)=>{let r=n.createShader(e);if(n.shaderSource(r,t),n.compileShader(r),!n.getShaderParameter(r,n.COMPILE_STATUS))throw Error(n.getShaderInfoLog(r)||`shader`);return r},i=n.createProgram();if(n.attachShader(i,r(n.VERTEX_SHADER,e)),n.attachShader(i,r(n.FRAGMENT_SHADER,t)),n.linkProgram(i),!n.getProgramParameter(i,n.LINK_STATUS))throw Error(n.getProgramInfoLog(i)||`link`);return i}u(e,t){let n=this.loc.get(e);return n||(n=new Map,this.loc.set(e,n)),n.has(t)||n.set(t,this.gl.getUniformLocation(e,t)),n.get(t)??null}buildGeometry(){let e=this.gl;this.quad=e.createVertexArray(),e.bindVertexArray(this.quad);let t=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,t),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0),this.tagVao=e.createVertexArray(),e.bindVertexArray(this.tagVao),e.bindBuffer(e.ARRAY_BUFFER,t),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0),this.tagBuf=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.tagBuf),e.bufferData(e.ARRAY_BUFFER,this.tagData.byteLength,e.DYNAMIC_DRAW),e.enableVertexAttribArray(1),e.vertexAttribPointer(1,4,e.FLOAT,!1,24,0),e.vertexAttribDivisor(1,1),e.enableVertexAttribArray(2),e.vertexAttribPointer(2,2,e.FLOAT,!1,24,16),e.vertexAttribDivisor(2,1),e.bindVertexArray(null);let n=e.createTexture();e.bindTexture(e.TEXTURE_2D,n),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,g,1,0,e.RGBA,e.UNSIGNED_BYTE,null),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),this.probeFbo=e.createFramebuffer(),e.bindFramebuffer(e.FRAMEBUFFER,this.probeFbo),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,n,0),e.bindFramebuffer(e.FRAMEBUFFER,null),this.pbo=e.createBuffer(),e.bindBuffer(e.PIXEL_PACK_BUFFER,this.pbo),e.bufferData(e.PIXEL_PACK_BUFFER,this.probeBytes.byteLength,e.STREAM_READ),e.bindBuffer(e.PIXEL_PACK_BUFFER,null)}tick(e){let t=this.gl,n=window.scrollY;if(this.opts.fixed&&(this.pendingShift+=(n-this.lastScroll)/this.cell),this.lastScroll=n,this.covered||!this.visible){this.pendingShift=0;return}if(e-this.lastStep<f)return;this.lastStep=e;let r=Math.trunc(this.pendingShift);this.pendingShift-=r,this.frame++;let i=this.canvas.getBoundingClientRect();this.rect={left:i.left,top:i.top,sx:i.width?this.viewW/i.width:1,sy:i.height?this.viewH/i.height:1};let a=(e,t)=>[(e-this.rect.left)*this.rect.sx/this.cell,(this.viewH-(t-this.rect.top)*this.rect.sy)/this.cell],o=new Float32Array(32),s=new Float32Array(8),c=0;for(let t of this.sourceLayers)for(let n of t(e)){if(c>=8||n.amp<=5e-4)continue;let[e,t]=a(n.x,n.y);o.set([e,t,n.amp*.11,n.radius??2.2],c*4),s[c]=n.phase??0,c++}let l=new Float32Array(24),u=new Float32Array(6),d=0;for(let e of this.obstacleLayers)for(let t of e()){if(d>=6)break;let[e,n]=a(t.x0,t.y0),[r,i]=a(t.x1,t.y1);l.set([e,i,r,n],d*4),u[d]=t.kind===`metal`?1:2,d++}t.disable(t.BLEND),t.useProgram(this.progStep),t.bindVertexArray(this.quad),t.viewport(0,0,this.gridW,this.gridH),t.uniform2f(this.u(this.progStep,`u_texel`),1/this.gridW,1/this.gridH),t.uniform2f(this.u(this.progStep,`u_size`),this.gridW,this.gridH),t.uniform1f(this.u(this.progStep,`u_c2`),this.c2),t.uniform1f(this.u(this.progStep,`u_damp`),this.damp),t.uniform1f(this.u(this.progStep,`u_sponge`),this.sponge),t.uniform1f(this.u(this.progStep,`u_edge`),this.opts.edge),t.uniform4fv(this.u(this.progStep,`u_obs`),l),t.uniform1fv(this.u(this.progStep,`u_obsKind`),u),t.uniform1i(this.u(this.progStep,`u_obsCount`),d),t.uniform1i(this.u(this.progStep,`u_state`),0),t.activeTexture(t.TEXTURE0);for(let e=0;e<this.steps;e++){this.phase+=this.omega;let n=c,i=o.slice(),l=s.slice();for(let e=0;e<n;e++)l[e]=this.phase+s[e];if(e===0)for(let e of this.impulses){if(n>=8)break;let[t,r]=a(e.x,e.y);i.set([t,r,e.amp*.6,e.radius??2.6],n*4),l[n]=Math.PI/2,n++}t.uniform4fv(this.u(this.progStep,`u_src`),i),t.uniform1fv(this.u(this.progStep,`u_srcPhase`),l),t.uniform1i(this.u(this.progStep,`u_srcCount`),n),t.uniform1f(this.u(this.progStep,`u_shift`),e===0?r:0),t.bindTexture(t.TEXTURE_2D,this.tex[this.cur]),t.bindFramebuffer(t.FRAMEBUFFER,this.fbo[1-this.cur]),t.drawArrays(t.TRIANGLE_STRIP,0,4),this.cur=1-this.cur}this.impulses=[],this.drawSurface(),this.drawTags()}drawSurface(){let e=this.gl,t=this.progSurf,n=this.opts.theme;if(e.bindFramebuffer(e.FRAMEBUFFER,null),e.viewport(0,0,this.canvas.width,this.canvas.height),e.useProgram(t),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,this.tex[this.cur]),e.uniform1i(this.u(t,`u_state`),0),e.uniform2f(this.u(t,`u_texel`),1/this.gridW,1/this.gridH),e.uniform1f(this.u(t,`u_sub`),this.pendingShift),e.uniform1f(this.u(t,`u_gain`),1),e.uniform3fv(this.u(t,`u_spec`),this.c.spec),e.uniform1f(this.u(t,`u_specK`),n.specK),e.uniform1f(this.u(t,`u_shadeK`),n.shadeK),e.uniform1f(this.u(t,`u_specPow`),this.opts.specPow),e.uniform1f(this.u(t,`u_slope`),this.opts.slope),e.uniform1f(this.u(t,`u_omega`),this.omega),this.opts.overlay){let[n,r]=this.opts.halo??[.18,.55];e.uniform2f(this.u(t,`u_halo`),n,r);let i=this.cone,a=i&&Math.hypot(i.dx,i.dy)||1;e.uniform4f(this.u(t,`u_cone`),i?(i.x-this.rect.left)*this.rect.sx*this.dpr:0,i?(this.viewH-(i.y-this.rect.top)*this.rect.sy)*this.dpr:0,i?i.dx/a:0,i?-i.dy/a:0),e.uniform2f(this.u(t,`u_coneCos`),i?Math.cos(i.inner):1,i?Math.cos(i.outer):1);let o=this.hole;e.uniform3f(this.u(t,`u_hole`),o?(o.x-this.rect.left)*this.rect.sx*this.dpr:0,o?(this.viewH-(o.y-this.rect.top)*this.rect.sy)*this.dpr:0,o?o.r*this.dpr:-1)}this.opts.mode===`refract`?(e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,this.imgTex),e.uniform1i(this.u(t,`u_image`),1),e.uniform4fv(this.u(t,`u_cover`),this.cover),e.uniform1f(this.u(t,`u_bend`),this.opts.bend),e.uniform3fv(this.u(t,`u_tintCol`),this.c.tint),e.uniform1f(this.u(t,`u_tintK`),n.tintK??.12),e.activeTexture(e.TEXTURE0)):(e.uniform3fv(this.u(t,`u_ground`),this.c.ground),e.uniform3fv(this.u(t,`u_crest`),this.c.crest),e.uniform1f(this.u(t,`u_crestK`),n.crestK)),e.drawArrays(e.TRIANGLE_STRIP,0,4)}drawTags(){let e=this.gl,t=0;if(this.probeMap=[],this.tagLayers.forEach((e,n)=>{let r=t;for(let n of e()){if(t>=g)break;this.tagData.set([(n.x-this.rect.left)*this.rect.sx,(n.y-this.rect.top)*this.rect.sy,n.w,n.h,n.rot,n.alpha],t*6),t++}this.probeMap.push({layer:n,start:r,count:t-r})}),!t)return;let n=this.progTag;if(e.bindBuffer(e.ARRAY_BUFFER,this.tagBuf),e.bufferSubData(e.ARRAY_BUFFER,0,this.tagData,0,t*6),e.useProgram(n),e.bindVertexArray(this.tagVao),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,this.tex[this.cur]),e.uniform1i(this.u(n,`u_state`),0),e.uniform2f(this.u(n,`u_view`),this.viewW,this.viewH),e.uniform2f(this.u(n,`u_cellPx`),this.cell,this.cell),e.uniform2f(this.u(n,`u_grid`),this.gridW,this.gridH),e.uniform1f(this.u(n,`u_sub`),this.pendingShift),e.uniform3fv(this.u(n,`u_cold`),this.c.cold),e.uniform3fv(this.u(n,`u_wire`),this.c.wire),e.uniform3fv(this.u(n,`u_hot`),this.c.hot),e.uniform2f(this.u(n,`u_aa`),2/(24*this.dpr),2/(10*this.dpr)),e.uniform1f(this.u(n,`u_probe`),0),e.enable(e.BLEND),e.blendFunc(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA),e.drawArraysInstanced(e.TRIANGLE_STRIP,0,4,t),e.disable(e.BLEND),this.fence){let t=e.clientWaitSync(this.fence,0,0);(t===e.ALREADY_SIGNALED||t===e.CONDITION_SATISFIED)&&(e.bindBuffer(e.PIXEL_PACK_BUFFER,this.pbo),e.getBufferSubData(e.PIXEL_PACK_BUFFER,0,this.probeBytes),e.bindBuffer(e.PIXEL_PACK_BUFFER,null),e.deleteSync(this.fence),this.fence=null,this.emit())}else this.frame%3==0&&this.listeners.length&&(e.bindFramebuffer(e.FRAMEBUFFER,this.probeFbo),e.viewport(0,0,g,1),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT),e.uniform1f(this.u(n,`u_probe`),g),e.drawArraysInstanced(e.POINTS,0,1,t),e.bindBuffer(e.PIXEL_PACK_BUFFER,this.pbo),e.bufferData(e.PIXEL_PACK_BUFFER,this.probeBytes.byteLength,e.STREAM_READ),e.readPixels(0,0,g,1,e.RGBA,e.UNSIGNED_BYTE,0),e.bindBuffer(e.PIXEL_PACK_BUFFER,null),e.bindFramebuffer(e.FRAMEBUFFER,null),this.fence=e.fenceSync(e.SYNC_GPU_COMMANDS_COMPLETE,0));e.bindVertexArray(null)}emit(){for(let{layer:e,start:t,count:n}of this.probeMap){if(!n)continue;let r=new Float32Array(n);for(let e=0;e<n;e++)r[e]=this.probeBytes[(t+e)*4]/255;for(let t of this.listeners)t(e,r)}}},b=()=>window.matchMedia(`(prefers-reduced-motion: reduce)`).matches;function x(e,t){if(!e)return null;if(b())return e.hidden=!0,null;let n=new y(e,t);return n.ok?(e.classList.add(`is-live`),document.addEventListener(`visibilitychange`,()=>document.hidden?n.stop():n.start()),n.start(),n):(e.hidden=!0,null)}function S(e,t,{amp:n=.85,click:r=0,rise:i=.25,fall:a=.06}={}){let o=0,s=0,c=-1e9,l=0;return t.addEventListener(`pointermove`,e=>{e.pointerType!==`touch`&&(o=e.clientX,s=e.clientY,c=performance.now())},{passive:!0}),t.addEventListener(`pointerdown`,t=>{t.target.closest(`a, button, input, label, textarea, select`)||e.pulse(t.clientX,t.clientY,t.pointerType===`touch`?1.4:r||1.2,3)},{passive:!0}),e.sourceLayers.push(e=>{let t=+(e-c<700);return l+=(t-l)*(t>l?i:a),l>.01?[{x:o,y:s,amp:l*n,radius:2.4}]:[]}),{active:()=>performance.now()-c<2600}}function C(e,t,n,{every:r,length:i,amp:a},o=[.5,.5]){e.sourceLayers.push(e=>{if(n.active())return[];let s=e%r;if(s>i)return[];let c=t.getBoundingClientRect();return[{x:c.left+c.width*o[0],y:c.top+c.height*o[1],amp:Math.sin(Math.PI*s/i)*a,radius:2.4}]})}var w={ground:`#1594a3`,crest:`#8fe6ef`,crestK:.5,spec:`#ffffff`,specK:.4,shadeK:.16,cold:`#2aa6b4`,wire:`#127b88`,hot:`#ffffff`},T={name:`Спокойно`,room:{steps:2,c2:.32,wavelength:150,specPow:24,slope:3.6,damp:.9988},light:{specK:.3,shadeK:.12,crestK:.45},hand:{amp:.7,rise:.12,fall:.04,click:3},breath:{every:4200,length:1600,amp:.7}};function E(e,t){let n=x(e.querySelector(`[data-hero-water]`),{theme:{...w,...t.light},...t.room});if(!n)return;e.classList.add(`has-water`);let r=S(n,e,t.hand),i=e.querySelector(`[data-hero-scanner]`);i&&C(n,i,r,t.breath,[.86,.62])}var D=new Float32Array([-1,-1,1,-1,-1,1,1,1]),O=9,k=`#version 300 es
layout(location = 0) in vec2 a_pos;
out vec2 v_uv;
void main() { v_uv = a_pos * 0.5 + 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }`,A=`#version 300 es
precision highp float;
in vec2 v_uv; out vec4 o;
uniform sampler2D u_prev; uniform float u_keep;
void main() { o = texture(u_prev, v_uv) * u_keep; }`,j=`#version 300 es
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec4 a_seg;
layout(location = 2) in vec4 a_col;
layout(location = 3) in float a_r;
uniform vec2 u_size;
out vec2 v_q; out vec4 v_col; out float v_half; out float v_r;
void main() {
  vec2 p0 = a_seg.xy; vec2 p1 = a_seg.zw;
  vec2 d = p1 - p0; float len = length(d);
  vec2 t = len > 1e-3 ? d / len : vec2(1.0, 0.0);
  vec2 n = vec2(-t.y, t.x);
  float h = len * 0.5;
  vec2 c = (p0 + p1) * 0.5 + t * a_corner.x * (h + a_r) + n * a_corner.y * a_r;
  v_q = vec2(a_corner.x * (h + a_r), a_corner.y * a_r);
  v_half = h; v_r = a_r;
  v_col = vec4(a_col.rgb, a_col.a * a_r / (a_r + h));
  gl_Position = vec4(c.x / u_size.x * 2.0 - 1.0, 1.0 - c.y / u_size.y * 2.0, 0.0, 1.0);
}`,M=`#version 300 es
precision highp float;
in vec2 v_q; in vec4 v_col; in float v_half; in float v_r;
out vec4 o;
void main() {
  float dx = max(abs(v_q.x) - v_half, 0.0);
  float r = length(vec2(dx, v_q.y)) / v_r;
  float g = max(0.0, 1.0 - r * r);
  g *= g;
  o = vec4(v_col.rgb * v_col.a * g, v_col.a * g);
}`,N=`#version 300 es
precision highp float;
in vec2 v_uv; out vec4 o;
uniform sampler2D u_trail; uniform float u_gain; uniform float u_opacity; uniform float u_glow;
uniform vec2 u_res; uniform float u_edge;
// the dye thins out toward the canvas' edges, so no stream is ever cut by a straight line
float edge() { vec2 p = v_uv * u_res; vec2 q = min(p, u_res - p); return smoothstep(0.0, u_edge, min(q.x, q.y)); }
uniform vec4 u_dim[4]; uniform int u_dimN; uniform float u_dimK; uniform float u_dimSoft;
// inside a thing the air passes through (a box): the dye shows faintly, as through cardboard; it thins in softly
float dimmed() {
  vec2 p = v_uv * u_res;
  float m = 1.0;
  for (int i = 0; i < 4; i++) {
    if (i >= u_dimN) break;
    vec4 r = u_dim[i];
    vec2 c = (r.xy + r.zw) * 0.5;
    vec2 h = (r.zw - r.xy) * 0.5;
    vec2 q = abs(p - c) - h + u_dimSoft;
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - u_dimSoft;
    m = min(m, mix(1.0, u_dimK, 1.0 - smoothstep(-u_dimSoft, 0.0, d)));
  }
  return m;
}
void main() {
  vec4 s = texture(u_trail, v_uv);
  float a = (1.0 - exp(-s.a * u_gain)) * u_opacity * edge() * dimmed();
  vec3 col = s.rgb / max(s.a, 1e-4);
  col = mix(col, vec3(1.0), clamp(a * u_glow, 0.0, 0.6));
  o = vec4(col * a, a);
}`,P=`#version 300 es
precision highp float;
in vec2 v_uv; out vec4 o;
uniform sampler2D u_trail; uniform sampler2D u_image; uniform vec2 u_texel;
uniform float u_gain; uniform float u_opacity; uniform float u_glow; uniform float u_bend; uniform float u_tint;
uniform vec2 u_res; uniform float u_edge; uniform vec3 u_ground;
float edge() { vec2 p = v_uv * u_res; vec2 q = min(p, u_res - p); return smoothstep(0.0, u_edge, min(q.x, q.y)); }
uniform vec4 u_dim[4]; uniform int u_dimN; uniform float u_dimK; uniform float u_dimSoft;
// inside a thing the air passes through (a box): the dye shows faintly, as through cardboard; it thins in softly
float dimmed() {
  vec2 p = v_uv * u_res;
  float m = 1.0;
  for (int i = 0; i < 4; i++) {
    if (i >= u_dimN) break;
    vec4 r = u_dim[i];
    vec2 c = (r.xy + r.zw) * 0.5;
    vec2 h = (r.zw - r.xy) * 0.5;
    vec2 q = abs(p - c) - h + u_dimSoft;
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - u_dimSoft;
    m = min(m, mix(1.0, u_dimK, 1.0 - smoothstep(-u_dimSoft, 0.0, d)));
  }
  return m;
}
// the haze is taken from a blurred copy of the dye (a smaller mip level): it sways, it never tears
float cover(vec2 uv) { return 1.0 - exp(-textureLod(u_trail, uv, 2.5).a * u_gain); }
void main() {
  vec4 s = texture(u_trail, v_uv);
  float fade = edge() * dimmed();
  float a = (1.0 - exp(-s.a * u_gain)) * u_opacity * fade;
  // the slope of the haze, taken wide and soft, so the picture sways instead of tearing along each speck
  vec2 e = u_texel * 6.0;
  vec2 g = vec2(0.0);
  for (int i = -1; i <= 1; i++) {
    vec2 sx = vec2(0.0, float(i) * e.y);
    vec2 sy = vec2(float(i) * e.x, 0.0);
    g.x += cover(v_uv + vec2(e.x, 0.0) + sx) - cover(v_uv - vec2(e.x, 0.0) + sx);
    g.y += cover(v_uv + vec2(0.0, e.y) + sy) - cover(v_uv - vec2(0.0, e.y) + sy);
  }
  vec2 uv = v_uv + g / 3.0 * u_bend * fade;
  vec3 base = texture(u_image, vec2(uv.x, 1.0 - uv.y)).rgb;
  vec3 col = s.rgb / max(s.a, 1e-4);
  col = mix(col, vec3(1.0), clamp(a * u_glow, 0.0, 0.6));
  // the air shows its colour over the ground; over the type it mostly bends it, so the letters never turn muddy
  float onGround = 1.0 - smoothstep(0.06, 0.3, distance(base, u_ground));
  o = vec4(mix(base, col, a * u_tint * (0.25 + 0.75 * onGround)), 1.0);
}`,F=class{ok=!1;canvas;streams=[];before=[];after=[];onResize=null;dims=[];width=1;height=1;gl;o;progDecay;progDust;progOut;quad;dustVao;dustBuf;tex=[];fbo=[];imgTex=null;cur=0;bufW=1;bufH=1;dpr=1;half=!0;n=0;px;py;vx;vy;age;life;seed;sid;inst;debt=[];vel=new Float32Array(2);time=0;last=-1;raf=0;running=!1;visible=!0;loc=new Map;constructor(e,t={}){this.canvas=e,this.o={max:5e3,decay:.955,gain:1.6,opacity:.9,scale:.5,glow:0,image:null,bend:.02,tint:.8,mist:.18,edge:90,ground:[0,0,0],dimK:.3,dimSoft:40,...t};let n=this.o.max;this.px=new Float32Array(n),this.py=new Float32Array(n),this.vx=new Float32Array(n),this.vy=new Float32Array(n),this.age=new Float32Array(n),this.life=new Float32Array(n),this.seed=new Float32Array(n),this.sid=new Uint8Array(n),this.inst=new Float32Array(n*O);let r=!!this.o.image,i=e.getContext(`webgl2`,{alpha:!r,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1});if(!i)return;this.gl=i,this.half=!!i.getExtension(`EXT_color_buffer_float`);try{this.progDecay=this.program(k,A),this.progDust=this.program(j,M),this.progOut=this.program(k,r?P:N)}catch{return}this.geometry(),this.resize(),this.ok=!0,this.o.image&&this.setImage(this.o.image),new IntersectionObserver(([e])=>{this.visible=e.isIntersecting},{rootMargin:`120px`}).observe(e);let a=0;new ResizeObserver(()=>{(e.clientWidth!==this.width||e.clientHeight!==this.height)&&(window.clearTimeout(a),a=window.setTimeout(()=>this.resize(),100))}).observe(e),document.addEventListener(`visibilitychange`,()=>{this.last=-1})}setImage(e){if(!this.gl)return;let t=this.gl;this.imgTex||=t.createTexture(),t.bindTexture(t.TEXTURE_2D,this.imgTex),t.pixelStorei(t.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,t.RGBA,t.UNSIGNED_BYTE,e),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE)}get pixelRatio(){return this.dpr}add(e){return this.streams.push(e),this.debt.push(0),e}countIn(e,t,n,r){let i=this.streams.indexOf(e),a=0,o=r*r;for(let e=0;e<this.n;e++){if(this.sid[e]!==i)continue;let r=this.px[e]-t,s=this.py[e]-n;r*r+s*s<o&&a++}return a}front(e,t,n,r,i,a=.97){let o=this.streams.indexOf(e),s=[];for(let e=0;e<this.n;e++)this.sid[e]===o&&s.push((this.px[e]-t)*r+(this.py[e]-n)*i);return s.length<8?-1/0:(s.sort((e,t)=>e-t),s[Math.min(s.length-1,Math.floor(s.length*a))])}expire(e,t){let n=this.streams.indexOf(e);for(let e=0;e<this.n;e++)this.sid[e]===n&&(this.life[e]=Math.min(this.life[e],this.age[e]+t*(.6+.8*Math.random())))}clear(){if(this.n=0,!this.ok)return;let e=this.gl;for(let t of this.fbo)e.bindFramebuffer(e.FRAMEBUFFER,t),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT);e.bindFramebuffer(e.FRAMEBUFFER,null)}start(){if(!this.ok||this.running)return;this.running=!0;let e=t=>{this.raf=requestAnimationFrame(e),this.frame(t)};this.raf=requestAnimationFrame(e)}stop(){this.running=!1,cancelAnimationFrame(this.raf)}get isVisible(){return this.visible&&!document.hidden}still(e){if(this.ok){for(let t=0;t<e*60;t++)this.step(.016666666666666666,!0);this.draw()}}stillWhen(e,t=20,n=.4){if(!this.ok)return;let r=1/30,i=0;for(;i<t*30&&!e();)this.step(r,!1),i++;for(let e=0;e<n*30;e++)this.step(r,!0);this.draw()}resize(){if(!this.gl)return;let e=this.gl,t=window.matchMedia(`(max-width: 767px)`).matches;this.dpr=Math.min(window.devicePixelRatio||1,this.o.image?2:t?1.5:1.75),this.width=Math.max(1,this.canvas.clientWidth),this.height=Math.max(1,this.canvas.clientHeight),this.canvas.width=Math.round(this.width*this.dpr),this.canvas.height=Math.round(this.height*this.dpr);let n=this.o.scale*Math.min(this.dpr,1.5);this.bufW=Math.max(2,Math.round(this.width*n)),this.bufH=Math.max(2,Math.round(this.height*n));for(let t of this.tex)e.deleteTexture(t);for(let t of this.fbo)e.deleteFramebuffer(t);this.tex=[],this.fbo=[];for(let t=0;t<2;t++){let t=e.createTexture();e.bindTexture(e.TEXTURE_2D,t),this.half?e.texImage2D(e.TEXTURE_2D,0,e.RGBA16F,this.bufW,this.bufH,0,e.RGBA,e.HALF_FLOAT,null):e.texImage2D(e.TEXTURE_2D,0,e.RGBA,this.bufW,this.bufH,0,e.RGBA,e.UNSIGNED_BYTE,null),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE);let n=e.createFramebuffer();e.bindFramebuffer(e.FRAMEBUFFER,n),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,t,0),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT),this.tex.push(t),this.fbo.push(n)}e.bindFramebuffer(e.FRAMEBUFFER,null),this.onResize?.()}frame(e){if(!this.isVisible){this.last=-1;return}let t=this.last<0?1/60:Math.min(1/30,(e-this.last)/1e3);this.last=e,this.step(t,!0),this.draw()}step(e,t){this.time+=e;let n=this.time;for(let t of this.before)t(n,e);this.spawn(e),this.move(e);for(let t of this.after)t(n,e);t&&this.paint(e)}spawn(e){let t=this.o.max;this.streams.forEach((n,r)=>{if(!n.on)this.debt[r]=0;else{for(this.debt[r]+=n.rate*(n.gust?n.gust(this.time):1)*e;this.debt[r]>=1&&this.n<t;){--this.debt[r];let e=Math.random(),t=n.emit(e),i=this.n++;this.px[i]=t.x,this.py[i]=t.y,this.vx[i]=t.vx,this.vy[i]=t.vy,this.age[i]=0,this.life[i]=n.life[0]+Math.random()*(n.life[1]-n.life[0]),this.seed[i]=t.seed??e,this.sid[i]=r}this.n>=t&&(this.debt[r]=0)}})}move(e){let t=this.vel,n=this.time,r=0;for(;r<this.n;){let i=this.streams[this.sid[r]],a=this.age[r]+=e,o=this.px[r],s=this.py[r];i.field(o,s,n,this.seed[r],a,t);let c=Math.min(1,i.relax*e);this.vx[r]+=(t[0]-this.vx[r])*c,this.vy[r]+=(t[1]-this.vy[r])*c,o+=this.vx[r]*e,s+=this.vy[r]*e;let l=o<-80||s<-80||o>this.width+80||s>this.height+80,u=i.sink?i.sink(o,s,this.seed[r]):!1;if(u&&i.onSink?.(o,s,this.seed[r]),a>this.life[r]||l||u){let e=--this.n;this.px[r]=this.px[e],this.py[r]=this.py[e],this.vx[r]=this.vx[e],this.vy[r]=this.vy[e],this.age[r]=this.age[e],this.life[r]=this.life[e],this.seed[r]=this.seed[e],this.sid[r]=this.sid[e]}else this.px[r]=o,this.py[r]=s,r++}}paint(e){let t=this.gl,n=this.bufW/this.width,r=this.bufH/this.height,i=this.inst;for(let t=0;t<this.n;t++){let a=this.streams[this.sid[t]],o=this.age[t],s=this.life[t],c=Math.min(1,o/.35,(s-o)/.6),l=this.px[t]*n,u=this.py[t]*r,d=t*O,f=this.seed[t],p=f*13.73%1,m=f*5.31%1,h=f*91.7%1<(a.mist??this.o.mist);i[d]=l-this.vx[t]*e*2*n,i[d+1]=u-this.vy[t]*e*2*r,i[d+2]=l,i[d+3]=u,i[d+4]=a.color[0],i[d+5]=a.color[1],i[d+6]=a.color[2],i[d+7]=a.weight*(h?.16:.35+1.3*p*p)*Math.max(0,c)*e*60,i[d+8]=Math.max(.8,a.size*(h?4+3*m:.55+.9*m*m)*n)}t.disable(t.BLEND),t.useProgram(this.progDecay),t.bindVertexArray(this.quad),t.viewport(0,0,this.bufW,this.bufH),t.bindFramebuffer(t.FRAMEBUFFER,this.fbo[1-this.cur]),t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,this.tex[this.cur]),t.uniform1i(this.u(this.progDecay,`u_prev`),0),t.uniform1f(this.u(this.progDecay,`u_keep`),this.o.decay**(e*60)),t.drawArrays(t.TRIANGLE_STRIP,0,4),this.cur=1-this.cur,this.n&&(t.useProgram(this.progDust),t.bindVertexArray(this.dustVao),t.bindBuffer(t.ARRAY_BUFFER,this.dustBuf),t.bufferSubData(t.ARRAY_BUFFER,0,i,0,this.n*O),t.uniform2f(this.u(this.progDust,`u_size`),this.bufW,this.bufH),t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE),t.drawArraysInstanced(t.TRIANGLE_STRIP,0,4,this.n),t.disable(t.BLEND)),t.bindVertexArray(null)}draw(){let e=this.gl,t=this.progOut;e.bindFramebuffer(e.FRAMEBUFFER,null),e.viewport(0,0,this.canvas.width,this.canvas.height),e.useProgram(t),e.bindVertexArray(this.quad),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,this.tex[this.cur]),e.uniform1i(this.u(t,`u_trail`),0),e.uniform1f(this.u(t,`u_gain`),this.o.gain),e.uniform1f(this.u(t,`u_opacity`),this.o.opacity),e.uniform1f(this.u(t,`u_glow`),this.o.glow),e.uniform2f(this.u(t,`u_res`),this.width,this.height),e.uniform1f(this.u(t,`u_edge`),this.o.edge);let n=new Float32Array(16),r=Math.min(4,this.dims.length);for(let e=0;e<r;e++){let t=this.dims[e];n.set([t.x,this.height-(t.y+t.h),t.x+t.w,this.height-t.y],e*4)}e.uniform4fv(this.u(t,`u_dim`),n),e.uniform1i(this.u(t,`u_dimN`),r),e.uniform1f(this.u(t,`u_dimK`),this.o.dimK),e.uniform1f(this.u(t,`u_dimSoft`),this.o.dimSoft),this.o.image?(e.generateMipmap(e.TEXTURE_2D),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR_MIPMAP_LINEAR),e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,this.imgTex),e.uniform1i(this.u(t,`u_image`),1),e.uniform2f(this.u(t,`u_texel`),1/this.bufW,1/this.bufH),e.uniform1f(this.u(t,`u_bend`),this.o.bend),e.uniform1f(this.u(t,`u_tint`),this.o.tint),e.uniform3fv(this.u(t,`u_ground`),this.o.ground),e.activeTexture(e.TEXTURE0)):(e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT)),e.drawArrays(e.TRIANGLE_STRIP,0,4),e.bindVertexArray(null)}geometry(){let e=this.gl;this.quad=e.createVertexArray(),e.bindVertexArray(this.quad);let t=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,t),e.bufferData(e.ARRAY_BUFFER,D,e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0),this.dustVao=e.createVertexArray(),e.bindVertexArray(this.dustVao),e.bindBuffer(e.ARRAY_BUFFER,t),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0),this.dustBuf=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.dustBuf),e.bufferData(e.ARRAY_BUFFER,this.inst.byteLength,e.DYNAMIC_DRAW),e.enableVertexAttribArray(1),e.vertexAttribPointer(1,4,e.FLOAT,!1,36,0),e.vertexAttribDivisor(1,1),e.enableVertexAttribArray(2),e.vertexAttribPointer(2,4,e.FLOAT,!1,36,16),e.vertexAttribDivisor(2,1),e.enableVertexAttribArray(3),e.vertexAttribPointer(3,1,e.FLOAT,!1,36,32),e.vertexAttribDivisor(3,1),e.bindVertexArray(null)}program(e,t){let n=this.gl,r=(e,t)=>{let r=n.createShader(e);if(n.shaderSource(r,t),n.compileShader(r),!n.getShaderParameter(r,n.COMPILE_STATUS))throw Error(n.getShaderInfoLog(r)||`shader`);return r},i=n.createProgram();if(n.attachShader(i,r(n.VERTEX_SHADER,e)),n.attachShader(i,r(n.FRAGMENT_SHADER,t)),n.linkProgram(i),!n.getProgramParameter(i,n.LINK_STATUS))throw Error(n.getProgramInfoLog(i)||`link`);return i}u(e,t){let n=this.loc.get(e);return n||(n=new Map,this.loc.set(e,n)),n.has(t)||n.set(t,this.gl.getUniformLocation(e,t)),n.get(t)??null}},ee=()=>window.matchMedia(`(prefers-reduced-motion: reduce)`).matches,te=e=>{let t=e.match(/[\d.]+/g)??[`0`,`0`,`0`];return[Number(t[0])/255,Number(t[1])/255,Number(t[2])/255]},I=e=>{let t=parseInt(e.replace(`#`,``),16);return[(t>>16&255)/255,(t>>8&255)/255,(t&255)/255]};function L(e,t){let n=e.getBoundingClientRect(),r=t.getBoundingClientRect();return{x:n.left-r.left,y:n.top-r.top,w:n.width,h:n.height}}var ne=[[.83,.56,1,.35,1],[-.42,.91,.62,-.5,.7],[.97,-.26,.38,.8,.45],[-.71,-.7,.24,-1.1,.3]],re=Math.PI*2;function R(e,t,n,r,i){let a=0,o=0;for(let[i,s,c,l,u]of ne){let d=Math.cos((i*e+s*t)*re/(r*c)+l*n+c*9.1)*u;a+=d*s,o-=d*i}i[0]=a*.55,i[1]=o*.55}var z=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)},B=e=>e-Math.floor(e);function V(e){let t=new Float32Array(2),n=()=>{let t=e.face(),n=e.tag();return Math.min(e.maxSpeed??240,Math.hypot(n.x-t.x,n.y-t.y)/(e.trip??3))},r={taken:0,speed:n,color:e.color,weight:e.weight??.08,size:e.size??7,life:[(e.trip??3)*1.25+.4,(e.trip??3)*1.25+.4+2*(e.beyond??.6)],rate:e.rate??700,on:!1,relax:3.2,gust:e=>.55+.3*Math.sin(e*4.1)+.15*Math.sin(e*9.7+1.3),emit(t){let r=e.face(),i=t*2-1,a=n(),o=-r.ny,s=r.nx,c=(Math.random()-.5)*6;return{x:r.x+o*i*r.half*.92+r.nx*(4+c),y:r.y+s*i*r.half*.92+r.ny*(4+c),vx:r.nx*a*.7,vy:r.ny*a*.7}},field(r,i,a,o,s,c){let l=e.face(),u=e.tag(),d=n()*(.7+.6*B(o*17.13)),f=B(o*29.7)*90,p=B(o*41.3)*90,m=u.x-l.x,h=u.y-l.y,g=Math.hypot(m,h)||1;m/=g,h/=g;let _=-h,v=m,y=o*2-1,b=u.r*1.3+l.half*(e.width??.3),x=u.x+_*y*b,S=u.y+v*y*b,C=(r-u.x)*m+(i-u.y)*h,w=(r-u.x)*_+(i-u.y)*v,T,E;if(C<-u.r*.6){T=x-r,E=S-i;let e=Math.hypot(T,E)||1;T/=e,E/=e;let t=(r-l.x)*l.nx+(i-l.y)*l.ny,n=z(0,g*.3,t);T=l.nx*(1-n)+T*n,E=l.ny*(1-n)+E*n;let a=Math.hypot(T,E)||1;T/=a,E/=a}else T=m+_*Math.sign(w)*.45,E=h+v*Math.sign(w)*.45;let D=1-.65*z(u.r,u.r*5,C),O=T*d*D,k=E*d*D,A=C*C+w*w,j=u.r*u.r;if(A>1){let e=j/(A*A),t=-d*e*(C*C-w*w),n=-d*2*e*C*w,r=1-z(j*4,j*16,A);O+=(m*t+_*n)*r,k+=(h*t+v*n)*r}if(A<j*.8){let e=Math.sqrt(A)||1;O+=(r-u.x)/e*d*1.4,k+=(i-u.y)/e*d*1.4}let M=(r-l.x)*m+(i-l.y)*h,N=(e.stir??.45)*(.25+.75*z(0,g*.7,M));R(r+f,i+p,a,e.eddy??220,t),c[0]=O+t[0]*d*N,c[1]=k+t[1]*d*N},sink(t,n,r){if(B(r*7.31)>(e.absorb??.3))return!1;let i=e.tag();return Math.hypot(t-i.x,n-i.y)<i.r*1.12},onSink(){r.taken++}};return r}function H(e){let t=new Float32Array(2),n=()=>{let t=e.face(),n=e.tag();return Math.min(e.maxSpeed??220,Math.hypot(n.x-t.x,n.y-t.y)/(e.trip??2.8))},r={taken:0,color:e.color,weight:e.weight??.09,size:e.size??6,life:[4.5,6.5],rate:e.rate??600,on:!1,relax:2.6,mist:e.mist,gust:e=>.6+.28*Math.sin(e*5.3+.7)+.12*Math.sin(e*11.1),emit(t){let r=e.tag(),i=e.face(),a=Math.atan2(i.y-r.y,i.x-r.x)+(t*2-1)*Math.PI*(e.bloom??1),o=n(),s=Math.cos(a),c=Math.sin(a);return{x:r.x+s*r.r*.85,y:r.y+c*r.r*.85,vx:s*o*.55,vy:c*o*.55}},field(r,i,a,o,s,c){let l=e.face(),u=e.tag(),d=n()*(.7+.6*B(o*17.13)),f=B(o*3.7)*2-1,p=-l.ny,m=l.nx,h=l.x+p*f*l.half*(e.land??.8)+l.nx*2,g=l.y+m*f*l.half*(e.land??.8)+l.ny*2,_=h-r,v=g-i,y=Math.hypot(_,v)||1;_/=y,v/=y;let b=r-u.x,x=i-u.y,S=Math.hypot(b,x)||1,C=z(0,.15+.55*(e.bloom??1),s);_=b/S*(1-C)+_*C,v=x/S*(1-C)+v*C;let w=Math.hypot(_,v)||1,T=Math.hypot(u.x-l.x,u.y-l.y)||1,E=(e.stir??.4)*z(0,T*.25,S)*z(0,T*.3,y);R(r+400+B(o*29.7)*90,i-300+B(o*41.3)*90,a,e.eddy??200,t);let D=d*(.55+.45*z(0,60,y));c[0]=_/w*D+t[0]*d*E,c[1]=v/w*D+t[1]*d*E},sink(t,n){let r=e.face(),i=(t-r.x)*r.nx+(n-r.y)*r.ny,a=Math.abs((t-r.x)*-r.ny+(n-r.y)*r.nx);return i<7&&i>-40&&a<r.half},onSink(){r.taken++}};return r}function U(e){let t=e.lead??.8,n=e.wake??.45,r=e.answerFor??1.8,i=e.read??2,a=e.rest??1.8,o=`lead`,s=0,c=(t,n)=>{o=t,s=n,e.root.dataset.phase=t,e.onPhase?.(t)},l=0;return c(`lead`,0),e.flow.before.push(u=>{l=u;let d=u-s;o===`lead`&&d>=t?(e.call.taken=0,e.call.on=!0,c(`call`,u)):o===`call`&&(e.call.taken>=(e.hear??14)||d>9)?(e.call.on=!1,e.flow.expire(e.call,e.callFade??1.4),c(`wake`,u)):o===`wake`&&d>=n?(e.answer.taken=0,e.answer.on=!0,c(`answer`,u)):o===`answer`?(d>=r&&(e.answer.on=!1),(e.answer.taken>=(e.arrive??14)||d>9)&&(e.answer.on=!1,e.flow.expire(e.answer,1.6),c(`read`,u))):o===`read`&&d>=i?c(`rest`,u):o===`rest`&&d>=a&&c(`lead`,u)}),{phase:()=>o,reset:()=>{e.call.on=!1,e.answer.on=!1,e.flow.clear(),c(`lead`,l)}}}function ie(e,t,n=.9){let r=()=>{t.reset(),e.stillWhen(()=>t.phase()===`read`,20,n)};e.onResize=r,r()}async function ae(e){try{await Promise.all(e.map(e=>document.fonts.load(e))),await document.fonts.ready}catch{}}function oe(e,t,n,r,{ground:i,ink:a}){let o=Math.max(1,t.clientWidth),s=Math.max(1,t.clientHeight);e.width=Math.round(o*r),e.height=Math.round(s*r);let c=e.getContext(`2d`);if(c){c.setTransform(r,0,0,r,0,0),c.fillStyle=i,c.fillRect(0,0,o,s);for(let e of n){let n=getComputedStyle(e),r=L(e,t),i=(e.textContent??``).trim();c.font=`${n.fontWeight} ${n.fontSize} ${n.fontFamily}`,c.letterSpacing=n.letterSpacing===`normal`?`0px`:n.letterSpacing,c.textBaseline=`alphabetic`,c.fillStyle=a(e);let o=c.measureText(i),s=parseFloat(n.lineHeight)||r.h,l=r.y+(s-(o.fontBoundingBoxAscent+o.fontBoundingBoxDescent))/2+o.fontBoundingBoxAscent;c.fillText(i,r.x,l)}}}var se=e=>Math.max(0,Math.sin(e*Math.PI*2*3))**3;async function ce(e){if(!e)return;let t=()=>{e.dataset.phase=`read`},n=ee(),r=e.querySelector(`[data-air]`),i=e.querySelector(`[data-ant]`),a=e.querySelector(`[data-tag]`),o=[...e.querySelectorAll(`[data-line]`)];if(!r||!i||!a||!o.length)return t();await ae([`900 100px "Golos Text Variable"`]);let s=document.createElement(`canvas`),c=window.matchMedia(`(max-width: 767px)`).matches,l=c?.55:1,u=c?.8:1,d=c?.68:1,f=getComputedStyle(e).backgroundColor,p=new F(r,{image:s,ground:te(f),max:c?3500:7e3,scale:.75,tint:.85,decay:.93,gain:1.5,opacity:.9,glow:.3,bend:.016,mist:.4});if(!p.ok)return t();let m=getComputedStyle(o[0]).color,h=()=>{oe(s,e,o,p.pixelRatio,{ground:f,ink:()=>m}),p.setImage(s)};h(),e.classList.add(`is-live`);let g=0;new ResizeObserver(()=>{window.clearTimeout(g),g=window.setTimeout(h,n?0:160)}).observe(e);let _=Number(i.dataset.faceX),v=Number(i.dataset.faceTop),y=Number(i.dataset.faceBottom),b={x:0,y:0,nx:1,ny:0,half:1},x={x:0,y:0,r:1};p.before.push(()=>{let e=L(i,r);b.x=e.x+e.w*_-2,b.y=e.y+e.h*(v+y)*.5,b.half=e.h*(y-v)/2;let t=L(a,r);x.x=t.x+t.w/2,x.y=t.y+t.h/2,x.r=Math.max(t.w,t.h)*.5});let S=p.add(V({face:()=>b,tag:()=>x,color:I(`#7fdbe6`),trip:1.3,maxSpeed:750,eddy:220*d,stir:1.2,size:5*u,weight:.07,rate:2200*l,absorb:.35}));S.gust=se;let C=U({root:e,flow:p,call:S,answer:p.add(H({face:()=>b,tag:()=>x,color:I(`#ff8a3d`),trip:1.25,maxSpeed:700,eddy:210*d,stir:.5,size:4.5*u,weight:.08,rate:1800*l,mist:.45,bloom:.6})),lead:.4,wake:.25,answerFor:1.1,read:1.5,rest:1,callFade:.8,hear:c?6:16,arrive:c?12:30});if(n)return ie(p,C);p.start()}var le=`77479597238`,W=`Здравствуйте! Хочу обсудить учёт вещей на RFID-метках.`,ue=(e=W)=>`https://wa.me/${le}?text=${encodeURIComponent(e)}`,G={heading:`Подбор`,invite:`Расскажите, что хотите учитывать, и мы подберём метки и оборудование.`,questions:{what:{label:`Что хотите учитывать`,options:[{id:`box`,label:`Коробки и товар`,tag:`бумажная этикетка`},{id:`asset`,label:`Мебель и технику`,tag:`плёночная этикетка`},{id:`metal`,label:`Металл: инструмент, стеллажи`,tag:`метка для металла`},{id:`crate`,label:`Тару и паллеты`,tag:`корпусная метка`},{id:`cloth`,label:`Одежду и спецодежду`,tag:`метка под стирку`},{id:`doc`,label:`Документы`,tag:`бумажная этикетка`},{id:`liquid`,label:`Бутылки и канистры`,tag:`метка для жидкостей`}]},count:{label:`Сколько вещей`,options:[`До 1 000`,`1 000–10 000`,`Больше 10 000`,`Пока не знаю`]},account:{label:`Где ведёте учёт`,options:[`Есть 1С`,`Другая система`,`Пока нет`]},note:{label:`Пара слов о задаче`,placeholder:`Например: теряем инструмент между сменами`}},resultIdle:`Отметьте, что хотите учитывать, и мы покажем, какие метки подойдут.`,resultLead:`Скорее всего подойдут:`,resultTail:`Оборудование подберём после разговора.`,messageLabel:`Сообщение`,footnote:`Откроется WhatsApp с готовым сообщением.`};function de(e=document){let t=e.querySelector(`[data-podbor-form]`);if(!t)return;let n=e.querySelector(`[data-podbor-fit]`),r=e.querySelector(`[data-podbor-msg]`),i=[...e.querySelectorAll(`[data-podbor-link]`)],a=()=>{let e=[...t.querySelectorAll(`input[name="what"]:checked`)],a=t.querySelector(`input[name="count"]:checked`)?.value,o=t.querySelector(`input[name="account"]:checked`)?.value,s=(t.querySelector(`textarea[name="note"]`)?.value??``).trim().slice(0,400),c=[...new Set(e.map(e=>e.dataset.tag??``))].filter(Boolean);if(n){if(n.replaceChildren(),c.length){let e=document.createElement(`b`);e.textContent=c.join(`, `),n.append(`${G.resultLead} `,e,`. ${G.resultTail}`)}else n.textContent=G.resultIdle}let l=[`Здравствуйте! Хочу учёт вещей на RFID-метках.`];e.length&&l.push(`Метим: ${e.map(e=>(e.dataset.label??``).toLowerCase()).join(`, `)}.`),a&&l.push(`Вещей: ${a.toLowerCase()}.`),o&&l.push(`Учёт: ${o.charAt(0).toLowerCase()}${o.slice(1)}.`),s&&l.push(s);let u=l.length>1?l.join(`
`):W;r&&(r.textContent=u),i.forEach(e=>{e.href=ue(u)}),t.classList.toggle(`has-choice`,e.length>0)};t.addEventListener(`input`,a),t.addEventListener(`change`,a),t.addEventListener(`submit`,e=>e.preventDefault())}var fe=400,K=()=>window.matchMedia(`(prefers-reduced-motion: reduce)`).matches;function pe(e){if(!e)return;let t=[...e.querySelectorAll(`details`)],n=e=>e.querySelector(`.acc__body`),r=0,i=(e,t)=>{let n=String(++r);e.dataset.turn=n;let i=!1,a=()=>{e.removeEventListener(`transitionend`,o),!(i||e.dataset.turn!==n)&&(i=!0,t())},o=t=>{t.target===e&&t.propertyName===`height`&&a()};e.addEventListener(`transitionend`,o),window.setTimeout(a,fe)},a=e=>{e.style.height=``,e.style.opacity=``},o=e=>{let t=n(e),r=e.open&&t?t.getBoundingClientRect().height:0;e.classList.remove(`is-closing`),e.open=!0,!t||K()?t&&a(t):(t.style.height=`${r}px`,t.style.opacity=r?getComputedStyle(t).opacity:`0`,t.getBoundingClientRect(),t.style.height=`${t.scrollHeight}px`,t.style.opacity=`1`,i(t,()=>a(t)))},s=e=>{if(!e.open||e.classList.contains(`is-closing`))return;let t=n(e);!t||K()?e.open=!1:(t.style.height=`${t.getBoundingClientRect().height}px`,t.style.opacity=getComputedStyle(t).opacity,e.classList.add(`is-closing`),t.getBoundingClientRect(),t.style.height=`0px`,t.style.opacity=`0`,i(t,()=>{e.open=!1,e.classList.remove(`is-closing`),a(t)}))};for(let e of t)e.querySelector(`summary`)?.addEventListener(`click`,n=>{n.preventDefault(),e.open&&!e.classList.contains(`is-closing`)?s(e):(t.forEach(t=>{t!==e&&s(t)}),o(e))})}var q=new Set,J=!1,me=()=>{J=!1;for(let e of q)e.getBoundingClientRect().top<window.innerHeight*.95&&(e.classList.add(`is-in`),q.delete(e))};window.addEventListener(`scroll`,()=>{!J&&q.size&&(J=!0,requestAnimationFrame(me))},{passive:!0});var Y=(e,t=`0px 0px -10% 0px`)=>{if(!(`IntersectionObserver`in window)){e.forEach(e=>e.classList.add(`is-in`));return}e.forEach(e=>q.add(e));let n=new IntersectionObserver(e=>{for(let t of e)t.isIntersecting&&(t.target.classList.add(`is-in`),n.unobserve(t.target))},{rootMargin:t,threshold:.06});e.forEach(e=>n.observe(e))};function he(e){let t=(e.textContent??``).trim().replace(/\s+/g,` `);e.setAttribute(`aria-label`,t),e.textContent=``;let n=t.split(` `).map(t=>{let n=document.createElement(`span`);return n.style.display=`inline-block`,n.textContent=t,e.append(n,` `),n}),r=[];for(let e of n){let t=r.at(-1);t&&Math.abs(t.top-e.offsetTop)<4?t.words.push(e.textContent??``):r.push({top:e.offsetTop,words:[e.textContent??``]})}e.textContent=``,r.forEach((t,n)=>{let r=document.createElement(`span`);r.className=`rl`,r.setAttribute(`aria-hidden`,`true`);let i=document.createElement(`span`);i.style.setProperty(`--i`,String(n)),i.textContent=t.words.join(` `),r.append(i),e.append(r,` `)}),e.classList.add(`is-split`)}function ge(e){window.matchMedia(`(pointer: coarse)`).matches&&document.querySelectorAll(`[data-touch]`).forEach(e=>{e.textContent=e.dataset.touch??e.textContent}),document.querySelectorAll(`[data-stagger]`).forEach(e=>{[...e.children].forEach((e,t)=>{e.setAttribute(`data-reveal`,``),e.style.setProperty(`--i`,String(Math.min(t,10)))})}),Y([...document.querySelectorAll(`[data-reveal]`)]);let t=[...document.querySelectorAll(`[data-open]`)];if(`IntersectionObserver`in window){let e=new IntersectionObserver(n=>{for(let r of n)r.isIntersecting&&(e.unobserve(r.target),t.filter(e=>e.parentElement===r.target).forEach(e=>e.classList.add(`is-in`)))},{rootMargin:`0px 0px -10% 0px`});new Set(t.map(e=>e.parentElement)).forEach(t=>e.observe(t))}else t.forEach(e=>e.classList.add(`is-in`));if(e)return;let n=[...document.querySelectorAll(`[data-lines]`)];document.fonts?.ready.then(()=>{n.forEach(he),Y(n)})}var X=`cubic-bezier(0.16, 1, 0.3, 1)`;function _e(e,t){let n=e.querySelector(`.mark__base`),r=[...e.querySelectorAll(`.mark__arc`)];n?.animate([{opacity:0,transform:`scale(0.6) rotate(-45deg)`},{opacity:1,transform:`none`}],{duration:900,delay:t,easing:X,fill:`both`}),r.forEach((e,n)=>e.animate([{opacity:0,transform:`translateX(-30%) scale(0.7)`},{opacity:1,transform:`none`}],{duration:700,delay:t+420+n*140,easing:X,fill:`both`}))}function ve(e){if(e||!(`IntersectionObserver`in window))return;let t=new IntersectionObserver(e=>{for(let n of e)n.isIntersecting&&(t.unobserve(n.target),n.target.matches(`[data-mark-draw]`)?_e(n.target,150):n.target.querySelectorAll(`.wordmark__letter`).forEach((e,t)=>{e.animate([{opacity:0,transform:`translateY(38%)`},{opacity:1,transform:`none`}],{duration:1e3,delay:t*70,easing:X,fill:`both`})}))},{rootMargin:`0px 0px -6% 0px`});document.querySelectorAll(`[data-mark-draw], [data-word-rise]`).forEach(e=>{e.querySelectorAll(`.wordmark__letter`).forEach(e=>{e.style.opacity=`0`,e.style.transition=`none`}),t.observe(e)}),window.addEventListener(`beforeprint`,()=>document.querySelectorAll(`.wordmark__letter`).forEach(e=>{e.style.opacity=``}))}var Z=b();e.smooth();var Q=document.querySelector(`[data-hero]`);Q&&E(Q,T);var $=document.querySelector(`[data-disc]`);if($){let e=[...$.querySelectorAll(`[data-disc-obj]`)],t=[...$.querySelectorAll(`[data-disc-btn]`)],n=$.querySelector(`[data-disc-text]`),r=r=>{e.forEach((e,t)=>e.classList.toggle(`is-on`,t===r)),t.forEach((e,t)=>e.setAttribute(`aria-selected`,String(t===r))),n.textContent=t[r].dataset.text??``};t.forEach((e,t)=>{e.addEventListener(`click`,()=>r(t)),e.addEventListener(`pointerenter`,e=>{e.pointerType!==`touch`&&r(t)}),e.addEventListener(`focus`,()=>r(t))})}ce(document.querySelector(`[data-air-poster]`)),de(),pe(document.querySelector(`.acc__list`)),ge(Z),ve(Z);