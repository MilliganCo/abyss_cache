// Звук как навигация: гул вентилятора, диск, модем, энергия, преследователь.

let A = null, hum = null, humG = null, noiseBuf = null, out = null;

// Всё идёт через одну мягкую шину: НЧ-фильтр срезает звон, лёгкая компрессия
// не даёт совпавшим звукам сложиться в резь. Эмбиент должен быть фоном, а не давлением.
function audioInit(){
  if(A) return;
  A = new (window.AudioContext || window.webkitAudioContext)();

  const lp = A.createBiquadFilter(), comp = A.createDynamicsCompressor();
  lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = .4;
  comp.threshold.value = -26; comp.ratio.value = 6; comp.attack.value = .004; comp.release.value = .3;
  out = A.createGain(); out.gain.value = .85;
  out.connect(lp).connect(comp).connect(A.destination);

  hum = A.createOscillator(); humG = A.createGain();
  hum.type = 'triangle'; hum.frequency.value = 46; humG.gain.value = .022;   // мягче пилы
  hum.connect(humG).connect(out); hum.start();

  noiseBuf = A.createBuffer(1, A.sampleRate, A.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for(let i = 0; i < d.length; i++) d[i] = Math.random()*2 - 1;

  setInterval(tick, 200);
}

// атака не мгновенная: щелчок в начале ноты и есть то, что режет уши
function beep(f, dur, vol, type, slideTo){
  if(!A) return;
  const o = A.createOscillator(), g = A.createGain(), t = A.currentTime;
  o.type = type || 'triangle'; o.frequency.value = f;
  if(slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(.0005, t);
  g.gain.exponentialRampToValueAtTime(vol, t + Math.min(.05, dur*.25));
  g.gain.exponentialRampToValueAtTime(.0005, t + dur);
  o.connect(g).connect(out); o.start(); o.stop(t + dur + .02);
}

function hiss(dur, vol, freq, q){
  if(!A) return;
  const src = A.createBufferSource(), f = A.createBiquadFilter(), g = A.createGain();
  const t = A.currentTime;
  src.buffer = noiseBuf; src.loop = true;
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
  g.gain.setValueAtTime(.0005, t);
  g.gain.exponentialRampToValueAtTime(vol, t + Math.min(.08, dur*.3));
  g.gain.exponentialRampToValueAtTime(.0005, t + dur);
  src.connect(f).connect(g).connect(out); src.start(); src.stop(t + dur);
}

const click     = () => beep(420 + Math.random()*260, .07, .022, 'triangle');   // работа диска, не писк
const key       = () => beep(1200 + Math.random()*700, .012, .012, 'square');   // стук клавиш
const chime     = () => { beep(320, .9, .07, 'sine'); beep(482, 1.4, .05, 'sine'); };
const sonar     = () => { beep(1500, .5, .05, 'sine', 420); hiss(.25, .02, 2400, 3); };
const sonarFail = () => beep(180, .12, .04, 'square', 90);
const thud      = () => { beep(70, .25, .09, 'triangle', 40); hiss(.1, .03, 300, .7); };
const powerHum  = () => beep(240 + Math.random()*60, .3, .03, 'sine', 480);
const dive      = () => beep(300, .18, .025, 'sine', 220);
const warble    = () => { beep(420, .5, .04, 'sine', 300); beep(300, .5, .03, 'sine', 420); };
const growl     = () => { hiss(1.4, .05, 120, .6); beep(58, 1.2, .05, 'sawtooth', 40); };
const hitSting  = () => { hiss(.7, .12, 900, .4); beep(90, .6, .1, 'sawtooth', 38); };
const whaleSong = () => { beep(44, 3.2, .07, 'sine', 62); hiss(2.4, .03, 180, .5); };
const fragCall  = k => beep(1046, .5 + k, .012 + k*.03, 'sine', 1568);   // зов кадра, громче вблизи
const echoPing  = k => { beep(880, .5, .05, 'sine', 660); if(k === 'star') beep(1320, .8, .03, 'sine'); };
const diskChatter=() => { for(let i = 0; i < 5; i++) setTimeout(() => beep(600 + Math.random()*900, .04, .035), i*70); };
const photoSound= () => { beep(660, 1.4, .05, 'sine', 990); beep(880, 1.8, .035, 'sine'); hiss(1.6, .02, 700, .6); };
const liftSound = () => { beep(523, .5, .05, 'sine', 1046); beep(784, .8, .035, 'sine'); };
const charging  = k => beep(300 + k*900, .07, .022, 'sine');           // тон растёт по мере вскрытия
const scare     = () => { hiss(.9, .06, 1600, .5); beep(120, .8, .05, 'sawtooth', 900); };
const membrane  = () => { beep(180, .35, .04, 'sine', 120); hiss(.3, .03, 500, 1.2); };
const havenHum  = () => { beep(196, 1.6, .022, 'sine', 294); beep(294, 2.0, .014, 'sine'); };
const indexPing = () => beep(2000, .12, .03, 'square', 1400);
const ghostWhisper = () => { hiss(.6, .025, 900 + Math.random()*600, 2); beep(220, .5, .015, 'sine', 180); };
const finaleRoar= () => { beep(40, 6, .12, 'sawtooth', 180); hiss(6, .07, 300, .3); };
const finaleTick= () => beep(400 + Math.random()*2600, .05, .03, 'square');
// зов квестового объекта: чем ближе, тем чище и выше. k = 0..1 по близости
const questPing = k => { beep(523 + k*262, .5 + k*.5, .012 + k*.028, 'sine');
                         if(k > .55) beep(1046 + k*262, .4, .008 + k*.012, 'sine'); };
const clueSting = () => { beep(392, .7, .04, 'sine', 587); beep(587, 1.1, .025, 'sine', 784); };
const wreckHum  = () => { hiss(1.8, .035, 220, .7); beep(87, 1.6, .05, 'triangle', 65); };
const starVoice = () => { beep(65, 4, .07, 'sine', 98); beep(196, 3.4, .03, 'sine', 262);
                          hiss(3.2, .025, 400, .4); };
const collapse  = () => { beep(2400, 3.5, .1, 'sawtooth', 30); hiss(4, .09, 900, .3); };
const fadeOut   = () => { beep(160, 5, .05, 'sine', 40); hiss(5, .02, 200, .5); };
const phaseSting= p => {
  if(p === 'INDEX')    { beep(600, .5, .05, 'sine', 1400); }
  if(p === 'NET')      { beep(1800, .6, .04, 'sine', 900); beep(2100, .6, .03, 'sine', 1100); }
  if(p === 'PURGE')    { hiss(1.6, .05, 500, .5); beep(110, 1.2, .05, 'triangle', 60); }
  if(p === 'OVERHEAT') { beep(70, 2.0, .08, 'sawtooth', 200); hiss(2, .04, 1600, .4); }
  if(p === 'BOOT')     { beep(440, .4, .05, 'sine', 880); }
};

// Фон должен быть редким. Раньше он сыпал по несколько звуков в секунду —
// от этого и «шумит в уши»: событий не слышно, потому что фон занял всё место.
function tick(){
  if(!A) return;
  hum.frequency.value = 46 + (phase === 'OVERHEAT' ? 26 : 0) + drone.y/H*8 + Math.sin(now)*1.5;
  humG.gain.value = paused ? .010 : .022 + starLight(drone.x, drone.y)*.014;
  if(paused) return;
  if(Math.random() < (phase === 'INDEX' ? .12 : .035)) click();
  if(phase === 'NET'   && Math.random() < .05) beep(700 + Math.random()*400, .3, .012, 'sine');
  if(phase === 'PURGE' && Math.random() < .09) beep(84 + Math.random()*30, .5, .022, 'triangle');
  if(hunters.length && Math.random() < .06) hiss(.5, .016, 180 + Math.random()*220, .8);
  if(drone.pwr < PWR_LOW && Math.random() < .06) beep(760, .14, .014, 'triangle');

  // зов ближайшего квестового объекта: частота ударов растёт по мере приближения
  if(questNear > .04 && Math.random() < .12 + questNear*.7) questPing(questNear);
}
