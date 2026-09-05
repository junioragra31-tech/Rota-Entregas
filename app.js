const deliveries=[
{id:1,name:'Maria Silva',address:'Av. Tapajós, 100, Santarém-PA',lat:-2.4389,lon:-54.6996,p:'normal',done:false},
{id:2,name:'João Santos',address:'Av. Mendonça Furtado, 850, Santarém-PA',lat:-2.4260,lon:-54.7130,p:'alta',done:false},
{id:3,name:'Ana Oliveira',address:'Av. Rui Barbosa, 1200, Santarém-PA',lat:-2.4240,lon:-54.7070,p:'normal',done:false},
{id:4,name:'Carlos Lima',address:'Rod. Fernando Guilhon, Santarém-PA',lat:-2.4300,lon:-54.7500,p:'alta',done:false},
{id:5,name:'Mercado Exemplo',address:'Av. Cuiabá, 500, Santarém-PA',lat:-2.4250,lon:-54.7350,p:'normal',done:false},
{id:6,name:'Paula Costa',address:'Tv. Silvino Pinto, 300, Santarém-PA',lat:-2.4380,lon:-54.7160,p:'normal',done:false},
{id:7,name:'Pedro Souza',address:'Av. Presidente Vargas, 700, Santarém-PA',lat:-2.4330,lon:-54.7080,p:'normal',done:false},
{id:8,name:'Empresa Exemplo',address:'Av. São Sebastião, 1600, Santarém-PA',lat:-2.4350,lon:-54.7200,p:'alta',done:false}];
const origin={lat:-2.4385,lon:-54.6990};

function dist(a,b){const R=6371,p=Math.PI/180,dlat=(b.lat-a.lat)*p,dlon=(b.lon-a.lon)*p,x=Math.sin(dlat/2)**2+Math.cos(a.lat*p)*Math.cos(b.lat*p)*Math.sin(dlon/2)**2;return 2*R*Math.asin(Math.sqrt(x))}
function optimize(){let pending=deliveries.filter(d=>!d.done),current=origin,result=[],total=0;while(pending.length){const high=pending.filter(d=>d.p==='alta'),pool=high.length?high:pending;pool.sort((a,b)=>dist(current,a)-dist(current,b));const next=pool[0];total+=dist(current,next);current=next;result.push(next);pending=pending.filter(d=>d.id!==next.id)}render(result,total);document.querySelector('#status').textContent='Rota calculada'}
function render(route,total){document.querySelector('#count').textContent=route.length;document.querySelector('#km').textContent=total.toFixed(1)+' km';document.querySelector('#time').textContent=Math.round(total/28*60)+' min';const ol=document.querySelector('#route');ol.innerHTML='';route.forEach((d,i)=>{const li=document.createElement('li');li.innerHTML=`<div class="stop"><div><b>${i+1}. ${esc(d.name)}</b><br><small>${esc(d.address)}</small><br><span class="priority ${d.p==='alta'?'high':''}">${d.p==='alta'?'🔴 Alta prioridade':'🟢 Normal'}</span></div><button onclick="go(${d.id})">Navegar</button></div>`;ol.appendChild(li)})}
function go(id){const d=deliveries.find(x=>x.id===id),nav=document.querySelector('#nav').value;if(nav==='waze')location.href='https://www.waze.com/ul?q='+encodeURIComponent(d.address)+'&navigate=yes';else location.href='https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(d.address)}
function esc(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
document.querySelector('#opt').onclick=optimize;optimize();

let deferredPrompt;
const installBtn=document.querySelector('#installBtn');
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;installBtn.classList.remove('hidden')});
installBtn.addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;installBtn.classList.add('hidden')});
window.addEventListener('appinstalled',()=>{installBtn.classList.add('hidden');document.querySelector('#installHelp').textContent='Aplicativo instalado na tela inicial.'});
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));
