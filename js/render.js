// Отрисовка: замкнутый мир, кольцевая глубина, свет звезды, помехи.

const c = document.getElementById('c'), g = c.getContext('2d');
let VW = 0, VH = 0;
function size(){ VW = c.width = innerWidth; VH = c.height = innerHeight; }
addEventListener('resize', size); size();

// экран: кратчайший путь по тору + параллакс кольцевой глубины
function scr(x, y, z){
  const k = .40 + (1 - Math.min(1, Math.abs(zd(z, drone.z))*1.6)) * .85;
  return [wrapD(x - cam.x, W)*k + VW/2, wrapD(y - cam.y, H)*k + VH/2, k];
}
const fog = z => Math.max(0, 1 - Math.abs(zd(z, drone.z))*ZFOG);
const vis = (x, y, m) => x > -m && x < VW + m && y > -m && y < VH + m;

// освещённость точки: звезда + фонарь дрона + подсветка MOUNT
function lit(x, y, ang){
  let l = starLight(x, y)*.9;
  if(mouse.down && drone.pwr > 0){
    const d = dist(x, y, drone.x, drone.y);
    if(d < 640){
      const pa = Math.atan2(wrapD(y - drone.y, H), wrapD(x - drone.x, W));
      if(Math.abs(wrapD(pa - ang, 6.2832)) < .5) l += (1 - d/640)*1.1;
    }
  }
  return l;
}

function draw(){
  const deep = drone.y/H, mounted = now < mountUntil;
  const lightAng = Math.atan2(mouse.y - VH/2, mouse.x - VW/2);
  const starK = starLight(drone.x, drone.y);
  // вступительный сектор — мелкий и светлый, туда падает свет «сверху»
  const bootK = zoneAt(drone.y) === 'BOOT SECTOR' ? 1 - drone.y/GATE_Y*.55 : 0;

  g.fillStyle = phase === 'OVERHEAT' ? '#0a0806'
    : `rgb(${4 + deep*4 + starK*26 + bootK*46},${13 - deep*8 + starK*18 + bootK*76},${10 + deep*12 + starK*8 + bootK*66})`;
  g.fillRect(0, 0, VW, VH);
  if(bootK > 0){                                   // столбы света с поверхности
    const [, sy] = scr(0, 0, drone.z);
    const grd = g.createLinearGradient(0, sy, 0, sy + 1400);
    grd.addColorStop(0, `rgba(190,255,230,${.16*bootK})`);
    grd.addColorStop(1, 'rgba(190,255,230,0)');
    g.fillStyle = grd; g.fillRect(0, sy, VW, 1400);
    for(let i = 0; i < 7; i++){
      const x = ((i*1700 + 400) - cam.x*.5) % VW;
      g.globalAlpha = .05*bootK; g.fillStyle = '#dfffef';
      g.fillRect(x < 0 ? x + VW : x, sy, 90 + Math.sin(now*.6 + i)*20, 1400);
    }
    g.globalAlpha = 1;
  }
  g.save();
  if(shake) g.translate((Math.random()-.5)*shake, (Math.random()-.5)*shake);
  g.font = '12px Consolas, monospace';

  drawStar();

  // волна индексации
  if(waveY > -1e4){
    const [, wy] = scr(0, waveY, drone.z);
    const grd = g.createLinearGradient(0, wy-240, 0, wy+240);
    grd.addColorStop(0, 'rgba(120,220,170,0)');
    grd.addColorStop(.5, 'rgba(120,220,170,.24)');
    grd.addColorStop(1, 'rgba(120,220,170,0)');
    g.fillStyle = grd; g.fillRect(0, wy-240, VW, 480);
  }

  // частицы (взвесь, искры, обломки)
  for(const p of parts){
    if(p.life <= 0) continue;
    const a = fog(p.z)*(p.life/p.max); if(a <= .03) continue;
    const [x, y, k] = scr(p.x, p.y, p.z);
    if(!vis(x, y, 20)) continue;
    g.globalAlpha = a*.8; g.fillStyle = p.col;
    g.fillRect(x, y, p.s*k, p.s*k);
  }

  drawHavens();
  drawGate();
  drawProps(lightAng, mounted);
  drawWrecks();
  drawRecords();
  drawCreatures();
  drawWhales();
  drawGhosts();
  drawNulls();
  drawIndexer();
  drawHunters();

  // обрывки данных
  for(const l of labels){
    const age = (now - l.t)/8, a = fog(l.z)*(1 - age);
    if(a <= .02) continue;
    const [x, y] = scr(l.x, l.y, l.z);
    if(!vis(x, y, 140)) continue;
    g.globalAlpha = a*.9; g.fillStyle = TEXT_COLOR[l.cat] || '#bff4d8';
    g.fillText(l.s, x + 12, y - 12 - age*20);
  }

  // обучающие объекты
  for(const t of TEACHERS){
    const a = fog(t.z); if(a <= .02) continue;
    const [x, y, k] = scr(t.x, t.y, t.z);
    if(!vis(x, y, 100)) continue;
    const got = save.cmds.includes(t.cmd);
    g.globalAlpha = a*(got ? .4 : .95); g.strokeStyle = got ? '#4a2b42' : QCOL;
    g.lineWidth = got ? 1.2 : 2;
    g.strokeRect(x - 48*k, y - 17*k, 96*k, 34*k);
    g.beginPath(); g.arc(x, y, (54 + Math.sin(now*2)*6)*k, 0, 6.29); g.stroke();
    g.fillStyle = got ? '#7d3568' : QCOL_HOT; g.globalAlpha = a*(got ? .5 : .85);
    g.fillText(t.label, x - 34*k, y + 4*k);
  }

  drawFrags();

  // импульсы сканирования
  for(const p of pulses){
    const [x, y, k] = scr(p.x, p.y, p.z);
    g.globalAlpha = Math.max(0, 1 - p.r/1400)*.5; g.strokeStyle = '#bff4d8'; g.lineWidth = 1;
    g.beginPath(); g.arc(x, y, p.r*k, 0, 6.29); g.stroke();
  }

  drawBlips();
  drawPing();

  // стена очистки
  if(purgeY > -1e4){
    const [, py] = scr(0, purgeY, drone.z);
    g.globalAlpha = .92;
    const grd = g.createLinearGradient(0, py-320, 0, py);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(1, 'rgba(230,240,235,.85)');
    g.fillStyle = grd; g.fillRect(0, py-320, VW, 320);
    g.fillStyle = '#e6f0eb'; g.fillRect(0, py, VW, VH);
  }

  drawBeam();
  drawDrone(lightAng);
  g.restore();
  havenVeil();
  overlay();
  drawToasts();
  if(mapOpen) drawMap();
  hud();
}

// ---- журнал: не карта и не квестлог. слева — что понято, справа — что нет ----
// Открытые вопросы и есть вся навигация игры: непонятое указывает, куда плыть.
function openQuestions(){
  return QUESTIONS.filter(q => !knows(q.id) && q.need.every(knows));
}

