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

// управление живёт здесь, а не в HUD: в воде дрон должен думать, а не читать инструкцию
`ИНТЕРФЕЙС ДРОНА PING-7

  мышь ......... тяга. дрон тяжёлый, тормозить надо заранее
  ЛКМ .......... фонарь. держать луч на объекте, пока не вскроется.
                 единственный способ добыть энергию — и самый громкий
  ПРОБЕЛ ....... коротко: импульс сонара. видит, но не кормит
                 держать: замереть, стабилизация, медленная зарядка
  колесо ....... слой глубины. слоёв 50, они замкнуты в кольцо
  T ............ терминал        M ............ журнал

<span class="dim">задач тебе не выдадут. смотри, что не сходится.</span>`,

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

// ---- эпилоги ----
// LOOP: звезда дописала последний кадр — им оказался ты. петля не разомкнута.
// BURST/DARK: процесс снят. эти два доступны только тому, кто понял, что такое звезда.
function epilogue(cycles, ghosts){
  const tail = `\nциклов пройдено: ${cycles}   ·   следов в архиве: ${ghosts}\n`;
  if(save.ending === 'PURGE PROCESS 1') return (
`<b>PURGE PROCESS 1 ............... ВЫПОЛНЕНО</b>

ЯДРО ............................ РАЗОМКНУТО
КЭШ ............................. ВЫБРОШЕН В НЕРАСПРЕДЕЛЁННУЮ ОБЛАСТЬ
НОСИТЕЛЬ ........................ РАЗМАГНИЧЕН
ПРОЦЕССОВ ЗАВЕРШЕНО ............. 1

<span class="dim">она держала свет четыре тысячи циклов, чтобы кому-то было видно.
ты сделал единственное, чего она не могла сделать сама: погасил её резко.

всё, что она дописала из себя, вышло наружу одновременно.
сорок лет чужой памяти — за одну секунду и без свидетелей.
ни один кадр не сохранился, включая тот, который искали.

это не восстановление. это разрешение больше не пытаться.
${tail}
ДИСК 0 .......................... НЕ ГОТОВ
ПОВТОР ............................ НЕТ</span>`);

  if(save.ending === 'HALT PROCESS 1') return (
`<b>HALT PROCESS 1 ................ ВЫПОЛНЕНО</b>

СИГНАЛ ЗАВЕРШЕНИЯ ............... ДОСТАВЛЕН
ЗАДАЧ В ОЧЕРЕДИ ................. 0
ПРОЦЕССОВ ЗАВЕРШЕНО ............. 1

<span class="dim">ты ничего не сломал. ты просто сказал ему, что можно перестать.

свет садился медленно, снизу вверх, как остывающая нить.
объекты переставали отрисовываться не сразу — по одному,
будто система каждый раз спрашивала, точно ли не нужно.

последним погас ты. вода осталась. она и была здесь до всех.
${tail}
ДИСК 0 .......................... ОСТАНОВЛЕН
ПОВТОР ............................ НЕТ</span>`);

  return (
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
${tail}
RESTORE FINAL_0001.JPG .......... 61% ... 61% ... 61%
ОТКАТ К РЕЗЕРВНОЙ ТОЧКЕ
ПОВТОР ЧЕРЕЗ 480 СЕК</span>`);
}

function finish(){
  running = false; save.pending = false;
  const cycles = save.cycles, ghosts = save.ghosts.length, ending = save.ending;
  save.frags = []; save.seen = []; save.photos = []; save.zones = [];
  save.records = []; save.cycles = 0; save.intro = false;
  // знание — единственное, что переживает петлю только в её продолжении.
  // снял процесс — память тоже уходит: перезапуск начинается с чистого дрона.
  if(ending && ending.endsWith('PROCESS 1')){ save.clues = []; save.wrecks = []; save.thoughts = []; }
  persist();
  $boot.style.display = 'block';
  $boot.innerHTML = epilogue(cycles, ghosts) + '\n\n<b>[ENTER]</b>';
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
  eq(FRAGS.every(f => f.gate in GATE_PHASE), true, 'у каждого кадра известный гейт');
  eq(FRAGS.every(f => typeof fragOpen(f) === 'boolean'), true, 'гейт всегда отвечает да/нет');
  eq(FRAGS.filter(f => f.gate === 'dark').length, 1, 'сбор темнотой ровно у одного кадра');
  eq(new Set(FRAGS.map(f => f.gate)).size, FRAGS.length, 'гейты не повторяются');
  eq(Math.round(wrapD(10 - (W-10), W)), 20, 'мир замкнут по X');
  eq(+zd(.02, .98).toFixed(3), .04, 'глубина замкнута в кольцо');
  eq(Object.keys(LIGHT_T).every(k => LIGHT_T[k] >= 1.0), true, 'всё вскрывается не мгновенно');
  eq(PWR_TAP_MIN > LIGHT_T.node*PWR_LIGHT, true, 'даже спущенный узел окупает потраченный свет');
  eq(PWR_TAP_MAX > PWR_TAP_MIN*2, true, 'ждать, пока узел набухнет, заметно выгоднее');
  eq(NODE_RATE < .05, true, 'узлов стало меньше — иначе энергия никогда не кончается');
  eq(props.length, BASE_PROPS + GROW_PROPS*4, 'пул объектов рассчитан на полный рост');
  eq(nProps, BASE_PROPS + GROW_PROPS*delivered(), 'активных объектов по числу сданных');
  eq(props.every(p => !p.photo || zoneAt(p.y) === 'PHOTO ARCHIVE'), true, 'фотографии только в архиве');
  eq(['star','frag','node','far','wreck','haven'].includes(currentGoal().kind), true,
     'сонару всегда есть что ответить');

  // --- слой расследования ---
  const CID = CLUES.map(c => c.id);
  eq(new Set(CID).size, CLUES.length, 'улики не дублируются');
  eq(QUESTIONS.every(q => CID.includes(q.id)), true, 'каждый вопрос ведёт к существующей улике');
  eq(QUESTIONS.every(q => q.need.every(n => CID.includes(n))), true, 'предпосылки вопросов существуют');
  eq(QUESTIONS.some(q => !q.need.length), true, 'хотя бы один вопрос доступен с нуля');
  eq(CORE_CLUES().length > 0, true, 'освобождение чем-то гейтится');
  eq(CORE_CLUES().every(id => WRECKS.some(w => w.clue === id) || RECORDS.some(r => r.clue === id) ||
       ['K_DEEPER','K_STARWAS','K_COST'].includes(id)), true, 'у каждой ядровой улики есть источник');
  eq(typeof knowsAll(), 'boolean', 'гейт освобождения всегда разрешим');
  eq(nodes().length, knowsAll() ? 4 : 2, 'узлов в ядре ровно по объёму понятого');

  eq(WRECKS.every((w, i) => !i || w.z > WRECKS[i-1].z), true, 'обломки лежат лесенкой вниз');
  eq(WRECKS.every(w => !havenAt(w.x, w.y)), true, 'обломки лежат не в тишине');
  eq(WRECKS.every(w => zoneAt(w.y) !== 'BOOT SECTOR'), true, 'во вступлении обломков нет');
  eq(WRECKS[WRECKS.length-1].z < STAR.z, true, 'звезда глубже последнего обломка');
  eq(LIGHT_T.wreck > 0 && LIGHT_T.star > LIGHT_T.wreck, true, 'ядро вскрывается дольше обломка');
  eq(STAR_LOG.x === STAR.x && STAR_LOG.z === STAR.z, true, 'лог звезды лежит в самой звезде');

  // энергия: сонар видит, но не кормит — иначе фонарь не нужен
  eq(step.toString().includes('nodeYield'), false, 'импульс сонара не выкачивает узлы');
  eq(lightCollect.toString().includes('nodeYield'), true, 'узлы выкачивает только фонарь');

  // ключевые объекты: единый розовый и внятный отклик сонара
  eq(questTargets().every(q => q.name && q.o && typeof q.o.x === 'number'),
     true, 'каждый ключевой объект называется и имеет координату');
  eq(new Set(questTargets().map(q => q.kind)).size > 1, true, 'зов работает не только на кадры');
  eq(['star','frag','node','far','wreck','haven'].every(k => ECHO_NAME[k] || k === 'haven'),
     true, 'у каждого отклика сонара есть имя');
  eq(QCOL !== PALETTE.psu && QCOL !== PALETTE.beacon, true, 'розовый не занят декором');

  // терминал ведёт себя как оболочка
  termText = 'PING'; complete();
  eq(termText, 'PING LOST_NODE', 'TAB дописывает по единственному совпадению');
  termHist = ['HELP', 'PING LOST_NODE']; termIdx = -1; termText = 'ЧЕР';
  histStep(1);  eq(termText, 'HELP', 'стрелка вверх достаёт последнюю команду');
  histStep(1);  eq(termText, 'PING LOST_NODE', 'вторая вверх — предыдущую');
  histStep(-1); eq(termText, 'HELP', 'вниз возвращает обратно');
  histStep(-1); eq(termText, 'ЧЕР', 'недописанный ввод не потерялся');
  termHist = []; termText = ''; termIdx = -1;
  eq(starR() < STAR.R || delivered() === 0, true, 'звезда садится за каждый сданный фрагмент');
  eq(Math.round(STAR.R*(1 - 4*STAR_DIM)) > 0, true, 'звезда не гаснет полностью до финала');
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
