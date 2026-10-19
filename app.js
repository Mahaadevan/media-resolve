const {FFmpeg}=FFmpegWASM,{fetchFile,toBlobURL}=FFmpegUtil,{animate,stagger}=Motion;
const $=s=>document.querySelector(s),CDN='https://cdn.jsdelivr.net/npm/';
const prof=(p,px)=>['-c:v','prores_ks','-profile:v',p,'-pix_fmt',px];
const dnx=(p,px)=>['-c:v','dnxhd','-profile:v',p,'-pix_fmt',px];
const VC={dnx_lb:['DNxHR LB (proxy)',dnx('dnxhr_lb','yuv422p')],dnx_sq:['DNxHR SQ',dnx('dnxhr_sq','yuv422p')],dnx_hq:['DNxHR HQ (8-bit)',dnx('dnxhr_hq','yuv422p')],dnx_hqx:['DNxHR HQX (10-bit)',dnx('dnxhr_hqx','yuv422p10le')],dnx_444:['DNxHR 444 (10-bit)',dnx('dnxhr_444','yuv444p10le')],
pr_proxy:['ProRes Proxy',prof('0','yuv422p10le')],pr_lt:['ProRes LT',prof('1','yuv422p10le')],pr_422:['ProRes 422',prof('2','yuv422p10le')],pr_hq:['ProRes 422 HQ',prof('3','yuv422p10le')],pr_4444:['ProRes 4444 (alpha)',prof('4','yuva444p10le')],mjpeg:['MJPEG (high quality)',['-c:v','mjpeg','-q:v','2','-pix_fmt','yuvj422p']],none:['No video (audio only)',[]]};
const AC={pcm16:['PCM 16-bit',['-c:a','pcm_s16le']],pcm24:['PCM 24-bit',['-c:a','pcm_s24le']],none:['No audio',['-an']]};
const CT={mov:'MOV',mkv:'MKV',mxf:'MXF'},RES={'':'Source','2160':'2160p','1440':'1440p','1080':'1080p','720':'720p','480':'480p'},FPS={'':'Source','24':'24','25':'25','30':'30','50':'50','60':'60'};
const ROT={'':'None','transpose=1':'90° CW','transpose=2':'90° CCW','transpose=1,transpose=1':'180°'};
const PRESETS={edit:{n:'Edit · DNxHR HQ',d:'Intra-frame, fast scrubbing. Best general codec for Resolve Free on Linux.',v:'dnx_hq',a:'pcm16',c:'mov',r:''},
color:{n:'Color · ProRes 422 HQ',d:'10-bit 4:2:2 for grading. Larger files.',v:'pr_hq',a:'pcm24',c:'mov',r:''},
proxy:{n:'Proxy · 720p',d:'Tiny, light files for weak PCs.',v:'dnx_lb',a:'pcm16',c:'mov',r:'720'},
alpha:{n:'Alpha · ProRes 4444',d:'Keeps transparency.',v:'pr_4444',a:'pcm24',c:'mov',r:''},
audio:{n:'Audio · WAV',d:'Extracts PCM audio (no AAC on Resolve Free Linux).',v:'none',a:'pcm16',c:'mov',r:''}};
const FEATS=['Any input format|Everything ffmpeg can read','Resolve presets|Edit, Color, Proxy, Alpha, Audio','Private|Files never leave your browser','Format menus|Codec, audio, container, size, fps','Dev menu|Command, logs, stats, file analysis','Glass UI|Dark / light, Resolve gradient'];
const fill=(id,o)=>$(id).innerHTML=Object.entries(o).map(([k,v])=>`<option value="${k}">${Array.isArray(v)?v[0]:v}</option>`).join('');
fill('#vc',VC);fill('#ac',AC);fill('#ct',CT);fill('#res',RES);fill('#fps',FPS);fill('#rot',ROT);
$('#featList').innerHTML=FEATS.map(f=>{const[a,b]=f.split('|');return`<div class="glass"><b>${a}</b><br><span class="muted">${b}</span></div>`}).join('');
let ff,file,loaded=false,busy=false,url,lines=[],t0=0,inSize=0,outSize=0,elapsed=0,cap=null;const plyr=new Plyr('#player');
const errMsg=e=>e instanceof Error?e.message:typeof e==='string'?e:(e&&e.message)||(()=>{try{return JSON.stringify(e)}catch{return''}})()||'Unknown error';
function toast(m,e){const t=document.createElement('div');t.className='toast'+(e?' err':'');t.textContent=m;$('#toasts').append(t);animate(t,{opacity:[0,1],x:[40,0]},{duration:.3});setTimeout(()=>t.remove(),4500)}
function log(s,c){const d=document.createElement('div');c=c||(/error|invalid|fail|no such|unknown/i.test(s)?'err':/warn/i.test(s)?'warn':'');d.className=c;const l=`[${new Date().toLocaleTimeString()}] ${s}`;d.textContent=l;lines.push(l);const L=$('#log');L.append(d);while(L.childElementCount>2000)L.firstChild.remove();L.scrollTop=L.scrollHeight}
function stats(){const mb=n=>n?(n/1048576).toFixed(2)+' MB':'–';$('#stats').innerHTML=[['Engine',loaded?'ready':'not loaded'],['Isolated',self.crossOriginIsolated?'yes':'no (single thread)'],['Input',mb(inSize)],['Output',mb(outSize)],['Ratio',inSize&&outSize?(outSize/inSize).toFixed(2)+'×':'–'],['Elapsed',elapsed?(elapsed/1000).toFixed(1)+' s':'–']].map(([a,b])=>`<div>${a}<b>${b}</b></div>`).join('')}
function mk(){ff=new FFmpeg();ff.on('log',({message})=>{log(message);if(cap)cap.push(message)});ff.on('progress',({progress})=>{const p=Math.min(100,Math.max(0,Math.round((progress||0)*100)));$('#pb').style.width=p+'%';$('#pt').textContent=p+'%'})}mk();
async function reset(){try{ff.terminate()}catch{}loaded=false;mk();stats()}
async function load(){if(loaded)return;toast('Loading engine (~30 MB, cached after)…');log('Loading ffmpeg core 0.12.6','ok');const b=CDN+'@ffmpeg/core@0.12.6/dist/umd/';
await ff.load({coreURL:await toBlobURL(b+'ffmpeg-core.js','text/javascript'),wasmURL:await toBlobURL(b+'ffmpeg-core.wasm','application/wasm'),classWorkerURL:await toBlobURL(CDN+'@ffmpeg/ffmpeg@0.12.10/dist/umd/814.ffmpeg.js','text/javascript')});loaded=true;log('Engine ready','ok');stats()}
const IN=()=>{const x=(file.name.split('.').pop()||'').toLowerCase();return'in.'+(/^[a-z0-9]{1,5}$/.test(x)?x:'bin')};
function build(cli){const v=$('#vc').value,a=$('#ac').value,r=$('#res').value,f=$('#fps').value,rot=$('#rot').value,noV=v==='none';
const ext=noV?'wav':$('#ct').value,vf=[rot,r&&`scale=-2:${r}`,f&&`fps=${f}`].filter(Boolean).join(','),ex=$('#extra').value.trim().split(/\s+/).filter(Boolean);
const inp=cli&&file?`"${file.name}"`:file?IN():'input',out=cli&&file?`"${file.name.replace(/\.[^.]+$/,'')}_resolve.${ext}"`:'out.'+ext;
return{ext,out:'out.'+ext,args:['-hide_banner','-loglevel',$('#ll').value,'-i',inp,...(noV?['-vn']:[...(vf?['-vf',vf]:[]),...VC[v][1]]),...(noV&&a==='none'?[]:AC[a][1]),...ex,...(cli?[out]:['out.'+ext])]}}
function refresh(){const noV=$('#vc').value==='none';$('#ct').disabled=noV;$('#cmd').textContent='ffmpeg '+build(true).args.join(' ');$('#go').textContent='Convert → '+(noV?'WAV':$('#ct').value.toUpperCase())}
$('#presets').innerHTML=Object.entries(PRESETS).map(([k,p])=>`<button data-k="${k}">${p.n}</button>`).join('');
$('#presets').onclick=e=>{const k=e.target.dataset.k;if(!k)return;const p=PRESETS[k];document.querySelectorAll('#presets button').forEach(b=>b.classList.toggle('on',b===e.target));$('#pdesc').textContent=p.d;$('#vc').value=p.v;$('#ac').value=p.a;$('#ct').value=p.c;$('#res').value=p.r;$('#fps').value='';refresh()};
$('#presets button').click();['vc','ac','ct','res','fps','rot','extra','ll'].forEach(i=>$('#'+i).addEventListener('input',()=>{if(['vc','ac','ct','res','fps'].includes(i))document.querySelectorAll('#presets button').forEach(b=>b.classList.remove('on'));refresh()}));
function pick(f){if(!f)return;if(!/^(video|audio)\//.test(f.type)&&!/\.(mkv|mts|m2ts|flv|wmv|avi|ts|mxf|3gp|mov|mp4|webm|m4a|mp3|wav|flac|ogg)$/i.test(f.name))return toast('Unsupported file type',1);
file=f;inSize=f.size;outSize=0;elapsed=0;$('#fname').textContent=f.name;$('#go').disabled=$('#frame').disabled=$('#analyze').disabled=false;if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(f);
plyr.source={type:'video',sources:[{src:url,type:f.type||'video/mp4'}]};$('#info').textContent=`${f.name}\n${(f.size/1048576).toFixed(1)} MB · ${f.type||'unknown type'}`;log(`Loaded ${f.name} (${f.size} bytes, ${f.type||'?'})`,'ok');refresh();stats();toast('File ready')}
const d=$('#drop');d.onclick=()=>$('#file').click();d.onkeydown=e=>{if(e.key==='Enter')$('#file').click()};$('#file').onchange=e=>pick(e.target.files[0]);
['dragover','dragenter'].forEach(v=>d.addEventListener(v,e=>{e.preventDefault();d.classList.add('on')}));
['dragleave','drop'].forEach(v=>d.addEventListener(v,e=>{e.preventDefault();d.classList.remove('on')}));d.ondrop=e=>pick(e.dataTransfer.files[0]);
['loadedmetadata','play','pause','seeked','ended'].forEach(ev=>plyr.on(ev,()=>log(`player:${ev} t=${plyr.currentTime.toFixed(2)} dur=${(plyr.duration||0).toFixed(2)}`,'pl')));
plyr.on('error',()=>{log('player: browser cannot decode this source (conversion still works)','warn');toast('Browser can’t preview this codec — conversion still works',1)});
const btns=['#go','#frame','#analyze'];const setBusy=b=>{busy=b;btns.forEach(s=>$(s).disabled=b||!file)};
async function run(args,out,mime,name,after){if(!file)return toast('Choose a file first',1);if(busy)return;setBusy(true);$('.bar').hidden=false;$('#pb').style.width='0';$('#pt').textContent='0%';t0=performance.now();
log('ffmpeg '+args.join(' '),'ok');
try{await load();await ff.writeFile(IN(),await fetchFile(file));const code=await ff.exec(args);if(code!==0)throw new Error(`ffmpeg exited with code ${code} — see Dev ▸ log`);
let data;try{data=await ff.readFile(out)}catch{throw new Error('No output file was produced — see Dev ▸ log')}if(!data||!data.length)throw new Error('Output is empty — encoder may be missing in this wasm build');
const l=document.createElement('a');l.href=URL.createObjectURL(new Blob([data],{type:mime}));l.download=name;l.className='btn';l.textContent='Download '+name;$('#out').replaceChildren(l);animate(l,{opacity:[0,1],y:[12,0]});
outSize=data.length;elapsed=performance.now()-t0;$('#pb').style.width='100%';$('#pt').textContent='100%';log(`Done in ${(elapsed/1000).toFixed(1)} s → ${name} (${outSize} bytes)`,'ok');toast('Done ✔')}
catch(e){const m=errMsg(e);log('ERROR: '+m,'err');toast('Failed: '+m+(/memory|abort|out of bounds/i.test(m)?' (file may be too large for wasm)':''),1);await reset()}
finally{try{await ff.deleteFile(IN())}catch{}try{await ff.deleteFile(out)}catch{}setBusy(false);stats()}}
$('#go').onclick=()=>{const b=build(false),base=file.name.replace(/\.[^.]+$/,'');if($('#vc').value==='none'&&$('#ac').value==='none')return toast('Audio-only needs an audio codec',1);
run(b.args,b.out,b.ext==='wav'?'audio/wav':'video/quicktime',`${base}_resolve.${b.ext}`)};
$('#frame').onclick=()=>{const img=$('#fimg').value,raw=$('#ft').value,t=raw===''?(plyr.currentTime||0):parseFloat(raw);if(!isFinite(t)||t<0)return toast('Invalid time',1);
const rot=$('#rot').value,out='frame.'+img;run(['-hide_banner','-loglevel',$('#ll').value,'-ss',t.toFixed(3),'-i',IN(),...(rot?['-vf',rot]:[]),'-frames:v','1',...(img==='jpg'?['-q:v','2']:[]),out],out,img==='png'?'image/png':'image/jpeg',`${file.name.replace(/\.[^.]+$/,'')}_${t.toFixed(2)}s.${img}`)};
$('#analyze').onclick=async()=>{if(busy||!file)return;setBusy(true);cap=[];try{await load();await ff.writeFile(IN(),await fetchFile(file));await ff.exec(['-hide_banner','-i',IN()]);
const s=cap.filter(m=>/Duration|Stream #|Input #|major_brand|encoder/i.test(m)).map(m=>m.trim());$('#info').textContent=file.name+'\n'+(s.join('\n')||'No stream info found');toast('Analysis complete')}
catch(e){const m=errMsg(e);log('ERROR: '+m,'err');toast('Analyze failed: '+m,1);await reset()}finally{cap=null;try{await ff.deleteFile(IN())}catch{}setBusy(false)}};
$('#devT').onchange=e=>{$('#dev').hidden=!e.target.checked;stats()};
const flash=async(t)=>{try{await navigator.clipboard.writeText(t);toast('Copied')}catch{toast('Copy blocked by browser',1)}};
$('#copyCmd').onclick=()=>flash('ffmpeg '+build(true).args.join(' '));$('#copyLog').onclick=()=>flash(lines.join('\n'));$('#clrLog').onclick=()=>{lines=[];$('#log').replaceChildren()};
$('#dlLog').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/plain'}));a.download='media-resolve.log';a.click()};
const tt=document.createElement('div');tt.id='tt';document.body.append(tt);
function tip(el){tt.textContent=el.dataset.tip;tt.style.opacity=1;const r=el.getBoundingClientRect(),w=tt.offsetWidth,h=tt.offsetHeight;const x=Math.max(8,Math.min(innerWidth-w-8,r.left+r.width/2-w/2));let y=r.bottom+8;if(y+h>innerHeight-8)y=Math.max(8,r.top-h-8);tt.style.transform=`translate(${x}px,${y}px)`}
document.addEventListener('mouseover',e=>{const el=e.target.closest('[data-tip]');el?tip(el):tt.style.opacity=0});document.addEventListener('focusin',e=>{const el=e.target.closest('[data-tip]');el&&tip(el)});document.addEventListener('focusout',()=>tt.style.opacity=0);document.addEventListener('scroll',()=>tt.style.opacity=0,true);
$('#themeT').onclick=()=>{const h=document.documentElement;h.dataset.theme=h.dataset.theme==='dark'?'light':'dark';try{localStorage.theme=h.dataset.theme}catch{}};
try{document.documentElement.dataset.theme=localStorage.theme||'dark'}catch{}
animate('.hero > *, .card',{opacity:[0,1],y:[24,0]},{delay:stagger(.08),duration:.6});stats();
