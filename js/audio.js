// Звук как навигация: гул вентилятора, диск, модем, энергия, преследователь.

let A = null, hum = null, humG = null, noiseBuf = null;

function audioInit(){
  if(A) return;
  A = new (window.AudioContext || window.webkitAudioContext)();
  hum = A.createOscillator(); humG = A.createGain();
  hum.type = 'sawtooth'; hum.frequency.value = 50; humG.gain.value = .03;
  hum.connect(humG).connect(A.destination); hum.start();

  noiseBuf = A.createBuffer(1, A.sampleRate, A.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for(let i = 0; i < d.length; i++) d[i] = Math.random()*2 - 1;

  setInterval(tick, 200);
}

function beep(f, dur, vol, type, slideTo){
  if(!A) return;
  const o = A.createOscillator(), g = A.createGain();
  o.type = type || 'square'; o.frequency.value = f;
  if(slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, A.currentTime + dur);
  g.gain.setValueAtTime(vol, A.currentTime);
  g.gain.exponentialRampToValueAtTime(.0005, A.currentTime + dur);
  o.connect(g).connect(A.destination); o.start(); o.stop(A.currentTime + dur + .02);
}

function hiss(dur, vol, freq, q){
  if(!A) return;
  const src = A.createBufferSource(), f = A.createBiquadFilter(), g = A.createGain();
  src.buffer = noiseBuf; src.loop = true;
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
  g.gain.setValueAtTime(vol, A.currentTime);
  g.gain.exponentialRampToValueAtTime(.0005, A.currentTime + dur);
  src.connect(f).connect(g).connect(A.destination); src.start(); src.stop(A.currentTime + dur);
}

const click     = () => beep(700 + Math.random()*500, .05, .05);
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

function tick(){
  if(!A) return;
  hum.frequency.value = 50 + (phase === 'OVERHEAT' ? 30 : 0) + drone.y/H*10 + Math.sin(now)*2;
  humG.gain.value = paused ? .012 : .03 + starLight(drone.x, drone.y)*.02;
  if(paused) return;
  if(Math.random() < (phase === 'INDEX' ? .5 : .12)) click();
  if(phase === 'NET'   && Math.random() < .12) beep(1200 + Math.random()*900, .25, .02, 'sine');
  if(phase === 'PURGE' && Math.random() < .2)  beep(90 + Math.random()*40, .4, .03, 'triangle');
  if(hunters.length && Math.random() < .08) hiss(.4, .02, 200 + Math.random()*300, .8);
  if(drone.pwr < PWR_LOW && Math.random() < .25) beep(1400, .06, .02, 'square');
}
