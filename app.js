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
const defaultOrigin={lat:-2.4385,lon:-54.6990,name:'Centro de Santarém'};
let startPoint={...defaultOrigin};
let map=null,markers=[],routeLayer=null;

function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}

function render(route,totalKm=0,totalMin=0){
  document.querySelector('#count').textContent=route.length;
  document.querySelector('#km').textContent=totalKm?totalKm.toFixed(1)+' km':'0 km';
  document.querySelector('#time').textContent=totalMin?Math.round(totalMin)+' min':'0 min';
  const ol=document.querySelector('#route'); ol.innerHTML='';
  if(!route.length){ol.innerHTML='<li class="empty">Nenhuma entrega com localização disponível.</li>';return}
  route.forEach((d,i)=>{
    const li=document.createElement('li');
    const geo=d.geocoded?'📍 Localizado':'⚠️ Sem localização';
    const leg=d.roadDuration!=null?`<br><span class="road-leg">🚗 ${Math.round(d.roadDuration/60)} min até esta parada</span>`:'';
    li.innerHTML=`<div class="stop"><div><b>${i+1}. ${esc(d.name)}</b><br><small>${esc(d.address)}</small><br><span class="priority ${d.p==='alta'?'high':''}">${d.p==='alta'?'🔴 Alta prioridade':'🟢 Normal'}</span><br><span class="geo-badge">${geo}</span>${leg}</div><button onclick="go(${d.id})">Navegar</button></div>`;
    ol.appendChild(li);
  });
}

function go(id){
  const d=deliveries.find(x=>x.id===id),nav=document.querySelector('#nav').value;
  if(!d)return;
  if(nav==='waze') location.href='https://www.waze.com/ul?q='+encodeURIComponent(d.address)+'&navigate=yes';
  else location.href='https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(d.address);
}

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
  render([],0,0);
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
  // Santarém é a cidade padrão do Rota Entregas.
  // Tentamos algumas formas para que o usuário não precise repetir a cidade em cada linha.
  const base=String(address||'').trim();
  const queries=[
    `${base}, Santarém, Pará, Brasil`,
    `${base}, Santarém, PA, Brasil`,
    `${base}, Santarém - PA, Brasil`,
    `${base}, Brasil`
  ];
  for(const q of queries){
    const url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3&countrycodes=br&q='+encodeURIComponent(q);
    const response=await fetch(url,{headers:{'Accept':'application/json'}});
    if(!response.ok) throw new Error('Falha no serviço de localização');
    const results=await response.json();
    if(results.length) return results;
    await sleep(1100);
  }
  return [];
}

async function geocodeAll(){
  const msg=document.querySelector('#geoMsg');
  const btn=document.querySelector('#geocodeBtn');
  const opt=document.querySelector('#opt');
  if(!deliveries.length){msg.textContent='Importe pelo menos uma entrega primeiro.';msg.className='message geo-warn';return}
  btn.disabled=true; opt.disabled=true;
  let ok=0,notFound=0,errors=0;
  msg.textContent='Localizando ponto de saída...';
  try{
    const startQuery=document.querySelector('#start').value.trim()||defaultOrigin.name;
    const startResults=await geocodeAddress(startQuery+' , Santarém - PA');
    if(startResults.length){
      startPoint={lat:parseFloat(startResults[0].lat),lon:parseFloat(startResults[0].lon),name:startQuery};
    }else startPoint={...defaultOrigin};
  }catch(e){startPoint={...defaultOrigin}}
  await sleep(1100);

  for(let i=0;i<deliveries.length;i++){
    const d=deliveries[i];
    msg.textContent=`📍 Localizando ${i+1} de ${deliveries.length}: ${d.address}`;
    try{
      // Quando o endereço é muito curto, o nome ajuda a encontrar um estabelecimento.
      const query=d.address.length<28?`${d.name}, ${d.address}`:d.address;
      const results=await geocodeAddress(query);
      if(results.length){
        d.lat=parseFloat(results[0].lat); d.lon=parseFloat(results[0].lon);
        d.display_name=results[0].display_name; d.geocoded=true; d.needsGeocode=false; d.ambiguous=results.length>1; ok++;
      }else{d.geocoded=false;d.needsGeocode=true;notFound++}
    }catch(e){d.geocoded=false;errors++}
    render(deliveries.filter(x=>x.geocoded),0,0);
    await sleep(1100);
  }
  const located=deliveries.filter(x=>x.geocoded);
  if(located.length){opt.disabled=false;drawStops(located)}
  msg.textContent=`✅ ${ok} localizado(s) • ⚠️ ${notFound} não localizado(s) • ❌ ${errors} erro(s).`;
  msg.className=errors||notFound?'message geo-warn':'message success';
  btn.disabled=false;
  document.querySelector('#status').textContent='Geocodificação concluída';
}

async function osrmTable(points){
  const coords=points.map(p=>`${p.lon},${p.lat}`).join(';');
  const url=`https://router.project-osrm.org/table/v1/driving/${coords}?annotations=duration,distance`;
  const response=await fetch(url);
  if(!response.ok) throw new Error('Falha no serviço de rotas');
  const data=await response.json();
  if(data.code!=='Ok') throw new Error(data.code||'Não foi possível calcular a matriz de rotas');
  return data;
}

function routeCost(order,matrix){
  let cost=0,prev=0;
  for(const idx of order){
    const v=matrix[prev]?.[idx];
    if(v==null) return Infinity;
    cost+=v; prev=idx;
  }
  return cost;
}