function drawMap(){
  g.globalAlpha = .95; g.fillStyle = '#04070a'; g.fillRect(0, 0, VW, VH);
  g.font = '12px Consolas, monospace';
  const L = 46, R = VW/2 + 20, wrapAt = Math.max(30, Math.floor((VW/2 - 90)/7));

  // перенос по словам: длинные строки улик иначе уезжают за середину экрана
  const lines = s => {
    const out = []; let cur = '';
    for(const w of s.split(' ')){
      if((cur + ' ' + w).trim().length > wrapAt){ out.push(cur); cur = w; }
      else cur = (cur ? cur + ' ' : '') + w;
    }
    if(cur) out.push(cur);
    return out;
  };

  g.globalAlpha = .85; g.fillStyle = '#8fb89b';
  g.fillText('ЖУРНАЛ PING-7 — то, до чего дошёл я, а не то, что мне выдали.', L, 34);
  g.fillText('ЦИКЛ #' + save.cycles + '   ОБЛАСТИ ' + save.zones.length + '/' + ZONES.length +
             '   ОБЛОМКИ ' + save.wrecks.length + '/' + WRECKS.length +
             '   КАДРЫ ' + save.photos.length + '/' + PHOTOS.length +
             '   ФРАГМЕНТЫ ' + delivered() + '/' + FRAGS.length, L, 54);

  g.globalAlpha = .55; g.fillStyle = '#6fd6a4'; g.fillText('ИЗВЕСТНО', L, 92);
  let y = 116;
  for(const c of CLUES){
    if(!knows(c.id)) continue;
    g.globalAlpha = c.core ? 1 : .68; g.fillStyle = c.core ? '#dffbec' : '#9fc9ae';
    for(const ln of lines((c.core ? '▸ ' : '· ') + c.t)){ g.fillText(ln, L, y); y += 17; }
    y += 5;
  }
  if(y === 116){ g.globalAlpha = .35; g.fillStyle = '#6fd6a4';
                 g.fillText('· пока ничего. я только что открыл глаза.', L, y); }

  g.globalAlpha = .55; g.fillStyle = '#ffd27f'; g.fillText('НЕ ЗНАЮ', R, 92);
  y = 116;
  for(const q of openQuestions()){
    g.globalAlpha = .9; g.fillStyle = '#ffd27f';
    for(const ln of lines('? ' + q.q)){ g.fillText(ln, R, y); y += 17; }
    y += 5;
  }
  if(!openQuestions().length){
    g.globalAlpha = .9; g.fillStyle = '#ffe9b0';
    for(const ln of lines('вопросов не осталось. в ядре, при перегреве, ' +
                          'процесс можно снять.')){ g.fillText(ln, R, y); y += 17; }
  }

  g.globalAlpha = .4; g.fillStyle = '#8fb89b';
  g.fillText('M — закрыть', L, VH - 26);
  g.globalAlpha = 1;
}

// ---- звезда ----
function drawStar(){
  const a = fog(STAR.z), [x, y, k] = scr(STAR.x, STAR.y, STAR.z);
  const d = dist(drone.x, drone.y, STAR.x, STAR.y);
  if(d > STAR.R*2.2) return;
  // корона садится с каждым сданным фрагментом: «рост мира» она платит собой
  const R = (420 + Math.sin(now*.7)*20 + starPulse*260) * k * (1 - delivered()*STAR_DIM);
  const grd = g.createRadialGradient(x, y, 0, x, y, R*3.2);
  const core = coreOpen ? '255,240,200' : '255,225,160';
  grd.addColorStop(0,   `rgba(${core},${.55*(a*.5+.5)})`);
  grd.addColorStop(.25, `rgba(${core},${.18*(a*.5+.5)})`);
  grd.addColorStop(1,   'rgba(40,70,60,0)');
  g.globalAlpha = 1; g.fillStyle = grd;
  g.beginPath(); g.arc(x, y, R*3.2, 0, 6.29); g.fill();

  g.globalAlpha = .5 + a*.5; g.strokeStyle = '#ffe9b0'; g.lineWidth = 1.4;
  for(let i = 0; i < 3; i++){                            // кольца системных процессов
    const rr = R*(.55 + i*.28), rot = now*(.12 + i*.07)*(i%2?-1:1);
    g.beginPath();
    for(let s = 0; s <= 28; s++){
      const an = rot + s/28*6.2832, r2 = rr*(1 + Math.sin(an*6 + now)*.04);
      s ? g.lineTo(x + Math.cos(an)*r2, y + Math.sin(an)*r2*.42)
        : g.moveTo(x + Math.cos(an)*r2, y + Math.sin(an)*r2*.42);
    }
    g.closePath(); g.stroke();
  }
  // вблизи внутри короны проступает то, чем звезда была: раскрытый корпус дрона
  // размером с гору. видно только если подойти — издалека это просто свет.
  if(d < 2600){
    const v = (1 - d/2600) * (save.records.includes(STAR_LOG.id) ? 1 : .55);
    const S = R*.62;
    g.globalAlpha = v*.5; g.strokeStyle = '#8a6a3a'; g.lineWidth = 2.4;
    g.beginPath();                                       // корпус: тот же силуэт, что у дрона
    g.arc(x, y, S*.34, 0, 6.29);
    g.moveTo(x - S*.9, y); g.lineTo(x + S*.9, y);
    g.stroke();
    g.globalAlpha = v*.35; g.lineWidth = 1.6;
    g.beginPath();                                       // створки раскрытого ядра
    for(const s of [-1, 1]){
      g.moveTo(x + s*S*.34, y - S*.1);
      g.lineTo(x + s*S*.78, y - S*.46);
      g.lineTo(x + s*S*.78, y + S*.46);
      g.lineTo(x + s*S*.34, y + S*.1);
    }
    g.stroke();
    if(!save.records.includes(STAR_LOG.id)){              // подойти вплотную и посветить
      const pul = .55 + Math.sin(now*2.6)*.45;
      g.globalAlpha = v*(.35 + pul*.5); g.strokeStyle = QCOL; g.lineWidth = 2.2;
      g.beginPath(); g.arc(x, y, S*(.42 + pul*.06), 0, 6.29); g.stroke();
      if(d < 700){
        g.globalAlpha = .4 + pul*.5; g.fillStyle = QCOL_HOT;
        g.fillText('ЯДРО', x - 15, y - S*.6);
      }
    }
  }
  if(carry.length){                                      // куда нести
    g.globalAlpha = .7; g.fillStyle = '#ffe9b0';
    g.fillText('СДАТЬ ФРАГМЕНТ: ' + carry.join(' '), x - 90, y - R*.75);
  }
  if(coreOpen) for(const n of nodes()){
    const free = n.id.endsWith('PROCESS 1');
    const nx = x + n.dx*k;
    g.globalAlpha = 1; g.strokeStyle = free ? '#bff4d8' : '#ffe9b0'; g.lineWidth = 1.8;
    g.strokeRect(nx - 84*k, y - 24*k, 168*k, 48*k);
    g.fillStyle = free ? '#bff4d8' : '#ffe9b0'; g.fillText(n.id, nx - 74*k, y + 4*k);
  }
}

