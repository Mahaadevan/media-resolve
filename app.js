const {FFmpeg}=FFmpegWASM,{fetchFile,toBlobURL}=FFmpegUtil,{animate,stagger}=Motion;
const $=s=>document.querySelector(s),CDN='https://cdn.jsdelivr.net/npm/';
const PRESETS={
edit:{n:'Edit · DNxHR HQ',ext:'mov',d:'Intra-frame, fast scrubbing. Best general editing codec for Resolve Free on Linux.',a:['-c:v','dnxhd','-profile:v','dnxhr_hq','-pix_fmt','yuv422p','-c:a','pcm_s16le']},
color:{n:'Color · ProRes 422 HQ',ext:'mov',d:'10-bit 4:2:2 for grading. Larger files.',a:['-c:v','prores_ks','-profile:v','3','-pix_fmt','yuv422p10le','-c:a','pcm_s16le']},
proxy:{n:'Proxy · DNxHR LB 720p',ext:'mov',d:'Tiny, light files for weak PCs.',vf:'scale=-2:720',a:['-c:v','dnxhd','-profile:v','dnxhr_lb','-pix_fmt','yuv422p','-c:a','pcm_s16le']},
audio:{n:'Audio · WAV',ext:'wav',d:'Extracts PCM audio (Resolve Free Linux lacks AAC).',a:['-vn','-c:a','pcm_s16le']}};
const FEATS=['Any input format|Everything ffmpeg can read','Resolve presets|Edit, Color, Proxy, Audio','Private|Files never leave your browser','Rotate & frame grab|Fix orientation, export PNG','Dev menu|Command preview, logs, custom args','Dark / light|Gradient accent UI'];
$('#featList').innerHTML=FEATS.map(f=>{const[a,b]=f.split('|');return`<div><b>${a}</b><br><span class="muted">${b}</span></div>`}).join('');
const ff=new FFmpeg();let file,preset='edit',loaded=false,plyr=new Plyr('#player'),url;
function toast(m,e){const t=document.createElement('div');t.className='toast'+(e?' err':'');t.textContent=m;$('#toasts').append(t);animate(t,{opacity:[0,1],x:[40,0]},{duration:.3});setTimeout(()=>t.remove(),4000)}
function log(s){$('#log').textContent+=s+'\n';$('#log').scrollTop=1e9}
ff.on('log',({message})=>log(message));
ff.on('progress',({progress})=>{const p=Math.min(100,Math.max(0,Math.round(progress*100)));$('#pb').style.width=p+'%';$('#pt').textContent=p+'%'});
async function load(){if(loaded)return;toast('Loading engine (~30 MB, cached after)…');const b=CDN+'@ffmpeg/core@0.12.6/dist/umd/';
await ff.load({coreURL:await toBlobURL(b+'ffmpeg-core.js','text/javascript'),wasmURL:await toBlobURL(b+'ffmpeg-core.wasm','application/wasm'),classWorkerURL:await toBlobURL(CDN+'@ffmpeg/ffmpeg@0.12.10/dist/umd/814.ffmpeg.js','text/javascript')});loaded=true}
const ext=()=>'.'+(file.name.split('.').pop()||'bin');
function args(){const p=PRESETS[preset],vf=[$('#rot').value,p.vf].filter(Boolean).join(',');const ex=$('#extra').value.trim().split(/\s+/).filter(Boolean);
return['-i','in'+ext(),...(vf&&!p.a.includes('-vn')?['-vf',vf]:[]),...p.a,...ex,'out.'+p.ext]}
function refresh(){const p=PRESETS[preset];$('#pdesc').textContent=p.d;$('#ext').value=p.ext;$('#cmd').textContent='ffmpeg '+(file?args().join(' '):'…')}
$('#presets').innerHTML=Object.entries(PRESETS).map(([k,p])=>`<button data-k="${k}">${p.n}</button>`).join('');
$('#presets').onclick=e=>{const k=e.target.dataset.k;if(!k)return;preset=k;document.querySelectorAll('#presets button').forEach(b=>b.classList.toggle('on',b===e.target));refresh()};
$('#presets button').click();['#rot','#extra'].forEach(s=>$(s).oninput=refresh);
function pick(f){if(!f)return;if(!/^(video|audio)\//.test(f.type)&&!/\.(mkv|mts|m2ts|flv|wmv|avi|ts|mxf|3gp)$/i.test(f.name))return toast('Unsupported file type',1);
file=f;$('#fname').textContent=f.name;$('#go').disabled=$('#frame').disabled=false;if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(f);
plyr.source={type:'video',sources:[{src:url,type:f.type||'video/mp4'}]};$('#info').textContent=`${f.name} · ${(f.size/1048576).toFixed(1)} MB · ${f.type||'unknown type'}`;refresh();toast('File ready')}
const d=$('#drop');d.onclick=()=>$('#file').click();$('#file').onchange=e=>pick(e.target.files[0]);
['dragover','dragenter'].forEach(v=>d.addEventListener(v,e=>{e.preventDefault();d.classList.add('on')}));
['dragleave','drop'].forEach(v=>d.addEventListener(v,e=>{e.preventDefault();d.classList.remove('on')}));d.ondrop=e=>pick(e.dataTransfer.files[0]);
async function run(a,name,mime){try{$('#go').disabled=true;$('.bar').hidden=false;$('#log').textContent='';await load();await ff.writeFile('in'+ext(),await fetchFile(file));
const r=await ff.exec(a);if(r!==0)throw new Error('ffmpeg exited with code '+r);const data=await ff.readFile(name);
const l=document.createElement('a');l.href=URL.createObjectURL(new Blob([data.buffer],{type:mime}));l.download=file.name.replace(/\.[^.]+$/,'')+'_resolve.'+name.split('.').pop();l.className='btn';l.textContent='Download '+l.download;$('#out').replaceChildren(l);
animate(l,{opacity:[0,1],y:[12,0]});toast('Done ✔');await ff.deleteFile(name)}
catch(e){toast('Failed: '+e.message+(/memory|abort/i.test(e.message)?' (file may be too large for wasm)':''),1);loaded=false}finally{$('#go').disabled=false}}
$('#go').onclick=()=>run(args(),'out.'+PRESETS[preset].ext,PRESETS[preset].ext=='wav'?'audio/wav':'video/quicktime');
$('#frame').onclick=()=>run(['-ss',String(plyr.currentTime||0),'-i','in'+ext(),'-frames:v','1','frame.png'],'frame.png','image/png');
$('#devT').onchange=e=>$('#dev').hidden=!e.target.checked;
$('#themeT').onclick=()=>{const h=document.documentElement;h.dataset.theme=h.dataset.theme=='dark'?'light':'dark';localStorage.theme=h.dataset.theme};
document.documentElement.dataset.theme=localStorage.theme||'dark';
animate('.hero > *, .card',{opacity:[0,1],y:[24,0]},{delay:stagger(.08),duration:.6});
