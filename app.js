const {FFmpeg}=FFmpegWASM,{fetchFile,toBlobURL}=FFmpegUtil,{animate,stagger}=Motion;
const $=s=>document.querySelector(s),CDN='https://cdn.jsdelivr.net/npm/';
const prof=(p,px)=>['-c:v','prores_ks','-profile:v',p,'-pix_fmt',px];
const dnx=(p,px)=>['-c:v','dnxhd','-profile:v',p,'-pix_fmt',px];
const VC={dnx_lb:['DNxHR LB (proxy)',dnx('dnxhr_lb','yuv422p')],dnx_sq:['DNxHR SQ',dnx('dnxhr_sq','yuv422p')],dnx_hq:['DNxHR HQ (8-bit)',dnx('dnxhr_hq','yuv422p')],dnx_hqx:['DNxHR HQX (10-bit)',dnx('dnxhr_hqx','yuv422p10le')],dnx_444:['DNxHR 444 (10-bit)',dnx('dnxhr_444','yuv444p10le')],
pr_proxy:['ProRes Proxy',prof('0','yuv422p10le')],pr_lt:['ProRes LT',prof('1','yuv422p10le')],pr_422:['ProRes 422',prof('2','yuv422p10le')],pr_hq:['ProRes 422 HQ',prof('3','yuv422p10le')],pr_4444:['ProRes 4444 (alpha)',prof('4','yuva444p10le')],mjpeg:['MJPEG (high quality)',['-c:v','mjpeg','-q:v','2','-pix_fmt','yuvj422p']],none:['No video (audio only)',[]]};
const AC={pcm16:['PCM 16-bit',['-c:a','pcm_s16le']],pcm24:['PCM 24-bit',['-c:a','pcm_s24le']],none:['No audio',['-an']]};
const CT={mov:'MOV',mkv:'MKV',mxf:'MXF'},RES={'':'Source','3840:2160':'4K UHD 16:9','2560:1440':'1440p 16:9','1920:1080':'1080p 16:9','1280:720':'720p 16:9','1080:1920':'1080×1920 9:16','1080:1350':'1080×1350 4:5','1080:1080':'1080×1080 1:1','720:1280':'720×1280 9:16'},CTA={wav:'WAV',aiff:'AIFF',flac:'FLAC'},FIT={pad:'Fit (letterbox)',crop:'Fill (crop)'},SR={'':'Source','44100':'44.1 kHz','48000':'48 kHz','96000':'96 kHz'},FPS={'':'Source','24':'24','25':'25','30':'30','50':'50','60':'60'};
const ROT={'':'None','transpose=1':'90° CW','transpose=2':'90° CCW','transpose=1,transpose=1':'180°'};
const P=(n,d,o)=>({n,d,v:'dnx_hq',a:'pcm16',c:'mov',r:'',f:'',fit:'pad',sr:'',...o});
const PRESETS={edit:P('Edit · DNxHR HQ','Intra-frame, fast scrubbing. Best general codec for Resolve Free on Linux.',{}),
color:P('Color · ProRes 422 HQ','10-bit 4:2:2 for grading. Larger files.',{v:'pr_hq',a:'pcm24'}),
proxy:P('Proxy · 720p','Tiny, light files for weak PCs.',{v:'dnx_lb',r:'1280:720'}),
alpha:P('Alpha · ProRes 4444','Keeps transparency.',{v:'pr_4444',a:'pcm24'}),
yt:P('YouTube 1080p','Platform size 16:9 1920×1080, source fps (YouTube accepts 24–60). Resolve-safe DNxHR HQ + PCM.',{r:'1920:1080'}),
yt4k:P('YouTube 4K','16:9 3840×2160, source fps. Heavy files.',{r:'3840:2160'}),
shorts:P('YT Shorts','9:16 1080×1920, 30 fps, cropped to fill.',{r:'1080:1920',f:'30',fit:'crop'}),
reels:P('Reels / TikTok','9:16 1080×1920, 30 fps, cropped to fill.',{r:'1080:1920',f:'30',fit:'crop'}),
igfeed:P('Instagram 4:5','Portrait feed 1080×1350, 30 fps.',{r:'1080:1350',f:'30',fit:'crop'}),
square:P('Square 1:1','1080×1080, 30 fps (Instagram / Facebook).',{r:'1080:1080',f:'30',fit:'crop'}),
x:P('X / Twitter','16:9 1280×720, 30 fps.',{r:'1280:720',f:'30'}),
fb:P('Facebook','16:9 1920×1080, 30 fps.',{r:'1920:1080',f:'30'}),
wav:P('Audio · WAV 24-bit','48 kHz PCM — safest audio for Resolve Free on Linux.',{v:'none',a:'pcm24',c:'wav',sr:'48000'}),
aiff:P('Audio · AIFF','48 kHz PCM, big-endian.',{v:'none',a:'pcm24',c:'aiff',sr:'48000'}),
flac:P('Audio · FLAC','Lossless, smaller than WAV.',{v:'none',a:'pcm24',c:'flac',sr:'48000'})};
const FEATS=['Any input format|Everything ffmpeg can read','Platform presets|YouTube, Reels, TikTok, X, Facebook…','Private|Files never leave your browser','Format menus|Codec, audio, container, size, fps','Dev menu|Command, logs, stats, file analysis','Glass UI|Dark / light, Resolve gradient'];
const fill=(id,o)=>$(id).innerHTML=Object.entries(o).map(([k,v])=>`<option value="${k}">${Array.isArray(v)?v[0]:v}</option>`).join('');
fill('#vc',VC);fill('#ac',AC);fill('#ct',CT);fill('#res',RES);fill('#fps',FPS);fill('#fit',FIT);fill('#sr',SR);
$('#featList').innerHTML=FEATS.map(f=>{const[a,b]=f.split('|');return`<div class="glass"><b>${a}</b><br><span class="muted">${b}</span></div>`}).join('');
let items=[],sel=-1,ff,file,loaded=false,busy=false,url,lines=[],t0=0,inSize=0,outSize=0,elapsed=0,cap=null;const plyr=new Plyr('#player');
const errMsg=e=>e instanceof Error?e.message:typeof e==='string'?e:(e&&e.message)||(()=>{try{return JSON.stringify(e)}catch{return''}})()||'Unknown error';
function toast(m,e){const t=document.createElement('div');t.className='toast'+(e?' err':'');t.textContent=m;$('#toasts').append(t);animate(t,{opacity:[0,1],x:[40,0]},{duration:.3});setTimeout(()=>t.remove(),4500)}
function log(s,c){const d=document.createElement('div');c=c||(/error|invalid|fail|no such|unknown/i.test(s)?'err':/warn/i.test(s)?'warn':'');d.className=c;const l=`[${new Date().toLocaleTimeString()}] ${s}`;d.textContent=l;lines.push(l);const L=$('#log');L.append(d);while(L.childElementCount>2000)L.firstChild.remove();L.scrollTop=L.scrollHeight}
function stats(){const mb=n=>n?(n/1048576).toFixed(2)+' MB':'–';$('#stats').innerHTML=[['Engine',loaded?'ready':'not loaded'],['Isolated',self.crossOriginIsolated?'yes':'no (single thread)'],['Input',mb(inSize)],['Output',mb(outSize)],['Ratio',inSize&&outSize?(outSize/inSize).toFixed(2)+'×':'–'],['Elapsed',elapsed?(elapsed/1000).toFixed(1)+' s':'–']].map(([a,b])=>`<div>${a}<b>${b}</b></div>`).join('')}
function mk(){ff=new FFmpeg();ff.on('log',({message})=>{log(message);if(cap)cap.push(message)});ff.on('progress',({progress})=>{const p=Math.min(100,Math.max(0,Math.round((progress||0)*100)));$('#pb').style.width=p+'%';$('#pt').textContent=p+'%'})}mk();
async function reset(){try{ff.terminate()}catch{}loaded=false;mk();stats()}
async function load(){if(loaded)return;toast('Loading engine (~30 MB, cached after)…');log('Loading ffmpeg core 0.12.6','ok');const b=CDN+'@ffmpeg/core@0.12.6/dist/umd/';
await ff.load({coreURL:await toBlobURL(b+'ffmpeg-core.js','text/javascript'),wasmURL:await toBlobURL(b+'ffmpeg-core.wasm','application/wasm'),classWorkerURL:await toBlobURL(CDN+'@ffmpeg/ffmpeg@0.12.10/dist/umd/814.ffmpeg.js','text/javascript')});loaded=true;log('Engine ready','ok');stats()}
const IN=()=>{const x=(file.name.split('.').pop()||'').toLowerCase();return'in.'+(/^[a-z0-9]{1,5}$/.test(x)?x:'bin')};
const AUD={wav:{pcm16:'pcm_s16le',pcm24:'pcm_s24le'},aiff:{pcm16:'pcm_s16be',pcm24:'pcm_s24be'}};
function setCT(noV){const s=$('#ct'),k=noV?'a':'v';if(s.dataset.k===k)return;const cur=s.value;fill('#ct',noV?CTA:CT);s.dataset.k=k;if([...s.options].some(o=>o.value===cur))s.value=cur}
function build(cli){const v=$('#vc').value,a=$('#ac').value,r=$('#res').value,f=$('#fps').value,rot=rotv(),fit=$('#fit').value,sr=$('#sr').value,noV=v==='none',ct=$('#ct').value;
const ext=noV?(CTA[ct]?ct:'wav'):ct,ex=$('#extra').value.trim().split(/\s+/).filter(Boolean);
let sc='';if(r){const[w,h]=r.split(':');sc=fit==='crop'?`scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1`:`scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1`}
const vf=[rot,sc,f&&`fps=${f}`].filter(Boolean).join(','),bd=a==='pcm24'?'pcm24':'pcm16';
const aud=noV?(ext==='flac'?['-c:a','flac',...(bd==='pcm24'?['-sample_fmt','s32']:[])]:['-c:a',AUD[ext][bd]]):AC[a][1];
const inp=cli&&file?`"${file.name}"`:file?IN():'input',out=cli&&file?`"${file.name.replace(/\.[^.]+$/,'')}_resolve.${ext}"`:'out.'+ext;
return{ext,out:'out.'+ext,args:['-hide_banner','-loglevel',$('#ll').value,'-i',inp,...(noV?['-vn']:[...(vf?['-vf',cli?`"${vf}"`:vf]:[]),...VC[v][1]]),...aud,...(sr?['-ar',sr]:[]),...ex,...(cli?[out]:['out.'+ext])]}}
function refresh(){setCT($('#vc').value==='none');$('#cmd').textContent='ffmpeg '+build(true).args.join(' ');$('#go').textContent='Convert → '+build(false).ext.toUpperCase()}
$('#presets').innerHTML=Object.entries(PRESETS).map(([k,p])=>`<button data-k="${k}">${p.n}</button>`).join('');
$('#presets').onclick=e=>{const k=e.target.dataset.k;if(!k)return;const p=PRESETS[k];document.querySelectorAll('#presets button').forEach(b=>b.classList.toggle('on',b===e.target));$('#pdesc').textContent=p.d;$('#vc').value=p.v;setCT(p.v==='none');$('#ac').value=p.a;$('#ct').value=p.c;$('#res').value=p.r;$('#fps').value=p.f;$('#fit').value=p.fit;$('#sr').value=p.sr;refresh()};
$('#presets button').click();['vc','ac','ct','res','fps','fit','sr','extra','ll'].forEach(i=>$('#'+i).addEventListener('input',()=>{if(['vc','ac','ct','res','fps','fit','sr'].includes(i))document.querySelectorAll('#presets button').forEach(b=>b.classList.remove('on'));refresh()}));
const esc=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const OKX=/\.(mkv|mts|m2ts|flv|wmv|avi|ts|mxf|3gp|mov|mp4|webm|m4a|mp3|wav|flac|ogg|aac|aif|aiff|opus)$/i,isAud=f=>/^audio\//.test(f.type)||/\.(m4a|mp3|wav|flac|ogg|aac|aif|aiff|opus)$/i.test(f.name);
function rotv(){return items[sel]?items[sel].rot:''}
const STL={'':'Pending',run:'Converting…',done:'Done',err:'Failed'};
const upd=()=>{['#go','#frame','#analyze'].forEach(s=>$(s).disabled=busy||!file);$('#all').disabled=busy||!items.length};
function render(){$('#queue').innerHTML=items.length?items.map((it,i)=>`<div class="q${i===sel?' on':''}" data-i="${i}"><span class="qn">${esc(it.f.name)}</span><small>${(it.f.size/1048576).toFixed(1)} MB</small><select data-r="${i}" title="Rotate this file">${Object.entries(ROT).map(([k,v])=>`<option value="${k}"${k===it.rot?' selected':''}>${v==='None'?'↻ No rotation':'↻ '+v}</option>`).join('')}</select><em class="st ${it.st}">${STL[it.st]}</em><b data-x="${i}" title="Remove">×</b></div>`).join(''):'<p class="muted">No media yet — add files or drop them above.</p>'}
function choose(i){sel=i;file=items[i]&&items[i].f;render();if(!file){$('#fname').textContent='No file selected';$('#info').textContent='File info appears after loading a file.';try{plyr.stop()}catch{}upd();refresh();return}
inSize=file.size;outSize=0;elapsed=0;$('#fname').textContent=items.length>1?`${items.length} files queued`:file.name;if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(file);
plyr.source={type:'video',sources:[{src:url,type:file.type||'video/mp4'}]};$('#info').textContent=`${file.name}\n${(file.size/1048576).toFixed(1)} MB · ${file.type||'unknown type'}`;log(`Selected ${file.name} (${file.size} bytes, ${file.type||'?'})`,'ok');
if(isAud(file)&&$('#vc').value!=='none')$('#presets [data-k=wav]').click();upd();refresh();stats()}
function addFiles(l){let n=0;for(const f of l){if(!/^(video|audio)\//.test(f.type)&&!OKX.test(f.name)){toast('Skipped '+f.name,1);continue}items.push({f,rot:'',st:''});n++}if(!n)return;toast(n+' file'+(n>1?'s':'')+' added');sel<0?choose(items.length-n):(render(),upd())}
$('#queue').onclick=e=>{if(busy||e.target.closest('select'))return;const x=e.target.dataset.x;if(x!==undefined){items.splice(+x,1);choose(items.length?Math.min(sel>+x?sel-1:sel,items.length-1):-1)}else{const q=e.target.closest('[data-i]');q&&choose(+q.dataset.i)}};
$('#queue').onchange=e=>{const r=e.target.dataset.r;if(r===undefined)return;items[+r].rot=e.target.value;if(+r===sel)refresh();toast('Rotation set: '+items[+r].f.name)};
$('#add').onclick=()=>$('#file').click();$('#clr').onclick=()=>{if(!busy){items=[];choose(-1)}};
$('#all').onclick=async()=>{if(busy)return;for(let i=0;i<items.length;i++){choose(i);await $('#go').onclick()}};
const d=$('#drop');d.onclick=()=>$('#file').click();d.onkeydown=e=>{if(e.key==='Enter')$('#file').click()};$('#file').onchange=e=>{addFiles(e.target.files);e.target.value=''};
['dragover','dragenter'].forEach(v=>d.addEventListener(v,e=>{e.preventDefault();d.classList.add('on')}));
['dragleave','drop'].forEach(v=>d.addEventListener(v,e=>{e.preventDefault();d.classList.remove('on')}));d.ondrop=e=>addFiles(e.dataTransfer.files);
['loadedmetadata','play','pause','seeked','ended'].forEach(ev=>plyr.on(ev,()=>log(`player:${ev} t=${plyr.currentTime.toFixed(2)} dur=${(plyr.duration||0).toFixed(2)}`,'pl')));
plyr.on('error',()=>{log('player: browser cannot decode this source (conversion still works)','warn');toast('Browser can’t preview this codec — conversion still works',1)});
const btns=['#go','#frame','#analyze','#all'];const setBusy=b=>{busy=b;btns.forEach(s=>$(s).disabled=b||!file)};
async function run(args,out,mime,name,after){if(!file)return toast('Choose a file first',1);if(busy)return;setBusy(true);$('.bar').hidden=false;$('#pb').style.width='0';$('#pt').textContent='0%';t0=performance.now();
log('ffmpeg '+args.join(' '),'ok');
try{await load();await ff.writeFile(IN(),await fetchFile(file));const code=await ff.exec(args);if(code!==0)throw new Error(`ffmpeg exited with code ${code} — see Dev ▸ log`);
let data;try{data=await ff.readFile(out)}catch{throw new Error('No output file was produced — see Dev ▸ log')}if(!data||!data.length)throw new Error('Output is empty — encoder may be missing in this wasm build');
const l=document.createElement('a');l.href=URL.createObjectURL(new Blob([data],{type:mime}));l.download=name;l.className='btn';l.textContent='Download '+name;$('#out').append(l);animate(l,{opacity:[0,1],y:[12,0]});
outSize=data.length;elapsed=performance.now()-t0;$('#pb').style.width='100%';$('#pt').textContent='100%';log(`Done in ${(elapsed/1000).toFixed(1)} s → ${name} (${outSize} bytes)`,'ok');toast('Done ✔');return true}
catch(e){const m=errMsg(e);log('ERROR: '+m,'err');toast('Failed: '+m+(/memory|abort|out of bounds/i.test(m)?' (file may be too large for wasm)':''),1);await reset();return false}
finally{try{await ff.deleteFile(IN())}catch{}try{await ff.deleteFile(out)}catch{}setBusy(false);stats()}}
$('#go').onclick=async()=>{if(!file)return;const it=items[sel],b=build(false),base=file.name.replace(/\.[^.]+$/,'');if($('#vc').value==='none'&&$('#ac').value==='none')return toast('Audio-only needs an audio codec',1);
it.st='run';render();const ok=await run(b.args,b.out,({wav:'audio/wav',aiff:'audio/aiff',flac:'audio/flac'})[b.ext]||'video/quicktime',`${base}_resolve.${b.ext}`);it.st=ok?'done':'err';render()};
const RTX={'transpose=1':90,'transpose=2':-90,'transpose=1,transpose=1':180};
async function grab(t,img,rot){const v=plyr.media;if(!v||!v.videoWidth)throw new Error('browser cannot decode this video');
if(Math.abs(v.currentTime-t)>.01)await new Promise(ok=>{const s=()=>{v.removeEventListener('seeked',s);ok()};v.addEventListener('seeked',s);v.currentTime=Math.min(t,v.duration||t);setTimeout(ok,4000)});
const a=RTX[rot]||0,w=v.videoWidth,h=v.videoHeight,c=document.createElement('canvas'),sw=Math.abs(a)===90;c.width=sw?h:w;c.height=sw?w:h;const x=c.getContext('2d');x.translate(c.width/2,c.height/2);x.rotate(a*Math.PI/180);x.drawImage(v,-w/2,-h/2);
return new Promise((ok,no)=>c.toBlob(b=>b?ok(b):no(new Error('Canvas export failed')),img==='png'?'image/png':'image/jpeg',.95))}
$('#frame').onclick=async()=>{if(!file||busy)return;const img=$('#fimg').value,raw=$('#ft').value,rot=rotv(),t=raw===''?(plyr.currentTime||0):parseFloat(raw);if(!isFinite(t)||t<0)return toast('Invalid time',1);
const name=`${file.name.replace(/\.[^.]+$/,'')}_${t.toFixed(2)}s.${img}`;
try{const blob=await grab(t,img,rot),l=document.createElement('a');l.href=URL.createObjectURL(blob);l.download=name;l.className='btn';l.textContent='Download '+name;$('#out').append(l);animate(l,{opacity:[0,1],y:[12,0]});toast('Frame extracted ✔');log(`Frame saved ${name} (${blob.size} bytes)`,'ok');return}
catch(e){log('Canvas capture unavailable ('+errMsg(e)+') — using ffmpeg','warn')}
const out='frame.'+img;run(['-hide_banner','-loglevel',$('#ll').value,'-i',IN(),'-ss',t.toFixed(3),...(rot?['-vf',rot]:[]),'-frames:v','1','-update','1',...(img==='jpg'?['-pix_fmt','yuvj420p','-q:v','2']:['-pix_fmt','rgb24']),out],out,img==='png'?'image/png':'image/jpeg',name)};
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