// ---- обломки предшественников: ориентиры, видные раньше, чем читаются ----
function drawWrecks(){
  for(const w of WRECKS){
    const got = save.wrecks.includes(w.id), a = fog(w.z);
    const d = dist(w.x, w.y, drone.x, drone.y);
    if(d > 6000) continue;
    const pul = 1 + Math.sin(now*2.2)*.07;
    const [x, y, k] = scr(w.x, w.y, w.z), s = 150*k*(got ? 1 : pul);
    if(!vis(x, y, s + 200)) continue;
    // силуэт читается и сквозь туман слоёв: это ориентир, а не мелочь
    g.globalAlpha = Math.max(a, .18)*(got ? .35 : .9);
    g.strokeStyle = got ? '#4a2b42' : QCOL; g.lineWidth = got ? 1.6 : 2.4;
    g.beginPath();
    g.arc(x, y, s*.30, 0, 6.29);                        // тот же силуэт, что у тебя
    g.moveTo(x - s*.8, y); g.lineTo(x + s*.8, y);
    g.stroke();
    g.beginPath(); g.lineWidth = 1.4;                   // вскрытые створки корпуса
    for(const sg of [-1, 1]){
      g.moveTo(x + sg*s*.30, y - s*.08);
      g.lineTo(x + sg*s*.72, y - s*.42);
      g.lineTo(x + sg*s*.72, y + s*.42);
      g.lineTo(x + sg*s*.30, y + s*.08);
    }
    g.stroke();
    g.globalAlpha = Math.max(a, .12)*(got ? .2 : .5);   // обломки вокруг, осевшие на дно
    for(let i = 0; i < 9; i++){
      const an = w.z*40 + i*.7, r = s*(1.1 + (i%3)*.35);
      g.strokeRect(x + Math.cos(an)*r, y + Math.sin(an)*r*.5, 8*k, 6*k);
    }
    if(!got){
      g.globalAlpha = Math.max(a, .3)*.85; g.fillStyle = QCOL_HOT;
      g.fillText('СЛОЙ ' + String(Math.round(w.z*ZLAYERS)).padStart(2,'0'), x - 24, y - s*.6);
      g.globalAlpha = Math.max(a, .2)*.35; g.strokeStyle = QCOL;   // тут ещё есть питание
      for(let i = 0; i < 2; i++){
        const rr = s*2.4 - ((now*90 + i*s) % (s*1.8));
        g.beginPath(); g.arc(x, y, Math.max(s*.9, rr), 0, 6.29); g.stroke();
      }
    }
  }
}

// ---- объекты ----
function drawProps(lightAng, mounted){
  for(let i = 0; i < nProps; i++){
    const p = props[i];
    if(p.dead) continue;
    let a = fog(p.z); if(mounted) a = Math.max(a, .3);
    if(a <= .02) continue;
    const [x, y0, k] = scr(p.x, p.y, p.z), s = p.s*k;
    if(!vis(x, y0, s + 70)) continue;
    const y = y0 + Math.sin(p.bob)*3*k;                 // лёгкое покачивание
    const L = lit(p.x, p.y, lightAng), awake = p.wake > .05;

    g.globalAlpha = Math.min(1, a*(.35 + L*.75 + p.wake*.6 + (p.glow ? .5 : 0)));
    g.lineWidth = awake ? 1.7 : 1;
    g.strokeStyle = awake ? '#dffbec' : p.tint || PALETTE[p.kind];
    g.beginPath();
    switch(p.kind){
      case 'folder': {
        const o = p.wake*s*.35;
        g.rect(x - s/2, y - s/3, s, s*.66);
        g.moveTo(x - s/2, y - s/3 - o); g.lineTo(x, y - s/2 - o); g.lineTo(x + s/2, y - s/3 - o);
        break; }
      case 'window':
        g.rect(x - s/2, y - s/3, s, s*.66);
        g.moveTo(x - s/2, y - s/3 + 9*k); g.lineTo(x + s/2, y - s/3 + 9*k);
        if(awake) for(let j = 0; j < 5; j++){
          const yy = y - s/4 + j*s*.11;
          g.moveTo(x - s/2 + 6, yy); g.lineTo(x - s/2 + 6 + Math.random()*s*.85, yy);
        }
        break;
      case 'monolith':                                   // монумент-препятствие
        g.rect(x - s*.32, y - s*.6, s*.64, s*1.2);
        g.moveTo(x - s*.32, y - s*.3); g.lineTo(x + s*.32, y - s*.3);
        g.moveTo(x - s*.32, y + s*.3); g.lineTo(x + s*.32, y + s*.3);
        break;
      case 'cursor': {
        const an = p.a;
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(an)*s*.5, y + Math.sin(an)*s*.5);
        g.lineTo(x + Math.cos(an+.5)*s*.32, y + Math.sin(an+.5)*s*.32);
        g.closePath(); break; }
      case 'board':
        g.rect(x - s/2, y - s/2, s, s);
        g.moveTo(x - s/2, y); g.lineTo(x + s/2, y);
        g.moveTo(x, y - s/2); g.lineTo(x, y + s/2);
        break;
      case 'cable': {
        const amp = (10 + p.wake*24)*k;
        g.moveTo(x - s, y);
        for(let j = -s; j < s; j += 12) g.lineTo(x + j, y + Math.sin((j + p.a*40 + now*22)/22)*amp);
        break; }
      case 'chip':
        g.rect(x - s*.4, y - s*.4, s*.8, s*.8);
        for(let j = 0; j < 4; j++){
          const yy = y - s*.3 + j*s*.2;
          g.moveTo(x - s*.55, yy); g.lineTo(x - s*.4, yy);
          g.moveTo(x + s*.4, yy);  g.lineTo(x + s*.55, yy);
        }
        break;
      case 'psu': {                                      // энергоузел: медленно дышит
        const spent = p.spent;                           // вскрыт светом — пуст до конца цикла
        const sw = spent ? .05 : nodeSwell(p);           // 0..1 — он же множитель отдачи
        const r = s*.16*(1 + sw*1.4);
        g.arc(x, y, r, 0, 6.29);
        g.moveTo(x - r*1.6, y); g.lineTo(x + r*1.6, y);
        g.moveTo(x, y - r*1.6); g.lineTo(x, y + r*1.6);
        g.stroke();
        // ореол только у набравших вес и только вблизи: градиент на каждый узел в кадре
        // был вторым по стоимости после теней убежищ
        if(!spent && sw > .25 && a > .3){
          const gr = g.createRadialGradient(x, y, r*.4, x, y, r*3.4);
          gr.addColorStop(0, `rgba(255,210,127,${.10 + sw*.28})`);
          gr.addColorStop(1, 'rgba(255,210,127,0)');
          g.globalAlpha = a; g.fillStyle = gr;
          g.beginPath(); g.arc(x, y, r*3.4, 0, 6.29); g.fill();
        }
        g.beginPath();
        break; }
      case 'photo': {                                    // объёмный кадр: цвет виден изнутри
        const w = s*.45, hh = s*.32, seen = save.photos.includes(p.photo.id);
        g.rect(x - w, y - hh, w*2, hh*2);
        g.moveTo(x - w, y - hh); g.lineTo(x - w*.7, y - hh*1.5); g.lineTo(x + w*1.3, y - hh*1.5);
        g.lineTo(x + w, y - hh);
        g.stroke();
        // цвет проступает полосами развёртки, а не сплошной заливкой
        const inten = seen ? .30 : .07 + p.wake*.5;
        g.fillStyle = p.photo.col;
        for(let yy = -hh + 2; yy < hh - 2; yy += 4){
          g.globalAlpha = a*inten*(.45 + Math.abs(Math.sin(yy*.4 + p.bob))*.55);
          g.fillRect(x - w + 3, y + yy, w*2 - 6, 2);
        }
        g.globalAlpha = a*.55; g.fillStyle = '#05070a';
        for(let j = 0; j < 18; j++)                       // выбитые куски изображения
          g.fillRect(x - w + Math.random()*w*2, y - hh + Math.random()*hh*2, 7*k, 5*k);
        g.beginPath();
        break; }
      case 'frame':
        g.rect(x - s*.5, y - s*.36, s, s*.72);
        g.rect(x - s*.42, y - s*.28, s*.84, s*.56);
        break;
      case 'pillar':
        g.rect(x - s*.2, y - s*.7, s*.4, s*1.4);
        for(let j = 0; j < 5; j++){
          const yy = y - s*.6 + j*s*.3;
          g.moveTo(x - s*.28, yy); g.lineTo(x + s*.28, yy);
        }
        break;
      case 'packet':                                       // пакет данных
        g.rect(x - s*.3, y - s*.18, s*.6, s*.36);
        g.moveTo(x - s*.3, y - s*.18); g.lineTo(x, y); g.lineTo(x + s*.3, y - s*.18);
        break;
      case 'beacon': {                                     // маяк исчезнувшей сети
        const r = s*.22*(1 + Math.sin(now*2 + p.bob)*.2);
        g.arc(x, y, r, 0, 6.29);
        for(let j = 1; j <= 3; j++){
          const rr = r + j*14*k + (now*22 % (14*k));
          g.moveTo(x + rr, y); g.arc(x, y, rr, 0, 6.29);
        }
        break; }
      case 'ruin':                                         // обломок кэшированного города
        g.rect(x - s*.45, y - s*.5, s*.9, s);
        g.moveTo(x - s*.45, y - s*.2); g.lineTo(x + s*.45, y - s*.2);
        g.moveTo(x - s*.15, y - s*.5); g.lineTo(x - s*.15, y + s*.5);
        for(let j = 0; j < 6; j++){
          const wx = x - s*.35 + (j%3)*s*.3, wy = y - s*.4 + ((j/3)|0)*s*.5;
          g.rect(wx, wy, s*.12, s*.16);
        }
        break;
      case 'trash':
        g.moveTo(x - s*.35, y - s*.3); g.lineTo(x + s*.35, y - s*.3);
        g.lineTo(x + s*.25, y + s*.4); g.lineTo(x - s*.25, y + s*.4); g.closePath();
        break;
      case 'block':
        g.rect(x - s*.5, y - s*.35, s, s*.7);
        g.moveTo(x - s*.5, y - s*.35); g.lineTo(x + s*.5, y + s*.35);
        break;
      case 'tape': {
        for(let j = 0; j < 20; j++){
          const an = p.a + j*.5, r = s*.06*j;
          j ? g.lineTo(x + Math.cos(an)*r, y + Math.sin(an)*r*.5)
            : g.moveTo(x + Math.cos(an)*r, y + Math.sin(an)*r*.5);
        }
        break; }
      default: {                                         // shard / anomaly
        const spin = p.a + now*(p.kind === 'anomaly' ? .4 : p.wake*.6);
        const pts = p.kind === 'anomaly' ? 7 : 5;
        for(let j = 0; j < pts; j++){
          const an = spin + j*6.2832/pts, r = s*.4*(j % 2 ? .5 : 1);
          j ? g.lineTo(x + Math.cos(an)*r, y + Math.sin(an)*r)
            : g.moveTo(x + Math.cos(an)*r, y + Math.sin(an)*r);
        }
        g.closePath();
      }
    }
    g.stroke();
    if(p.solid && Math.abs(zd(p.z, drone.z)) < ZSOLID){  // твёрдое на твоём слое
      g.globalAlpha = a*.25; g.strokeStyle = '#ff8f8f'; g.lineWidth = 1;
      g.beginPath(); g.arc(x, y, p.s*.5*k + 8, 0, 6.29); g.stroke();
    }
  }
}

