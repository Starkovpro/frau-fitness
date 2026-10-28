/* ═══════════════════════════════════════════════════════════════
   Frau Fitness — кинематографичный слой главной страницы
   3D-логотип, морфинг-форма InBody, пролёт камеры,
   кинетическая типографика. Работает поверх обычного HTML:
   если WebGL/скрипты недоступны — сайт полностью рабочий без них.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mobile = window.matchMedia('(max-width: 760px)').matches;
  var root = document.documentElement;

  /* ---------- 1. Hero: разбивка заголовка на буквы (анимация по таймеру, всегда завершается) ---------- */
  var idx = 0;
  function splitChars(el, cls, withIndex) {
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (w) {
            if (!w) return;
            if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(' ')); return; }
            var ws = document.createElement('span'); ws.className = 'kw'; ws.setAttribute('aria-hidden', 'true');
            Array.prototype.forEach.call(w, function (c) {
              var s = document.createElement('span'); s.className = cls; s.textContent = c;
              if (withIndex) s.style.setProperty('--i', idx++);
              ws.appendChild(s);
            });
            frag.appendChild(ws);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
      });
    })(el);
  }
  var h1 = document.querySelector('.hero h1');
  if (h1 && !reduce) {
    h1.setAttribute('aria-label', h1.textContent.replace(/\s+/g, ' ').trim());
    h1.querySelectorAll('.hl-line').forEach(function (l) { splitChars(l, 'kc', true); });
    root.classList.add('kinetic-on');
  }

  /* ---------- 2. Плавный скролл ---------- */
  var lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
    if (window.gsap) {
      lenis.on('scroll', function () { if (window.ScrollTrigger) window.ScrollTrigger.update(); });
      window.gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      window.gsap.ticker.lagSmoothing(0);
    } else {
      (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);
    }
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (id.length < 2) return;
        var t = document.querySelector(id); if (!t) return;
        e.preventDefault(); lenis.scrollTo(t, { duration: 1.5, offset: -70 });
      });
    });
  }

  /* ---------- 3. Кинетические заголовки разделов (сходятся из разлёта при прокрутке; текст всегда видим) ---------- */
  if (window.gsap && window.ScrollTrigger && !reduce) {
    var gsap = window.gsap; gsap.registerPlugin(window.ScrollTrigger);
    document.querySelectorAll('.section-title, .cert-content h3').forEach(function (h) {
      h.setAttribute('aria-label', h.textContent.replace(/\s+/g, ' ').trim());
      splitChars(h, 'tc', false);
      var cs = h.querySelectorAll('.tc'); var mid = (cs.length - 1) / 2;
      Array.prototype.forEach.call(cs, function (c, i) {
        var d = (i - mid) / Math.max(mid, 1);
        gsap.fromTo(c, { x: d * (mobile ? 40 : 80), y: Math.abs(d) * -30, rotate: d * 12, skewX: -16 },
          { x: 0, y: 0, rotate: 0, skewX: 0, ease: 'none',
            scrollTrigger: { trigger: h, start: 'top 100%', end: 'top 55%', scrub: 0.6 } });
      });
    });
    // жёлтая форма за абонементами меняет очертания
    var ps = document.querySelector('.pricing-shape');
    if (ps) gsap.fromTo(ps, { clipPath: 'polygon(0% 42%, 100% 28%, 100% 58%, 0% 72%)' },
      { clipPath: 'polygon(0% 4%, 100% 0%, 100% 96%, 0% 100%)', ease: 'none',
        scrollTrigger: { trigger: '#pricing', start: 'top 85%', end: 'center 60%', scrub: 0.8 } });
    // счётчики InBody
    document.querySelectorAll('[data-count]').forEach(function (b) {
      var end = +b.getAttribute('data-count'), o = { v: 0 };
      window.ScrollTrigger.create({ trigger: b, start: 'top 90%', once: true, onEnter: function () {
        gsap.to(o, { v: end, duration: 1.6, ease: 'power3.out', onUpdate: function () { b.textContent = Math.round(o.v); } });
      } });
    });
  }

  /* ---------- 4. Бегущая строка направлений: скорость и наклон от скорости прокрутки ---------- */
  var rows = Array.prototype.slice.call(document.querySelectorAll('.mq-row'));
  rows.forEach(function (r) { r.innerHTML += r.innerHTML; r._x = 0; });
  var lastY = window.scrollY, vel = 0;
  function marquee() {
    if (reduce || !rows.length) return;
    var y = window.scrollY, v = y - lastY; lastY = y; vel += (v - vel) * 0.1;
    rows.forEach(function (r) {
      var w = r.scrollWidth / 2; if (!w) return;
      var dir = +r.getAttribute('data-dir');
      r._x -= dir * (0.5 + Math.min(Math.abs(vel), 60) * 0.22);
      if (r._x < -w) r._x += w; if (r._x > 0) r._x -= w;
      var sk = Math.max(-10, Math.min(10, -vel * 0.3)) * dir;
      r.style.transform = 'translate3d(' + r._x + 'px,0,0) skewX(' + sk + 'deg)';
    });
  }

  /* ---------- 5. «Магнитные» кнопки (только мышь) ---------- */
  if (!reduce && window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.btn, .p-btn').forEach(function (b) {
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        b.style.transform = 'translate(' + (e.clientX - r.left - r.width / 2) * 0.18 + 'px,' + (e.clientY - r.top - r.height / 2) * 0.28 + 'px)';
      });
      b.addEventListener('pointerleave', function () { b.style.transform = ''; });
    });
  }

  /* ---------- 6. WebGL-сцена ---------- */
  var canvas = document.getElementById('stage');
  var THREE = window.THREE;
  var ok = false;
  try {
    if (canvas && THREE) {
      var test = document.createElement('canvas');
      if (test.getContext('webgl') || test.getContext('experimental-webgl')) { initStage(); ok = true; }
    }
  } catch (err) { if (window.console) console.warn('3D-слой отключён:', err); }
  if (!ok) {
    root.classList.add('no-stage');
    (function loop() { marquee(); requestAnimationFrame(loop); })();
  }

  function initStage() {
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !mobile, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75));
    renderer.setClearColor(0x0a0a0a, 1);
    // Без тонмаппинга: фирменный #ffff00 остаётся чистым жёлтым
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputEncoding = THREE.LinearEncoding;

    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0a0a, 0.05);
    var cam = new THREE.PerspectiveCamera(42, 1, 0.1, 200);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 0.7));
    var key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(3, 5, 6); scene.add(key);
    var rim = new THREE.PointLight(0xffffff, 1.4, 25); rim.position.set(-4, 2, -2); scene.add(rim);

    /* --- логотип F из векторного файла логотипа --- */
    var PATHS = [
      'M 216.13 255.81 C 216.64 252.87 218.98 242.22 227.45 231.64 C 236.00 220.97 252.61 208.25 283.17 208.25 L 328.02 208.25 C 327.31 204.06 326.11 200.30 324.37 197.12 C 307.07 165.51 247.83 182.35 247.83 182.35 C 235.02 185.06 201.99 199.80 195.28 228.87 C 191.27 246.24 191.58 283.57 204.50 307.94 Z',
      'M 283.17 233.63 C 267.23 233.63 255.37 238.03 247.93 246.70 C 244.79 250.36 243.05 254.13 242.11 256.74 L 291.67 256.74 L 286.69 280.11 L 236.72 280.11 L 225.90 328.58 C 232.70 331.20 240.76 331.75 250.28 329.48 C 290.96 319.80 320.52 271.59 327.32 233.63 Z'
    ];
    function toShape(d) {
      var t = d.trim().split(/\s+/), s = new THREE.Shape(), i = 0;
      function P() { var x = +t[i++] - 259.5, y = -(+t[i++] - 255); return [x, y]; }
      while (i < t.length) {
        var c = t[i++];
        if (c === 'M') { var m = P(); s.moveTo(m[0], m[1]); }
        else if (c === 'L') { var l = P(); s.lineTo(l[0], l[1]); }
        else if (c === 'C') { var a = P(), b = P(), e = P(); s.bezierCurveTo(a[0], a[1], b[0], b[1], e[0], e[1]); }
        else if (c === 'Z') s.closePath();
      }
      return s;
    }
    var geo = new THREE.ExtrudeGeometry(PATHS.map(toShape), {
      depth: 16, bevelEnabled: true, bevelThickness: 3, bevelSize: 2.2,
      bevelSegments: mobile ? 3 : 6, curveSegments: mobile ? 18 : 36
    });
    geo.center(); geo.scale(1 / 42, 1 / 42, 1 / 42);
    // лицевая сторона — чистый фирменный жёлтый (эмиссия держит цвет), бока чуть темнее для объёма
    var faceMat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 0.62, metalness: 0.05, roughness: 0.35 });
    var sideMat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0x9a9a00, emissiveIntensity: 0.55, metalness: 0.2, roughness: 0.3 });
    var logo = new THREE.Mesh(geo, [faceMat, sideMat]);
    var logoG = new THREE.Group(); logoG.add(logo); scene.add(logoG);
    var ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.009, 8, 200), new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.55 }));
    var ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.004, 8, 200), new THREE.MeshBasicMaterial({ color: 0xf5f1ea, transparent: true, opacity: 0.16 }));
    ring2.rotation.x = 1.2; logoG.add(ring1, ring2);
    var logoEnd = new THREE.Group(); var le = logo.clone(); logoEnd.add(le); scene.add(logoEnd);

    /* --- пыль --- */
    var N = mobile ? 600 : 1600, pos = new Float32Array(N * 3);
    for (var i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 24; pos[i * 3 + 1] = (Math.random() - 0.5) * 16; pos[i * 3 + 2] = 8 - Math.random() * 90; }
    var pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var dust = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xfffbd0, size: 0.028, transparent: true, opacity: 0.6, depthWrite: false }));
    scene.add(dust);

    /* --- морфинг-форма InBody: сфера ↔ силуэт тела, сканирующая полоса --- */
    var NOISE = 'vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}float snoise(vec3 v){const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;i=mod289(i);vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}';
    var U = { uTime: { value: 0 }, uAmp: { value: 0.32 }, uFreq: { value: 1.1 }, uMorph: { value: 0 }, uScan: { value: 0 }, uWire: { value: 0.3 } };
    var VS = NOISE + 'uniform float uTime,uAmp,uFreq,uMorph;varying vec3 vN;varying vec3 vP;varying float vD;void main(){vec3 n=normalize(position);vec3 body=vec3(n.x*(0.72+0.28*abs(n.y))*(1.0-0.22*exp(-pow(n.y*3.0,2.0))),n.y*1.55,n.z*0.6);vec3 base=mix(n*1.3,body*1.3,uMorph);float d=snoise(base*uFreq+vec3(0.,uTime*.25,uTime*.12));vD=d;vec3 disp=base+n*d*uAmp*(1.0-uMorph*.6);vN=normalize(normalMatrix*n);vP=disp;gl_Position=projectionMatrix*modelViewMatrix*vec4(disp,1.);}';
    var FS = 'uniform float uScan,uTime;varying vec3 vN;varying vec3 vP;varying float vD;void main(){float fr=pow(1.-abs(vN.z),2.0);vec3 col=mix(vec3(.04,.04,.045),vec3(1.,1.,0.),fr);col+=vec3(1.,1.,0.)*smoothstep(.35,.9,vD)*.22;float sy=mix(-2.,2.,fract(uTime*.22));col+=vec3(1.,1.,.3)*smoothstep(.08,0.,abs(vP.y-sy))*uScan*1.4;gl_FragColor=vec4(min(col,vec3(1.)),1.);}';
    var blobG = new THREE.Group();
    blobG.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1, mobile ? 24 : 56), new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: FS })));
    blobG.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.03, mobile ? 10 : 18), new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, wireframe: true, transparent: true, depthWrite: false,
      fragmentShader: 'uniform float uWire;void main(){gl_FragColor=vec4(1.,1.,0.,.22*uWire);}' })));
    scene.add(blobG);

    /* --- раскладка объектов (десктоп: справа от текста; телефон: по центру сверху) --- */
    var B, L, E;
    function layout() {
      mobile = window.matchMedia('(max-width: 760px)').matches;
      L = mobile ? new THREE.Vector3(0, 1.35, 0) : new THREE.Vector3(2.5, 0.1, 0);
      B = mobile ? new THREE.Vector3(0, 1.5, -38) : new THREE.Vector3(2.3, 0, -38);
      E = mobile ? new THREE.Vector3(0, 1.2, -74) : new THREE.Vector3(2.5, 0, -74);
      logoG.position.copy(L); logoG.scale.setScalar(mobile ? 0.78 : 1);
      blobG.position.copy(B); blobG.scale.setScalar(mobile ? 0.8 : 1);
      logoEnd.position.copy(E); logoEnd.scale.setScalar(mobile ? 0.9 : 1.25);
    }

    /* --- станции камеры: по одной на раздел страницы; между ними — плавный перелёт --- */
    var V = function (x, y, z) { return new THREE.Vector3(x, y, z); };
    function stations() {
      if (mobile) return {
        top: [V(0, 0, 8.6), V(0, 0.55, 0)],
        about: [V(-1.6, 1.6, 4.2), V(0, 1.35, 0)],
        schedule: [V(0, 0.4, -4), V(0, 0, -14)],
        pricing: [V(0, 0.2, -9), V(0, 0, -19)],
        gallery: [V(0, 0.2, -14), V(0, 0, -24)],
        inbody: [V(0, 1.4, -32.4), V(0, 1.2, -38)],
        certificates: [V(-1.4, 1.8, -34), V(0, 1.3, -38.5)],
        testimonials: [V(0, 0, -46), V(0, 0, -56)],
        blog: [V(0, -0.3, -52), V(0, 0, -62)],
        faq: [V(0, 0, -58), V(0, 0, -68)],
        contact: [V(0, 0.9, -66.5), V(0, 0.9, -74)]
      };
      return {
        top: [V(0, 0, 7), V(0, 0, 0)],
        about: [V(4.6, 0.5, 4.4), V(5.6, 0.1, -1)],
        schedule: [V(0.4, 0.3, -4), V(0, 0, -14)],
        pricing: [V(0, 0.2, -9), V(0, 0, -19)],
        gallery: [V(0, 0.2, -14), V(0, 0, -24)],
        inbody: [V(0, 0.2, -31.5), V(0, 0, -38)],
        certificates: [V(-0.6, 0.8, -34), V(1.6, 0, -39)],
        testimonials: [V(0, 0, -46), V(0, 0, -56)],
        blog: [V(0, -0.3, -52), V(0, 0, -62)],
        faq: [V(0, 0, -58), V(0, 0, -68)],
        contact: [V(0, 0, -67), V(0, 0, -74)]
      };
    }
    // сколько раздела камера «держит» станцию, прежде чем лететь к следующей
    var HOLD = { top: 0.35 };
    var secEls = ['top', 'about', 'schedule', 'pricing', 'gallery', 'inbody', 'certificates', 'testimonials', 'blog', 'faq', 'contact']
      .map(function (id) { return document.getElementById(id); }).filter(Boolean);

    function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * x * (x * (x * 6 - 15) + 10); }
    var curPos = V(0, 0, 7), curLook = V(0, 0, 0), wantPos = V(0, 0, 7), wantLook = V(0, 0, 0);
    var mouse = { x: 0, y: 0, sx: 0, sy: 0 };
    window.addEventListener('pointermove', function (e) { mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5; }, { passive: true });

    var st = null;
    function state() {
      var vh = innerHeight, y = window.scrollY + vh * 0.5, cur = 0, k = 0;
      for (var i = secEls.length - 1; i >= 0; i--) {
        if (y >= secEls[i].offsetTop) {
          cur = i;
          var nextTop = i < secEls.length - 1 ? secEls[i + 1].offsetTop : secEls[i].offsetTop + secEls[i].offsetHeight;
          k = Math.max(0, Math.min(1, (y - secEls[i].offsetTop) / Math.max(1, nextTop - secEls[i].offsetTop)));
          break;
        }
      }
      var id = secEls[cur].id, hold = HOLD[id] != null ? HOLD[id] : 0.55;
      var nid = cur < secEls.length - 1 ? secEls[cur + 1].id : id;
      var tt = smooth((k - hold) / (1 - hold));
      wantPos.copy(st[id][0]).lerp(st[nid][0], tt);
      wantLook.copy(st[id][1]).lerp(st[nid][1], tt);
      return { id: id, k: k };
    }

    function resize() {
      var w = innerWidth, h = innerHeight;
      renderer.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 56 : 42; cam.updateProjectionMatrix();
      layout(); st = stations();
    }
    window.addEventListener('resize', resize); resize();
    curPos.copy(st.top[0]); curLook.copy(st.top[1]);

    var clock = new THREE.Clock(), running = true, inView = true;
    document.addEventListener('visibilitychange', function () { running = !document.hidden; if (running) { clock.getDelta(); loop(); } });

    function frame() {
      var dt = Math.min(clock.getDelta(), 0.05), t = reduce ? 0 : clock.elapsedTime;
      var s = state();
      var f = reduce ? 1 : Math.min(1, dt * 3.4);
      curPos.lerp(wantPos, f); curLook.lerp(wantLook, f);
      mouse.sx += (mouse.x - mouse.sx) * 0.05; mouse.sy += (mouse.y - mouse.sy) * 0.05;
      cam.position.copy(curPos); cam.position.x += mouse.sx * 0.5; cam.position.y -= mouse.sy * 0.35;
      cam.lookAt(curLook);

      // логотип: живое вращение + поворот от прокрутки
      logo.rotation.y = Math.sin(t * 0.35) * 0.6 + window.scrollY * 0.0012;
      logo.rotation.x = Math.sin(t * 0.25) * 0.12;
      logoG.position.y = L.y + Math.sin(t * 0.8) * 0.07;
      ring1.rotation.z = t * 0.2; ring2.rotation.z = -t * 0.12;
      le.rotation.y = Math.sin(t * 0.4) * 0.5 + 0.3;

      // форма InBody
      var on = s.id === 'inbody';
      U.uTime.value = t;
      U.uMorph.value += ((on ? 1 : 0) - U.uMorph.value) * 0.05;
      U.uScan.value += ((on ? 1 : 0) - U.uScan.value) * 0.08;
      U.uWire.value += ((on ? 1 : 0.3) - U.uWire.value) * 0.06;
      blobG.rotation.y = t * 0.15;

      dust.rotation.y = t * 0.01;
      renderer.render(scene, cam);
    }
    function loop() { if (!running) return; frame(); marquee(); requestAnimationFrame(loop); }
    loop();
  }
})();
