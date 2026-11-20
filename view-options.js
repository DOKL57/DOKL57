const profileText = {
  '← DOKL57 / Overview':'← DOKL57 / Обзор','LOCAL ARCADE':'ЛОКАЛЬНАЯ АРКАДА','Restart':'Начать заново','Round diff':'Что разбито за раунд',
  'Move with ← →, mouse or touch. Space serves or pauses. Clear both bands to reveal the next buried season. The concrete holds until you reach 2016.':'Двигай платформу стрелками, мышью или пальцем. Пробел — подача или пауза. Разбей оба слоя, чтобы открыть предыдущий сезон. Бетон поддастся, когда доберёшься до 2016-го.',
  'Catch it. The next hit clears a cluster of up to nine bricks.':'Поймай капсулу. Следующим ударом можно убрать до девяти соседних кирпичей.',
  'Undo a bad decision. One extra ball.':'Откат неудачного решения. Ещё один мяч.',
  'Double damage for 12 seconds. Ship it.':'Двойной урон на 12 секунд. Можно в прод.',
  'Even the paddle gets wider. 12 seconds.':'Требования разрослись. Платформа тоже. На 12 секунд.',
  'Source: DOKL57’s public GitHub contribution calendar. The newest contributions are at the bottom. Empty periods are skipped. The concrete marks the day I joined GitHub.':'Источник — публичный календарь вкладов DOKL57. Свежие вклады внизу. Пустые периоды пропускаются. За бетоном — дата моей регистрации на GitHub.',
  'Diff Breaker playing field. Move the paddle with arrow keys or pointer. Space serves or pauses.':'Игровое поле. Двигай платформу стрелками, мышью или пальцем. Пробел — подача или пауза.',
  'Local preview controls':'Настройки локального просмотра','Play Diff Breaker using your keyboard, mouse or touch':'Играть стрелками, мышью или пальцем',
  'Mechanical sign reading OPEN LATE':'Табло мастерской: открыто','Arcade display. PRESS START.':'Экран автомата: нажми старт.',
  'Diff Breaker. Animated demo on my actual GitHub contribution calendar. Select to play.':'Разбор по дням. Демораунд на моём календаре вкладов. Нажми, чтобы сыграть.'
};

const params = new URLSearchParams(location.search);
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
const language = () => params.get('lang') === 'ru' ? 'ru' : 'en';
const themeName = () => ['light','dark'].includes(params.get('theme')) ? params.get('theme') : systemTheme.matches ? 'dark' : 'light';
const tr = (english, russian) => language() === 'ru' ? russian : english;
function pluralRu(n, one, few, many) {
  return n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14) ? few : many;
}
function pageLink(name) {
  const url = new URL(name,location.href);
  url.search = params.toString();
  return url.href;
}
function bindView(refresh) {
  const substitutions = [];
  const walker = document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  for(let n=walker.nextNode();n;n=walker.nextNode()){
    if(n.parentElement.closest('style,script,svg')) continue;
    const value=n.textContent, key=value.trim();
    if(Object.hasOwn(profileText,key))substitutions.push(ru=>{n.textContent=ru?value.replace(key,profileText[key]):value});
  }
  document.querySelectorAll('[alt],[aria-label],[title]').forEach(el=>{
    for(const k of ['alt','aria-label','title']){
      const val=el.getAttribute(k);
      if(Object.hasOwn(profileText,val))substitutions.push(ru=>el.setAttribute(k,ru?profileText[val]:val));
    }
  });
  function apply(){
    const ru=language()==='ru', theme=themeName();
    const root=document.documentElement;
    root.lang=language();root.dataset.colorMode=theme;root.style.colorScheme=theme;
    substitutions.forEach(f=>f(ru));
    const themeButton=document.querySelector('.theme');
    themeButton.textContent=theme==='dark'?tr('Light theme','Светлая тема'):tr('Dark theme','Тёмная тема');
    const langButton=document.querySelector('.language');
    langButton.textContent=ru?'EN':'RU';
    langButton.setAttribute('aria-label',tr('Переключить на русский','Switch to English'));
    refresh();
  }
  function choose(key,value){
    params.set(key,value);
    const url=new URL(location.href);url.search=params.toString();
    history.replaceState(null,'',url);apply();
  }
  document.querySelector('.theme').onclick=()=>choose('theme',themeName()==='dark'?'light':'dark');
  document.querySelector('.language').onclick=()=>choose('lang',language()==='en'?'ru':'en');
  systemTheme.addEventListener('change',apply);
  apply();
}