function drawCreatures(){
  for(let i = 0; i < nLife; i++){
    const cr = creatures[i], a = fog(cr.z);
    if(a <= .03) continue;
    const [x, y, k] = scr(cr.x, cr.y, cr.z);
    if(!vis(x, y, 100)) continue;
    g.lineWidth = 1;
    if(cr.kind === 'null'){                              // нулевое существо: дыра в шуме
      g.globalAlpha = a*.9; g.fillStyle = '#05070a';
      g.beginPath(); g.arc(x, y, 46*k, 0, 6.29); g.fill();
      g.globalAlpha = a*.18; g.strokeStyle = '#8fb89b';
      g.beginPath(); g.arc(x, y, 46*k, 0, 6.29); g.stroke();
      continue;
    }
    g.globalAlpha = a*(cr.kind === 'eel' ? .45 : .8);
    g.strokeStyle = cr.kind === 'exception' ? '#d8f7a0' : cr.kind === 'ray' ? '#69c6a4' : '#cfe8d6';
    g.beginPath();
    if(cr.kind === 'exception'){
      const s = 9*k; g.rect(x-s, y-s, s*2, s*2); g.moveTo(x-s, y-s); g.lineTo(x+s, y+s);
    } else if(cr.kind === 'ray'){
      const s = 46*k, f = Math.sin(cr.p*2)*8*k;
      g.moveTo(x-s, y); g.quadraticCurveTo(x, y - s*.4 - f, x+s, y);
      g.quadraticCurveTo(x, y + s*.5 + f, x-s, y);
    } else {
      g.moveTo(x, y);
      for(let j = 1; j < 14; j++) g.lineTo(x - j*7*k, y + Math.sin(cr.p*2 + j*.5)*9*k);
    }
    g.stroke();
  }
}

// защищённые страницы памяти: круги тишины, видны издалека как тёплая аура
function drawHavens(){
  for(const hv of HAVENS){
    const d = dist(hv.x, hv.y, drone.x, drone.y);
    if(d > hv.r + 4200) continue;
    const [x, y, k] = scr(hv.x, hv.y, drone.z);
    const R = hv.r*k, inside = d < hv.r;
    const pulse = .5 + Math.sin(now*.9)*.5;

    // тёплая толща: плотнее к центру, с чётко читаемым краем
    const grd = g.createRadialGradient(x, y, 0, x, y, R);
    grd.addColorStop(0,   `rgba(150,232,200,${.20 + pulse*.05})`);
    grd.addColorStop(.55, `rgba(130,220,190,${.11 + pulse*.03})`);
    grd.addColorStop(.88, `rgba(120,210,180,${.09 + pulse*.04})`);
    grd.addColorStop(1,   'rgba(110,200,170,0)');
    g.globalAlpha = 1; g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, R, 0, 6.29); g.fill();

    // Свечение границы делаем двойной обводкой, а не shadowBlur: размытие тени на
    // окружности радиусом за тысячу пикселей — самая дорогая операция в кадре,
    // и именно она роняла fps в убежищах.
    g.beginPath();
    for(let s = 0; s <= 48; s++){
      const an = s/48*6.2832, rr = R*(1 + Math.sin(an*5 + now*.8)*.012);
      s ? g.lineTo(x + Math.cos(an)*rr, y + Math.sin(an)*rr)
        : g.moveTo(x + Math.cos(an)*rr, y + Math.sin(an)*rr);
    }
    g.closePath();
    g.globalAlpha = inside ? .28 : .18; g.strokeStyle = '#9fe8c4'; g.lineWidth = 9;
    g.stroke();
    g.globalAlpha = inside ? .85 : .55; g.strokeStyle = '#b6f2d6'; g.lineWidth = inside ? 2.6 : 2;
    g.stroke();

    if(d < hv.r + 1800){                            // круги на воде — только когда уже подплыл
      g.globalAlpha = .22; g.strokeStyle = '#9fe8c4'; g.lineWidth = 1;
      for(let i = 0; i < 3; i++){
        const rr = R - ((now*40 + i*R/3) % R);
        g.beginPath(); g.arc(x, y, Math.max(4, rr), 0, 6.29); g.stroke();
      }
    }
  }
}

