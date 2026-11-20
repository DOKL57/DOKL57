const W = 960;
const origin = ACTIVITY.joined;
const periods = ACTIVITY.rows.filter(row => row.end > origin.slice(0, 4) + '-12-31' && row.days.length);
const chapters = [periods.slice(0, 2), ...periods.slice(2).map(row => [row])].filter(group => group.length);
const concreteHP = 1000000;
const slab = {x:133, y:143, w:791, h:24, concrete:true};
const floor = 480, H = floor + 60;
const periodLabel = row => row.start.slice(0,4) === row.end.slice(0,4) ? row.start.slice(0,4) : row.start.slice(0,4)+'–'+row.end.slice(2,4);
const colors = ['#e780a3','#879fcc','#d2a46d','#b4a6d5'];
const bonuses = ['SQUASH MERGE','REVERT','HOTFIX','SCOPE CREEP'];
const columns = 42, pitchX = 19, pitchY = 13, brickW = 17, brickH = 10;
function makeBoard(group) {
  const total = group.reduce((n, row) => n + row.days.reduce((sum, day) => sum + day[1], 0), 0);
  // Keep a very busy future archive playable without discarding any contributions.
  const perTile = Math.max(1, Math.ceil(total / (14 * columns)));
  const bands = [], blocks = [];
  let boardBottom = 208;
  for (let index = group.length - 1; index >= 0; index--) {
    const row = group[index], age = periods.indexOf(row), tiles = [];
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
    bands.push({age, y, lines, size: tiles.length, label: periodLabel(row)});
    boardBottom += Math.max(30, lines * pitchY + 9);
  }
  return {blocks, bands, perTile, obstacles:[...blocks,slab]};
}
const boards = [...chapters, []].map(makeBoard);
function rangeLabel(b){return b.date === b.end ? b.date : b.date+' → '+b.end}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const fmt=n=>String(n).padStart(3,'0');
function initial(stage=0, strikes=0){
  const board=boards[stage];
  return {x:480,y:floor-8,px:480,vx:0,vy:0,stage,board,strikes,scuffs:0,impactX:480,dust:0,remaining:new Map(board.blocks.map(b=>[b.id,b.hp])),
    hits:[],points:0,lives:3,mode:stage===chapters.length && strikes===concreteHP?'won':'ready',wide:0,hot:0,drops:[],caught:[],
    squash:false,dropIndex:0,feedback:'',flash:0,trail:[],revision:0};
}
function width(s){return s.wide>0?80:46}
function movePaddle(s,x){s.px=clamp(x,21+width(s),939-width(s))}
function launch(s){
  if(s.mode!=='ready')return;
  const candidates=s.board.blocks.filter(b=>s.remaining.get(b.id)>0);
  candidates.sort((a,b)=>Math.hypot(a.x+6-s.px,a.y-floor)-Math.hypot(b.x+6-s.px,b.y-floor));
  const target=candidates[0] || {x:slab.x+slab.w/2,y:slab.y};
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
  if(b.concrete){
    s.scuffs++;s.dust=.38;s.impactX=clamp(s.x,slab.x+10,slab.x+slab.w-10);s.revision++;
    if(s.stage===chapters.length){
      s.strikes=Math.min(concreteHP,s.strikes+1);
      if(s.strikes===concreteHP)s.mode='won';
    }
    return;
  }
  if(!s.remaining.get(b.id))return;
  const burst=s.squash;
  s.squash=false;
  const targets=burst ? s.board.blocks.filter(other=>other.age===b.age && Math.abs(other.line-b.line)<=1 && Math.abs(other.x-b.x)<=pitchX+0.01) : [b];
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
  if(s.board.blocks.every(tile=>!s.remaining.get(tile.id))){
    s.stage++;s.board=boards[s.stage];
    s.remaining=new Map(s.board.blocks.map(tile=>[tile.id,tile.hp]));
    s.mode='reveal';s.reveal=1.55;s.trail=[];s.drops=[];
    s.x=s.px;s.y=floor-8;s.vx=0;s.vy=0;
  }
}
function tick(s,dt){
  s.dust=Math.max(0,s.dust-dt);
  if(s.mode==='reveal'){
    s.reveal=Math.max(0,s.reveal-dt);
    if(!s.reveal){s.mode='ready';s.flash=0}
    return;
  }
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
  for(const b of s.board.obstacles){
    if(!b.concrete && !s.remaining.get(b.id))continue;
    const x0=b.x-4,x1=b.x+(b.w || brickW)+4,y0=b.y-4,y1=b.y+(b.h || brickH)+4;
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
    if(s.mode!=='play')return;
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
// A separate stretch of freeway above the arena; its cars never enter the collision system.
function traffic(){
  const skyline=[16,24,18,35,24,52,47,25,33,18,26,14,36,48,21,17,29,23,16];
  let city='';
  skyline.forEach((height,i)=>{
    const x=410+i*28;
    city+=rect(x,84-height,26,height,'#30283c');
    if(i%3===1)city+=rect(x+5,90-height,3,2,'#dda77c')+rect(x+11,90-height,3,2,'#dda77c');
  });
  for(const anchor of [493,705,853]){
    city+='<path d="M'+anchor+' 81v-23l3-4h8" fill="none" stroke="#716272" stroke-width="1.2"/>'+rect(anchor+8,54,5,1.5,'#ffcf99');
  }
  const coupe='<path d="M-19 -2H5" stroke="#ff5675" opacity=".32"/><path d="M0 0l3-5 9-2 7-8h18l11 9 11 2 2 4v3H0z" fill="#a696ac"/><path d="M16-7l6-6h13l8 7z" fill="#332a40"/>'+rect(1,-3,7,3,'#ff526e')+rect(53,-4,7,3,'#ffe4ad')+'<g fill="#15131c"><circle cx="12" cy="3" r="4"/><circle cx="48" cy="3" r="4"/></g>';
  const sedan='<path d="M-18 -1H4" stroke="#ff5675" opacity=".4"/><path d="M0 0l3-4 9-1 6-7h23l8 7 9 2 3 4v2H0z" fill="#7e91aa"/><path d="M16-5l5-6h16l7 6z" fill="#332a40"/>'+rect(1,-2,7,2,'#ff526e')+rect(55,-3,6,2,'#ffe4ad')+'<g fill="#15131c"><circle cx="12" cy="2" r="3.5"/><circle cx="48" cy="2" r="3.5"/></g>';
  return '<svg x="397" y="18" width="534" height="88" viewBox="397 18 534 88" overflow="hidden">'+rect(397,18,534,88,'#211d2e')+city+rect(397,81,534,2,'#72566d')+rect(397,95,534,3,'#594457')+'<g transform="translate(0 78)"><g class="inbound"><g transform="scale(-.64 .64)">'+sedan+'</g></g></g><g transform="translate(0 92)"><g class="outbound">'+coupe+'</g></g></svg>';
}
function foundation(s){
  const {x,y,w,h}=slab, open=s.stage===chapters.length;
  if(s.strikes===concreteHP){
    return rect(x,y,w,h,'#262a3f')+rect(412,y+7,10,10,'#64c780')+textAt(432,y+17,origin+'  /  '+tr('JOINED GITHUB','РЕГИСТРАЦИЯ НА GITHUB'),13,'#e1dfec');
  }
  let art=rect(x,y,w,h,open?'#655467':'#514d60')+rect(x,y,w,2,'#938b99');
  for(let i=0;i<8;i++)art+=rect(x+33+i*97,y+7,2,2,'#b0a1a3')+rect(x+57+i*97,y+16,4,1,'#332d40');
  const wear=Math.min(7,Math.ceil(Math.log2(1+s.scuffs+s.strikes)));
  for(let i=0;i<wear;i++){
    const cx=x+45+(i*131)%690;
    art+='<path d="M'+cx+' '+y+'l-5 6 7 4 -9 8 2 6" fill="none" stroke="#272033" stroke-width="2"/>';
  }
  if(open && s.strikes>=10)art+=textAt(x+w-10,y+17,(concreteHP-s.strikes).toLocaleString('en-US'),14,'#fff3e6','text-anchor="end"');
  if(s.dust>0){
    const t=1-s.dust/.38;
    for(let i=0;i<5;i++)art+=rect(s.impactX+(i-2)*t*12,y+h+t*t*19-(i%2)*4,3,2,'#cbb9c2','opacity="'+(1-t)+'"');
  }
  return art;
}
function chassis(s){
  const {bands,blocks,perTile}=s.board, muted='#babdd1', right='text-anchor="end"';
  let a=rect(0,0,W,H,'#191b2a')+traffic();
  a+=textAt(29,35,'D O K L 5 7   /   '+tr('ARCHIVE ARCADE','АРКАДНЫЙ АРХИВ'),14,muted);
  a+=textAt(28,87,tr('Diff Breaker','Разбор по дням'),tr(60,43),'#ff85b1','font-family="Georgia, serif" font-weight="bold" font-style="italic" letter-spacing="-3"');
  a+=rect(17,111,926,floor-85,'#10121e','rx="5"');
  a+=textAt(31,130,tr('ARCHIVE','АРХИВ'),11,muted);
  a+=textAt(930,130,origin.slice(0,4)+' — '+ACTIVITY.end.slice(0,4),13,'#abb1cb',right);
  a+=textAt(39,161,origin.slice(0,4),19,'#e1dfec');
  if(s.stage<chapters.length){
    for(let i=0;i<2;i++){
      const y=178+i*12;
      a+=textAt(47,y+3,'···',17,muted)+rect(133,y,791,1,'#44465e','opacity="'+(.8-i*.3)+'"');
    }
  }
  for(const band of bands){
    a+=rect(30,band.y,3,band.lines*pitchY-3,colors[band.age % colors.length]);
    a+=textAt(42,band.y+10,band.label,15,'#e1dfec');
    a+=textAt(42,band.y+23,'HP '+(band.age+1),10,muted);
  }
  a+=textAt(30,H-18,blocks.length?(perTile===1?tr('ONE CONTRIBUTION / BRICK','ОДИН ВКЛАД / БЛОК'):tr('MAX CONTRIBUTIONS / BRICK','МАКС. ВКЛАДОВ НА БЛОК')+'  '+perTile):tr('ACCOUNT ORIGIN','НАЧАЛО АРХИВА'),13,muted);
  return a+textAt(930,H-18,tr('UPDATED ','ДАННЫЕ НА ')+ACTIVITY.end,13,muted,right);
}
function brick(b,hp=b.hp){
  if(!hp)return '';
  let a=rect(b.x,b.y,brickW,brickH,colors[b.age % colors.length],'rx="1.8"');
  a+=rect(b.x+2,b.y+1,brickW-4,1,'#ffffff','opacity=".32"');
  for(let i=0;i<Math.min(hp,5);i++)a+=rect(b.x+2+i*3,b.y+6,2,2,'#10121e');
  return a;
}
function paddle(x,half=46){return rect(x-half,floor,2*half,7,'#ecd5c8','rx="3"')+rect(x-half+9,floor+7,2*half-18,3,'#a85870')}
function ball(x,y,hot=false){return '<circle cx="'+x+'" cy="'+y+'" r="5.5" fill="'+(hot?'#ffac91':'#fff5df')+'"/>'}
function capsule(kind,x,y){
  const i=bonuses.indexOf(kind);
  return '<g transform="translate('+x+' '+y+')">'+rect(-14,-7,28,14,colors[i],'rx="6"')+textAt(0,4,['3×3','+1','×2','↔'][i],12,'#10121e','text-anchor="middle" font-weight="bold"')+'</g>';
}
function svg(body){const trafficStyle='<style>@keyframes east{from{transform:translateX(325px)}to{transform:translateX(937px)}}@keyframes west{from{transform:translateX(977px)}to{transform:translateX(390px)}}.outbound{transform:translateX(590px);animation:east 10s linear -4.1s infinite}.inbound{transform:translateX(815px);animation:west 13s linear -2.5s infinite}@media(prefers-reduced-motion:reduce){.outbound,.inbound{animation:none}}</style>';return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 '+H+'" width="960" height="'+H+'"  font-family="Consolas, monospace">'+trafficStyle+body+'</svg>'}
