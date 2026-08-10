// Содержимое океана, рост мира, преследователи, симуляция кадра.

const rnd = (s => () => (s = s * 16807 % 2147483647) / 2147483647)(42);

// виды объектов: solid — препятствие, pow — энергоузел, glow — светится сам
const KINDS = {
  folder:{}, window:{}, monolith:{solid:1}, cursor:{},
  board:{},  cable:{},  chip:{solid:1},     psu:{pow:1, glow:1},
  photo:{},  frame:{},  pillar:{solid:1},
  trash:{},  shard:{},  block:{solid:1},    tape:{},
  packet:{}, beacon:{glow:1}, ruin:{solid:1}
};
// что растёт в какой зоне — по порядку ZONES
const BY_ZONE = [
  ['folder','window','cursor'],                       // BOOT SECTOR: только знакомое и безопасное
  ['folder','window','monolith','cursor'],            // DESKTOP SHALLOWS
  ['board','cable','chip','psu'],                     // CORAL BUS
  ['photo','frame','pillar'],                         // PHOTO ARCHIVE
  ['trash','shard','block','tape'],                   // TRASH TRENCH
  ['packet','beacon','ruin']                          // MODEM ABYSS
];

const PALETTE = {
  folder:'#4e8f6a', window:'#5aa37c', monolith:'#3c7a5c', cursor:'#cfe8d6',
  board:'#4e8f6a',  cable:'#5fbf92',  chip:'#3c7a5c',     psu:'#ffd27f',
  photo:'#9fb8c9',  frame:'#7f9aa8',  pillar:'#5f7c8a',
  trash:'#41725a',  shard:'#7fd9ff',  block:'#33604c',    tape:'#a9c7b6',
  packet:'#6fa8ff', beacon:'#7fd9ff', ruin:'#3d5a75'
};

const props = [], creatures = [], hunters = [];
const MAXP = BASE_PROPS + GROW_PROPS*4, MAXL = BASE_LIFE + GROW_LIFE*4;
let nProps = BASE_PROPS, nLife = BASE_LIFE, starPulse = 0, rayGoal = null;

for(let i = 0; i < MAXP; i++){
  const y = rnd()*H, zi = zoneIdx(y);
  let kind = BY_ZONE[zi][(rnd()*BY_ZONE[zi].length)|0];
  if(zi > 0 && rnd() < NODE_RATE) kind = 'psu';       // энергоузлы везде, кроме вступления
  const t = TEXTS[(rnd()*TEXTS.length)|0];
  props.push({
    x: rnd()*W, y, z: rnd(), kind, s: 26 + rnd()*140, a: rnd()*6.28,
    spin: (rnd()-.5)*.004, bob: rnd()*6.28, cat: t[0], txt: t[1],
    solid: !!KINDS[kind].solid, pow: !!KINDS[kind].pow, glow: !!KINDS[kind].glow,
    tint: rnd() < .05 ? ['#ff8f8f','#7fd9ff','#c58fff','#ffd27f'][(rnd()*4)|0] : null,
    photo: kind === 'photo' ? PHOTOS[(rnd()*PHOTOS.length)|0] : null,
    wake: 0, dead: false, hunt: false
  });
}
for(let i = 0; i < MAXL; i++)
  creatures.push({x:rnd()*W, y:rnd()*H, z:rnd(), a:rnd()*6.28, p:rnd()*6.28, fear:0,
    kind: i%4 === 0 ? 'exception' : i%4 === 1 ? 'ray' : i%4 === 2 ? 'eel' : 'null'});

// архивные киты: проходят через весь океан раз за цикл, звук — шум жёсткого диска
const whales = [
  {x:0, y:WHALE.y0,       z:.35, dir: 1, p:0},
  {x:W, y:WHALE.y0+4200,  z:.65, dir:-1, p:2}
];

function grow(){                                      // мир прирастает за каждый сданный фрагмент
  nProps = BASE_PROPS + GROW_PROPS*growth();
  nLife  = BASE_LIFE  + GROW_LIFE*growth();
  for(let i = 0; i < nProps; i++) if(props[i].dead && rnd() < .5) props[i].dead = false;
}

grow();                                               // плотность мира — сразу по сохранённому прогрессу

// Узлы ядра. Первые два — что делать с изображением: петля продолжается в обоих.
// Вторые два появляются только от знания: понял, что такое звезда — можешь снять процесс.
const NODES_LOOP = [{id:'COMPLETE RESTORE', dx:-260}, {id:'PROTECT CACHE', dx:260}];
const NODES_FREE = [{id:'COMPLETE RESTORE', dx:-560}, {id:'PROTECT CACHE', dx:-190},
                    {id:'PURGE PROCESS 1',  dx: 190}, {id:'HALT PROCESS 1', dx:560}];
const nodes = () => knowsAll() ? NODES_FREE : NODES_LOOP;

function reboot(){
  t0 = performance.now()/1000; save.cycles++; persist();
  if(carry.length) toast('ЦИКЛ ОБОРВАН', 'ПОТЕРЯНО: ' + carry.join(', ') + ' — фрагмент вернулся на место', '#ff8f8f');
  saveTrack(); loadGhosts();                     // прожитый цикл становится призраком
  carry = []; hunters.length = 0; nulls.length = 0; indexer = null;
  drone.vx = drone.vy = 0; drone.pwr = PWR_MAX;
  noise = 0; labels = []; pingArrow = null; mountUntil = 0; coreOpen = false;
  for(let i = 0; i < props.length; i++){
    props[i].dead = false; props[i].wake = 0; props[i].hunt = false; props[i].spent = false;
  }
  grow();
}