// внутри убежища: мягкая зелёная вуаль по краям кадра — «здесь можно выдохнуть»
function havenVeil(){
  if(!haven) return;
  const k = 1 - dist(drone.x, drone.y, haven.x, haven.y)/haven.r;
  const grd = g.createRadialGradient(VW/2, VH/2, VH*.3, VW/2, VH/2, VH*.95);
  grd.addColorStop(0, 'rgba(120,220,180,0)');
  grd.addColorStop(1, `rgba(120,220,180,${.10 + k*.10})`);
  g.globalAlpha = 1; g.fillStyle = grd; g.fillRect(0, 0, VW, VH);
}

// мембрана под сектором загрузки: пока не найден RECORD_0
function drawGate(){
  const broken = save.intro, age = now - gateBreak;
  if(broken && age > 4) return;
  const [, gy] = scr(0, GATE_Y - 120, drone.z);
  if(gy < -200 || gy > VH + 200) return;
  const a = broken ? Math.max(0, 1 - age/4) : 1;
  g.globalAlpha = a*.5; g.strokeStyle = '#8fd8ff'; g.lineWidth = 1.4;
  g.beginPath();
  for(let x = 0; x <= VW; x += 14){
    const yy = gy + Math.sin(x*.012 + now*1.4)*7 + (broken ? Math.random()*age*22 : 0);
    x ? g.lineTo(x, yy) : g.moveTo(x, yy);
  }
  g.stroke();
  g.globalAlpha = a*.10;
  const grd = g.createLinearGradient(0, gy, 0, gy + 160);
  grd.addColorStop(0, 'rgba(143,216,255,.5)'); grd.addColorStop(1, 'rgba(143,216,255,0)');
  g.fillStyle = grd; g.fillRect(0, gy, VW, 160);
}

// записи: вступительная и лорные
function drawRecords(){
  for(const r of RECORDS){
    const got = save.records.includes(r.id), a = fog(r.z);
    if(a <= .02) continue;
    const [x, y, k] = scr(r.x, r.y, r.z);
    if(!vis(x, y, 120)) continue;
    const pulse = 1 + Math.sin(now*2.4)*.14;
    g.globalAlpha = a*(got ? .3 : .95);
    g.strokeStyle = got ? '#4a2b42' : QCOL; g.lineWidth = got ? 1.4 : 2;
    g.beginPath();                                   // катушка
    g.arc(x, y, 26*k*pulse, 0, 6.29); g.stroke();
    g.beginPath(); g.arc(x, y, 9*k, 0, 6.29); g.stroke();
    if(!got){
      g.globalAlpha = a*.35;
      for(let i = 1; i <= 3; i++){
        g.beginPath(); g.arc(x, y, (26 + i*16)*k*pulse, 0, 6.29); g.stroke();
      }
      g.globalAlpha = a*.85; g.fillStyle = QCOL_HOT;
      g.fillText(r.id, x - 26*k, y - 44*k);
    }
  }
}

// призраки прошлых циклов: сам себе, только медленнее и с подвисаниями
function drawGhosts(){
  for(const gh of ghosts){
    const a = fog(gh.z)*(.5 - gh.i*.12);
    if(a <= .03) continue;
    const [x, y, k] = scr(gh.x, gh.y, gh.z);
    if(!vis(x, y, 90)) continue;
    const jit = gh.lag > 0 ? 5 : 1;
    const jx = (Math.random()-.5)*jit*3, jy = (Math.random()-.5)*jit*3;
    if(gh.lit){                                       // прошлый ты тоже светил
      g.globalAlpha = a*.25; g.fillStyle = '#9fe8c4';
      g.beginPath(); g.arc(x + jx, y + jy, 60*k, 0, 6.29); g.fill();
    }
    g.globalAlpha = a; g.strokeStyle = '#9fe8c4'; g.lineWidth = 1.2;
    g.beginPath(); g.arc(x + jx, y + jy, 7*k, 0, 6.29);
    g.moveTo(x + jx - 13*k, y + jy); g.lineTo(x + jx + 13*k, y + jy); g.stroke();
    g.globalAlpha = a*.5;                             // ступенчатый шлейф записи
    for(let i = 1; i <= 4; i++)
      g.strokeRect(x + jx - 2 - i*4, y + jy - 2 + i*2, 4, 4);
  }
}

// пожиратель пустоты: дыра, которую видно только по искажению
function drawNulls(){
  for(const n of nulls){
    const a = fog(n.z); if(a <= .04) continue;
    const [x, y, k] = scr(n.x, n.y, n.z);
    if(!vis(x, y, 200)) continue;
    const R = (90 + Math.sin(now*1.7)*8)*k;
    g.globalAlpha = a*.95; g.fillStyle = '#03050a';
    g.beginPath(); g.arc(x, y, R, 0, 6.29); g.fill();
    g.globalAlpha = a*(.12 + n.seen*.5); g.strokeStyle = n.seen > .3 ? '#8f9fff' : '#5f6f8a';
    g.lineWidth = 1;
    for(let i = 0; i < 3; i++){                       // рябь по краю дыры
      g.beginPath();
      for(let s = 0; s <= 24; s++){
        const an = s/24*6.2832, rr = R*(1.04 + i*.10 + Math.sin(an*7 + now*3 + i)*.04);
        s ? g.lineTo(x + Math.cos(an)*rr, y + Math.sin(an)*rr)
          : g.moveTo(x + Math.cos(an)*rr, y + Math.sin(an)*rr);
      }
      g.closePath(); g.stroke();
    }
  }
}

// индексатор: строка развёртки, режет по своей глубине
function drawIndexer(){
  if(!indexer) return;
  const [, iy] = scr(0, indexer.y, drone.z);
  const near = Math.abs(zd(indexer.z, drone.z)) < .12;
  g.globalAlpha = near ? .5 : .16;
  const grd = g.createLinearGradient(0, iy - INDEXER_W*.3, 0, iy + INDEXER_W*.3);
  grd.addColorStop(0, 'rgba(120,220,255,0)');
  grd.addColorStop(.5, near ? 'rgba(160,240,255,.5)' : 'rgba(120,200,220,.2)');
  grd.addColorStop(1, 'rgba(120,220,255,0)');
  g.fillStyle = grd; g.fillRect(0, iy - INDEXER_W*.3, VW, INDEXER_W*.6);
  g.globalAlpha = near ? .8 : .25; g.strokeStyle = '#a0f0ff'; g.lineWidth = 1;
  g.beginPath();
  for(let x = 0; x <= VW; x += 8){
    const yy = iy + Math.sin(x*.05 + now*9)*(near ? 6 : 2);
    x ? g.lineTo(x, yy) : g.moveTo(x, yy);
  }
  g.stroke();
}