function improve2Opt(order,matrix){
  let best=[...order],bestCost=routeCost(best,matrix),changed=true,passes=0;
  while(changed && passes<20){
    changed=false;passes++;
    for(let i=0;i<best.length-1;i++){
      for(let j=i+1;j<best.length;j++){
        const candidate=best.slice();
        const part=candidate.slice(i,j+1).reverse();
        candidate.splice(i,j-i+1,...part);
        const cost=routeCost(candidate,matrix);
        if(cost+1<bestCost){best=candidate;bestCost=cost;changed=true;}
      }
    }
  }
  return best;
}

async function roadOptimize(){
  const opt=document.querySelector('#opt'),msg=document.querySelector('#geoMsg');
  const pending=deliveries.filter(d=>!d.done&&Number.isFinite(d.lat)&&Number.isFinite(d.lon));
  if(!pending.length){msg.textContent='Não há entregas localizadas para calcular.';msg.className='message geo-warn';return}
  if(pending.length>20){msg.textContent='Para esta versão de teste, use até 20 paradas por vez.';msg.className='message geo-warn';return}
  opt.disabled=true;
  document.querySelector('#status').textContent=`Calculando rota pelas ruas (${pending.length} paradas)...`;
  msg.textContent='🚗 Calculando distâncias e tempos pela malha viária...';msg.className='message';
  try{
    const points=[startPoint,...pending];
    const table=await osrmTable(points);
    let order=pending.map((_,i)=>i+1);
    order=nearestRoadOrder(order,table.durations);
    order=improve2Opt(order,table.durations);
    const ordered=order.map(idx=>pending[idx-1]);
    const coords=[startPoint,...ordered].map(p=>`${p.lon},${p.lat}`).join(';');
    const routeUrl=`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;
    const response=await fetch(routeUrl);
    if(!response.ok) throw new Error('Falha ao desenhar a rota');
    const routeData=await response.json();
    if(routeData.code!=='Ok'||!routeData.routes?.length) throw new Error(routeData.code||'Rota não encontrada');
    const r=routeData.routes[0];
    ordered.forEach((d,i)=>{
      const leg=r.legs?.[i];
      d.roadDuration=leg?.duration??null;
      d.roadDistance=leg?.distance??null;
    });
    render(ordered,r.distance/1000,r.duration/60);
    drawRoadRoute(ordered,r.geometry);
    document.querySelector('#status').textContent='Rota real calculada';
    msg.textContent=`🚗 Rota pelas ruas calculada: ${ (r.distance/1000).toFixed(1) } km • ${Math.round(r.duration/60)} min.`;
    msg.className='message success';
  }catch(e){
    msg.textContent='❌ Não foi possível calcular a rota real agora. Tente novamente em alguns segundos.';
    msg.className='message geo-warn';
    document.querySelector('#status').textContent='Erro no cálculo';
  }finally{opt.disabled=false}
}

function nearestRoadOrder(ids,matrix){
  const remaining=[...ids],result=[];let current=0;
  while(remaining.length){
    let bestPos=0,best=Infinity;
    remaining.forEach((idx,pos)=>{const v=matrix[current]?.[idx];if(v!=null&&v<best){best=v;bestPos=pos}});
    const next=remaining.splice(bestPos,1)[0];result.push(next);current=next;
  }
  return result;
}

function initMap(){
  map=L.map('map').setView([defaultOrigin.lat,defaultOrigin.lon],13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
}
function clearMap(){
  if(!map)return;
  markers.forEach(m=>m.remove());markers=[];
  if(routeLayer){routeLayer.remove();routeLayer=null}
  map.setView([defaultOrigin.lat,defaultOrigin.lon],13);
}
function drawStops(items){
  if(!map)return;
  markers.forEach(m=>m.remove());markers=[];
  const bounds=[[startPoint.lat,startPoint.lon]];
  const startMarker=L.marker([startPoint.lat,startPoint.lon]).addTo(map).bindPopup('<b>🚚 Saída</b><br>'+esc(startPoint.name));
  markers.push(startMarker);
  items.forEach((d,i)=>{
    if(!Number.isFinite(d.lat)||!Number.isFinite(d.lon))return;
    const marker=L.marker([d.lat,d.lon]).addTo(map).bindPopup(`<b>${i+1}. ${esc(d.name)}</b><br>${esc(d.address)}`);
    markers.push(marker);bounds.push([d.lat,d.lon]);
  });
  if(bounds.length>1)map.fitBounds(bounds,{padding:[25,25]});
}
function drawRoadRoute(items,geometry){
  drawStops(items);
  if(routeLayer)routeLayer.remove();
  routeLayer=L.geoJSON(geometry,{style:{weight:5,opacity:.85}}).addTo(map);
  const bounds=routeLayer.getBounds();if(bounds.isValid())map.fitBounds(bounds,{padding:[25,25]});
}

document.querySelector('#opt').onclick=roadOptimize;
document.querySelector('#geocodeBtn').onclick=geocodeAll;
document.querySelector('#importBtn').onclick=importBulk;
document.querySelector('#exampleBtn').onclick=fillExample;
document.querySelector('#clearBtn').onclick=clearBulk;
window.addEventListener('load',()=>initMap());
render([],0,0);

let deferredPrompt;
const installBtn=document.querySelector('#installBtn');
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;installBtn.classList.remove('hidden')});
installBtn.addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;installBtn.classList.add('hidden')});
window.addEventListener('appinstalled',()=>{installBtn.classList.add('hidden');document.querySelector('#installHelp').textContent='Aplicativo instalado na tela inicial.'});
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));