// ---- всё ключевое одним списком: его метит импульс и по нему идёт зов ----
// Список короткий (около двадцати позиций), поэтому его не жалко пересобирать в кадре.
function questTargets(){
  const out = [];
  for(const f of FRAGS)   if(!fragTaken(f))                out.push({o:f, kind:'frag',   name:f.id});
  for(const w of WRECKS)  if(!save.wrecks.includes(w.id))  out.push({o:w, kind:'wreck',
                            name:'ОБЛОМОК · СЛОЙ ' + String(Math.round(w.z*ZLAYERS)).padStart(2,'0')});
  for(const r of RECORDS) if(!save.records.includes(r.id)) out.push({o:r, kind:'record', name:r.id});
  for(const t of TEACHERS)if(!save.cmds.includes(t.cmd))   out.push({o:t, kind:'teach',  name:t.label});
  if(!save.records.includes(STAR_LOG.id))                  out.push({o:STAR_LOG, kind:'core', name:'ЯДРО ЗВЕЗДЫ'});
  return out;
}

// Импульс метит всё ключевое вокруг: розовая засветка, имя и дистанция.
// Раньше он только будил декор — отсюда «непонятно, что я должен им найти».
function markQuest(){
  for(const q of questTargets()){
    const d = dist(q.o.x, q.o.y, drone.x, drone.y);
    if(d > 3400) continue;
    blips.push({x:q.o.x, y:q.o.y, z:q.o.z, name:q.name, kind:q.kind, d, t:now});
  }
  blips = blips.slice(-12);
}

// Что сейчас важнее всего — сонар отвечает эхом именно оттуда.
// Никакого текста: игрок слышит отклик и видит засветку на кольце дрона.
function currentGoal(){
  if(hunters.length && !havenAt(drone.x, drone.y)){  // за тобой идут — эхо ведёт в тишину
    let hv = null, hd = 6000;
    for(const h of HAVENS){
      const d = dist(h.x, h.y, drone.x, drone.y);
      if(d < hd){ hd = d; hv = h; }
    }
    if(hv) return {x:hv.x, y:hv.y, z:drone.z, kind:'haven'};
  }
  if(drone.pwr < PWR_LOW){                           // сядешь — не доплывёшь: сначала заряд
    let best = null, bd = 4000;
    for(let i = 0; i < nProps; i++){
      const p = props[i];
      if(p.dead || !(p.pow || p.glow) || p.spent) continue;
      const d = dist(p.x, p.y, drone.x, drone.y);
      if(d < bd){ bd = d; best = p; }
    }
    if(best) return {x:best.x, y:best.y, z:best.z, kind:'node'};
  }
  if(carry.length) return {x:STAR.x, y:STAR.y, z:STAR.z, kind:'star'};
  const f = FRAGS.find(f => fragArmed(f) && !fragTaken(f));   // у кого сейчас его час
  if(f) return {x:f.x, y:f.y, z:f.z, kind:'frag'};
  const w = WRECKS.find(w => !save.wrecks.includes(w.id));    // некуда спешить — иди читать
  if(w) return {x:w.x, y:w.y, z:w.z, kind:'wreck'};
  const nf = FRAGS.find(f => !fragTaken(f));                  // иначе — где искать следующий кадр
  return nf ? {x:nf.x, y:nf.y, z:nf.z, kind:'far'} : {x:STAR.x, y:STAR.y, z:STAR.z, kind:'star'};
}

function pingEcho(){
  const t = currentGoal();
  const d = dist(t.x, t.y, drone.x, drone.y);
  echo = {ang: Math.atan2(wrapD(t.y - drone.y, H), wrapD(t.x - drone.x, W)),
          dz: zd(t.z, drone.z), d, kind: t.kind,
          at: now + ECHO_DELAY + Math.min(1.2, d/3000)};   // дальше цель — позже отклик
}

// защищённая страница памяти: внутри тихо, тепло и никто не приходит
function havenAt(x, y){
  for(const h of HAVENS) if(dist(x, y, h.x, h.y) < h.r) return h;
  return null;
}

// ---- освещение: звезда + собственный фонарь + светящиеся узлы ----
function starLight(x, y){
  const d = dist(x, y, STAR.x, STAR.y);
  return Math.max(0, 1 - d / starR()) * (1 + starPulse);
}