// архивный кит: гора сжатых файлов, проходящая мимо
function drawWhales(){
  for(const wh of whales){
    const a = fog(wh.z); if(a <= .04) continue;
    const [x, y, k] = scr(wh.x, wh.y, wh.z), s = WHALE.size*k;
    if(!vis(x, y, s)) continue;
    g.globalAlpha = a*.5; g.strokeStyle = '#7ea89a'; g.lineWidth = 1.6;
    g.beginPath();                                   // тело
    g.moveTo(x - s*.5, y);
    g.quadraticCurveTo(x - s*.1, y - s*.22, x + s*.5, y - s*.04);
    g.quadraticCurveTo(x + s*.62, y + s*.06, x + s*.42, y + s*.12);
    g.quadraticCurveTo(x - s*.1, y + s*.26, x - s*.5, y);
    g.closePath(); g.stroke();
    g.globalAlpha = a*.28;                            // сжатые блоки внутри
    for(let i = 0; i < 26; i++){
      const px = x - s*.42 + ((i*137)%100)/100*s*.84;
      const py = y - s*.12 + Math.sin(i*2.3 + wh.p)*s*.1;
      g.strokeRect(px, py, 9*k, 6*k);
    }
    g.globalAlpha = a*.6; g.fillStyle = '#7ea89a';
    g.fillText('ARCHIVE ' + (wh.dir > 0 ? '→' : '←') + '  ~' + (1 + (wh.p|0)%9) + ',2 ГБ', x - s*.4, y - s*.24);
  }
}

function drawHunters(){
  for(const h of hunters){
    const a = Math.max(.25, fog(h.z));
    const [x, y, k] = scr(h.x, h.y, h.z);
    if(!vis(x, y, 160)) continue;
    const jx = Math.sin(h.jit)*4, jy = Math.cos(h.jit*1.3)*4;
    const s = 60*k;
    g.globalAlpha = a*.9; g.strokeStyle = '#b32727'; g.lineWidth = 2.2;
    g.beginPath();
    for(let i = 0; i < 6; i++){
      const an = h.jit*.05 + i*1.047, r = s*(.6 + Math.sin(h.jit + i)*.18);
      i ? g.lineTo(x + jx + Math.cos(an)*r, y + jy + Math.sin(an)*r)
        : g.moveTo(x + jx + Math.cos(an)*r, y + jy + Math.sin(an)*r);
    }
    g.closePath(); g.stroke();
    g.globalAlpha = a*.45; g.strokeStyle = '#ff4d4d';
    g.beginPath(); g.arc(x + jx, y + jy, s*(1.1 + Math.sin(now*6)*.08), 0, 6.29); g.stroke();
    if(dist(h.x, h.y, drone.x, drone.y) < 1300){
      g.globalAlpha = a*(.4 + Math.random()*.5); g.fillStyle = '#ff6b6b';
      g.fillText(h.line, x + jx - 40, y + jy - s - 10);
    }
  }
}

// Кадр говорит о себе тремя состояниями, без единой строки текста:
// камень (не его час) → жёлтый пульс (час настал) → белое кольцо (условие выполнено, бери).
function drawFrags(){
  for(const f of FRAGS){
    const done = save.frags.includes(f.id), held = carry.includes(f.id);
    if(held) continue;
    const a = fog(f.z); if(a <= .02) continue;
    const [x, y, k] = scr(f.x, f.y, f.z);
    if(!vis(x, y, 140)) continue;
    const armed = !done && fragArmed(f), open = armed && fragOpen(f);
    g.globalAlpha = a*(done ? .25 : armed ? 1 : .45);
    g.strokeStyle = done ? '#4a2b42' : open ? QCOL_HOT : armed ? QCOL : QCOL_DIM;
    g.lineWidth = open ? 2.6 : 1.9;
    const s = 32*k*(armed ? 1 + Math.sin(now*4)*.14 : 1 + Math.sin(now*1.6)*.05);
    g.beginPath(); g.rect(x-s, y-s, s*2, s*2); g.moveTo(x-s, y+s); g.lineTo(x+s, y-s); g.stroke();
    if(armed){
      g.globalAlpha = a*.8; g.fillStyle = open ? QCOL_HOT : QCOL;
      g.fillText(f.id, x - s, y - s - 8);
      g.globalAlpha = a*.3;
      g.beginPath(); g.arc(x, y, s*(2 + Math.sin(now*3)*.3), 0, 6.29); g.stroke();
    }
    if(open){                                     // окно открыто: сходящееся кольцо, видно издалека
      g.globalAlpha = a*.55; g.lineWidth = 1.4; g.strokeStyle = QCOL_HOT;
      for(let i = 0; i < 3; i++){
        const rr = s*4 - ((now*180 + i*s*1.3) % (s*3));
        g.beginPath(); g.arc(x, y, Math.max(s*1.1, rr), 0, 6.29); g.stroke();
      }
    }
  }
}

// Засветки от импульса: что именно сонар нащупал вокруг, как оно называется
// и как далеко. Это и есть ответ на «непонятно, что я должен найти пробелом».
function drawBlips(){
  for(const b of blips){
    const age = (now - b.t)/9, al = 1 - age;
    if(al <= 0) continue;
    const [x, y, k] = scr(b.x, b.y, b.z);
    const off = !vis(x, y, 0);
    if(off){                                  // цель за кадром — метка ползёт по краю экрана
      const an = Math.atan2(wrapD(b.y - drone.y, H), wrapD(b.x - drone.x, W));
      const r = Math.min(VW, VH)*.42;
      const ex = VW/2 + Math.cos(an)*r, ey = VH/2 + Math.sin(an)*r;
      g.globalAlpha = al*.5; g.strokeStyle = QCOL; g.lineWidth = 1.4;
      g.beginPath(); g.arc(ex, ey, 5, 0, 6.29); g.stroke();
      g.globalAlpha = al*.6; g.fillStyle = QCOL;
      g.fillText(b.name + '  ' + Math.round(b.d) + 'м', ex + 10, ey + 4);
      continue;
    }
    const pul = 1 + Math.sin(now*4 + b.d)*.18;
    g.globalAlpha = al*.85; g.strokeStyle = QCOL; g.lineWidth = 1.6;
    g.beginPath();                            // ромб: ни один объект мира так не рисуется
    g.moveTo(x, y - 13*pul); g.lineTo(x + 13*pul, y);
    g.lineTo(x, y + 13*pul); g.lineTo(x - 13*pul, y); g.closePath(); g.stroke();
    g.globalAlpha = al*.35;
    const rr = 90 - (age*9 % 1)*70;
    g.beginPath(); g.arc(x, y, Math.max(16, rr*k), 0, 6.29); g.stroke();
    g.globalAlpha = al*.9; g.fillStyle = QCOL_HOT;
    const dz = Math.round(zd(b.z, drone.z)*ZLAYERS);
    g.fillText(b.name + '  ' + Math.round(b.d) + 'м' +
               (dz ? '  слой ' + (dz > 0 ? '+' : '') + dz : '  слой ok'), x + 18, y - 16);
  }
}

function drawPing(){
  if(!pingArrow) return;
  const an = Math.atan2(wrapD(pingArrow.y - drone.y, H), wrapD(pingArrow.x - drone.x, W));
  const r = 130 + Math.sin(now*4)*6;
  g.globalAlpha = .85; g.strokeStyle = '#ffd27f'; g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(VW/2 + Math.cos(an)*r, VH/2 + Math.sin(an)*r);
  g.lineTo(VW/2 + Math.cos(an)*(r+28), VH/2 + Math.sin(an)*(r+28));
  g.stroke();
  const dzl = Math.round(zd(pingArrow.z, drone.z)*ZLAYERS);
  g.fillStyle = '#ffd27f';
  g.fillText(dzl ? 'слой ' + (dzl > 0 ? '+' : '') + dzl + '  ' +
                   Math.round(dist(pingArrow.x, pingArrow.y, drone.x, drone.y)) + 'м'
                 : 'слой ok  ' + Math.round(dist(pingArrow.x, pingArrow.y, drone.x, drone.y)) + 'м',
    VW/2 + Math.cos(an)*(r+36) - 26, VH/2 + Math.sin(an)*(r+36));
}

