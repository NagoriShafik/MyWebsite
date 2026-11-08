/* Nagori Shafik portfolio: scene and interactions. Needs three.js r128 loaded first. */
(function(){
  var root=document.documentElement;
  root.classList.add('js');
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var secs=[].slice.call(document.querySelectorAll('main section'));
  var labels=['Hello','Data','Reasoning','Safety','Pipeline','Stack','Contact'];

  /* panels fade in */
  var panels=[].slice.call(document.querySelectorAll('.panel'));
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)e.target.classList.add('on')})},{threshold:.25});
    panels.forEach(function(p){io.observe(p)});
  }else{panels.forEach(function(p){p.classList.add('on')})}

  /* rail */
  var rail=document.getElementById('rail');
  secs.forEach(function(s,i){
    var a=document.createElement('a');a.href='#'+s.id;a.innerHTML='<span>'+labels[i]+'</span><i></i>';a.setAttribute('aria-label',labels[i]);rail.appendChild(a);
  });
  var railLinks=[].slice.call(rail.children);
  function setActive(i){railLinks.forEach(function(a,k){a.setAttribute('aria-current',k===i?'true':'false')})}

  /* copy email */
  var copyBtn=document.getElementById('copyBtn'),mail=document.getElementById('mailText');
  copyBtn.addEventListener('click',function(){
    function done(){copyBtn.textContent='Copied';setTimeout(function(){copyBtn.textContent='Copy email'},1600)}
    function fb(){var r=document.createRange();r.selectNodeContents(mail);var s=getSelection();s.removeAllRanges();s.addRange(r);copyBtn.textContent='Selected, press copy'}
    try{navigator.clipboard.writeText(mail.textContent).then(done,fb)}catch(e){fb()}
  });

  /* ---------- 3D world ---------- */
  var R=null;
  try{
    if(typeof THREE==='undefined')throw new Error('no three');
    R=new THREE.WebGLRenderer({canvas:document.getElementById('gl'),antialias:true,alpha:true,powerPreference:'high-performance'});
  }catch(e){root.classList.add('nogl');R=null}
  if(!R){setActive(0);addEventListener('scroll',function(){var m=scrollY+innerHeight/2,k=0;secs.forEach(function(s,i){if(s.offsetTop<=m)k=i});setActive(k)},{passive:true});return}

  var COOL=0x6FE0FF,WARM=0xFF8A63;
  var cC=new THREE.Color(COOL),cW=new THREE.Color(WARM),cWhite=new THREE.Color(0xffffff);
  var scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x060A12,0.02);
  var cam=new THREE.PerspectiveCamera(55,1,0.1,400);
  function sstep(a,b,x){var t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)}

  var tc=document.createElement('canvas');tc.width=tc.height=64;
  var tx=tc.getContext('2d'),gr=tx.createRadialGradient(32,32,0,32,32,32);
  gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.35,'rgba(255,255,255,.55)');gr.addColorStop(1,'rgba(255,255,255,0)');
  tx.fillStyle=gr;tx.fillRect(0,0,64,64);
  var TEX=new THREE.CanvasTexture(tc);

  function pts(n,size,opacity,vc){
    var g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3));
    if(vc)g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(n*3),3));
    var m=new THREE.PointsMaterial({size:size,map:TEX,transparent:true,opacity:opacity,depthWrite:false,blending:THREE.AdditiveBlending,vertexColors:!!vc,sizeAttenuation:true});
    return new THREE.Points(g,m);
  }
  function lineMat(color,op){return new THREE.LineBasicMaterial({color:color,transparent:true,opacity:op,blending:THREE.AdditiveBlending,depthWrite:false})}
  function wire(geo,color,op){return new THREE.LineSegments(new THREE.EdgesGeometry(geo),lineMat(color,op))}

  var ST=[[0,0,0],[30,0,-10],[-30,4,-26],[28,-2,-44],[-28,0,-62],[0,2,-80]];
  function group(i){var g=new THREE.Group();g.position.set(ST[i][0],ST[i][1],ST[i][2]);scene.add(g);return g}

  /* stars */
  var stars=pts(1300,.16,.65,false);stars.material.fog=false;stars.material.color=new THREE.Color(0x9FB4D8);
  (function(){var p=stars.geometry.attributes.position.array;for(var i=0;i<1300;i++){p[i*3]=(Math.random()-.5)*260;p[i*3+1]=(Math.random()-.5)*130;p[i*3+2]=30-Math.random()*190}})();
  scene.add(stars);

  /* 0: hero lattice */
  var g0=group(0),N=2600,hp=pts(N,.06,.95,true),hP=hp.geometry.attributes.position.array,hC=hp.geometry.attributes.color.array,tmp=new THREE.Color();
  for(var i=0;i<N;i++){
    var y=1-(i/(N-1))*2,r=Math.sqrt(1-y*y),th=i*2.399963,rad=2.4*(.96+Math.random()*.08);
    hP[i*3]=Math.cos(th)*r*rad;hP[i*3+1]=y*rad;hP[i*3+2]=Math.sin(th)*r*rad;
    if(Math.random()<.1)tmp.copy(cW);else tmp.copy(cC).lerp(cWhite,Math.random()*.55);
    hC[i*3]=tmp.r;hC[i*3+1]=tmp.g;hC[i*3+2]=tmp.b;
  }
  g0.add(hp);
  (function(){
    var nodes=[];for(var i=0;i<N;i+=17)nodes.push([hP[i*3],hP[i*3+1],hP[i*3+2]]);
    var seg=[];
    for(var a=0;a<nodes.length;a++)for(var b=a+1;b<nodes.length;b++){
      var dx=nodes[a][0]-nodes[b][0],dy=nodes[a][1]-nodes[b][1],dz=nodes[a][2]-nodes[b][2];
      if(dx*dx+dy*dy+dz*dz<1.3)seg.push(nodes[a][0],nodes[a][1],nodes[a][2],nodes[b][0],nodes[b][1],nodes[b][2]);
    }
    var g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(seg,3));
    g0.add(new THREE.LineSegments(g,lineMat(COOL,.3)));
  })();
  var ringA=new THREE.Mesh(new THREE.TorusGeometry(3.2,.01,6,180),new THREE.MeshBasicMaterial({color:COOL,transparent:true,opacity:.55}));
  var ringB=new THREE.Mesh(new THREE.TorusGeometry(3.7,.008,6,180),new THREE.MeshBasicMaterial({color:WARM,transparent:true,opacity:.5}));
  ringA.rotation.x=1.2;ringB.rotation.y=.9;g0.add(ringA,ringB);

  /* 1: data slabs + rain */
  var g1=group(1);g1.rotation.x=.3;
  var slabY=[-1.6,-.55,.5,1.55],slabDots=pts(4*14*8,.05,.9,false);slabDots.material.color=cC.clone();
  (function(){
    var p=slabDots.geometry.attributes.position.array,n=0;
    slabY.forEach(function(y,k){
      var bx=new THREE.BoxGeometry(5,.1,3);
      var m=new THREE.Mesh(bx,new THREE.MeshBasicMaterial({color:k===3?WARM:COOL,transparent:true,opacity:.07,depthWrite:false}));
      m.position.y=y;g1.add(m);
      var w=wire(bx,k===3?WARM:COOL,.75);w.position.y=y;g1.add(w);
      for(var ix=0;ix<14;ix++)for(var iz=0;iz<8;iz++){p[n++]=-2.3+ix*(4.6/13);p[n++]=y+.07;p[n++]=-1.3+iz*(2.6/7)}
    });
    var beams=[];[[-2.5,-1.5],[2.5,-1.5],[2.5,1.5],[-2.5,1.5]].forEach(function(c){beams.push(c[0],slabY[0],c[1],c[0],slabY[3],c[1])});
    var bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.Float32BufferAttribute(beams,3));g1.add(new THREE.LineSegments(bg,lineMat(COOL,.35)));
  })();
  g1.add(slabDots);
  var RN=240,rain=pts(RN,.08,.95,false),rainP=rain.geometry.attributes.position.array,rainS=new Float32Array(RN);
  rain.material.color=new THREE.Color(0xBFF3FF);
  for(var i=0;i<RN;i++){rainP[i*3]=(Math.random()-.5)*4.6;rainP[i*3+1]=(Math.random()-.5)*5;rainP[i*3+2]=(Math.random()-.5)*2.8;rainS[i]=.6+Math.random()*1.4}
  g1.add(rain);

  /* 2: causal graph */
  var g2=group(2);
  var dn=[[-3.2,1.7,.2],[-3.1,-1.6,-.4],[-1.5,2.2,-.6],[-1.4,0,.8],[-1.5,-2,.3],[.4,1.4,.2],[.5,-1.2,-.5],[2.1,.1,.6],[3.5,.1,-.1]];
  var de=[[0,2],[0,3],[1,3],[1,4],[2,5],[3,5],[3,6],[4,6],[5,7],[6,7],[7,8]];
  var edgeSeg=[];
  de.forEach(function(e){var a=dn[e[0]],b=dn[e[1]];edgeSeg.push(a[0],a[1],a[2],b[0],b[1],b[2])});
  var eg=new THREE.BufferGeometry();eg.setAttribute('position',new THREE.Float32BufferAttribute(edgeSeg,3));
  g2.add(new THREE.LineSegments(eg,lineMat(COOL,.55)));
  var up=new THREE.Vector3(0,1,0);
  de.forEach(function(e){
    var a=new THREE.Vector3().fromArray(dn[e[0]]),b=new THREE.Vector3().fromArray(dn[e[1]]),d=b.clone().sub(a),len=d.length();d.normalize();
    var cone=new THREE.Mesh(new THREE.ConeGeometry(.07,.22,10),new THREE.MeshBasicMaterial({color:COOL}));
    cone.position.copy(b).addScaledVector(d,-(e[1]===8?.38:.26));cone.quaternion.setFromUnitVectors(up,d);g2.add(cone);
  });
  dn.forEach(function(p,i){
    var last=i===8,m=new THREE.Mesh(new THREE.SphereGeometry(last?.28:.16,18,18),new THREE.MeshBasicMaterial({color:last?WARM:COOL}));
    m.position.fromArray(p);g2.add(m);
    var h=pts(1,last?1.7:.9,.55,false);h.material.color=new THREE.Color(last?WARM:COOL);h.geometry.attributes.position.array.set(p);g2.add(h);
  });
  var dagPulse=pts(de.length,.16,1,false);dagPulse.material.color=new THREE.Color(0xFFFFFF);g2.add(dagPulse);
  var dp=dagPulse.geometry.attributes.position.array;

  /* 3: alert beacon */
  var g3=group(3);g3.rotation.x=.5;
  var grid=new THREE.GridHelper(16,16,COOL,COOL);grid.material.transparent=true;grid.material.opacity=.14;grid.material.depthWrite=false;grid.position.y=-.2;g3.add(grid);
  var beacon=new THREE.Mesh(new THREE.SphereGeometry(.26,20,20),new THREE.MeshBasicMaterial({color:WARM}));g3.add(beacon);
  var bh=pts(1,2.4,.7,false);bh.material.color=new THREE.Color(WARM);g3.add(bh);
  var rings=[];
  for(var i=0;i<4;i++){
    var rm=new THREE.Mesh(new THREE.RingGeometry(.92,.96,72),new THREE.MeshBasicMaterial({color:WARM,transparent:true,opacity:.6,side:THREE.DoubleSide,depthWrite:false}));
    rm.rotation.x=-Math.PI/2;g3.add(rm);rings.push(rm);
  }
  var orbs=[];
  for(var i=0;i<3;i++){var o=new THREE.Mesh(new THREE.SphereGeometry(.14,14,14),new THREE.MeshBasicMaterial({color:COOL}));g3.add(o);orbs.push(o)}
  var orbLineG=new THREE.BufferGeometry();orbLineG.setAttribute('position',new THREE.BufferAttribute(new Float32Array(18),3));
  g3.add(new THREE.LineSegments(orbLineG,lineMat(COOL,.7)));
  var olp=orbLineG.attributes.position.array;

  /* 4: ETL pipeline */
  var g4=group(4);g4.rotation.y=.25;
  var PN=1500,pl=pts(PN,.05,.9,true),plP=pl.geometry.attributes.position.array,plC=pl.geometry.attributes.color.array;
  var u0=new Float32Array(PN),ry=new Float32Array(PN),rz=new Float32Array(PN),gy=new Float32Array(PN),gz=new Float32Array(PN);
  for(var i=0;i<PN;i++){
    u0[i]=Math.random();ry[i]=(Math.random()-.5)*3.8;rz[i]=(Math.random()-.5)*3.8;
    gy[i]=Math.round(((Math.random()-.5)*3.6)/.45)*.45;gz[i]=Math.round(((Math.random()-.5)*3.6)/.45)*.45;
  }
  g4.add(pl);
  var gateA=new THREE.Mesh(new THREE.TorusGeometry(2.3,.025,8,110),new THREE.MeshBasicMaterial({color:COOL}));
  var gateB=new THREE.Mesh(new THREE.TorusGeometry(1.9,.02,8,110),new THREE.MeshBasicMaterial({color:WARM,transparent:true,opacity:.8}));
  gateA.rotation.y=Math.PI/2;gateB.rotation.y=Math.PI/2;g4.add(gateA,gateB);

  /* 5: gyroscope */
  var g5=group(5);
  var gy1=new THREE.Mesh(new THREE.TorusGeometry(2.2,.025,8,140),new THREE.MeshBasicMaterial({color:COOL}));
  var gy2=new THREE.Mesh(new THREE.TorusGeometry(1.75,.022,8,140),new THREE.MeshBasicMaterial({color:WARM}));
  var gy3=new THREE.Mesh(new THREE.TorusGeometry(1.3,.02,8,140),new THREE.MeshBasicMaterial({color:0xFFFFFF,transparent:true,opacity:.85}));
  var core=new THREE.Mesh(new THREE.IcosahedronGeometry(.55,1),new THREE.MeshBasicMaterial({color:COOL,wireframe:true,transparent:true,opacity:.85}));
  var core2=new THREE.Mesh(new THREE.SphereGeometry(.2,16,16),new THREE.MeshBasicMaterial({color:0xFFFFFF}));
  var disc=pts(520,.06,.85,true),dP=disc.geometry.attributes.position.array,dC=disc.geometry.attributes.color.array;
  for(var i=0;i<520;i++){
    var a=Math.random()*6.2832,rr=3.1+Math.random()*1.8;
    dP[i*3]=Math.cos(a)*rr;dP[i*3+1]=(Math.random()-.5)*.35;dP[i*3+2]=Math.sin(a)*rr;
    tmp.copy(cC).lerp(cW,Math.random());dC[i*3]=tmp.r;dC[i*3+1]=tmp.g;dC[i*3+2]=tmp.b;
  }
  disc.rotation.x=.45;
  g5.add(gy1,gy2,gy3,core,core2,disc);

  /* camera poses per section */
  var poses=[],centers=[],mobile=false;
  function measure(){
    mobile=innerWidth<820;
    centers=secs.map(function(s){var b=s.getBoundingClientRect();return b.top+scrollY+b.height/2});
    poses=secs.map(function(s){
      var st=+s.dataset.st,look=+s.dataset.look,b=ST[st],dist=(st===5?13:10.5)*(mobile?1.15:1);
      return{p:new THREE.Vector3(b[0],b[1]+.5,b[2]+dist),l:new THREE.Vector3(b[0]+(mobile?0:look*3.1),b[1]+(mobile?-1.9:0),b[2])};
    });
  }
  function resize(){
    R.setPixelRatio(Math.min(devicePixelRatio||1,1.75));R.setSize(innerWidth,innerHeight,false);
    cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();measure();sched();
  }
  function fracIndex(){
    var m=scrollY+innerHeight*.5,n=centers.length;
    if(m<=centers[0])return 0;if(m>=centers[n-1])return n-1;
    for(var i=0;i<n-1;i++)if(m<centers[i+1]){var t=(m-centers[i])/(centers[i+1]-centers[i]);return i+sstep(0,1,t)}
    return n-1;
  }

  var curP=new THREE.Vector3(),curL=new THREE.Vector3(),tgtP=new THREE.Vector3(),tgtL=new THREE.Vector3(),init=false;
  var mx=0,my=0,smx=0,smy=0,glow=document.getElementById('glow'),time=0,lastNow=performance.now();
  addEventListener('pointermove',function(e){
    mx=e.clientX/innerWidth*2-1;my=e.clientY/innerHeight*2-1;
    glow.style.transform='translate('+e.clientX+'px,'+e.clientY+'px)';
    if(reduce)sched();
  },{passive:true});

  var warmC=[1,.54,.39],coolC=[.44,.88,1];
  function render(dt){
    var f=fracIndex(),i=Math.min(secs.length-2,Math.floor(f)),t=f-i,a=poses[i],b=poses[i+1];
    tgtP.copy(a.p).lerp(b.p,t);tgtL.copy(a.l).lerp(b.l,t);
    var k=(reduce||!init)?1:1-Math.exp(-dt*3.4);init=true;
    curP.lerp(tgtP,k);curL.lerp(tgtL,k);
    smx+=(mx-smx)*Math.min(1,dt*4+(reduce?1:0));smy+=(my-smy)*Math.min(1,dt*4+(reduce?1:0));
    cam.position.set(curP.x+smx*.7,curP.y-smy*.45,curP.z);cam.lookAt(curL);
    var near=Math.round(f);setActive(near);
    var st=+secs[near].dataset.st,T=time;

    g0.rotation.y=T*.12+smx*.2;g0.rotation.x=smy*.12;
    var br=1+Math.sin(T*.8)*.015;g0.scale.set(br,br,br);
    ringA.rotation.z=T*.2;ringB.rotation.x=T*.15;

    if(st===1||Math.abs(f-1)<1.2){
      g1.rotation.y=Math.sin(T*.25)*.35+.4;
      for(var q=0;q<RN;q++){var y=rainP[q*3+1]-rainS[q]*dt*(reduce?0:1);if(y<-1.8)y=2.2;rainP[q*3+1]=y}
      rain.geometry.attributes.position.needsUpdate=true;
    }
    if(st===2||Math.abs(f-2)<1.2){
      g2.rotation.y=Math.sin(T*.2)*.3;
      for(var e=0;e<de.length;e++){
        var pa=dn[de[e][0]],pb=dn[de[e][1]],u=(T*.35+e*.37)%1;
        dp[e*3]=pa[0]+(pb[0]-pa[0])*u;dp[e*3+1]=pa[1]+(pb[1]-pa[1])*u;dp[e*3+2]=pa[2]+(pb[2]-pa[2])*u;
      }
      dagPulse.geometry.attributes.position.needsUpdate=true;
    }
    if(st===3||Math.abs(f-3)<1.2){
      g3.rotation.y=T*.1;
      for(var r2=0;r2<4;r2++){var ph=(T*.3+r2*.25)%1,s=.4+ph*5.4;rings[r2].scale.set(s,s,1);rings[r2].material.opacity=(1-ph)*.65}
      var bs=1+Math.sin(T*5)*.12;beacon.scale.set(bs,bs,bs);
      for(var o2=0;o2<3;o2++){
        var an=T*(.35+o2*.12)+o2*2.09,ox=Math.cos(an)*2.5,oz=Math.sin(an)*2.5,oy=.15+Math.sin(T+o2)*.1;
        orbs[o2].position.set(ox,oy,oz);
        olp[o2*6]=0;olp[o2*6+1]=0;olp[o2*6+2]=0;olp[o2*6+3]=ox;olp[o2*6+4]=oy;olp[o2*6+5]=oz;
      }
      orbLineG.attributes.position.needsUpdate=true;
    }
    if(st===4||Math.abs(f-4)<1.2){
      for(var n2=0;n2<PN;n2++){
        var uu=(u0[n2]+T*.05)%1,m=sstep(.4,.6,uu),j=(1-m)*.05*Math.sin(T*2+n2);
        plP[n2*3]=(uu-.5)*10;plP[n2*3+1]=ry[n2]+(gy[n2]-ry[n2])*m+j;plP[n2*3+2]=rz[n2]+(gz[n2]-rz[n2])*m+j;
        plC[n2*3]=warmC[0]+(coolC[0]-warmC[0])*m;plC[n2*3+1]=warmC[1]+(coolC[1]-warmC[1])*m;plC[n2*3+2]=warmC[2]+(coolC[2]-warmC[2])*m;
      }
      pl.geometry.attributes.position.needsUpdate=true;pl.geometry.attributes.color.needsUpdate=true;
      gateA.rotation.x=T*.5;gateB.rotation.x=-T*.7;
    }
    if(st===5||Math.abs(f-5)<1.2){
      gy1.rotation.x=T*.4;gy2.rotation.y=T*.5;gy3.rotation.z=T*.6;gy2.rotation.x=.8;gy3.rotation.y=.6;
      core.rotation.y=T*.6;core.rotation.x=T*.3;disc.rotation.y=T*.12;
    }
    R.render(scene,cam);
  }

  var pend=false;
  function sched(){if(!reduce||pend)return;pend=true;requestAnimationFrame(function(){pend=false;render(1)})}
  function frame(now){
    var dt=Math.min(.05,(now-lastNow)/1000);lastNow=now;time+=dt;render(dt);requestAnimationFrame(frame);
  }
  addEventListener('resize',resize);
  addEventListener('load',function(){measure();sched()});
  setInterval(measure,2000);
  if(reduce){time=4;addEventListener('scroll',sched,{passive:true})}
  resize();
  if(reduce)render(1);else requestAnimationFrame(frame);
})();