function step(dt){
  const low = drone.pwr < PWR_LOW;

  // --- движение: курсор задаёт тягу, дрон тяжёлый ---
  const dx = (mouse.x - VW/2)/VW*2, dy = (mouse.y - VH/2)/VH*2;
  const drag   = stabilize ? .84 : .952;
  const power  = drone.pwr <= 0 ? .12 : low ? .38 : 1;
  const thrust = stabilize ? 0 : .42 * power;
  drone.vx = drone.vx*drag + dx*thrust;
  drone.vy = drone.vy*drag + dy*thrust;
  if(phase === 'OVERHEAT'){ drone.vx += Math.sin(now*7)*.5; drone.vy += Math.cos(now*9)*.5; }
  drone.x = wrap(drone.x + drone.vx, W);
  drone.y = wrap(drone.y + drone.vy, H);
  if(!save.intro){                                 // мембрана: вниз не пускает, пока нет RECORD_0
    const over = wrapD(drone.y - (GATE_Y - 120), H);
    if(over > 0 && over < H/2){
      drone.y = wrap(GATE_Y - 120, H); drone.vy = -Math.abs(drone.vy)*.5 - .6;
      if(Math.random() < .5) spawn(drone.x + (Math.random()-.5)*300, GATE_Y - 120, drone.z,
        (Math.random()-.5)*2, -1, .8, '#8fd8ff', 2);
      if(Math.random() < .06) membrane();
    }
  }
  cam.x = wrap(cam.x + wrapD(drone.x - cam.x, W)*.055, W);
  cam.y = wrap(cam.y + wrapD(drone.y - cam.y, H)*.055, H);
  const speed = Math.hypot(drone.vx, drone.vy);
  if(speed > 1.2) trail(drone.x, drone.y, drone.z, drone.vx, drone.vy);
  dust();

  mouse.speed = Math.hypot(mouse.x - mouse.px, mouse.y - mouse.py);
  mouse.px = mouse.x; mouse.py = mouse.y;

  const zn = zoneAt(drone.y);                   // карта памяти рисуется по посещённому
  if(!save.zones.includes(zn)){ save.zones.push(zn); persist(); toast('ОБЛАСТЬ · ' + zn, 'ОБНАРУЖЕНА ОБЛАСТЬ: ' + zn, '#7fe3a8'); }
  recordTrack();

  // --- энергия ---
  let atNode = false;
  drone.pwr -= (PWR_IDLE + speed*PWR_MOVE*.1 + carry.length*CARRY_PWR) * dt;
  if(mouse.down && drone.pwr > 0) drone.pwr -= PWR_LIGHT*dt;
  const nearStar = dist(drone.x, drone.y, STAR.x, STAR.y) < starR()*.35;
  if(nearStar){ drone.pwr += PWR_NODE*dt*.8; atNode = true; }
  if(stabilize && !mouse.down) drone.pwr += PWR_REST*dt;
  haven = havenAt(drone.x, drone.y);
  if(haven){
    drone.pwr += HAVEN_PWR*dt;
    if(Math.random() < dt*6){                     // тёплая взвесь стягивается к дрону
      const a = Math.random()*6.28, r = 120 + Math.random()*300;
      spawn(drone.x + Math.cos(a)*r, drone.y + Math.sin(a)*r, drone.z,
            -Math.cos(a)*1.4, -Math.sin(a)*1.4, 1.2, '#9fe8c4', 1.6);
    }
    if(Math.random() < dt*.5) havenHum();
  }
  drone.pwr = Math.max(0, Math.min(PWR_MAX, drone.pwr));

  // --- шум: сканирование, свет, скорость, несомые фрагменты ---
  noise += (mouse.down ? NOISE_LIGHT : 0) * dt + speed*NOISE_MOVE*dt + carry.length*CARRY_NOISE*dt;
  noise = Math.max(0, Math.min(NOISE_MAX, noise - NOISE_DECAY*dt*(haven ? HAVEN_QUIET : 1)));
  quiet = (!mouse.down && speed < .5) ? quiet + dt : 0;

  // --- события фазы ---
  waveY  = phase === 'INDEX' ? (cycleT-120)/120*H : -1e5;
  purgeY = (phase === 'PURGE' || phase === 'OVERHEAT') ? (cycleT-360)/90*H : -1e5;
  if(purgeY > -1e4) for(let i = 0; i < nProps; i++){
    const p = props[i];
    if(!p.dead && p.y < purgeY){ p.dead = true; if(Math.random() < .04) burst(p.x, p.y, p.z, 5, '#e6f0eb'); }
  }
  coreOpen = phase === 'OVERHEAT' && delivered() === FRAGS.length;
  starPulse = Math.max(0, starPulse - dt*.6);

  // --- импульс сканирования: не больше SCAN_MAX объектов ---
  for(const p of pulses) p.r += 780*dt;
  const fresh = pulses.find(p => p.fresh);
  if(fresh){
    fresh.fresh = false; sonar(); pingEcho(); markQuest();
    const hits = [];
    for(let i = 0; i < nProps; i++){
      const p = props[i];
      if(p.dead || Math.abs(zd(p.z, drone.z)) > .14) continue;
      const d = dist(p.x, p.y, drone.x, drone.y);
      if(d < 900) hits.push([d, p]);
    }
    hits.sort((a,b) => a[0]-b[0]);
    // Сонар — только зрение. Энергию из узла достаёт исключительно фонарь:
    // иначе импульс окупает сам себя и свет становится не нужен.
    for(const [, p] of hits.slice(0, SCAN_MAX)){
      p.wake = 1;
      labels.push({x:p.x, y:p.y, z:p.z, s:p.txt, cat:p.cat, t:now});
      burst(p.x, p.y, p.z, 6, TEXT_COLOR[p.cat]);
      if(!save.seen.includes(p.txt)){ save.seen.push(p.txt); persist(); }
      if(p.photo) enterPhoto(p);                    // в фотографию можно заплыть
    }
    labels = labels.slice(-24);
    // кита не просканируешь целиком — он отдаёт сразу пачку обрывков
    for(const wh of whales)
      if(dist(wh.x, wh.y, drone.x, drone.y) < WHALE.size && Math.abs(zd(wh.z, drone.z)) < .2){
        for(let j = 0; j < 4; j++){
          const t = TEXTS[(Math.random()*TEXTS.length)|0];
          labels.push({x: wh.x + (Math.random()-.5)*WHALE.size, y: wh.y + (Math.random()-.5)*300,
                       z: wh.z, s: t[1], cat: t[0], t: now});
          if(!save.seen.includes(t[1])){ save.seen.push(t[1]); persist(); }
        }
        whaleSong();
      }
  }
  pulses = pulses.filter(p => p.r < 1400);
  labels = labels.filter(l => now - l.t < 8);

  // --- свет: будит объекты и вскрывает их, если держать луч ---
  const lightAng = Math.atan2(mouse.y - VH/2, mouse.x - VW/2);
  const lightOn = mouse.down && drone.pwr > 0;
  for(let i = 0; i < nProps; i++){
    const p = props[i];
    if(p.dead) continue;
    p.a += p.spin; p.bob += dt*1.4;
    if(lightOn && inBeam(p.x, p.y, p.z, lightAng)) p.wake = Math.max(p.wake, .9);
    p.wake *= .975;
    if(p.solid) collide(p);
  }
  atNode = mouse.down ? lightCollect(dt, lightAng) : darkCollect(dt);
  if(atNode && Math.random() < .07) powerHum();

  // --- сдача звезде ---
  if(carry.length && dist(drone.x, drone.y, STAR.x, STAR.y) < 420 && Math.abs(zd(STAR.z, drone.z)) < .2)
    deliver();

  // подсказки без слов: течение к звезде, скаты-проводники, зов активного кадра
  rayGoal = currentGoal();
  if(carry.length) current(dt);
  senseQuest(dt);
  blips = blips.filter(b => now - b.t < 9);

  stepMind(dt);
  stepCreatures(dt);
  stepWhales(dt);
  stepHunters(dt);
  stepNulls(dt);
  stepIndexer(dt);
  stepGhosts(dt);

  // штрафы за удары и касания приходят позже — ограничиваем в самом конце кадра
  drone.pwr = Math.max(0, Math.min(PWR_MAX, drone.pwr));
  noise = Math.max(0, Math.min(NOISE_MAX, noise));

  flash = Math.max(0, flash - dt*1.2);
  shake = phase === 'OVERHEAT' ? (cycleT-450)/30*9 : Math.max(0, shake - dt*30);
  if(pingArrow && now > pingArrow.until) pingArrow = null;
  if(low && Math.random() < .006) warble();

  // --- финальный выбор ---
  if(coreOpen && !save.pending) for(const n of nodes())
    if(dist(STAR.x + n.dx, STAR.y, drone.x, drone.y) < 130 && Math.abs(zd(STAR.z, drone.z)) < .2) choose(n.id);
}