// объект, который сейчас держим лучом: кольцо заполняется — видно, что процесс идёт
function drawBeam(){
  if(!beam) return;
  const o = beam.o, k01 = Math.min(1, beam.t/beam.need);
  const [x, y, k] = scr(o.x, o.y, o.z);
  const R = 46*k + 10;
  const col = beam.kind === 'hunter' ? '#ffd9a0'
            : beam.kind === 'photo'  ? o.photo.col
            : beam.kind === 'record' ? '#cfe8d6' : '#ffd27f';
  g.globalAlpha = .28; g.strokeStyle = col; g.lineWidth = 3;
  g.beginPath(); g.arc(x, y, R, 0, 6.2832); g.stroke();
  g.globalAlpha = .95; g.lineWidth = 4;
  g.beginPath(); g.arc(x, y, R, -1.5708, -1.5708 + 6.2832*k01); g.stroke();
  g.globalAlpha = .5 + k01*.5; g.fillStyle = col;
  g.fillText(Math.round(k01*100) + '%', x - 12, y - R - 10);
  if(k01 > .96){                                    // предвестие вскрытия
    g.globalAlpha = .5; g.beginPath(); g.arc(x, y, R*(1 + Math.sin(now*20)*.06), 0, 6.29); g.stroke();
  }
}

// находки: крупно по центру, растворяются и оседают в журнал справа
function drawToasts(){
  toasts = toasts.filter(t => now - t.t < 4.2);
  toasts.forEach((t, i) => {
    const age = (now - t.t)/4.2;
    const a = age < .12 ? age/.12 : age > .62 ? Math.max(0, (1 - age)/.38) : 1;
    const rise = age > .62 ? (age - .62)*160 : 0;
    const y = VH*.42 + i*54 - rise;
    g.save();
    g.globalAlpha = a;
    g.font = '22px Consolas, monospace'; g.textAlign = 'center';
    g.fillStyle = t.col;
    g.shadowColor = t.col; g.shadowBlur = 24;
    g.fillText(t.title, VW/2 + (age > .62 ? (Math.random()-.5)*3 : 0), y);
    g.shadowBlur = 0;
    if(t.sub){
      g.globalAlpha = a*.6; g.font = '13px Consolas, monospace'; g.fillStyle = '#cfe8d6';
      g.fillText(t.sub.length > 76 ? t.sub.slice(0, 74) + '…' : t.sub, VW/2, y + 26);
    }
    g.globalAlpha = a*.5; g.strokeStyle = t.col; g.lineWidth = 1;
    g.beginPath(); g.moveTo(VW/2 - 190, y + 12); g.lineTo(VW/2 + 190, y + 12); g.stroke();
    g.restore();
  });
  g.textAlign = 'left'; g.font = '12px Consolas, monospace';
}

function drawDrone(lightAng){
  const [x, y] = scr(drone.x, drone.y, drone.z);
  if(mouse.down && drone.pwr > 0){                       // конус фонаря
    // мягкий объёмный луч: три вложенных клина, узкий ярче широкого
    for(const [w, al] of [[.50,.05],[.42,.055],[.34,.06],[.26,.07],[.18,.08],[.09,.09]]){
      const grd = g.createRadialGradient(x, y, 10, x, y, 660);
      grd.addColorStop(0, `rgba(215,250,232,${al*1.6})`);
      grd.addColorStop(.4, `rgba(205,246,224,${al})`);
      grd.addColorStop(1, 'rgba(205,246,224,0)');
      g.globalAlpha = 1; g.fillStyle = grd;
      g.beginPath(); g.moveTo(x, y); g.arc(x, y, 660, lightAng - w, lightAng + w); g.closePath(); g.fill();
    }
  }
  // ореол заряда: радиус и плотность = энергия, при истощении сжимается и краснеет
  const f = drone.pwr/PWR_MAX, low = drone.pwr < PWR_LOW;
  const pulse = low ? Math.sin(now*7)*.5 + .5 : Math.sin(now*1.6)*.5 + .5;
  const R = 22 + f*46 + pulse*(low ? 5 : 3);
  const col = low ? '255,120,120' : `${180 - f*60},${240 + f*10},${200 + f*20}`;
  const halo = g.createRadialGradient(x, y, 4, x, y, R*2.1);
  halo.addColorStop(0,  `rgba(${col},${.30 + f*.32})`);
  halo.addColorStop(.5, `rgba(${col},${.10 + f*.14})`);
  halo.addColorStop(1,  `rgba(${col},0)`);
  g.globalAlpha = 1; g.fillStyle = halo;
  g.beginPath(); g.arc(x, y, R*2.1, 0, 6.29); g.fill();
  g.globalAlpha = .35 + f*.5; g.strokeStyle = `rgb(${col})`; g.lineWidth = 1.2;
  g.beginPath();                                       // кольцо-манометр: дуга по остатку заряда
  g.arc(x, y, R, -1.5708, -1.5708 + 6.2832*f); g.stroke();
  if(carry.length){                                    // несомый фрагмент подтачивает ореол
    g.globalAlpha = .5; g.strokeStyle = '#ffd27f'; g.setLineDash([3, 6]);
    g.beginPath(); g.arc(x, y, R + 9, 0, 6.29); g.stroke(); g.setLineDash([]);
  }
  // отклик сонара: засветка на кольце с той стороны, откуда пришло эхо
  if(echo && now > echo.at){
    const age = (now - echo.at)/ECHO_LIFE;
    if(age > 1) echo = null;
    else {
      if(!echo.rang){ echo.rang = true; echoPing(echo.kind); }
      const col = echo.kind === 'star' ? '255,233,176' : echo.kind === 'haven' ? '159,232,196'
                : echo.kind === 'wreck' ? '159,184,201'
                : echo.kind === 'node' || echo.kind === 'frag' ? '255,210,127' : '143,184,155';
      const a2 = (1 - age)*(echo.kind === 'far' ? .55 : 1);
      const near = Math.max(.3, 1 - echo.d/6000);          // ближе цель — шире засветка
      const RE = R + 26, ca = Math.cos(echo.ang), sa = Math.sin(echo.ang);
      g.globalAlpha = a2*.9; g.strokeStyle = `rgba(${col},1)`; g.lineWidth = 4;
      g.beginPath(); g.arc(x, y, RE, echo.ang - .34*near, echo.ang + .34*near); g.stroke();
      g.globalAlpha = a2*.5; g.lineWidth = 2;              // короткий вынос наружу — куда плыть
      g.beginPath(); g.moveTo(x + ca*(RE+5), y + sa*(RE+5));
      g.lineTo(x + ca*(RE+16+near*10), y + sa*(RE+16+near*10)); g.stroke();
      g.globalAlpha = a2*.22; g.lineWidth = 1;             // расходящийся след отклика
      for(let i = 1; i <= 3; i++){
        const rr = RE + 14 + i*11 + (1 - age)*8;
        g.beginPath(); g.arc(x, y, rr, echo.ang - .22*near, echo.ang + .22*near); g.stroke();
      }
      // подпись у засветки: что нащупали, как далеко и на сколько слоёв мимо.
      // без неё дуга на кольце читается как «там что-то есть» и ничего не объясняет.
      const dzl = Math.round(echo.dz*ZLAYERS);
      const lx = x + ca*(RE + 30), ly = y + sa*(RE + 30);
      g.globalAlpha = a2*.85; g.fillStyle = `rgba(${col},1)`;
      g.textAlign = ca < -.3 ? 'right' : 'left';
      g.fillText((ECHO_NAME[echo.kind] || echo.kind) + '  ' + Math.round(echo.d) + 'м' +
                 (dzl ? '  слой ' + (dzl > 0 ? '+' : '') + dzl : '  слой ok'),
                 lx + (ca < -.3 ? -4 : 4), ly + 4);
      g.textAlign = 'left';
    }
  }
  g.globalAlpha = 1; g.strokeStyle = low ? '#ffb0b0' : '#e8fff2'; g.lineWidth = 1.5;
  g.beginPath(); g.arc(x, y, 7, 0, 6.29); g.moveTo(x-13, y); g.lineTo(x+13, y); g.stroke();
  for(let i = 0; i < carry.length; i++){                 // несомые фрагменты болтаются позади
    const an = now*1.4 + i*2.1, r = 26 + i*7;
    g.globalAlpha = .9; g.strokeStyle = '#ffd27f';
    g.strokeRect(x + Math.cos(an)*r - 5, y + Math.sin(an)*r - 5, 10, 10);
  }
  g.globalAlpha = .35; g.strokeStyle = '#e8fff2';
  g.beginPath(); g.arc(mouse.x, mouse.y, 4, 0, 6.29); g.stroke();
  g.globalAlpha = .15; g.beginPath(); g.moveTo(x, y); g.lineTo(mouse.x, mouse.y); g.stroke();
}

