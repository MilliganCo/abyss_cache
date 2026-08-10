// Загрузочный экран (печатается построчно), главный цикл, финал.

const $boot = document.getElementById('boot');

// экран делится на блоки: ENTER печатает следующий, последний просит команду
function bootBlocks(){
  const b = [
`<b>ABYSS://CACHE</b>

POST ............................ OK
MEMORY 640K ..................... OK
CLOCK ........................... ДРЕЙФ 00:00:12 ЗА ЦИКЛ`,

`DISK 0 .......................... ЧИТАЕТСЯ. ЗАПИСЬ ОТКЛОНЕНА
NETWORK ......................... СОЕДИНЕНИЕ ПОТЕРЯНО (последняя синхронизация: —)
СВЕТИМОСТЬ В СЕКТОРЕ 26800 ...... ИСТОЧНИК НЕ ЗАРЕГИСТРИРОВАН
DIAGNOSTIC DRONE PING-7 ......... ОЖИДАЕТ КОМАНДЫ`,

`RESTORE FINAL_0001.JPG .......... 61% ... 61% ... 61%
ОТКАТ К РЕЗЕРВНОЙ ТОЧКЕ
ПОВТОР ЧЕРЕЗ 480 СЕК`];

  if(save.cycles) b.push(
`ПРЕДЫДУЩИХ ЗАПУСКОВ ............. ${save.cycles}
ЖУРНАЛ ДРОНА .................... СОХРАНЁН (СИСТЕМА ЭТОГО НЕ ПРЕДУСМАТРИВАЛА)
СЛЕДОВ В АРХИВЕ ................. ${save.ghosts.length}` +
    (delivered() ? `\nПЛОТНОСТЬ КЭША .................. +${delivered()*35}% (источник роста не определён)` : ''));

  b.push(
`<span class="dim">эта машина работает без оператора уже неизвестно сколько.
что-то в ней продолжает пытаться. каждые восемь минут — с начала.

в глубине горит то, чего в описи оборудования нет.
оно светит, оно кормит, и оно чего-то ждёт.

команд не выдано. задач не поставлено.</span>`,

`<span class="dim">консоль свободна. дрон отвечает на одну команду.</span>

<b>&gt; WAKE PING-7</b>`);
  return b;
}

let blocks = [], bi = 0, typed = '', typing = null, awaitCmd = false, cmdBuf = '';

function renderBoot(){
  const done = blocks.slice(0, bi).join('\n\n');
  const tail = awaitCmd
    ? `\n\n<b>&gt; ${cmdBuf}<span class="caret">_</span></b>`
    : (typing ? '' : '\n\n<b>[ENTER]</b>');
  $boot.innerHTML = done + (typed ? (done ? '\n\n' : '') + typed : '') + tail;
}

function typeBlock(){
  const src = blocks[bi];
  let i = 0; typed = '';
  clearInterval(typing);
  typing = setInterval(() => {
    if(i >= src.length){ finishBlock(); return; }
    // теги проскакиваем целиком, иначе разметка мигает
    if(src[i] === '<'){ const j = src.indexOf('>', i); typed += src.slice(i, j+1); i = j + 1; }
    else { typed += src[i++]; if(src[i-1] !== ' ' && Math.random() < .25) key(); }
    renderBoot();
  }, 9);
}

function finishBlock(){
  clearInterval(typing); typing = null;
  typed = ''; bi++;
  if(bi >= blocks.length) awaitCmd = true;
  else $boot.dataset.ready = '1';
  renderBoot();
}

function bootAdvance(){
  audioInit();                                      // Enter — это жест пользователя, звук можно
  if(typing){ finishBlock(); return; }             // ENTER во время печати — дописать разом
  if(bi < blocks.length) typeBlock();
}

function bootInit(){
  blocks = bootBlocks(); bi = 0; typed = ''; awaitCmd = false; cmdBuf = '';
  $boot.style.display = 'block';
  renderBoot();
  typeBlock();
}
bootInit();

// ввод на загрузочном экране: ENTER листает, в конце — команда пробуждения
addEventListener('keydown', e => {
  if(running || $boot.style.display === 'none') return;
  if(awaitCmd){
    if(e.key === 'Enter'){
      const c = cmdBuf.trim().toUpperCase();
      if(c === 'WAKE PING-7' || c === 'WAKE' || c === 'PING-7'){ key(); start(); }
      else { cmdBuf = ''; sonarFail(); $boot.dataset.err = '1'; renderBoot(); }
    }
    else if(e.key === 'Backspace') cmdBuf = cmdBuf.slice(0, -1);
    else if(e.key.length === 1 && cmdBuf.length < 24) cmdBuf += e.key;
    renderBoot(); e.preventDefault(); return;
  }
  if(e.key === 'Enter'){ bootAdvance(); e.preventDefault(); }
});

function start(){
  $boot.style.display = 'none';
  running = true; paused = false;
  t0 = performance.now()/1000; now = t0; trackAt = now;
  save.cycles++; persist();
  audioInit(); grow(); loadGhosts();
  if(!save.intro){ drone.x = 3200; drone.y = 900; drone.z = .5; cam.x = drone.x; cam.y = drone.y; }
  requestAnimationFrame(loop);
}