// луч ушёл с цели: накопленное тает, но не пропадает разом
function beamFade(d){
  if(!beam) return;
  beam.t -= d*.8;
  if(beam.t <= 0) beam = null;
}

// точка в конусе фонаря и на том же слое?
function inBeam(x, y, z, ang, range){
  if(Math.abs(zd(z, drone.z)) > .15) return false;
  const d = dist(x, y, drone.x, drone.y);
  if(d > (range || LIGHT_RANGE)) return false;
  const a = Math.atan2(wrapD(y - drone.y, H), wrapD(x - drone.x, W));
  return Math.abs(wrapD(a - ang, 6.2832)) < LIGHT_CONE;
}

// Всё берётся светом: держать луч, пока не заполнится. Один объект за раз.
// Исключение — кадр с гейтом dark: он берётся темнотой, см. darkCollect.
function lightCollect(dt, ang){
  if(!(mouse.down && drone.pwr > 0)){ beamFade(dt*2); return false; }
  let best = null, bd = 1e9, kind = null;

  const test = (o, k, x, y, z) => {
    if(!inBeam(x, y, z, ang)) return;
    const d = dist(x, y, drone.x, drone.y);
    if(d < bd){ bd = d; best = o; kind = k; }
  };
  for(const f of FRAGS)
    if(f.gate !== 'dark' && !fragTaken(f) && fragOpen(f)) test(f, 'frag', f.x, f.y, f.z);
  for(const r of RECORDS) if(!save.records.includes(r.id)) test(r, 'record', r.x, r.y, r.z);
  for(const w of WRECKS)  if(!save.wrecks.includes(w.id))  test(w, 'wreck', w.x, w.y, w.z);
  for(const t of TEACHERS) if(!save.cmds.includes(t.cmd)) test(t, 'teach', t.x, t.y, t.z);
  // ядро отвечает только вплотную: с дистанции звезда — просто свет
  if(!save.records.includes(STAR_LOG.id) && dist(STAR.x, STAR.y, drone.x, drone.y) < 700)
    test(STAR_LOG, 'star', STAR.x, STAR.y, STAR.z);
  for(let i = 0; i < nProps; i++){
    const p = props[i];
    if(p.dead) continue;
    if(p.photo && !save.photos.includes(p.photo.id)) test(p, 'photo', p.x, p.y, p.z);
    else if((p.pow || p.glow) && !p.spent)
      test(p, p.pow ? 'node' : 'beacon', p.x, p.y, p.z);
  }
  for(const h of hunters)                          // опасность важнее добычи: перебивает выбор
    if(inBeam(h.x, h.y, h.z, ang)){ best = h; kind = 'hunter'; bd = dist(h.x, h.y, drone.x, drone.y); break; }

  if(!best){ beamFade(dt); return false; }        // луч соскользнул — прогресс тает, а не гибнет
  if(!beam || beam.o !== best) beam = {o:best, kind, t:0, need:LIGHT_T[kind]};
  beam.t += dt;

  if(Math.random() < dt*10)                       // струйка к дрону: видно, что идёт вскрытие
    spawn(bd < 40 ? drone.x : best.x, best.y, best.z,
          wrapD(drone.x-best.x,W)*.004, wrapD(drone.y-best.y,H)*.004, .9,
          kind === 'photo' ? best.photo.col : '#ffd27f', 2);
  if(Math.random() < dt*2.5) charging(beam.t/beam.need);

  if(beam.t < beam.need) return kind === 'node';
  const o = best; beam = null;                    // вскрыто
  switch(kind){
    case 'frag':   liftFrag(o); break;
    case 'record': takeRecord(o); break;
    case 'wreck':  takeWreck(o); break;
    case 'star':   readStar(); break;
    case 'teach':  learn(o.cmd, o.text); break;
    case 'photo':  enterPhoto(o); break;
    case 'hunter': scareHunter(o); break;
    default:
      o.spent = true;                             // узел пуст до конца цикла, а не 25 секунд
      // отдача по текущему размеру: ждать, пока узел набухнет, выгоднее, чем брать спущенный
      const got = kind === 'node' ? nodeYield(o) : PWR_TAP_B;
      drone.pwr = Math.min(PWR_MAX, drone.pwr + got);
      burst(o.x, o.y, o.z, 12 + Math.round(got/2), '#ffd27f'); powerHum();
      toast('УЗЕЛ ВЫКАЧАН · +' + Math.round(got), null, '#ffd27f');
  }
  return kind === 'node';
}