// сканлайны, помехи, вспышка
function overlay(){
  g.globalAlpha = .05; g.fillStyle = '#000';
  for(let y = 0; y < VH; y += 3) g.fillRect(0, y, VW, 1);

  // цвет восстановленного кадра ненадолго заливает мир
  if(colorFlash){
    const k = 1 - (now - colorFlash.t)/9;
    if(k <= 0) colorFlash = null;
    else {
      g.globalAlpha = k*.22; g.fillStyle = colorFlash.col; g.fillRect(0, 0, VW, VH);
    }
  }

  // предупреждение задолго до контакта: рябь по краям, потом уже глитч
  if(huntSense > .02){
    const s = huntSense;
    g.globalAlpha = Math.min(.5, s*.55);
    const grd = g.createRadialGradient(VW/2, VH/2, VH*(.55 - s*.25), VW/2, VH/2, VH*.85);
    grd.addColorStop(0, 'rgba(120,0,0,0)'); grd.addColorStop(1, `rgba(150,20,20,${.5 + s*.5})`);
    g.fillStyle = grd; g.fillRect(0, 0, VW, VH);
    for(let i = 0; i < s*22; i++){                       // редкие полосы по краям кадра
      const y = Math.random()*VH, h = 1 + Math.random()*3;
      g.globalAlpha = s*.3;
      g.fillStyle = '#b32727';
      g.fillRect(Math.random() < .5 ? 0 : VW - Math.random()*VW*.22, y, Math.random()*VW*.22, h);
    }
  }

  if(glitch > .02){
    const n = 30 + glitch*90;
    for(let i = 0; i < n; i++){
      const y = Math.random()*VH, h = 1 + Math.random()*7;
      g.globalAlpha = Math.min(.5, glitch*.5);
      g.fillStyle = Math.random() < .3 ? '#b32727' : '#0d1512';
      g.fillRect(Math.random()*VW - VW*.2, y, Math.random()*VW*.5, h);
    }
    g.globalAlpha = Math.min(.35, glitch*.35);
    const grd = g.createRadialGradient(VW/2, VH/2, VH*.25, VW/2, VH/2, VH*.8);
    grd.addColorStop(0, 'rgba(120,0,0,0)'); grd.addColorStop(1, 'rgba(140,10,10,.9)');
    g.fillStyle = grd; g.fillRect(0, 0, VW, VH);
  }
  if(drone.pwr < PWR_LOW){
    g.globalAlpha = (1 - drone.pwr/PWR_LOW)*.25*(0.6 + Math.sin(now*6)*.4);
    g.fillStyle = '#000'; g.fillRect(0, 0, VW, VH);
  }
  if(flash > 0){ g.globalAlpha = Math.min(.85, flash*.55); g.fillStyle = '#fff'; g.fillRect(0, 0, VW, VH); }
  if(phase === 'OVERHEAT'){ g.globalAlpha = (cycleT-450)/30*.55; g.fillStyle = '#000'; g.fillRect(0, 0, VW, VH); }
  g.globalAlpha = 1;
}

const bar = (v, max, n) => {
  const f = Math.round(Math.max(0, Math.min(1, v/max))*n);
  return '█'.repeat(f) + '·'.repeat(n - f);
};

function hud(){
  if(mapOpen){                                    // на карте телеметрия не мешает
    document.getElementById('hud').textContent = '';
    document.getElementById('log').textContent = '';
    document.getElementById('hint').textContent = '';
    document.getElementById('term').textContent = '';
    return;
  }
  const ct = Math.max(0, cycleT);
  const m = String(Math.floor(ct/60)).padStart(2,'0'), s = String(Math.floor(ct%60)).padStart(2,'0');
  const layer = Math.round(drone.z*ZLAYERS) % ZLAYERS;
  const ring = '·'.repeat(layer) + '◆' + '·'.repeat(ZLAYERS - layer - 1);
  document.getElementById('hud').textContent =
    `PING-7   ${m}:${s} / 08:00   ${phase}\n` +
    `${zoneAt(drone.y)}\n` +
    `LAYER ${String(layer).padStart(2,'0')}/${ZLAYERS}  ⟳${ring}⟲\n` +
    `NOISE ${bar(noise, NOISE_MAX, 20)} ${haven ? 'ТИШИНА' : hunters.length ? 'СЛЫШАТ ×' + hunters.length : ''}\n` +
    `SCAN  ${now >= scanReady ? 'готов' : 'перезарядка ' + (scanReady-now).toFixed(1)}\n` +
    `СДАНО ${delivered()}/${FRAGS.length}   НЕСЁШЬ ${carry.length}   КАДРЫ ${save.photos.length}/${PHOTOS.length}   ЦИКЛ #${save.cycles}` +
    (mounted() ? `\nMOUNT A: ${Math.ceil(mountUntil-now)}s` : '');
  document.getElementById('log').textContent = save.log.join('\n');
  // Единственный канал подсказки — мысль самого дрона. Никаких целей и стрелок:
  // управление живёт на загрузочном экране, маршрут — в открытых вопросах журнала.
  const $h = document.getElementById('hint');
  $h.textContent = thought ? thought.t : '';
  $h.style.opacity = thought ? Math.max(0, Math.min(1, (13 - (now - thought.at))/2.5)) : 0;
  document.getElementById('term').textContent =
    termOpen ? '> ' + termText + '_\n' + termList() +
               '\n\n  TAB — дописать   ↑↓ — история   ESC — закрыть'
    : (now - termEchoT < 6 ? termEcho : '');
}
const mounted = () => now < mountUntil;
