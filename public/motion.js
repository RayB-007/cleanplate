(()=>{
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 const intro=document.getElementById('startup');let startupAnimation,heroAnimation,timer,previousFocus;
 const options={renderer:'svg',loop:true,autoplay:!reduced.matches,path:'/assets/preparing-food.json',rendererSettings:{preserveAspectRatio:'xMidYMid meet'}};
 if(window.lottie){heroAnimation=lottie.loadAnimation({...options,container:document.getElementById('hero-animation')});if(reduced.matches)heroAnimation.addEventListener('DOMLoaded',()=>heroAnimation.goToAndStop(60,true));}
 function close(){clearTimeout(timer);intro.classList.add('startup-leaving');document.body.classList.remove('intro-open');document.querySelector('main').inert=false;document.querySelector('header').inert=false;document.querySelector('footer').inert=false;if(intro.contains(document.activeElement))(previousFocus?.isConnected&&previousFocus!==document.body?previousFocus:document.getElementById('location')).focus({preventScroll:true});setTimeout(()=>{intro.hidden=true;startupAnimation?.pause();},reduced.matches?0:550);}
 function play(force=false){let seen=false;try{seen=sessionStorage.getItem('cleanplate-intro-seen')==='1';}catch{}if(reduced.matches||seen&&!force)return;try{sessionStorage.setItem('cleanplate-intro-seen','1');}catch{}previousFocus=document.activeElement;intro.hidden=false;intro.classList.remove('startup-leaving');document.body.classList.add('intro-open');document.querySelector('main').inert=true;document.querySelector('header').inert=true;document.querySelector('footer').inert=true;
  if(window.lottie&&!startupAnimation)startupAnimation=lottie.loadAnimation({...options,container:document.getElementById('startup-animation')});else startupAnimation?.goToAndPlay(0,true);
  document.getElementById('skip-intro').focus({preventScroll:true});timer=setTimeout(close,2900);
 }
 document.getElementById('skip-intro').addEventListener('click',close);document.getElementById('replay-intro').addEventListener('click',()=>play(true));document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!intro.hidden)close();if(e.key==='Tab'&&!intro.hidden){const first=document.getElementById('skip-intro'),last=intro.querySelector('.animation-credit');if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){heroAnimation?.pause();startupAnimation?.pause();}else if(!reduced.matches){heroAnimation?.play();if(!intro.hidden)startupAnimation?.play();}});
 reduced.addEventListener('change',()=>{if(reduced.matches){close();heroAnimation?.goToAndStop(60,true);}else heroAnimation?.play();});
 play();
})();