// Кадр с гейтом dark берётся наоборот: погасить фонарь, подойти, замереть, стихнуть.
// Прогресс рисуется тем же кольцом, что и у луча — отдельного индикатора не нужно.
function darkCollect(dt){
  const f = FRAGS.find(f => f.gate === 'dark' && !fragTaken(f));
  if(!f){ beamFade(dt*2); return false; }
  const near = dist(f.x, f.y, drone.x, drone.y) < 260 && Math.abs(zd(f.z, drone.z)) < .07;
  if(!(near && stabilize && fragOpen(f))){ beamFade(dt*2); return false; }

  if(!beam || beam.o !== f) beam = {o:f, kind:'frag', t:0, need:LIGHT_T.frag};
  beam.t += dt;
  if(Math.random() < dt*8)
    spawn(f.x + (Math.random()-.5)*200, f.y + (Math.random()-.5)*200, f.z,
          wrapD(drone.x-f.x,W)*.004, wrapD(drone.y-f.y,H)*.004, .9, '#7f9aa8', 2);
  if(Math.random() < dt*2.5) charging(beam.t/beam.need);
  if(beam.t >= beam.need){ beam = null; liftFrag(f); }
  return false;
}

// упругий отбой от препятствия + потеря энергии
function collide(p){
  if(Math.abs(zd(p.z, drone.z)) > ZSOLID) return;
  const r = p.s*.5 + 14, dx = wrapD(drone.x - p.x, W), dy = wrapD(drone.y - p.y, H);
  const d = Math.hypot(dx, dy);
  if(d > r || d === 0) return;
  drone.x = wrap(p.x + dx/d*r, W); drone.y = wrap(p.y + dy/d*r, H);
  const vn = (drone.vx*dx + drone.vy*dy)/d;
  if(vn < -.4){
    drone.vx -= 1.5*vn*dx/d; drone.vy -= 1.5*vn*dy/d;
    drone.pwr -= PWR_HIT; noise += 4; shake = Math.max(shake, 5);
    burst(drone.x, drone.y, drone.z, 8, '#cfe8d6'); thud();
  }
}

function stepCreatures(dt){
  for(let i = 0; i < nLife; i++){
    const cr = creatures[i];
    cr.p += dt*.6;
    if(cr.kind === 'exception'){
      const d = dist(cr.x, cr.y, drone.x, drone.y) || 1;
      cr.fear = (mouse.down && d < 480) ? 1 : Math.max(0, cr.fear - dt);
      if(cr.fear > .5){ cr.x += wrapD(cr.x-drone.x,W)/d*4.5; cr.y += wrapD(cr.y-drone.y,H)/d*4.5; }
      else { cr.x += Math.sin(cr.p*2)*1.1; cr.y += Math.cos(cr.p*3)*.7; }
    } else if(cr.kind === 'ray'){
      // пакетный скат идёт к источнику данных: за ним можно просто плыть
      const t = rayGoal;
      if(t && dist(cr.x, cr.y, drone.x, drone.y) < 2600){
        const want = Math.atan2(wrapD(t.y - cr.y, H), wrapD(t.x - cr.x, W));
        cr.a += wrapD(want - cr.a, 6.2832)*.02;
      }
      cr.x += Math.cos(cr.a)*1.3; cr.y += Math.sin(cr.a)*.55;
    } else if(cr.kind === 'eel'){
      const flee = Math.min(1, mouse.speed/40);
      cr.x += Math.cos(cr.p)*(.7 + flee*4.5); cr.y += Math.sin(cr.p*.7)*(.7 + flee*3);
    } else {                                  // нулевое существо: тянется к тишине, гасит объекты рядом
      cr.x += Math.cos(cr.p*.3)*.5; cr.y += Math.sin(cr.p*.21)*.5;
    }
    cr.x = wrap(cr.x, W); cr.y = wrap(cr.y, H);
  }
}

// несёшь фрагмент — вода начинает сносить в сторону звезды: видно по взвеси
function current(dt){
  const an = Math.atan2(wrapD(STAR.y - drone.y, H), wrapD(STAR.x - drone.x, W));
  drone.vx += Math.cos(an)*8*dt;                     // слабый снос, спорить с ним можно
  drone.vy += Math.sin(an)*8*dt;
  for(let i = 0; i < 3; i++){
    const a2 = Math.random()*6.28, r = 200 + Math.random()*700;
    spawn(drone.x + Math.cos(a2)*r, drone.y + Math.sin(a2)*r, drone.z + (Math.random()-.5)*.1,
          Math.cos(an)*(2 + Math.random()*2), Math.sin(an)*(2 + Math.random()*2),
          1.6, '#ffd27f', 1.2);
  }
}

// Зов: чем ближе ключевой объект, тем чаще пульс и тем гуще розовая взвесь вокруг него.
// Работает на всё сюжетное сразу, а не только на кадры — иначе обломки было не нащупать.
function senseQuest(dt){
  questNear = 0; questLead = null;
  for(const q of questTargets()){
    const d = dist(q.o.x, q.o.y, drone.x, drone.y);
    if(d > QUEST_SENSE) continue;
    const k = (1 - d/QUEST_SENSE) * (Math.abs(zd(q.o.z, drone.z)) < .12 ? 1 : .4);
    if(k > questNear){ questNear = k; questLead = q; }
  }
  if(!questLead) return;
  const o = questLead.o;
  // кадр в открытом окне зовёт вдвое сильнее: это и есть подсказка «бери сейчас»
  const open = questLead.kind === 'frag' && fragOpen(o);
  if(open) questNear = Math.min(1, questNear*1.5);
  for(let i = 0; i < (questNear > .5 ? 3 : 1) * (open ? 2 : 1); i++){
    const a = Math.random()*6.28, r = 200 + Math.random()*420;
    spawn(o.x + Math.cos(a)*r, o.y + Math.sin(a)*r, o.z,
          -Math.cos(a)*2.4, -Math.sin(a)*2.4, 1.3, open || questNear > .5 ? QCOL_HOT : QCOL, 1.6);
  }
  if(open && Math.random() < dt*1.4) fragCall(questNear);
}

