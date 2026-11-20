// Render the README movie using the same physics and snapshot as the playable game.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname,'..');
const source = ['activity.js','breaker.js'].map(file=>fs.readFileSync(path.join(root,file),'utf8')).join('\n');
const css = fs.readFileSync(path.join(root,'arcade-themes.css'),'utf8');
const light = css.split('\n').filter(line=>line.startsWith('html[data-color-mode=light] #arena [fill')).map(line=>line.replace('html[data-color-mode=light] #arena ','')).join('\n');
const fps=24, seconds=18, end=fps*seconds;
function animatePath(values){
  return '<animateTransform attributeName="transform" type="translate" dur="'+seconds+'s" repeatCount="indefinite" values="'+values.join(';')+'"/>';
}
function interval(start,stop){
  const times=[0],values=[start===0?'1':'0'];
  if(start>0){times.push(start/end);values.push('1')}
  if(stop<end){times.push(stop/end);values.push('0')}
  times.push(1);values.push(values.at(-1));
  return '<animate attributeName="opacity" calcMode="discrete" dur="'+seconds+'s" repeatCount="indefinite" keyTimes="'+times.join(';')+'" values="'+values.join(';')+'"/>';
}
for(const lang of ['en','ru']){
  const tr=(en,ru)=>lang==='en'?en:ru;
  const core=vm.runInNewContext(source+'\n;({initial,launch,tick,movePaddle,boards,svg,foundation,chassis,brick,paddle,ball,capsule,width,textAt,floor})',{tr});
  const game=core.initial(), positions=[], paddles=[], frames=[], drops=new Map();
  core.movePaddle(game,470);core.launch(game);
  for(let i=0;i<=end;i++){
    // Follow the ball and occasionally angle the return.
    const target=game.x+(game.vy>0?27*Math.sin(i/fps*1.4):0);
    core.movePaddle(game,game.px+Math.max(-19,Math.min(19,target-game.px)));
    for(let j=0;j<4;j++)core.tick(game,1/(4*fps));
    if(game.mode==='ready')core.launch(game);
    positions.push(game.x.toFixed(1)+' '+game.y.toFixed(1));paddles.push(game.px.toFixed(1)+' 0');
    frames.push({stage:game.stage,scuffs:game.scuffs,strikes:game.strikes,remaining:new Map(game.remaining),score:game.points,wide:game.wide>0,hot:game.hot>0});
    for(const d of game.drops){
      if(!drops.has(d))drops.set(d,{start:i});
      drops.get(d).stop=i+1;
    }
  }
  function segments(read,paint){
    let output='', start=0, value=read(frames[0]);
    for(let i=1;i<=end;i++){
      const next=read(frames[i]);
      if(i<end&&value===next)continue;
      const art=paint(value);
      if(art)output+=(start===0&&i===end)?art:'<g opacity="'+(start===0?1:0)+'">'+interval(start,i)+art+'</g>';
      value=next;start=i;
    }
    return output;
  }
  const start=core.initial();
  let bricks='';
  for(const stage of new Set(frames.map(f=>f.stage))){
    const state=core.initial(stage);
    bricks+=segments(f=>f.stage===stage,visible=>visible?core.chassis(state):'');
    bricks+=segments(f=>f.stage===stage?f.scuffs:-1,scuffs=>scuffs>=0?core.foundation({...state,scuffs}):'');
    bricks+=state.board.blocks.map(b=>segments(f=>f.stage===stage?(f.remaining.get(b.id)||0):0,hp=>core.brick(b,hp))).join('');
  }
  const badge=core.textAt(31,core.floor-80,tr('ATTRACT MODE','ДЕМОРАУНД'),12,'#aaaec8')+core.textAt(31,core.floor-55,tr('PLAY THIS ARCHIVE  ↗','СЫГРАТЬ  ↗'),18,'#ff85b1');
  let movie=bricks+badge;
  movie+=segments(f=>f.score,n=>core.textAt(926,core.floor-55,String(n).padStart(3,'0')+tr(' PTS',' ОЧК.'),21,'#ffac91','text-anchor="end"'));
  for(const [drop,span] of drops){
    const start=span.start, stop=Math.min(span.stop,end);
    if(start>=stop)continue;
    const values=positions.map((_,i)=>'0 '+(Math.max(0,i-start)*145/fps).toFixed(1));
    movie+='<g opacity="0">'+interval(start,stop)+'<g>'+animatePath(values)+core.capsule(drop.kind,drop.x,drop.originY)+'</g></g>';
  }
  for(let lag=4;lag>0;lag--){
    const trail=positions.map((_,i)=>positions[Math.max(0,i-lag)]);
    movie+='<g>'+animatePath(trail)+'<circle r="'+(5-lag*.75)+'" fill="#f16686" opacity="'+(.55-lag*.09)+'"/></g>';
  }
  movie+='<g>'+animatePath(positions)+segments(f=>f.hot,v=>core.ball(0,0,v))+'</g><g>'+animatePath(paddles)+segments(f=>f.wide,v=>core.paddle(0,v?80:46))+'</g>';
  const still=core.chassis(start)+core.foundation(start)+start.board.blocks.map(b=>core.brick(b)).join('')+badge+core.paddle(470)+core.ball(470,core.floor-9);
  const style='<style>.still{display:none}@media(prefers-reduced-motion:reduce){.run{display:none}.still{display:inline}}@media(prefers-color-scheme:light){'+light+'}</style>';
  const art=core.svg('<title>'+tr('Diff Breaker: a night drive through my GitHub archive since 2016','Разбор по дням: ночная поездка по архиву GitHub с 2016 года')+'</title>'+style+'<g class="run">'+movie+'</g><g class="still">'+still.replace(/(id="|url\(#)(sky|wet-road)/g,'$1still-$2')+'</g>');
  fs.writeFileSync(path.join(root,'breaker-demo'+(lang==='ru'?'-ru':'')+'.svg'),art);
  console.log(lang,start.board.blocks.length+' bricks',game.hits.length+' demo hits',game.points+' points');
}
