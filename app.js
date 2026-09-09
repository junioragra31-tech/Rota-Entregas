
const demoDeliveries=[
{id:1,name:'Maria Silva',address:'Av. Tapajós, 100, Santarém-PA',lat:-2.4389,lon:-54.6996,p:'normal',done:false},
{id:2,name:'João Santos',address:'Av. Mendonça Furtado, 850, Santarém-PA',lat:-2.4260,lon:-54.7130,p:'alta',done:false},
{id:3,name:'Ana Oliveira',address:'Av. Rui Barbosa, 1200, Santarém-PA',lat:-2.4240,lon:-54.7070,p:'normal',done:false},
{id:4,name:'Carlos Lima',address:'Rod. Fernando Guilhon, Santarém-PA',lat:-2.4300,lon:-54.7500,p:'alta',done:false},
{id:5,name:'Mercado Exemplo',address:'Av. Cuiabá, 500, Santarém-PA',lat:-2.4250,lon:-54.7350,p:'normal',done:false},
{id:6,name:'Paula Costa',address:'Tv. Silvino Pinto, 300, Santarém-PA',lat:-2.4380,lon:-54.7160,p:'normal',done:false},
{id:7,name:'Pedro Souza',address:'Av. Presidente Vargas, 700, Santarém-PA',lat:-2.4330,lon:-54.7080,p:'normal',done:false},
{id:8,name:'Empresa Exemplo',address:'Av. São Sebastião, 1600, Santarém-PA',lat:-2.4350,lon:-54.7200,p:'alta',done:false}];

let deliveries=[];
const origin={lat:-2.4385,lon:-54.6990};
let map=null, markers=[];

function dist(a,b){
  const R=6371,p=Math.PI/180,dlat=(b.lat-a.lat)*p,dlon=(b.lon-a.lon)*p;
  const x=Math.sin(dlat/2)**2+Math.cos(a.lat*p)*Math.cos(b.lat*p)*Math.sin(dlon/2)**2;
  return 2*R*Math.asin(Math.sqrt(x));
}

function optimize(){
  const pending=deliveries.filter(d=>!d.done && Number.isFinite(d.lat) && Number.isFinite(d.lon));
  let current=origin,result=[],total=0,remaining=[...pending];
  while(remaining.length){
    const high=remaining.filter(d=>d.p==='alta');
    const pool=high.length?high:remaining;
    pool.sort((a,b)=>dist(current,a)-dist(current,b));
    const next=pool[0];
    total+=dist(current,next); current=next; result.push(next);
    remaining=remaining.filter(d=>d.id!==next.id);
  }
  render(result,total);
  document.querySelector('#status').textContent=pending.length?'Rota calculada':'Sem coordenadas para calcular';
  if(pending.length) drawMap(result);
}

function render(route,total){
  document.querySelector('#count').textContent=route.length;
  document.querySelector('#km').textContent=total.toFixed(1)+' km';
  document.querySelector('#time').textContent=Math.round(total/28*60)+' min';
  const ol=document.querySelector('#route'); ol.innerHTML='';
  if(!route.length){ol.innerHTML='<li class="empty">Nenhuma entrega com localização disponível.</li>';return}
  route.forEach((d,i)=>{
    const li=document.createElement('li');
    const geo=d.geocoded?'📍 Localizado':'⚠️ Sem localização';
    li.innerHTML=`<div class="stop"><div><b>${i+1}. ${esc(d.name)}</b><br><small>${esc(d.address)}</small><br><span class="priority ${d.p==='alta'?'high':''}">${d.p==='alta'?'🔴 Alta prioridade':'🟢 Normal'}</span><br><span class="geo-badge">${geo}</span></div><button onclick="go(${d.id})">Navegar</button></div>`;
    ol.appendChild(li);
  });
}

function go(id){
  const d=deliveries.find(x=>x.id===id),nav=document.querySelector('#nav').value;
  if(!d)return;
  if(nav==='waze') location.href='https://www.waze.com/ul?q='+encodeURIComponent(d.address)+'&navigate=yes';
  else location.href='https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(d.address);
}

function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}

function parseBulk(text){
  return text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map((line,index)=>{
    let name='',address=line;
    const separators=[' - ',' — ',' – ',';','\t'];
    for(const sep of separators){
      const pos=line.indexOf(sep);
      if(pos>0){name=line.slice(0,pos).trim();address=line.slice(pos+sep.length).trim();break}
    }
    if(!name) name='Entrega '+(index+1);
    return {id:Date.now()+index,name,address,lat:null,lon:null,p:'normal',done:false,needsGeocode:true,geocoded:false};
  });
}