function stepWhales(dt){
  for(const wh of whales){
    wh.x = wrap(wh.x + wh.dir*WHALE.speed*dt, W);
    wh.p += dt*.4;
    wh.y = wrap(wh.y + Math.sin(wh.p*.3)*6*dt, H);
    if(Math.random() < dt*.25 && dist(wh.x, wh.y, drone.x, drone.y) < WHALE.size*3) diskChatter();
  }
}

// ---- преследователи: объект вдруг становится тёмно-красным и идёт на шум ----
// каждый живёт в своём диапазоне глубин — сменил слой, и он не достанет
function spawnHunter(){
  for(let n = 0; n < 40; n++){
    const p = props[(Math.random()*nProps)|0];
    if(p.dead || p.hunt) continue;
    const d = dist(p.x, p.y, drone.x, drone.y);
    if(d < 1400 || d > 3600) continue;
    if(havenAt(p.x, p.y) || havenAt(drone.x, drone.y)) continue;   // из тишины не рождается
    p.hunt = true; p.dead = true;
    huntCD = now + HUNT_CD;
    hunters.push({x:p.x, y:p.y, z:p.z, vx:0, vy:0, src:p, lost:0, jit:Math.random()*6.28,
      band: drone.z + (Math.random()-.5)*.1,          // его слой охоты, закреплён навсегда
      line: HUNT_LINES[(Math.random()*HUNT_LINES.length)|0], born:now});
    growl();
    return;
  }
}

function stepHunters(dt){
  const pressure = noise/NOISE_MAX + growth()*.12 + (phase === 'PURGE' || phase === 'OVERHEAT' ? .2 : 0);
  if(hunters.length < Math.min(HUNT_MAX, 1 + (growth() >= 3 ? 1 : 0)) &&
     now > huntCD && Math.random() < pressure*dt*.12) spawnHunter();

  let near = 0, sense = 0;
  for(let i = hunters.length - 1; i >= 0; i--){
    const h = hunters[i];
    h.jit += dt*14;
    const d = dist(h.x, h.y, drone.x, drone.y) || 1;
    const dz = Math.abs(zd(h.z, drone.z));
    const outOfBand = Math.abs(zd(drone.z, h.band)) > HUNT_BAND;   // спрятался по глубине

    h.lost = (quiet > HUNT_LOSE*.5 && noise < 22) || outOfBand ? h.lost + dt : 0;
    if(h.lost > HUNT_LOSE || now - h.born > HUNT_LIFE){
      h.src.dead = false; h.src.hunt = false;
      h.src.x = h.x; h.src.y = h.y; h.src.z = h.z;
      burst(h.x, h.y, h.z, 14, '#8a2b2b');
      hunters.splice(i, 1); continue;
    }

    // вне своего слоя он теряется и почти стоит; в слое — медленно, но неотступно
    const sp = HUNT_SPEED * (outOfBand ? .18 : 1 + growth()*.06);
    h.vx = h.vx*.93 - wrapD(h.x - drone.x, W)/d*sp;
    h.vy = h.vy*.93 - wrapD(h.y - drone.y, H)/d*sp;
    repel(h, dt);                                  // в защищённую страницу не заходит
    h.x = wrap(h.x + h.vx, W); h.y = wrap(h.y + h.vy, H);
    if(havenAt(drone.x, drone.y)) h.lost += dt*2;  // спрятался — теряет след вдвое быстрее
    h.z = wrap(h.z + Math.sign(zd(h.band, h.z))*.0012, 1);          // держится своей полосы

    if(d < HUNT_SENSE){                                             // рябь и рокот заранее
      sense = Math.max(sense, (1 - d/HUNT_SENSE)*(outOfBand ? .35 : 1));
      if(d < HUNT_SENSE*.5 && dz < .25) near = Math.max(near, 1 - d/(HUNT_SENSE*.5));
      if(Math.random() < dt*.4) growl();
    }
    if(d < 90 && dz < .16 && !outOfBand){                           // касание
      drone.pwr -= PWR_HUNT; noise += 10; glitch = 1.6; shake = 16;
      burst(drone.x, drone.y, drone.z, 30, '#ff4d4d'); hitSting();
      h.vx *= -6; h.vy *= -6; h.lost = HUNT_LOSE*.4;
      drone.vx -= wrapD(h.x - drone.x, W)/d*1.6;
      drone.vy -= wrapD(h.y - drone.y, H)/d*1.6;
    }
  }
  huntNear = near; huntSense = sense;
  glitch = Math.max(glitch, sense*.5 + near*.6);
}

// граница защищённой страницы выталкивает охоту наружу
function repel(e, dt){
  for(const hv of HAVENS){
    const dx = wrapD(e.x - hv.x, W), dy = wrapD(e.y - hv.y, H);
    const d = Math.hypot(dx, dy);
    if(d > hv.r + 120 || d === 0) continue;
    const push = (hv.r + 120 - d)/hv.r * 90 * dt;
    e.vx += dx/d*push; e.vy += dy/d*push;
    if(d < hv.r){                                  // затянуло внутрь — выкидывает и сбивает след
      e.x = wrap(hv.x + dx/d*(hv.r + 130), W);
      e.y = wrap(hv.y + dy/d*(hv.r + 130), H);
      e.lost = (e.lost || 0) + dt*3;
      if(Math.random() < dt*4) burst(e.x, e.y, e.z, 4, '#9fe8c4');
    }
  }
}