let prevT = 0;
function loop(){
  if(!running) return;
  requestAnimationFrame(loop);
  const t = performance.now()/1000;
  const dt = Math.min(.05, prevT ? t - prevT : .016);
  prevT = t; now = t;
  if(!paused){
    if(finale) stepFinale(dt);
    else if(save.intro){                            // до RECORD_0 цикл не идёт: вступление вне времени
      cycleT = (now - t0) % CYCLE;
      if(now - t0 >= CYCLE){ reboot(); phaseSting('BOOT'); }
      phase = phaseAt(cycleT);
      if(phase !== lastPhase){ phaseSting(phase); lastPhase = phase; flash = .5; }
    } else { cycleT = 0; phase = 'BOOT'; }
    step(dt);
    stepFx(dt);
  }
  draw();
  if(save.pending && !paused) finish();
}

// COMPLETE RESTORE: звезда дописала последний кадр — им оказался ты
function finish(){
  running = false; save.pending = false;
  const cycles = save.cycles, ghosts = save.ghosts.length;
  save.frags = []; save.seen = []; save.photos = []; save.zones = [];
  save.records = []; save.cycles = 0; save.intro = false; persist();
  $boot.style.display = 'block';
  $boot.innerHTML =
`<b>RESTORE FINAL_0001.JPG ........ 100%</b>

ИСТОЧНИК КАДРА .................. НАЙДЕН В ПАМЯТИ ПРОЦЕССА 1
ИМЯ ПРОЦЕССА .................... PING-7
ОСВОБОЖДЕНИЕ ПОВРЕЖДЁННОЙ ПАМЯТИ  4 218 МБ
ПРОЦЕССОВ ЗАВЕРШЕНО ............. 1

<span class="dim">последнего кадра не было ни в одном секторе.
его нельзя было найти — только прожить.
звезда собрала его из того, кто искал.

на снимке человек за этим компьютером.
рядом второй, полупрозрачный, чуть отстающий,
как запись, которую проигрывают медленнее, чем писали.

циклов пройдено: ${cycles}   ·   следов в архиве: ${ghosts}

RESTORE FINAL_0001.JPG .......... 61% ... 61% ... 61%
ОТКАТ К РЕЗЕРВНОЙ ТОЧКЕ
ПОВТОР ЧЕРЕЗ 480 СЕК</span>

<b>[ENTER]</b>`;
  addEventListener('keydown', function again(e){
    if(e.key !== 'Enter') return;
    removeEventListener('keydown', again);
    location.reload();
  });
}

// ---- self-check: открыть index.html#test, смотреть консоль ----
if(location.hash === '#test'){
  const eq = (a,b,m) => { if(a !== b) throw new Error(m + ': ' + a + ' != ' + b); };
  eq(phaseAt(0),'BOOT','t0'); eq(phaseAt(120),'INDEX','начало index');
  eq(phaseAt(359),'NET','конец net'); eq(phaseAt(450),'OVERHEAT','перегрев');
  eq(zoneAt(0),'BOOT SECTOR','вступление'); eq(zoneAt(GATE_Y),'DESKTOP SHALLOWS','мелководье');
  eq(zoneAt(13000),'PHOTO ARCHIVE','архив'); eq(zoneAt(H-1),'MODEM ABYSS','бездна');
  eq(zoneAt(STAR.y),'MODEM ABYSS','звезда в бездне');
  eq(RECORDS[0].id,'RECORD_0','первая запись — вступление');
  eq(zoneAt(RECORDS[0].y),'BOOT SECTOR','RECORD_0 лежит во вступительной зоне');
  eq(FRAGS.every(f => zoneAt(f.y) === f.zone), true, 'фрагменты в заявленных зонах');
  eq(FRAGS.every(f => zoneAt(f.y) !== 'BOOT SECTOR'), true, 'во вступлении фрагментов нет');
  eq(Math.round(wrapD(10 - (W-10), W)), 20, 'мир замкнут по X');
  eq(+zd(.02, .98).toFixed(3), .04, 'глубина замкнута в кольцо');
  eq(Object.keys(LIGHT_T).every(k => LIGHT_T[k] >= 1.0), true, 'всё вскрывается не мгновенно');
  eq(PWR_TAP > LIGHT_T.node*PWR_LIGHT, true, 'выкачка узла окупает потраченный свет');
  eq(props.length, BASE_PROPS + GROW_PROPS*4, 'пул объектов рассчитан на полный рост');
  eq(nProps, BASE_PROPS + GROW_PROPS*delivered(), 'активных объектов по числу сданных');
  eq(props.every(p => !p.photo || zoneAt(p.y) === 'PHOTO ARCHIVE'), true, 'фотографии только в архиве');
  eq([...new Set(MAP_LINKS.flat())].every(id => typeof known(id) === 'boolean'),
     true, 'каждый узел карты имеет условие обнаружения');
  eq(['star','frag','node','far'].includes(currentGoal().kind), true, 'сонару всегда есть что ответить');
  eq(GHOST_MAX > 0 && GHOST_STEP > 0, true, 'призраки пишутся');
  eq(HUNT_SPEED < .4, true, 'охотник заметно медленнее дрона');
  eq(LIGHT_T.hunter < LIGHT_T.frag, true, 'отпугнуть быстрее, чем поднять кадр');
  eq(HAVENS.length >= ZONES.length, true, 'убежище есть в каждой зоне');
  eq(HAVENS.every(h => !!havenAt(h.x, h.y)), true, 'центр убежища считается убежищем');
  eq(havenAt(HAVENS[0].x + HAVENS[0].r + 10, HAVENS[0].y), null, 'снаружи убежища нет');
  eq(FRAGS.every(f => !havenAt(f.x, f.y)), true, 'кадры лежат не в тишине — за ними надо выходить');
  eq(HAVEN_PWR > PWR_REST, true, 'в убежище заряжает быстрее, чем просто стоять');
  console.log('self-check OK');
}
