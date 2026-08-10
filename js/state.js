// Состояние сессии, память игрока, ввод, события-паузы, терминал.

const save = Object.assign(
  {frags:[], cmds:[], log:[], seen:[], photos:[], zones:[], records:[], ghosts:[],
   wrecks:[], clues:[], thoughts:[],
   intro:false, ending:null, cycles:0, pending:false},
  JSON.parse(localStorage.getItem('abyss') || '{}'));
const persist = () => localStorage.setItem('abyss', JSON.stringify(save));

function note(s){
  if(save.log.includes(s)) return;
  save.log.unshift(s);
  save.log.length = Math.min(save.log.length, 7);
  persist();
}

// ---- знание ----
// Улика — не предмет, а понятая вещь. Прогресс игры измеряется ими, а не фрагментами:
// два финала в ядре открываются знанием, а не собранным изображением.
const knows = id => save.clues.includes(id);
const CORE_CLUES = () => CLUES.filter(c => c.core).map(c => c.id);
const knowsAll = () => CORE_CLUES().every(knows);

function unlock(id){
  if(!id || knows(id)) return false;
  save.clues.push(id); persist();
  const c = CLUES.find(c => c.id === id);
  toast('ПОНЯТО', c ? c.t : id, '#bff4d8');
  clueSting();
  return true;
}

// ---- мысли PING-7: единственный канал подсказки. не приказ, а догадка ----
let thought = null, thinkAt = -99;
function think(t, force){
  if(!force && now - thinkAt < THINK_CD) return;
  thinkAt = now; thought = {t, at: now};
}

let clueAt = 0;
function stepMind(dt){
  if(now - clueAt < 1) return;                  // раз в секунду: проверки дешёвые, но не каждый кадр
  clueAt = now;
  if(save.cycles >= 1)                       unlock('K_FILE');
  if(save.cycles >= 2)                       unlock('K_LOOP');
  if(save.zones.includes('MODEM ABYSS'))     unlock('K_STAR');
  if(save.wrecks.length >= 2)                unlock('K_DEEPER');
  if(save.seen.includes('каталог перемонтирован 4118 раз')) unlock('K_MANY');
  if(knows('K_STARWAS') && delivered() >= 2)  unlock('K_COST');

  for(const th of THOUGHTS){
    if(th.once && save.thoughts.includes(th.id)) continue;
    if(now - thinkAt < THINK_CD || !th.cond()) continue;
    if(th.once){ save.thoughts.push(th.id); persist(); }
    think(th.t);
    break;
  }
  if(thought && now - thought.at > 13) thought = null;
}

const drone = {x:2000, y:900, z:.30, vx:0, vy:0, pwr:PWR_MAX};
const cam   = {x:2000, y:900};
const mouse = {x:innerWidth/2, y:innerHeight/2, px:0, py:0, speed:0, down:false};

let now=0, t0=0, cycleT=0, phase='BOOT', lastPhase='BOOT';
let running=false, paused=false, pauseAt=0;
let pulses=[], labels=[], flash=0, shake=0, stabilize=false;
let noise=0, glitch=0, quiet=0, scanReady=0;
let huntNear=0, huntSense=0, huntCD=0, mapOpen=false;
let echo=null;                                 // отклик сонара: направление на то, что сейчас важно
let spaceAt=0, beam=null, gateBreak=0;         // beam — объект, который сейчас держим лучом
let haven=null;                                // защищённая страница памяти, если стоим внутри
let ghosts=[], track=[], trackAt=0;            // призраки прошлых циклов и текущая запись
let finale=null;                               // сцена поглощения звездой
let carry=[];                                  // фрагменты в манипуляторе, до сдачи звезде
let colorFlash=null;                           // единственный источник цвета: восстановленный кадр
let mountUntil=0, pingArrow=null;
let termOpen=false, termText='', termEcho='', termEchoT=-99;
let waveY=-1e5, purgeY=-1e5, coreOpen=false;

const delivered = () => save.frags.length;
const growth = () => delivered();              // 0..4 — насколько мир разросся

// ---- находка: крупно по центру, затем растворяется и оседает в журнал справа ----
let toasts = [];
function toast(title, sub, col){
  toasts.push({title, sub, col: col || '#ffd27f', t: now});
  if(sub) note(sub);
}

// ---- событие: мир замирает, показывается панель ----
const $event = () => document.getElementById('event');
function showEvent(title, body, sub, cls){
  paused = true; pauseAt = now; flash = 1.6; shake = 14;
  const box = document.getElementById('eventbox');
  box.className = cls || '';
  box.innerHTML = '<h1>' + title + '</h1>' + body +
    '<span class="dim">' + (sub || 'ENTER — продолжить') + '</span>';
  $event().classList.add('on');
  chime();
}
function closeEvent(){
  if(!paused) return;
  t0 += now - pauseAt;                         // цикл стоит, пока читаешь
  paused = false;
  $event().classList.remove('on');
}