// луч в лицо: охотник выгорает, тормозит и уходит на другую глубину
function scareHunter(h){
  h.scared = now; h.lost = HUNT_LOSE*.8;
  h.band = wrap(h.band + (Math.random() < .5 ? .3 : -.3), 1);
  burst(h.x, h.y, h.z, 40, '#ffd9a0');
  toast('ПРЕСЛЕДОВАТЕЛЬ ОСЛЕПЛЁН', null, '#ffd9a0');
  scare();
}

// ---- пожиратель пустоты: идёт на свет, в темноте теряется ----
const nulls = [];
function stepNulls(dt){
  if(!save.intro) return;
  const want = Math.min(3, 1 + growth());
  if(nulls.length < want && Math.random() < dt*.06){
    const a = Math.random()*6.28, r = 2600 + Math.random()*1800;
    nulls.push({x: wrap(drone.x + Math.cos(a)*r, W), y: wrap(drone.y + Math.sin(a)*r, H),
                z: Math.random(), vx:0, vy:0, seen:0});
  }
  for(let i = nulls.length - 1; i >= 0; i--){
    const n = nulls[i];
    const d = dist(n.x, n.y, drone.x, drone.y) || 1;
    const lightOn = mouse.down && drone.pwr > 0;
    n.seen = lightOn && d < NULL_SENSE ? Math.min(1, n.seen + dt*.7) : Math.max(0, n.seen - dt*.5);
    if(n.seen > .05){                              // идёт ровно на источник света
      n.vx = n.vx*.95 - wrapD(n.x - drone.x, W)/d*NULL_SPEED*n.seen;
      n.vy = n.vy*.95 - wrapD(n.y - drone.y, H)/d*NULL_SPEED*n.seen;
      n.z = wrap(n.z + Math.sign(zd(drone.z, n.z))*.0009, 1);
    } else { n.vx *= .97; n.vy *= .97; }
    repel(n, dt);                                  // тоже не заходит в защищённые страницы
    n.x = wrap(n.x + n.vx, W); n.y = wrap(n.y + n.vy, H);
    if(d < 200 && Math.abs(zd(n.z, drone.z)) < .18){   // стирает то, к чему прикоснулся
      drone.pwr -= 22*dt; noise += 8*dt; glitch = Math.max(glitch, .8);
      if(Math.random() < dt*3) hitSting();
    }
    if(d > 7000) nulls.splice(i, 1);
  }
}

// ---- индексатор: строка развёртки в фазе INDEX, ловит на своей глубине ----
let indexer = null;
function stepIndexer(dt){
  if(phase !== 'INDEX'){ indexer = null; return; }
  if(!indexer) indexer = {y: wrap(drone.y - 3000, H), z: drone.z, hit: 0};
  indexer.y = wrap(indexer.y + 420*dt, H);
  indexer.z = wrap(indexer.z + .004*dt, 1);
  const dy = Math.abs(wrapD(indexer.y - drone.y, H));
  if(dy < INDEXER_W*.5 && Math.abs(zd(indexer.z, drone.z)) < .12){
    noise += 26*dt; drone.pwr -= 6*dt; glitch = Math.max(glitch, .5);
    indexer.hit = now;
    if(Math.random() < dt*2) indexPing();
  }
}

// ---- призраки: собственные прошлые циклы, замедленные и с помехами ----
function recordTrack(){
  if(now - trackAt < GHOST_STEP) return;
  trackAt = now;
  track.push([Math.round(drone.x), Math.round(drone.y), +drone.z.toFixed(2), mouse.down ? 1 : 0]);
}

function saveTrack(){
  if(track.length < 20) return;
  save.ghosts.unshift(track);
  save.ghosts.length = Math.min(save.ghosts.length, GHOST_MAX);
  persist();
  track = [];
}

function loadGhosts(){
  ghosts = save.ghosts.map((t, i) => ({t, i, k: 0, x: t[0][0], y: t[0][1], z: t[0][2], lag: 0}));
}

function stepGhosts(dt){
  for(const g of ghosts){
    const t = g.t;
    g.k += dt/GHOST_STEP * (.82 - g.i*.06);        // прошлое идёт медленнее настоящего
    if(g.k >= t.length - 1) g.k = 0;
    const i0 = Math.floor(g.k), f = g.k - i0, a = t[i0], b = t[Math.min(i0+1, t.length-1)];
    g.lag = Math.max(0, g.lag - dt);
    if(Math.random() < dt*.7) g.lag = .1 + Math.random()*.35;   // подвисания записи
    if(g.lag > 0) continue;
    g.x = wrap(a[0] + wrapD(b[0]-a[0], W)*f, W);
    g.y = wrap(a[1] + wrapD(b[1]-a[1], H)*f, H);
    g.z = a[2]; g.lit = a[3];
    const d = dist(g.x, g.y, drone.x, drone.y);
    if(d < 900 && Math.abs(zd(g.z, drone.z)) < .2){             // рядом с собой прошлым — помехи
      glitch = Math.max(glitch, (1 - d/900)*.75);
      if(Math.random() < dt*.8) ghostWhisper();
    }
  }
}

function choose(id){
  save.ending = id; persist();
  if(id === 'PURGE PROCESS 1' || id === 'HALT PROCESS 1'){
    finale = {t: now, stage: 0, mode: id === 'PURGE PROCESS 1' ? 'burst' : 'dark'};
    note(id);
    if(finale.mode === 'burst'){ starPulse = 5; collapse(); }
    else { starPulse = 0; fadeOut(); }
    return;
  }
  if(id === 'COMPLETE RESTORE'){
    finale = {t: now, stage: 0, mode: 'loop'};     // звезда начинает втягивать
    note('FINAL_0001.JPG восстановлен.');
    starPulse = 3; finaleRoar();
  } else {
    note('PING-7 IS NOT ALONE');
    showEvent('PROTECT CACHE',
      'Изображение удалено. Восстановление никогда не завершится.<br>' +
      'Звезда разгорается сильнее, чем можно смотреть.<br><br>' +
      'Океан остаётся. В журнале чужая запись:<br><br>PING-7 IS NOT ALONE',
      'ENTER — новый цикл', 'red');
    save.frags = []; save.pending = false; persist();
    grow();
  }
}