function importBulk(){
  const input=document.querySelector('#bulkInput').value;
  const items=parseBulk(input);
  const msg=document.querySelector('#importMsg');
  if(!items.length){msg.textContent='Digite ou cole pelo menos um endereço.';msg.className='message error';return}
  deliveries=items;
  msg.textContent=`✅ ${items.length} entrega${items.length===1?'':'s'} importada${items.length===1?'':'s'}. Agora toque em “Localizar endereços”.`;
  msg.className='message success';
  document.querySelector('#geoMsg').textContent='Pronto para localizar os endereços.';
  document.querySelector('#opt').disabled=true;
  document.querySelector('#status').textContent='Lista importada';
  render([],0);
  clearMap();
}

function fillExample(){
  document.querySelector('#bulkInput').value=[
  'Maria - Av. Tapajós, 100, Santarém-PA',
  'João - Av. Mendonça Furtado, 850, Santarém-PA',
  'Ana - Av. Rui Barbosa, 1200, Santarém-PA',
  'Carlos - Rod. Fernando Guilhon, Santarém-PA',
  'Mercado - Av. Cuiabá, 500, Santarém-PA'
  ].join('\n');
  document.querySelector('#importMsg').textContent='Exemplo carregado. Toque em “Importar entregas”.';
  document.querySelector('#importMsg').className='message';
}

function clearBulk(){
  document.querySelector('#bulkInput').value='';
  document.querySelector('#importMsg').textContent='';
  document.querySelector('#importMsg').className='message';
}

async function geocodeAddress(address){
  const url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3&countrycodes=br&q='+encodeURIComponent(address);
  const response=await fetch(url,{headers:{'Accept':'application/json'}});
  if(!response.ok) throw new Error('Falha no serviço de localização');
  const data=await response.json();
  return data;
}

function sleep(ms){return new Promise(r=>setTimeout(r,ms))}

async function geocodeAll(){
  const msg=document.querySelector('#geoMsg');
  const btn=document.querySelector('#geocodeBtn');
  const opt=document.querySelector('#opt');
  if(!deliveries.length){msg.textContent='Importe pelo menos uma entrega primeiro.';msg.className='message geo-warn';return}
  btn.disabled=true; opt.disabled=true;
  let ok=0,notFound=0,errors=0;
  msg.textContent='Localizando endereços...';
  for(let i=0;i<deliveries.length;i++){
    const d=deliveries[i];
    msg.textContent=`📍 Localizando ${i+1} de ${deliveries.length}: ${d.address}`;
    try{
      const results=await geocodeAddress(d.address);
      if(results.length){
        d.lat=parseFloat(results[0].lat);
        d.lon=parseFloat(results[0].lon);
        d.display_name=results[0].display_name;
        d.geocoded=true;
        d.needsGeocode=false;
        d.ambiguous=results.length>1;
        ok++;
      }else{
        d.geocoded=false; d.needsGeocode=true; notFound++;
      }
    }catch(e){d.geocoded=false;errors++}
    render(deliveries.filter(x=>x.geocoded),0);
    await sleep(1100);
  }
  const located=deliveries.filter(x=>x.geocoded);
  if(located.length){
    opt.disabled=false;
    drawMap(located);
  }
  msg.textContent=`✅ ${ok} localizado(s) • ⚠️ ${notFound} não localizado(s) • ❌ ${errors} erro(s). Revise os que ficaram sem localização.`;
  msg.className=errors||notFound?'message geo-warn':'message success';
  btn.disabled=false;
  document.querySelector('#status').textContent='Geocodificação concluída';
}

function initMap(){
  map=L.map('map').setView([origin.lat,origin.lon],13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19,attribution:'&copy; OpenStreetMap contributors'
  }).addTo(map);
}

function clearMap(){
  if(!map)return;
  markers.forEach(m=>m.remove());
  markers=[];
  map.setView([origin.lat,origin.lon],13);
}

function drawMap(items){
  if(!map)return;
  clearMap();
  const bounds=[];
  items.forEach((d,i)=>{
    if(!Number.isFinite(d.lat)||!Number.isFinite(d.lon))return;
    const marker=L.marker([d.lat,d.lon]).addTo(map);
    marker.bindPopup(`<b>${i+1}. ${esc(d.name)}</b><br>${esc(d.address)}`);
    markers.push(marker);
    bounds.push([d.lat,d.lon]);
  });
  if(bounds.length===1) map.setView(bounds[0],16);
  else if(bounds.length) map.fitBounds(bounds,{padding:[25,25]});
}

document.querySelector('#opt').onclick=optimize;
document.querySelector('#geocodeBtn').onclick=geocodeAll;
document.querySelector('#importBtn').onclick=importBulk;
document.querySelector('#exampleBtn').onclick=fillExample;
document.querySelector('#clearBtn').onclick=clearBulk;

window.addEventListener('load',()=>{initMap();});
render([],0);

let deferredPrompt;
const installBtn=document.querySelector('#installBtn');
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;installBtn.classList.remove('hidden')});
installBtn.addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;installBtn.classList.add('hidden')});
window.addEventListener('appinstalled',()=>{installBtn.classList.add('hidden');document.querySelector('#installHelp').textContent='Aplicativo instalado na tela inicial.'});
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));