// ---- фрагмент поднят светом: тост по центру, дальше нести к звезде ----
function liftFrag(f){
  if(save.frags.includes(f.id) || carry.includes(f.id)) return;
  carry.push(f.id);
  burst(drone.x, drone.y, drone.z, 50, '#ffd27f');
  flash = 1.1;
  toast('ПОДНЯТ ФРАГМЕНТ · ' + f.id, f.text.split('\n')[0] + ' — нести к звезде');
  liftSound();
}

function deliver(){
  const got = carry.splice(0);
  got.forEach(id => { if(!save.frags.includes(id)) save.frags.push(id); });
  persist(); grow();
  const left = FRAGS.length - delivered();
  if(!left) learn('RESTORE FINAL_0001', null);
  starPulse = 1;
  burst(STAR.x, STAR.y, STAR.z, 160, '#ffe9b0');
  // одна и та же сцена читается по-разному, когда игрок уже понял её цену
  showEvent('ЗВЕЗДА ПРИНЯЛА ' + got.length + ' ФР.',
    knows('K_COST')
      ? 'Свет уходит внутрь и возвращается тусклее.<br>' +
        'Вода густеет: из ниоткуда проступают объекты,<br>' +
        'которых в прошлом цикле здесь не было.<br>' +
        'Она дописывает их из себя. Радиус свечения — ' +
        Math.round(starR()) + ' при исходных ' + STAR.R + '.<br><br>' +
        'СДАНО ' + delivered() + '/' + FRAGS.length
      : 'Свет уходит внутрь и возвращается плотнее.<br>' +
        'Вода вокруг густеет: из ниоткуда проступают объекты,<br>' +
        'которых в прошлом цикле здесь не было.<br><br>' +
        'СДАНО ' + delivered() + '/' + FRAGS.length,
    left ? (knows('K_COST') ? 'мир стал больше. звезда — меньше.   ·   ENTER'
                            : 'мир стал больше. и громче.   ·   ENTER')
         : 'FINAL_0001.JPG собран. звезда ждёт перегрева.   ·   ENTER');
}

// ---- фотография: на несколько секунд в мире появляется цвет ----
function enterPhoto(p){
  const ph = p.photo;
  if(save.photos.includes(ph.id)) return;
  save.photos.push(ph.id); persist();
  colorFlash = {col: ph.col, t: now};
  burst(p.x, p.y, p.z, 60, ph.col);
  photoSound();
  showEvent('ВОССТАНОВЛЕНО · ' + ph.id + ' · ' + ph.title, ph.text,
    'цвет держится, пока держится кадр   ·   ENTER', 'photo');
  document.getElementById('eventbox').style.borderColor = ph.col;
}

function learn(cmd, ev){
  if(save.cmds.includes(cmd)) return false;
  save.cmds.push(cmd); persist();
  toast('КОМАНДА · ' + cmd, COMMANDS[cmd].desc, '#7fd9ff');
  liftSound();
  return true;
}

// ---- запись: вступительная и лорные, тоже берутся светом ----
function takeRecord(r){
  if(save.records.includes(r.id)) return;
  save.records.push(r.id); persist();
  burst(r.x, r.y, r.z, 70, '#cfe8d6'); flash = 1.4;
  const first = r.id === 'RECORD_0';
  showEvent(r.title, r.text,
    first ? 'мембрана под сектором загрузки распалась. цикл пошёл.   ·   ENTER'
          : 'запись сохранена в журнал   ·   ENTER');
  if(first){
    save.intro = true; persist();
    note('ВСТУПЛЕНИЕ ПРОЙДЕНО — цикл 8 минут запущен');
    gateBreak = now;
  }
  unlock(r.clue);
}

// ---- обломок предшественника: лог того, кого опустили раньше тебя ----
function takeWreck(w){
  if(save.wrecks.includes(w.id)) return;
  save.wrecks.push(w.id); persist();
  burst(w.x, w.y, w.z, 80, '#9fb8c9'); flash = 1.2;
  wreckHum();
  showEvent(w.title, w.text, 'слой ' + Math.round(w.z*ZLAYERS) + ' · корпус той же серии   ·   ENTER');
  unlock(w.clue);
}

// ---- звезда отвечает: держать фонарь на ядре, стоя вплотную ----
function readStar(){
  if(save.records.includes(STAR_LOG.id)) return;
  save.records.push(STAR_LOG.id); persist();
  starPulse = 2.4; flash = 1.6;
  burst(STAR.x, STAR.y, STAR.z, 200, '#ffe9b0');
  starVoice();
  showEvent(STAR_LOG.title, STAR_LOG.text, 'ENTER');
  unlock('K_STARWAS');
}

// ---- терминал ----
function cmdKnown(c){ return COMMANDS[c] && (COMMANDS[c].known || save.cmds.includes(c)); }
function termList(){
  return Object.keys(COMMANDS).filter(cmdKnown)
    .map(c => '  ' + c.padEnd(20) + COMMANDS[c].desc).join('\n');
}