// ---- освобождение: процесс снимается. два способа, обе — конец петли ----
// burst: ядро идёт вразнос, кэш выбрасывает наружу, диск размагничивается.
// dark:  процесс просто останавливают. объекты гаснут пачками, остаётся вода.
function stepRelease(dt){
  const T = now - finale.t, burst_ = finale.mode === 'burst';
  finale.stage = T < 6 ? 0 : T < 13 ? 1 : T < 20 ? 2 : 3;
  shake = burst_ ? Math.min(34, T*2.4) : Math.max(0, 6 - T);
  glitch = burst_ ? Math.min(2.6, T*.22) : Math.max(0, .8 - T*.05);
  starPulse = burst_ ? Math.min(7, T*.5) : Math.max(0, 1.2 - T*.09);

  // мир редеет: во взрыве его выносит наружу, в тишине — просто перестаёт отрисовываться
  const kill = Math.min(nProps, Math.floor(T/20*nProps));
  for(let i = 0; i < kill; i++) props[i].dead = true;
  nLife = Math.max(0, Math.floor(BASE_LIFE*(1 - T/20)));

  for(let i = 0; i < (burst_ ? 14 : 3); i++){
    const a = Math.random()*6.28, r = 300 + Math.random()*3400;
    const px = wrap(STAR.x + Math.cos(a)*r, W), py = wrap(STAR.y + Math.sin(a)*r, H);
    const sp = burst_ ? 6 + Math.random()*16 : -(1 + Math.random()*2);
    spawn(px, py, drone.z + (Math.random()-.5)*.25, Math.cos(a)*sp, Math.sin(a)*sp, 2.2,
          burst_ ? ['#ffffff','#ffe9b0','#ff8f8f'][(Math.random()*3)|0] : '#2c4a3c', burst_ ? 3 : 1.4);
  }
  if(burst_){                                     // ударная волна расталкивает дрона
    const d = dist(drone.x, drone.y, STAR.x, STAR.y) || 1;
    drone.vx += wrapD(drone.x - STAR.x, W)/d*T*.9*dt;
    drone.vy += wrapD(drone.y - STAR.y, H)/d*T*.9*dt;
  }
  drone.x = wrap(drone.x + drone.vx, W); drone.y = wrap(drone.y + drone.vy, H);
  drone.vx *= .985; drone.vy *= .985;
  cam.x = wrap(cam.x + wrapD(drone.x - cam.x, W)*.06, W);
  cam.y = wrap(cam.y + wrapD(drone.y - cam.y, H)*.06, H);
  if(Math.random() < dt*(burst_ ? 6 : 1)) finaleTick();
  if(finale.stage === 3 && !finale.done){
    finale.done = true; flash = burst_ ? 6 : 0;
    saveTrack(); save.pending = true; persist();
  }
}

// ---- финал: звезда рвёт изображение, втягивает дрона и записывает его ----
function stepFinale(dt){
  if(finale.mode === 'burst' || finale.mode === 'dark') return stepRelease(dt);
  const T = now - finale.t;
  finale.stage = T < 6 ? 0 : T < 13 ? 1 : T < 19 ? 2 : 3;
  glitch = Math.min(2.2, .3 + T*.18);
  shake  = Math.min(26, T*1.8);
  starPulse = Math.max(starPulse, Math.min(4, T*.3));

  const d = dist(drone.x, drone.y, STAR.x, STAR.y) || 1;
  const pull = (T < 13 ? 30 : 110) * dt;          // сначала тянет, потом всасывает
  drone.vx = drone.vx*.90 - wrapD(drone.x - STAR.x, W)/d*pull;
  drone.vy = drone.vy*.90 - wrapD(drone.y - STAR.y, H)/d*pull;
  drone.z = wrap(drone.z + zd(STAR.z, drone.z)*dt*1.2, 1);
  drone.x = wrap(drone.x + drone.vx, W); drone.y = wrap(drone.y + drone.vy, H);
  if(finale.stage >= 2){                          // последние секунды: втягивает без сопротивления
    drone.x = wrap(drone.x + wrapD(STAR.x - drone.x, W)*dt*1.1, W);
    drone.y = wrap(drone.y + wrapD(STAR.y - drone.y, H)*dt*1.1, H);
  }
  cam.x = wrap(cam.x + wrapD(drone.x - cam.x, W)*.09, W);
  cam.y = wrap(cam.y + wrapD(drone.y - cam.y, H)*.09, H);

  for(let i = 0; i < 6; i++){                     // мир осыпается внутрь звезды
    const a = Math.random()*6.28, r = 400 + Math.random()*3000;
    const px = wrap(STAR.x + Math.cos(a)*r, W), py = wrap(STAR.y + Math.sin(a)*r, H);
    spawn(px, py, drone.z + (Math.random()-.5)*.2,
          -Math.cos(a)*(3 + Math.random()*7), -Math.sin(a)*(3 + Math.random()*7),
          1.6, ['#ffe9b0','#ffd27f','#cfe8d6'][(Math.random()*3)|0], 2);
  }
  if(Math.random() < dt*3) finaleTick();
  if(finale.stage === 3 && !finale.done){         // дрон записан: петля замкнулась
    finale.done = true;
    saveTrack();                                  // последний след уходит в архив призраков
    save.records.push('PING-7');
    save.pending = true; persist();
  }
}
