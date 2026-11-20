const W = 960;
const rows = ACTIVITY.rows;
const colors = ['#6ee3d3','#6e93fc','#c9fa62','#ffac91'];
const bonuses = ['SQUASH MERGE','REVERT','HOTFIX','SCOPE CREEP'];
const columns = 42, pitchX = 19, pitchY = 13, brickW = 17, brickH = 10;
const capacity = 16 * columns;
const total = rows.reduce((n, row) => n + row.days.reduce((sum, day) => sum + day[1], 0), 0);
// Keep a very busy future archive playable without discarding any contributions.
const perTile = Math.max(1, Math.ceil(total / capacity));
const bands = [], blocks = [];
let boardBottom = 142;
for (let age = rows.length - 1; age >= 0; age--) {
  const row = rows[age], tiles = [];
  for (const [date, count] of row.days) {
    let unplaced = count;
    while (unplaced > 0) {
      let tile = tiles[tiles.length - 1];
      if (!tile || tile.count === perTile) {
        tile = {id: age + '-' + tiles.length, age, hp: age + 1, date, end: date, count: 0};
        tiles.push(tile);
      }
      const amount = Math.min(perTile - tile.count, unplaced);
      tile.count += amount;
      tile.end = date;
      unplaced -= amount;
    }
  }
  const lines = Math.max(1, Math.ceil(tiles.length / columns));
  const across = Math.ceil(tiles.length / lines);
  const y = boardBottom;
  for (const [i, tile] of tiles.entries()) {
    const line = Math.floor(i / across);
    const lineLength = Math.min(across, tiles.length - line * across);
    // Centre each course; variable silhouettes mark changes between years.
    tile.col = i % across;
    tile.line = line;
    tile.x = 133 + (columns - lineLength) * pitchX / 2 + tile.col * pitchX;
    tile.y = y + line * pitchY;
    blocks.push(tile);
  }
  bands.push({age, y, lines, size: tiles.length, label: row.start.slice(2,4)+'–'+row.end.slice(2,4)});
  boardBottom += lines * pitchY + 9;
}
const floor = boardBottom + 133;
const H = floor + 64;
function rangeLabel(b){return b.date === b.end ? b.date : b.date+' → '+b.end}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const fmt=n=>String(n).padStart(3,'0');
function initial(){
  return {x:480,y:floor-8,px:480,vx:0,vy:0,remaining:new Map(blocks.map(b=>[b.id,b.hp])),
    hits:[],points:0,lives:3,mode:blocks.length?'ready':'won',wide:0,hot:0,drops:[],caught:[],
    squash:false,dropIndex:0,feedback:'',flash:0,trail:[],revision:0};
}
function width(s){return s.wide>0?80:46}
function movePaddle(s,x){s.px=clamp(x,21+width(s),939-width(s))}
function launch(s){
  if(s.mode!=='ready')return;
  const candidates=blocks.filter(b=>s.remaining.get(b.id)>0);
  candidates.sort((a,b)=>Math.hypot(a.x+6-s.px,a.y-floor)-Math.hypot(b.x+6-s.px,b.y-floor));
  const target=candidates[0];
  if(!target){s.mode='won';return}
  s.x=s.px;s.y=floor-8;s.mode='play';
  const dx=target.x+7-s.x,dy=target.y+6-s.y,dist=Math.hypot(dx,dy);
  s.vx=255*dx/dist;s.vy=255*dy/dist;
}
function applyBonus(s,kind){
  if(kind==='SQUASH MERGE')s.squash=true;
  if(kind==='REVERT')s.lives++;
  if(kind==='HOTFIX')s.hot=12;
  if(kind==='SCOPE CREEP'){s.wide=12;movePaddle(s,s.px)}
  s.feedback=kind;s.flash=1.5;s.caught.unshift(kind);s.revision++;
}
function damage(s,b){
  if(!s.remaining.get(b.id))return;
  const burst=s.squash;
  s.squash=false;
  const targets=burst ? blocks.filter(other=>other.age===b.age && Math.abs(other.line-b.line)<=1 && Math.abs(other.x-b.x)<=pitchX+0.01) : [b];
  const previousHits=s.hits.length;
  let gain=0;
  for(const target of targets){
    const before=s.remaining.get(target.id);
    if(!before)continue;
    const hp=burst?0:Math.max(0,before-(s.hot>0?2:1));
    s.remaining.set(target.id,hp);
    if(hp===0){s.hits.unshift(target);gain+=target.count}
  }
  s.points+=gain;s.revision++;s.flash=.85;
  s.feedback=burst?'SQUASH ×'+(s.hits.length-previousHits):gain?'+'+gain+' PTS':'HP '+s.remaining.get(b.id)+'/'+b.hp;
  // At most one pickup per impact, even when a squash clears a cluster.
  if(s.hits.length>previousHits && (previousHits===0 || Math.floor(previousHits/3)<Math.floor(s.hits.length/3))){
    const kind=bonuses[s.dropIndex++%bonuses.length];
    const x=b.x+brickW/2,y=b.y+brickH;
    s.drops.push({kind,x,y,originY:y});
  }
  if(s.hits.length===blocks.length)s.mode='won';
}
function tick(s,dt){
  if(s.mode==='ready'){s.x=s.px;s.y=floor-8;return}
  if(s.mode!=='play')return;
  s.flash=Math.max(0,s.flash-dt);s.wide=Math.max(0,s.wide-dt);s.hot=Math.max(0,s.hot-dt);
  for(const drop of s.drops){
    drop.y+=145*dt;
    if(drop.y>=floor-5&&drop.y<=floor+8&&Math.abs(drop.x-s.px)<=width(s)+7){
      applyBonus(s,drop.kind);drop.y=floor+30;
    }
  }
  s.drops=s.drops.filter(d=>d.y<floor+20);
  const oldX=s.x,oldY=s.y;
  s.x+=s.vx*dt;s.y+=s.vy*dt;
  if(s.x<26||s.x>934){s.vx=s.x<26?Math.abs(s.vx):-Math.abs(s.vx);s.x=clamp(s.x,26,934)}
  if(s.y<136){s.y=136;s.vy=Math.abs(s.vy)}
  const dx=s.x-oldX,dy=s.y-oldY;
  let first=null, hitTime=2, vertical=false;
  for(const b of blocks){
    if(!s.remaining.get(b.id))continue;
    const x0=b.x-4,x1=b.x+brickW+4,y0=b.y-4,y1=b.y+brickH+4;
    if(Math.max(s.x,oldX)<x0||Math.min(s.x,oldX)>x1||Math.max(s.y,oldY)<y0||Math.min(s.y,oldY)>y1)continue;
    const enterX=dx===0?-Infinity:((dx>0?x0:x1)-oldX)/dx;
    const leaveX=dx===0?Infinity:((dx>0?x1:x0)-oldX)/dx;
    const enterY=dy===0?-Infinity:((dy>0?y0:y1)-oldY)/dy;
    const leaveY=dy===0?Infinity:((dy>0?y1:y0)-oldY)/dy;
    const entry=Math.max(enterX,enterY);
    if(entry<0||entry>1||entry>Math.min(leaveX,leaveY)||entry>=hitTime)continue;
    first=b;hitTime=entry;vertical=enterY>=enterX;
  }
  if(first){
    damage(s,first);
    s.x=oldX+dx*hitTime;s.y=oldY+dy*hitTime;
    if(vertical){s.y-=Math.sign(dy)*.1;s.vy=-s.vy}
    else{s.x-=Math.sign(dx)*.1;s.vx=-s.vx}
  }
  if(s.vy>0&&oldY<=floor-4&&s.y>=floor-4&&Math.abs(s.x-s.px)<=width(s)+5){
    const angle=clamp((s.x-s.px)/width(s),-1,1)*1.05;
    s.vx=Math.sin(angle)*280;s.vy=-Math.cos(angle)*280;s.y=floor-4;
  }
  if(s.y>floor+19){
    s.lives--;s.mode=s.lives?'ready':'over';s.x=s.px;s.y=floor-8;
    s.trail=[];s.drops=[];
  }
}
function rect(x,y,w,h,c,extra=''){return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+c+'" '+extra+'/>'}
function textAt(x,y,t,size,c,extra=''){return '<text x="'+x+'" y="'+y+'" fill="'+c+'" font-size="'+size+'" '+extra+'>'+t+'</text>'}
function chassis(){
  const lime='#c9fa62', muted='#babdd1', right='text-anchor="end"';
  let a=rect(0,0,W,H,'#191b2a')+rect(0,0,W,5,lime);
  a+=textAt(30,34,'D O K L 5 7   /   '+tr('ARCHIVE ARCADE','АРКАДНЫЙ АРХИВ'),14,lime);
  a+=textAt(26,96,tr('DIFF BREAKER','РАЗБОР ПО ДНЯМ'),tr(68,60),'#f8f6eb','font-family="Arial, sans-serif" font-weight="900" font-style="italic" letter-spacing="-3"');
  a+=textAt(930,42,tr('ROLLING ARCHIVE','СКОЛЬЗЯЩИЙ АРХИВ'),14,muted,right);
  a+=textAt(930,78,'04 × 365',31,lime,right);
  a+=rect(17,111,926,floor-85,'#10121e','rx="5"');
  a+=textAt(31,130,tr('ARCHIVE','АРХИВ'),11,muted);
  a+=textAt(930,130,blocks.length+tr(' BRICKS',' БЛ.'),12,'#abb1cb',right);
  for(const band of bands){
    a+=rect(30,band.y,3,band.lines*pitchY-3,colors[band.age]);
    a+=textAt(44,band.y+11,band.label,15,'#e1dfec');
    a+=textAt(44,band.y+24,'HP '+(band.age+1),10,muted);
  }
  a+=textAt(30,H-18,(perTile===1?tr('ONE CONTRIBUTION / BRICK','ОДИН ВКЛАД / БЛОК'):tr('MAX CONTRIBUTIONS / BRICK','МАКС. ВКЛАДОВ НА БЛОК')+'  '+perTile),13,muted);
  return a+textAt(930,H-18,tr('UPDATED ','ДАННЫЕ НА ')+ACTIVITY.end,13,muted,right);
}
function brick(b,hp=b.hp){
  if(!hp)return '';
  let a=rect(b.x,b.y,brickW,brickH,colors[b.age],'rx="1.8"');
  a+=rect(b.x+2,b.y+1,brickW-4,1,'#ffffff','opacity=".32"');
  for(let i=0;i<hp;i++)a+=rect(b.x+2+i*3,b.y+6,2,2,'#10121e');
  return a;
}
function paddle(x,half=46){return rect(x-half,floor,2*half,7,'#c9fa62','rx="3"')+rect(x-half+9,floor+7,2*half-18,3,'#748940')}
function ball(x,y,hot=false){return '<circle cx="'+x+'" cy="'+y+'" r="5.5" fill="'+(hot?'#ffac91':'#fff5df')+'"/>'}
function capsule(kind,x,y){
  const i=bonuses.indexOf(kind);
  return '<g transform="translate('+x+' '+y+')">'+rect(-14,-7,28,14,colors[i],'rx="6"')+textAt(0,4,['3×3','+1','×2','↔'][i],12,'#10121e','text-anchor="middle" font-weight="bold"')+'</g>';
}
function svg(body){return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 '+H+'" width="960" height="'+H+'"  font-family="Consolas, monospace">'+body+'</svg>'}
