// Runs on backloggd.com in the user's own browser (Backloggd blocks automated fetches,
// so the import happens from a page the user already has open). It reads the four
// lists for the profile in the URL and copies them as JSON for the Settings paste box.
const source = `(async()=>{
const m=location.pathname.match(/\\/u\\/([^/]+)/);
const user=m?m[1]:prompt('Backloggd username?');
if(!user)return;
const box=document.createElement('div');
box.style.cssText='position:fixed;inset:20px;z-index:99999;background:#111;color:#eee;padding:16px;border-radius:12px;font:14px system-ui;display:flex;flex-direction:column;gap:8px;box-shadow:0 10px 40px #000';
box.textContent='Reading your lists…';
document.body.appendChild(box);
const lists={played:[],playing:[],backlog:[],wishlist:[]};
for(const type of Object.keys(lists)){
for(let page=1;page<60;page++){
box.textContent='Reading '+type+', page '+page+'…';
const r=await fetch('/u/'+user+'/games/added/type:'+type+';/?page='+page,{credentials:'include'});
if(!r.ok)break;
const doc=new DOMParser().parseFromString(await r.text(),'text/html');
for(const c of doc.querySelectorAll('.game-cover[game_id]')){
const a=c.querySelector('a.cover-link')||c.closest('a');
const slug=((a&&a.getAttribute('href'))||'').split('/games/')[1]||'';
const t=c.parentElement&&c.parentElement.querySelector('.game-text-centered');
const rating=c.getAttribute('data-rating');
lists[type].push({igdbId:Number(c.getAttribute('game_id')),slug:slug.replace(/\\/$/,''),title:(t?t.textContent:(c.querySelector('img')||{}).alt||'').trim(),rating:rating?Number(rating):null});
}
if(!doc.querySelector('a[href*="page='+(page+1)+'"]'))break;
await new Promise(s=>setTimeout(s,400));
}
}
const json=JSON.stringify({user,importedAt:new Date().toISOString(),lists});
const n=Object.values(lists).reduce((a,l)=>a+l.length,0);
box.textContent='';
const p=document.createElement('p');
const ta=document.createElement('textarea');
ta.value=json;ta.style.cssText='flex:1;background:#000;color:#9f9;font:12px monospace';
const b=document.createElement('button');b.textContent='Close';b.onclick=()=>box.remove();
box.append(p,ta,b);
try{await navigator.clipboard.writeText(json);p.textContent='Copied '+n+' games. Paste them into Game Pass Companion → Settings.';}
catch(e){ta.select();p.textContent='Found '+n+' games. Press Cmd+C (or Ctrl+C) to copy, then paste into Game Pass Companion → Settings.';}
})();`;

export const BOOKMARKLET = "javascript:" + encodeURIComponent(source.replace(/\n/g, ""));
