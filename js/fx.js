// Частицы, всплывающий текст, помехи. Пул фиксированного размера — без аллокаций в кадре.

const PMAX = 900;
const parts = Array.from({length:PMAX}, () => ({life:0}));
let pi = 0;

function spawn(x, y, z, vx, vy, life, col, size){
  const p = parts[pi = (pi + 1) % PMAX];
  p.x=x; p.y=y; p.z=z; p.vx=vx; p.vy=vy; p.life=life; p.max=life; p.col=col; p.s=size||2;
}

function burst(x, y, z, n, col){
  for(let i = 0; i < n; i++){
    const a = Math.random()*6.28, v = 1 + Math.random()*5;
    spawn(x, y, z, Math.cos(a)*v, Math.sin(a)*v, .5 + Math.random(), col, 1 + Math.random()*2.5);
  }
}

function trail(x, y, z, vx, vy){
  spawn(x, y, z, -vx*.3 + (Math.random()-.5), -vy*.3 + (Math.random()-.5),
        .6 + Math.random()*.6, '#9fe8c4', 1.4);
}

function stepFx(dt){
  for(const p of parts){
    if(p.life <= 0) continue;
    p.life -= dt;
    p.x = wrap(p.x + p.vx, W); p.y = wrap(p.y + p.vy, H);
    p.vx *= .96; p.vy = p.vy*.96 + .02;          // лёгкое оседание, как взвесь
  }
  glitch = Math.max(0, glitch - dt*1.4);
}

// планктон/взвесь: постоянная редкая эмиссия вокруг дрона
function dust(){
  if(Math.random() > .35) return;
  const a = Math.random()*6.28, r = 300 + Math.random()*900;
  spawn(drone.x + Math.cos(a)*r, drone.y + Math.sin(a)*r,
        drone.z + (Math.random()-.5)*.2,
        (Math.random()-.5)*.3, (Math.random()-.5)*.3,
        3 + Math.random()*4, '#4e8f6a', 1);
}
