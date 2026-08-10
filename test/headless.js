// Гоняем встроенный self-check игры вне браузера: подставляем минимальный DOM/canvas
// и склеиваем скрипты в один контекст — ровно так же, как это делают <script> теги.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const files = ['config.js','state.js','fx.js','world.js','audio.js','render.js','main.js'];

const noop = () => {};
const ctx2d = new Proxy({}, {get: (t, k) =>
  k === 'canvas' ? {} :
  ['createRadialGradient','createLinearGradient'].includes(k) ? () => ({addColorStop: noop}) :
  ['measureText'].includes(k) ? () => ({width: 10}) : noop});

const el = () => ({dataset:{}, style:{}, classList:{add:noop, remove:noop},
                   innerHTML:'', textContent:'', getContext: () => ctx2d,
                   width:1280, height:720, appendChild:noop});
const els = {};
const store = {};

const sandbox = {
  console, Math, Date, JSON, Object, Array, String, Number, Set, Boolean, Error,
  isNaN, parseInt, parseFloat,
  innerWidth:1280, innerHeight:720,
  location:{hash:'#test', reload:noop},
  performance:{now: () => 1000},
  requestAnimationFrame: noop, setInterval: () => 0, clearInterval: noop, setTimeout: () => 0,
  addEventListener: noop, removeEventListener: noop,
  localStorage:{getItem: k => store[k] || null, setItem: (k,v) => store[k]=v},
  document:{getElementById: id => els[id] || (els[id] = el())},
  AudioContext: function(){ throw new Error('audio must stay lazy'); }
};
sandbox.window = sandbox;
vm.createContext(sandbox);

const src = files.map(f => fs.readFileSync(path.join(root,'js',f),'utf8')).join('\n;\n');
try {
  vm.runInContext(src, sandbox, {filename:'abyss-bundle.js'});
  console.log('bundle loaded, self-check ran above');

  // --- дымовой прогон: шагаем симуляцией и рисуем во всех интересных состояниях ---
  const drive = `
  const OK = (c, m) => { if(!c) throw new Error('smoke: ' + m); };
  save.intro = true; running = true; audioInit = () => {};
  let t = 1000;
  const tickN = (n, dt) => { for(let i=0;i<n;i++){ t += dt; now = t;
    cycleT = (now - t0) % CYCLE; phase = phaseAt(cycleT); step(dt); stepFx(dt); draw(); } };

  // 1. обычный ход, фонарь выключен: сонар не должен кормить
  drone.pwr = 60; mouse.down = false;
  const before = drone.pwr;
  for(let i=0;i<12;i++){ scanReady = 0; firePulse(); tickN(3, .05); }
  OK(drone.pwr < before, 'спам сонаром всё ещё даёт энергию: ' + before + ' -> ' + drone.pwr);

  // 2. фонарь включён, все фазы цикла, карта открыта
  mouse.down = true;
  for(const p of ['BOOT','INDEX','NET','PURGE','OVERHEAT']){
    t0 = now - PHASES.find(x => x[1] === p)[0] - 5;
    tickN(20, .05);
  }
  mapOpen = true; draw(); mapOpen = false;

  // 3. сбор темнотой: подойти к кадру-dark в тишине и замереть
  const f0 = FRAGS.find(f => f.gate === 'dark');
  mouse.down = false; stabilize = true; noise = 0;
  drone.x = f0.x; drone.y = f0.y; drone.z = f0.z; cam.x = f0.x; cam.y = f0.y;
  for(let i=0;i<160;i++){ noise = 0; t += .05; now = t; darkCollect(.05); }
  OK(carry.includes(f0.id) || save.frags.includes(f0.id), 'кадр dark не берётся темнотой');
  stabilize = false; carry = [];

  // 4. знание открывает четвёртый узел и оба финала освобождения
  OK(nodes().length === 2, 'узлов освобождения быть не должно без улик');
  CLUES.filter(c => c.core).forEach(c => save.clues.push(c.id));
  OK(nodes().length === 4, 'улики не открыли узлы освобождения');
  OK(knowsAll(), 'knowsAll не сработал');

  // 5. затухание звезды
  const r0 = starR();
  save.frags = FRAGS.map(f => f.id);
  OK(starR() < r0, 'звезда не садится за сданные фрагменты');
  OK(starR() > 0, 'звезда ушла в ноль');

  // 6. оба новых финала доводятся до конца без падения
  for(const mode of ['burst','dark']){
    save.pending = false; finale = {t: now, stage: 0, mode};
    for(let i=0;i<500;i++){ t += .05; now = t; stepFinale(.05); stepFx(.05); draw(); }
    OK(save.pending, 'финал ' + mode + ' не дошёл до конца');
  }
  console.log('smoke OK');
  `;
  vm.runInContext(drive, sandbox, {filename:'smoke.js'});
} catch(e){
  console.error('FAIL:', e.message);
  console.error(e.stack.split('\n').slice(0,6).join('\n'));
  process.exit(1);
}