function submit(cmd){
  termEchoT = now;
  if(!COMMANDS[cmd]) return termEcho = '> ' + cmd + '\n  :: unknown token';
  if(!cmdKnown(cmd)) return termEcho = '> ' + cmd + '\n  :: синтаксис верный, происхождение неизвестно';
  switch(cmd){
    case 'HELP':
      termEcho = 'известные команды:\n' + termList(); break;
    case 'PING LOST_NODE': {
      // отдаёт координату, но не условие: как вскрыть — придётся выяснить самому
      const tgt = carry.length ? STAR
        : FRAGS.filter(f => !fragTaken(f))
               .sort((a,b) => dist(a.x,a.y,drone.x,drone.y) - dist(b.x,b.y,drone.x,drone.y))[0];
      if(!tgt){ termEcho = '> PING LOST_NODE\n  :: потерянных узлов нет'; break; }
      pingArrow = {x:tgt.x, y:tgt.y, z:tgt.z, until: now + 30};
      termEcho = '> PING LOST_NODE\n  :: ' +
                 (carry.length ? 'несёшь фрагмент — курс на звезду'
                               : 'отклик ' + tgt.id + (fragArmed(tgt) ? ' · окно открыто' : ' · окно закрыто')) +
                 '\n  :: дистанция ' + Math.round(dist(tgt.x,tgt.y,drone.x,drone.y)) +
                 ' / слой ' + Math.round(tgt.z*ZLAYERS);
      drone.pwr -= 2; break; }
    case 'MOUNT A:':
      mountUntil = now + 20; drone.pwr -= 8; noise += 20;
      termEcho = '> MOUNT A:\n  :: каталог поднят, объекты подсвечены 20 сек'; break;
    case 'LISTEN PORT_23': {
      if(phase !== 'NET'){ termEcho = '> LISTEN PORT_23\n  :: порт молчит — модем не соединяется'; break; }
      const f = FRAGS.find(f => f.zone === 'MODEM ABYSS');   // порт выдаёт, где искать кадр
      pingArrow = {x:f.x, y:f.y, z:f.z, until: now + 60};
      termEcho = '> LISTEN PORT_23\n  :: поток идёт из сектора ' + Math.round(f.y) +
                 ', слой ' + Math.round(f.z*ZLAYERS) +
                 '\n  :: приём только с этого слоя. соседний уже тишина.';
      break; }
    case 'KILL -9 SELF':
      noise = 0; hunters.forEach(h => h.lost = 99); drone.pwr *= .5; glitch = 1.5;
      termEcho = '> KILL -9 SELF\n  :: процесс перезапущен. тишина. энергии вдвое меньше.'; break;
    case 'RESTORE FINAL_0001':
      termEcho = coreOpen && dist(STAR.x,STAR.y,drone.x,drone.y) < 600
        ? '> RESTORE FINAL_0001\n  :: узлы рядом. выбери один физически.' +
          (knowsAll() ? '\n  :: доступно снятие процесса 1. права выданы не системой.' : '')
        : '> RESTORE FINAL_0001\n  :: нужен узел звезды при перегреве';
      break;
  }
}

// импульс сонара: короткое нажатие пробела. удержание — стабилизация и подзарядка
function firePulse(){
  if(now < scanReady || drone.pwr <= PWR_SCAN){ sonarFail(); return; }
  scanReady = now + SCAN_CD; drone.pwr -= PWR_SCAN; noise += NOISE_SCAN;
  pulses.push({x:drone.x, y:drone.y, z:drone.z, r:0, fresh:true});
}

// ---- ввод ----
addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
addEventListener('mousedown', e => {
  if(paused){ closeEvent(); return; }
  if(!running) return;
  mouse.down = true;                     // мышь теперь только фонарь
  e.preventDefault();
});
addEventListener('mouseup',  () => mouse.down = false);
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('wheel', e => {
  drone.z = wrap(drone.z + Math.sign(e.deltaY) * ZSTEP, 1);   // глубина замкнута в кольцо
  dive();
}, {passive:true});

addEventListener('keydown', e => {
  if(!running) return;                     // загрузочным экраном управляет main.js
  if(paused){ if(['Enter','Escape',' '].includes(e.key)) closeEvent(); e.preventDefault(); return; }
  if(termOpen){
    if(e.key === 'Enter'){ submit(termText.trim().toUpperCase()); termText=''; termOpen=false; }
    else if(e.key === 'Escape'){ termOpen = false; termText = ''; }
    else if(e.key === 'Backspace') termText = termText.slice(0,-1);
    else if(e.key.length === 1) termText += e.key;
    e.preventDefault(); return;
  }
  if('tTеЕ'.includes(e.key)){ termOpen = true; termText = ''; }
  if('mMьЬ'.includes(e.key)){ mapOpen = !mapOpen; dive(); }
  if(e.code === 'Space' && !e.repeat){ spaceAt = now; stabilize = true; e.preventDefault(); }
});
addEventListener('keyup', e => {
  if(e.code !== 'Space') return;
  if(running && !paused && now - spaceAt < .28) firePulse();   // коротко нажал — импульс
  stabilize = false; spaceAt = 0;
});
