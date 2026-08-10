import{r as Me,a as u}from"./iframe-DeqCZp6t.js";import"./preload-helper-PPVm8Dsz.js";var Y=String.raw,Ne=(()=>{try{document.createElement("div").animate({opacity:0},{easing:"linear(0, 1)"})}catch{return!1}return!0})(),Ue=typeof CSS<"u"&&CSS.supports&&CSS.supports("line-height","mod(1,1)"),te=typeof matchMedia<"u"?matchMedia("(prefers-reduced-motion: reduce)"):null,R="--_number-flow-d-opacity",D="--_number-flow-d-width",b="--_number-flow-dx",O="--_number-flow-d",je=(()=>{try{return CSS.registerProperty({name:R,syntax:"<number>",inherits:!1,initialValue:"0"}),CSS.registerProperty({name:b,syntax:"<length>",inherits:!0,initialValue:"0px"}),CSS.registerProperty({name:D,syntax:"<number>",inherits:!1,initialValue:"0"}),CSS.registerProperty({name:O,syntax:"<number>",inherits:!0,initialValue:"0"}),!0}catch{return!1}})(),X="round(nearest, calc(var(--number-flow-mask-height, 0.25em) / 2), 1px)",ne=`calc(${X} * 2)`,ie="calc(var(--number-flow-mask-height, 0.25em) / 2)",re="var(--number-flow-mask-height, 0.25em)",W="var(--number-flow-mask-width, 0.5em)",_=`calc(${W} / var(--scale-x))`,V="#000 0, transparent 71%",se=e=>Y`
	/* Horizontal: */
	linear-gradient(
			to right,
			transparent 0,
			#000 ${_},
			#000 calc(100% - ${_}),
			transparent
		),
		/* Vertical: */
			linear-gradient(
				to bottom,
				transparent 0,
				#000 ${e},
				#000 calc(100% - ${e}),
				transparent 100%
			),
		/* TL corner */ radial-gradient(at bottom right, ${V}),
		/* TR corner */ radial-gradient(at bottom left, ${V}),
		/* BR corner */ radial-gradient(at top left, ${V}),
		/* BL corner */ radial-gradient(at top right, ${V})
`,ae=e=>Y`
	100% calc(100% - ${e} * 2),
	calc(100% - ${_} * 2) 100%,
	${_} ${e},
	${_} ${e},
	${_} ${e},
	${_} ${e}
`,Pe=Y`
  :host {
    display: inline-block;
    direction: ltr;
    white-space: nowrap;
    isolation: isolate; /* for .number z-index */
    /* Technically this is only needed on the .number, but applying it here makes the ::selection the same height for the whole element: */
    line-height: 1;
  }

  .number,
  .number__inner {
    display: inline-block;
    transform-origin: left top;
  }

  :host([data-will-change])
    :is(.number, .number__inner, .section, .digit, .digit__num, .symbol) {
    will-change: transform;
  }

  .number {
    --scale-x: calc(1 + var(${D}) / var(--width));
    transform: translateX(var(${b})) scaleX(var(--scale-x));

    margin: 0 calc(-1 * ${W});
    position: relative; /* for z-index */

    /* overflow: clip; /* helpful to not affect page layout, but breaks baseline alignment in Safari :/ */
    /* -webkit- prefixed properties have better support than unprefixed ones: */
    -webkit-mask-image: ${se(re)};
    -webkit-mask-size: ${ae(re)};
    -webkit-mask-position:
      center,
      center,
      top left,
      top right,
      bottom right,
      bottom left;
    -webkit-mask-repeat: no-repeat;
  }

  /* Small improvement for ::selection when not animating: */
  /* Reverted because you can see it change when char height < 1em: */
  /*.number:not(:has(.digit.is-spinning)) {
		-webkit-mask-image: none;
	}*/

  .number__inner {
    padding: ${ie} ${W};
    /* invert parent's: */
    transform: scaleX(calc(1 / var(--scale-x)))
      translateX(calc(-1 * var(${b})));
  }

  /* Put number underneath other sections. Negative z-index messed up text cursor and selection, weirdly: */
  :host > :not(.number) {
    z-index: 5;
  }

  .section,
  .symbol {
    display: inline-block;
    /* for exiting (> [inert]): */
    position: relative;
    isolation: isolate; /* also helpful for mix-blend-mode in symbol__value */
  }

  .section::after {
    /*
		 * We seem to need some type of character to ensure baseline alignment continues working
		 * even when empty
		 */
    content: '\200b'; /* zero-width space */
    display: inline-block;
  }

  .section--justify-left {
    transform-origin: center left;
  }

  .section--justify-right {
    transform-origin: center right;
  }

  .section > [inert],
  .symbol > [inert] {
    margin: 0 !important; /* to override any user styles */
    position: absolute !important; /* ^ */
    z-index: -1;
  }

  .digit {
    display: inline-block;
    position: relative;
    --c: var(--current) + var(${O});
  }

  .digit__num,
  .number .section::after {
    padding: ${ie} 0;
  }

  .digit__num {
    display: inline-block;
    /* Claude + https://buildui.com/recipes/animated-counter */
    --offset-raw: mod(
      var(--length) + var(--n) - mod(var(--c), var(--length)),
      var(--length)
    );
    --offset: calc(
      var(--offset-raw) - var(--length) *
        round(down, var(--offset-raw) / (var(--length) / 2), 1)
    );
    /* Technically we just need var(--offset)*100%, but clamping should reduce the layer size: */
    --y: clamp(-100%, var(--offset) * 100%, 100%);
    transform: translateY(var(--y));
  }

  .digit__num[inert] {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%) translateY(var(--y));
  }

  .digit:not(.is-spinning) .digit__num[inert] {
    display: none;
  }

  .symbol__value {
    display: inline-block;
    mix-blend-mode: plus-lighter; /* better crossfades e.g. + <-> - */
    white-space: pre; /* some symbols are spaces or thin spaces */
  }

  .section--justify-left .symbol > [inert] {
    left: 0;
  }

  .section--justify-right .symbol > [inert] {
    right: 0;
  }

  .animate-presence {
    opacity: calc(1 + var(${R}));
  }

  /*
	 * round() versions for Safari subpixel alignment. A double declaration
	 * doesn't work here: the values contain var(), so old browsers can't
	 * reject them at parse time — the later declaration would win the cascade
	 * and then die at computed-value time, unsetting the property entirely.
	 * The @supports probe must therefore be var()-free:
	 */
  @supports (padding: round(nearest, 0.125em, 1px)) {
    .number {
      -webkit-mask-image: ${se(ne)};
      -webkit-mask-size: ${ae(ne)};
    }

    .number__inner {
      padding: ${X} ${W};
    }

    .digit__num,
    .number .section::after {
      padding: ${X} 0;
    }
  }
`,ze=Pe,Ve=typeof HTMLElement<"u"?HTMLElement:class{},L=e=>e,j=(e,t,n,i)=>{if(e===t&&n===i)return L;const r=(l,d)=>1-3*d+3*l,a=(l,d)=>3*d-6*l,s=l=>3*l,o=(l,d,h)=>((r(d,h)*l+a(d,h))*l+s(d))*l,c=(l,d,h)=>3*r(d,h)*l*l+2*a(d,h)*l+s(d),p=l=>{let d=l;for(let h=0;h<8;h++){const f=c(d,e,n);if(f===0)break;d-=(o(d,e,n)-l)/f,d=Math.min(1,Math.max(0,d))}if(Math.abs(o(d,e,n)-l)>1e-5){let h=0,f=1;for(d=l;f-h>1e-7;)d=(h+f)/2,o(d,e,n)<l?h=d:f=d}return d};return l=>l<=0?0:l>=1?1:o(p(l),t,i)},We=e=>{const t=[];for(const r of e.split(",")){const a=r.trim().split(/\s+/).filter(Boolean);if(!a.length)return null;const s=parseFloat(a[0]);if(isNaN(s))return null;const o=a.slice(1).map(c=>c.endsWith("%")?parseFloat(c)/100:NaN);if(o.some(isNaN)||o.length>2)return null;o.length===0?t.push({v:s,pos:null}):o.forEach(c=>t.push({v:s,pos:c}))}if(t.length<2)return null;t[0].pos==null&&(t[0].pos=0),t[t.length-1].pos==null&&(t[t.length-1].pos=1);let n=0;for(let r=1;r<t.length;r++)if(t[r].pos!=null){t[r].pos=Math.max(t[r].pos,t[n].pos);const a=r-n;for(let s=n+1;s<r;s++)t[s].pos=t[n].pos+(t[r].pos-t[n].pos)*(s-n)/a;n=r}const i=t;return r=>{if(r<=i[0].pos)return i[0].v;if(r>=i[i.length-1].pos)return i[i.length-1].v;let a=0,s=i.length-1;for(;s-a>1;){const p=a+s>>1;i[p].pos<=r?a=p:s=p}const o=i[a],c=i[s];return c.pos===o.pos?c.v:o.v+(c.v-o.v)*(r-o.pos)/(c.pos-o.pos)}},H=(e,t)=>n=>{if(n>=1)return 1;if(n<=0)return 0;const i=Math.floor(n*e);switch(t){case"start":case"jump-start":return Math.min(1,(i+1)/e);case"jump-none":return Math.min(1,i/(e-1));case"jump-both":return(i+1)/(e+1);default:return i/e}},Le={linear:()=>L,ease:()=>j(.25,.1,.25,1),"ease-in":()=>j(.42,0,1,1),"ease-out":()=>j(0,0,.58,1),"ease-in-out":()=>j(.42,0,.58,1),"step-start":()=>H(1,"start"),"step-end":()=>H(1,"end")},oe=new Map,le=!1,Ie=e=>{if(!e)return L;const t=oe.get(e);if(t)return t;let n=null;const i=e.trim(),r=Le[i];if(r)n=r();else{const a=/^([a-z-]+)\((.*)\)$/i.exec(i);if(a){const[,s,o]=a;if(s==="linear")n=We(o);else if(s==="cubic-bezier"){const c=o.split(",").map(p=>parseFloat(p));c.length===4&&c.every(p=>!isNaN(p))&&(n=j(c[0],c[1],c[2],c[3]))}else if(s==="steps"){const[c,p]=o.split(",").map(d=>d.trim()),l=parseInt(c);l>0&&(n=H(l,p??"end"))}}}return n||(le||(le=!0,console.warn(`[number-flow] Unsupported easing "${e}", falling back to linear.`)),n=L),oe.set(e,n),n},Se=Ue&&Ne&&je,q="auto",ce=e=>{q=e},I=()=>q==="native"||q==="auto"&&Se,Ee=(e,t,n)=>Math.max(e,Math.min(t,n)),ue=(e,t)=>(e%t+t)%t,De=(e,t,n)=>{const i=ue(t+n-ue(e,t),t),r=i-t*Math.floor(i/(t/2));return Ee(-1,r,1)*100},Oe={transform:(e,t,n)=>{e.style.transform=n||!t?"":`translateX(${t}px)`},[b]:(e,t)=>{e.style.setProperty(b,`${t}px`)},[D]:(e,t)=>{const n=parseFloat(e.style.getPropertyValue("--width"));e.style.setProperty("--scale-x",String(n>0?1+t/n:1))},[R]:(e,t,n)=>{if(n){e.style.opacity="";return}const i=parseFloat(e.style.getPropertyValue(R))||0;e.style.opacity=String(Ee(0,1+i+t,1))},[O]:(e,t)=>{const n=parseFloat(e.style.getPropertyValue("--current"))||0,i=e.children.length,r=n+t;for(let a=0;a<i;a++)e.children[a].style.setProperty("--y",`${De(r,i,a)}%`)}},Be=class{constructor(e,t){this.el=e,this.applier=t,this.anims=new Set}apply(e){let t=0;this.anims.forEach(n=>{t+=n.valueAt(e),n.done&&this.anims.delete(n)}),this.applier(this.el,t,this.anims.size===0),this.anims.size===0&&P.delete(this)}},Ke=class{constructor(e,t,n,i,r,a){this._channel=e,this._scope=t,this._from=n,this._start=i,this._duration=r,this._ease=a,this.done=!1,this.finished=new Promise(s=>{this._resolve=s})}valueAt(e){if(this.done)return 0;const t=(e-this._start)/this._duration;return t<0?0:t>=1?(this._finish(),0):this._from*(1-this._ease(t))}_finish(){var e;this.done=!0,(e=z.get(this._scope))==null||e.delete(this),this._resolve()}finish(){this.done||(this._finish(),this._channel.apply(performance.now()))}},P=new Set,de=new WeakMap,z=new WeakMap,E=null,x=null,pe=()=>{E!=null&&(cancelAnimationFrame(E),E=null),x!=null&&(clearTimeout(x),x=null);const e=performance.now();P.forEach(t=>t.apply(e)),P.size&&xe()},xe=()=>{E??(E=requestAnimationFrame(pe)),x??(x=setTimeout(pe,34))},Je=e=>{var t,n;return typeof e=="number"?e:parseFloat((n=(t=/-?\d*\.?\d+(?:e[+-]?\d+)?/i.exec(e))==null?void 0:t[0])!=null?n:"0")},w=(e,t,n,i)=>{var r;if(I()){t.animate(n,{...i,composite:"accumulate"});return}const a=typeof i.duration=="number"?i.duration:0,s=(r=i.delay)!=null?r:0,o=Ie(typeof i.easing=="string"?i.easing:void 0),c=performance.now();let p=z.get(e);p||z.set(e,p=new Set);for(const l in n){const d=Oe[l];if(!d)continue;let h=de.get(t);h||de.set(t,h=new Map);let f=h.get(l);f||h.set(l,f=new Be(t,d));const y=Je(n[l][0]),m=new Ke(f,e,y,c+s,a,o);if(a<=0){f.anims.add(m),P.add(f),m.finish();continue}f.anims.add(m),p.add(m),P.add(f),xe()}},Xe=e=>{const t=z.get(e);t&&Array.from(t).forEach(n=>n.finish())},He=e=>{const t=z.get(e);return t?Array.from(t,n=>n.finished):[]};function qe(e,t,n,i){const r=t.formatToParts(e);n&&r.unshift({type:"prefix",value:n}),i&&r.push({type:"suffix",value:i});const a=[],s=[],o=[],c=[],p={},l=m=>{var v;return`${m}:${p[m]=((v=p[m])!=null?v:-1)+1}`};let d="",h=!1,f=!1;for(const m of r){d+=m.value;const v=m.type==="minusSign"||m.type==="plusSign"?"sign":m.type;v==="integer"?(h=!0,s.push(...m.value.split("").map(B=>({type:v,value:parseInt(B)})))):v==="group"?s.push({type:v,value:m.value}):v==="decimal"?(f=!0,o.push({type:v,value:m.value,key:l(v)})):v==="fraction"?o.push(...m.value.split("").map(B=>({type:v,value:parseInt(B),key:l(v),pos:-1-p[v]}))):(h||f?c:a).push({type:v,value:m.value,key:l(v)})}const y=[];for(let m=s.length-1;m>=0;m--){const v=s[m];y.unshift(v.type==="integer"?{...v,key:l(v.type),pos:p[v.type]}:{...v,key:l(v.type)})}return{pre:a,integer:y,fraction:o,post:c,valueAsString:d,value:typeof e=="string"?parseFloat(e):e}}var g=(e,t,n)=>{const i=document.createElement(e),[r,a]=Array.isArray(t)?[void 0,t]:[t,n];return r&&Object.assign(i,r),a?.forEach(s=>i.appendChild(s)),i},Ge=(e,t)=>{var n,i;return t==="left"?e.offsetLeft:((i=(n=e.offsetParent instanceof HTMLElement?e.offsetParent:null)==null?void 0:n.offsetWidth)!=null?i:0)-e.offsetWidth-e.offsetLeft},Ye=e=>e.offsetWidth>0&&e.offsetHeight>0,Ze=(e,t)=>{typeof HTMLElement<"u"&&typeof customElements<"u"&&!customElements.get(e)&&customElements.define(e,t)};function Qe(e,t,{reverse:n=!1}={}){const i=e.length;for(let r=n?i-1:0;n?r>=0:r<i;n?r--:r++)t(e[r],r)}var he=typeof requestAnimationFrame<"u",Re=class extends Ve{constructor(){super(),this.created=!1,this.batched=!1,this._preUpdated=!1;const{animated:e,...t}=this.constructor.defaultProps;this._animated=this.computedAnimated=e,Object.assign(this,t)}get animated(){return this._animated}set animated(e){var t;this.animated!==e&&(this._animated=e,I()?(t=this.shadowRoot)==null||t.getAnimations().forEach(n=>n.finish()):Xe(this))}set data(e){var t,n,i;if(e==null||e===this._data)return;const{pre:r,integer:a,fraction:s,post:o,value:c}=e;if(this.created){const p=this._data;this._data=e,this.computedTrend=typeof this.trend=="function"?this.trend(p.value,c):this.trend,this.computedAnimated=he&&this._animated&&(!this.respectMotionPreference||!((n=te)!=null&&n.matches))&&Ye(this)&&this.ownerDocument.visibilityState==="visible",(i=this.plugins)==null||i.forEach(l=>{var d;return(d=l.onUpdate)==null?void 0:d.call(l,e,p,this)}),this.batched||this.willUpdate(),this._pre.update(r),this._num.update({integer:a,fraction:s}),this._post.update(o),this.batched||this.didUpdate()}else{this._data=e,this.attachShadow({mode:"open"});try{(t=this._internals)!=null||(this._internals=this.attachInternals()),this._internals.role="img"}catch{}const p=document.createElement("style");this.nonce&&(p.nonce=this.nonce),p.textContent=ze,this.shadowRoot.appendChild(p),this._pre=new me(this,r,{justify:"right",part:"left"}),this.shadowRoot.appendChild(this._pre.el),this._num=new et(this,a,s),this.shadowRoot.appendChild(this._num.el),this._post=new me(this,o,{justify:"left",part:"right"}),this.shadowRoot.appendChild(this._post.el),this.created=!0}this._internals&&"ariaLabel"in this._internals?this._internals.ariaLabel=e.valueAsString:(this.setAttribute("role","img"),this.setAttribute("aria-label",e.valueAsString))}willUpdate(){var e;this._preUpdated=he&&this._animated&&(!this.respectMotionPreference||!((e=te)!=null&&e.matches))&&this.ownerDocument.visibilityState==="visible",this._preUpdated&&(this._pre.willUpdate(),this._num.willUpdate(),this._post.willUpdate())}didUpdate(){if(!this.computedAnimated||!this._preUpdated)return;this._abortAnimationsFinish?this._abortAnimationsFinish.abort():this.dispatchEvent(new Event("animationsstart")),this._pre.didUpdate(),this._num.didUpdate(),this._post.didUpdate();const e=new AbortController,t=I()?this.shadowRoot.getAnimations().map(n=>n.finished):He(this);Promise.all(t).then(()=>{e.signal.aborted||(this.dispatchEvent(new Event("animationsfinish")),this._abortAnimationsFinish=void 0)}),this._abortAnimationsFinish=e}};Re.defaultProps={transformTiming:{duration:900,easing:"linear(0,.005,.019,.039,.066,.096,.129,.165,.202,.24,.278,.316,.354,.39,.426,.461,.494,.526,.557,.586,.614,.64,.665,.689,.711,.731,.751,.769,.786,.802,.817,.831,.844,.856,.867,.877,.887,.896,.904,.912,.919,.925,.931,.937,.942,.947,.951,.955,.959,.962,.965,.968,.971,.973,.976,.978,.98,.981,.983,.984,.986,.987,.988,.989,.99,.991,.992,.992,.993,.994,.994,.995,.995,.996,.996,.9963,.9967,.9969,.9972,.9975,.9977,.9979,.9981,.9982,.9984,.9985,.9987,.9988,.9989,1)"},spinTiming:void 0,opacityTiming:{duration:450,easing:"ease-out"},animated:!0,trend:(e,t)=>Math.sign(t-e),respectMotionPreference:!0,plugins:void 0,digits:void 0};var et=class{constructor(e,t,n,{className:i,...r}={}){this.flow=e,this._integer=new fe(e,t,{justify:"right",part:"integer"}),this._fraction=new fe(e,n,{justify:"left",part:"fraction"}),this._inner=g("span",{className:"number__inner"},[this._integer.el,this._fraction.el]),this.el=g("span",{...r,part:"number",className:`number ${i??""}`},[this._inner]),I()||(this.el.style.setProperty("--scale-x","1"),this.el.style.setProperty(b,"0px"))}willUpdate(){this._prevWidth=this.el.offsetWidth,this._prevLeft=this.el.getBoundingClientRect().left,this._integer.willUpdate(),this._fraction.willUpdate()}update({integer:e,fraction:t}){this._integer.update(e),this._fraction.update(t)}didUpdate(){const e=this.el.getBoundingClientRect();this._integer.didUpdate(),this._fraction.didUpdate();const t=this._prevLeft-e.left,n=this.el.offsetWidth,i=this._prevWidth-n;this.el.style.setProperty("--width",String(n)),w(this.flow,this.el,{[b]:[`${t}px`,"0px"],[D]:[i,0]},this.flow.transformTiming)}},Ae=class{constructor(e,t,{justify:n,className:i,...r},a){this.flow=e,this.children=new Map,this.onCharRemove=o=>()=>{this.children.delete(o)},this.justify=n;const s=t.map(o=>this.addChar(o).el);this.el=g("span",{...r,className:`section section--justify-${n} ${i??""}`},a?a(s):s)}addChar(e,{startDigitsAtZero:t=!1,...n}={}){const i=e.type==="integer"||e.type==="fraction"?new Ce(this,e.type,t?0:e.value,e.pos,{...n,onRemove:this.onCharRemove(e.key)}):new tt(this,e.type,e.value,{...n,onRemove:this.onCharRemove(e.key)});return this.children.set(e.key,i),i}unpop(e){e.el.removeAttribute("inert"),e.el.style.top="",e.el.style[this.justify]=""}pop(e){e.forEach(t=>{t.el.style.top=`${t.el.offsetTop}px`,t.el.style[this.justify]=`${Ge(t.el,this.justify)}px`}),e.forEach(t=>{t.el.setAttribute("inert",""),t.present=!1})}addNewAndUpdateExisting(e){const t=new Map,n=new Map,i=this.justify==="left",r=i?"prepend":"append";if(Qe(e,a=>{let s;this.children.has(a.key)?(s=this.children.get(a.key),n.set(a,s),this.unpop(s),s.present=!0):(s=this.addChar(a,{startDigitsAtZero:!0,animateIn:!0}),t.set(a,s)),this.el[r](s.el)},{reverse:i}),this.flow.computedAnimated){const a=this.el.getBoundingClientRect();t.forEach(s=>{s.willUpdate(a)})}t.forEach((a,s)=>{a.update(s.value)}),n.forEach((a,s)=>{a.update(s.value)})}willUpdate(){const e=this.el.getBoundingClientRect();this._prevOffset=e[this.justify],this.children.forEach(t=>t.willUpdate(e))}didUpdate(){const e=this.el.getBoundingClientRect();this.children.forEach(i=>i.didUpdate(e));const t=e[this.justify],n=this._prevOffset-t;n&&this.children.size&&w(this.flow,this.el,{transform:[`translateX(${n}px)`,"none"]},this.flow.transformTiming)}},fe=class extends Ae{update(e){const t=new Map;this.children.forEach((n,i)=>{e.find(r=>r.key===i)||t.set(i,n),this.unpop(n)}),this.addNewAndUpdateExisting(e),t.forEach(n=>{n instanceof Ce&&n.update(0)}),this.pop(t)}},me=class extends Ae{update(e){const t=new Map;this.children.forEach((n,i)=>{e.find(r=>r.key===i)||t.set(i,n)}),this.pop(t),this.addNewAndUpdateExisting(e)}},G=class{constructor(e,t,{onRemove:n,animateIn:i=!1}={}){this.flow=e,this.el=t,this._present=!0,this._remove=()=>{var r;this.el.remove(),(r=this._onRemove)==null||r.call(this)},this.el.classList.add("animate-presence"),this.flow.computedAnimated&&i&&w(this.flow,this.el,{[R]:[-.9999,0]},this.flow.opacityTiming),this._onRemove=n}get present(){return this._present}set present(e){if(this._present!==e){if(this._present=e,e?this.el.removeAttribute("inert"):this.el.setAttribute("inert",""),!this.flow.computedAnimated){e||this._remove();return}this.el.style.setProperty("--_number-flow-d-opacity",e?"0":"-.999"),w(this.flow,this.el,{[R]:e?[-.9999,0]:[.999,0]},this.flow.opacityTiming),e?this.flow.removeEventListener("animationsfinish",this._remove):this.flow.addEventListener("animationsfinish",this._remove,{once:!0})}}},ke=class extends G{constructor(e,t,n,i){super(e.flow,n,i),this.section=e,this.value=t,this.el=n}},Ce=class extends ke{constructor(e,t,n,i,r){var a,s,o;const c=((o=(s=(a=e.flow.digits)==null?void 0:a[i])==null?void 0:s.max)!=null?o:9)+1,p=Array.from({length:c}).map((d,h)=>{const f=g("span",{className:"digit__num"},[document.createTextNode(String(h))]);return h!==n&&f.setAttribute("inert",""),f.style.setProperty("--n",String(h)),f}),l=g("span",{part:`digit ${t}-digit`,className:"digit"},p);l.style.setProperty("--current",String(n)),l.style.setProperty("--length",String(c)),super(e,n,l,r),this.pos=i,this._onAnimationsFinish=()=>{this.el.classList.remove("is-spinning")},this._numbers=p,this.length=c}willUpdate(e){const t=this.el.getBoundingClientRect();this._prevValue=this.value;const n=t[this.section.justify]-e[this.section.justify],i=t.width/2;this._prevCenter=this.section.justify==="left"?n+i:n-i}update(e){this.el.style.setProperty("--current",String(e)),this._numbers.forEach((t,n)=>n===e?t.removeAttribute("inert"):t.setAttribute("inert","")),this.value=e}didUpdate(e){var t;const n=this.el.getBoundingClientRect(),i=n[this.section.justify]-e[this.section.justify],r=n.width/2,a=this.section.justify==="left"?i+r:i-r,s=this._prevCenter-a;s&&w(this.flow,this.el,{transform:[`translateX(${s}px)`,"none"]},this.flow.transformTiming);const o=this.getDelta();o&&(this.el.classList.add("is-spinning"),w(this.flow,this.el,{[O]:[-o,0]},(t=this.flow.spinTiming)!=null?t:this.flow.transformTiming),this.flow.addEventListener("animationsfinish",this._onAnimationsFinish,{once:!0}))}getDelta(){var e;if(this.flow.plugins)for(const i of this.flow.plugins){const r=(e=i.getDelta)==null?void 0:e.call(i,this.value,this._prevValue,this);if(r!=null)return r}const t=this.value-this._prevValue,n=this.flow.computedTrend||Math.sign(t);return n<0&&this.value>this._prevValue?this.value-this.length-this._prevValue:n>0&&this.value<this._prevValue?this.length-this._prevValue+this.value:t}},tt=class extends ke{constructor(e,t,n,i){const r=g("span",{className:"symbol__value",textContent:n});super(e,n,g("span",{part:`symbol ${t}`,className:"symbol"},[r]),i),this.type=t,this._children=new Map,this._onChildRemove=a=>()=>{this._children.delete(a)},this._children.set(n,new G(this.flow,r,{onRemove:this._onChildRemove(n)}))}willUpdate(e){if(this.type==="decimal")return;const t=this.el.getBoundingClientRect();this._prevOffset=t[this.section.justify]-e[this.section.justify]}update(e){if(this.value!==e){const t=this._children.get(this.value);t&&(t.present=!1);const n=this._children.get(e);if(n)n.present=!0;else{const i=g("span",{className:"symbol__value",textContent:e});this.el.appendChild(i),this._children.set(e,new G(this.flow,i,{animateIn:!0,onRemove:this._onChildRemove(e)}))}}this.value=e}didUpdate(e){if(this.type==="decimal")return;const n=this.el.getBoundingClientRect()[this.section.justify]-e[this.section.justify],i=this._prevOffset-n;i&&w(this.flow,this.el,{transform:[`translateX(${i}px)`,"none"]},this.flow.transformTiming)}},nt=(e,t)=>e==null?t:t==null?e:Math.max(e,t),K=new WeakMap,it={onUpdate(e,t,n){if(K.set(n,void 0),!n.computedTrend)return;const i=t.integer.concat(t.fraction).filter(o=>o.type==="integer"||o.type==="fraction"),r=e.integer.concat(e.fraction).filter(o=>o.type==="integer"||o.type==="fraction"),a=i.find(o=>!r.find(c=>c.pos===o.pos&&c.value===o.value)),s=r.find(o=>!i.find(c=>o.pos===c.pos&&o.value===c.value));K.set(n,nt(a?.pos,s?.pos))},getDelta(e,t,n){const i=e-t,r=K.get(n.flow);if(!i&&r!=null&&r>=n.pos)return n.length*n.flow.computedTrend}},J={exports:{}},A={};var ve;function rt(){if(ve)return A;ve=1;var e=Me(),t=Symbol.for("react.element"),n=Symbol.for("react.fragment"),i=Object.prototype.hasOwnProperty,r=e.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner,a={key:!0,ref:!0,__self:!0,__source:!0};function s(o,c,p){var l,d={},h=null,f=null;p!==void 0&&(h=""+p),c.key!==void 0&&(h=""+c.key),c.ref!==void 0&&(f=c.ref);for(l in c)i.call(c,l)&&!a.hasOwnProperty(l)&&(d[l]=c[l]);if(o&&o.defaultProps)for(l in c=o.defaultProps,c)d[l]===void 0&&(d[l]=c[l]);return{$$typeof:t,type:o,key:h,ref:f,props:d,_owner:r.current}}return A.Fragment=n,A.jsx=s,A.jsxs=s,A}var ge;function st(){return ge||(ge=1,J.exports=rt()),J.exports}var Z=st(),ye,at=parseInt((ye=u.version.match(/^(\d+)\./))==null?void 0:ye[1]),Q=at>=19,ot=["data","digits"],ee=class extends Re{attributeChangedCallback(e,t,n){this[e]=JSON.parse(n)}};ee.observedAttributes=Q?[]:ot;Ze("number-flow-yceffort-react",ee);var _e={};function lt(e){return e}var be=Q?lt:JSON.stringify;function we(e){const{transformTiming:t,spinTiming:n,opacityTiming:i,animated:r,respectMotionPreference:a,trend:s,plugins:o,...c}=e;return[{transformTiming:t,spinTiming:n,opacityTiming:i,animated:r,respectMotionPreference:a,trend:s,plugins:o},c]}var ct=class extends u.Component{constructor(e){super(e),this.handleRef=this.handleRef.bind(this)}updateProperties(e){if(!this.el)return;this.el.batched=!this.props.isolate;const[t]=we(this.props);Object.entries(t).forEach(([n,i])=>{this.el[n]=i??ee.defaultProps[n]}),e?.onAnimationsStart&&this.el.removeEventListener("animationsstart",e.onAnimationsStart),this.props.onAnimationsStart&&this.el.addEventListener("animationsstart",this.props.onAnimationsStart),e?.onAnimationsFinish&&this.el.removeEventListener("animationsfinish",e.onAnimationsFinish),this.props.onAnimationsFinish&&this.el.addEventListener("animationsfinish",this.props.onAnimationsFinish)}componentDidMount(){this.updateProperties(),Q&&this.el&&(this.el.digits=this.props.digits,this.el.data=this.props.data)}getSnapshotBeforeUpdate(e){var t;if(this.updateProperties(e),e.data!==this.props.data){if(this.props.group)return this.props.group.willUpdate(),()=>{var n;return(n=this.props.group)==null?void 0:n.didUpdate()};if(!this.props.isolate)return(t=this.el)==null||t.willUpdate(),()=>{var n;return(n=this.el)==null?void 0:n.didUpdate()}}return null}componentDidUpdate(e,t,n){n?.()}handleRef(e){this.props.innerRef&&(this.props.innerRef.current=e),this.el=e}render(){const[e,{innerRef:t,className:n,data:i,nonce:r,willChange:a,isolate:s,group:o,digits:c,onAnimationsStart:p,onAnimationsFinish:l,...d}]=we(this.props);return Z.jsx("number-flow-yceffort-react",{ref:this.handleRef,"data-will-change":a?"":void 0,class:n,nonce:r,...d,dangerouslySetInnerHTML:{__html:""},suppressHydrationWarning:!0,digits:be(c),data:be(i)})}},$e=u.forwardRef(function({value:t,locales:n,format:i,prefix:r,suffix:a,...s},o){u.useImperativeHandle(o,()=>c.current,[]);const c=u.useRef(void 0),p=u.useContext(Te);p?.useRegister(c);const l=u.useMemo(()=>n?JSON.stringify(n):"",[n]),d=u.useMemo(()=>i?JSON.stringify(i):"",[i]),h=u.useMemo(()=>{var f,y;const m=(y=_e[f=`${l}:${d}`])!=null?y:_e[f]=new Intl.NumberFormat(n,i);return qe(t,m,r,a)},[t,l,d,r,a]);return Z.jsx(ct,{...s,group:p,data:h,innerRef:c})}),S=$e,Te=u.createContext(void 0);function ut({children:e}){const t=u.useRef(new Set),n=u.useRef(!1),i=u.useRef(new WeakMap),r=u.useMemo(()=>({useRegister(a){u.useEffect(()=>(t.current.add(a),()=>{t.current.delete(a)}),[])},willUpdate(){n.current||(n.current=!0,t.current.forEach(a=>{const s=a.current;!s||!s.created||(s.willUpdate(),i.current.set(s,!0))}))},didUpdate(){t.current.forEach(a=>{const s=a.current;!s||!i.current.get(s)||(s.didUpdate(),i.current.delete(s))}),n.current=!1}}),[]);return Z.jsx(Te.Provider,{value:r,children:e})}$e.__docgenInfo={description:"",methods:[],displayName:"NumberFlow"};const ht={title:"NumberFlow",component:S,args:{value:12345.6,suffix:"원",locales:"ko-KR"},argTypes:{value:{control:{type:"number"}},prefix:{control:"text"},suffix:{control:"text"},trend:{control:!1},plugins:{control:!1}},decorators:[e=>u.createElement("div",{style:{fontSize:"3rem",fontWeight:600}},u.createElement(e,null))]},k={},C={args:{value:1523790,suffix:void 0,format:{style:"currency",currency:"KRW"}}},$={args:{value:-.1003,suffix:void 0,format:{style:"percent",minimumFractionDigits:2}}},Fe=e=>e+(Math.random()-.48)*5e3,T={render:e=>{const[t,n]=u.useState(1523790),[i,r]=u.useState(!0);return u.useEffect(()=>{if(!i)return;const a=setInterval(()=>n(Fe),300);return()=>clearInterval(a)},[i]),u.createElement("div",{style:{textAlign:"center"}},u.createElement(S,{...e,value:Math.round(t),format:{style:"currency",currency:"KRW"},suffix:void 0}),u.createElement("div",{style:{marginTop:"1rem"}},u.createElement("button",{style:{fontSize:"1rem",padding:"0.5rem 1rem"},onClick:()=>r(!i)},i?"정지":"시작")))}},F={render:e=>{const[t,n]=u.useState(12345.6),i=()=>{[0,250,500].forEach((r,a)=>setTimeout(()=>n(s=>s+[98765,-1234,4321][a]),r))};return u.createElement("div",{style:{textAlign:"center"}},u.createElement(S,{...e,value:t}),u.createElement("div",{style:{marginTop:"1rem"}},u.createElement("button",{style:{fontSize:"1rem",padding:"0.5rem 1rem"},onClick:i},"인터럽트 연타")))}},M={render:e=>{const[t,n]=u.useState(12345.6);return u.useEffect(()=>(ce("raf"),()=>ce("auto")),[]),u.createElement("div",{style:{textAlign:"center"}},u.createElement(S,{...e,value:t}),u.createElement("div",{style:{marginTop:"1rem",fontSize:"0.9rem",color:"#666"}},"이 브라우저의 자동 감지 결과:"," ",Se?"네이티브 WAAPI":"rAF 폴백"),u.createElement("div",{style:{marginTop:"0.5rem"}},u.createElement("button",{style:{fontSize:"1rem",padding:"0.5rem 1rem"},onClick:()=>n(i=>i+123456)},"+123,456")))}},N={render:()=>{const[e,t]=u.useState(1523790);return u.createElement("div",{style:{textAlign:"center"}},u.createElement(ut,null,u.createElement("div",{style:{fontSize:"3rem",fontWeight:600}},u.createElement(S,{value:e,locales:"ko-KR",format:{style:"currency",currency:"KRW"}})),u.createElement("div",{style:{fontSize:"1.5rem",color:"#3b82f6"}},u.createElement(S,{value:e/15237900,locales:"ko-KR",format:{style:"percent",minimumFractionDigits:2}}))),u.createElement("div",{style:{marginTop:"1rem"}},u.createElement("button",{style:{fontSize:"1rem",padding:"0.5rem 1rem"},onClick:()=>t(n=>Fe(n)|0)},"랜덤 변경")))}},U={args:{value:100,suffix:void 0,plugins:[it]},render:e=>{const[t,n]=u.useState(100);return u.createElement("div",{style:{textAlign:"center"}},u.createElement(S,{...e,value:t}),u.createElement("div",{style:{marginTop:"1rem",display:"flex",gap:"0.5rem",justifyContent:"center"}},u.createElement("button",{style:{fontSize:"1rem",padding:"0.5rem 1rem"},onClick:()=>n(i=>i+1)},"+1"),u.createElement("button",{style:{fontSize:"1rem",padding:"0.5rem 1rem"},onClick:()=>n(i=>i+100)},"+100")))}};k.parameters={...k.parameters,docs:{...k.parameters?.docs,source:{originalSource:"{}",...k.parameters?.docs?.source},description:{story:"Controls 패널에서 value를 바꿔보세요.",...k.parameters?.docs?.description}}};C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`{
  args: {
    value: 1523790,
    suffix: undefined,
    format: {
      style: 'currency',
      currency: 'KRW'
    }
  }
}`,...C.parameters?.docs?.source},description:{story:"Intl.NumberFormat의 통화 포맷을 그대로 사용합니다.",...C.parameters?.docs?.description}}};$.parameters={...$.parameters,docs:{...$.parameters?.docs,source:{originalSource:`{
  args: {
    value: -0.1003,
    suffix: undefined,
    format: {
      style: 'percent',
      minimumFractionDigits: 2
    }
  }
}`,...$.parameters?.docs?.source},description:{story:"소수점·백분율 포맷.",...$.parameters?.docs?.description}}};T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  render: args => {
    const [value, setValue] = React.useState(1523790);
    const [running, setRunning] = React.useState(true);
    React.useEffect(() => {
      if (!running) return;
      const id = setInterval(() => setValue(randomWalk), 300);
      return () => clearInterval(id);
    }, [running]);
    return <div style={{
      textAlign: 'center'
    }}>
        <NumberFlow {...args} value={Math.round(value)} format={{
        style: 'currency',
        currency: 'KRW'
      }} suffix={undefined} />
        <div style={{
        marginTop: '1rem'
      }}>
          <button style={{
          fontSize: '1rem',
          padding: '0.5rem 1rem'
        }} onClick={() => setRunning(!running)}>
            {running ? '정지' : '시작'}
          </button>
        </div>
      </div>;
  }
}`,...T.parameters?.docs?.source},description:{story:"실시간 시세처럼 계속 값이 바뀌는 상황 (연속 인터럽트 합성).",...T.parameters?.docs?.description}}};F.parameters={...F.parameters,docs:{...F.parameters?.docs,source:{originalSource:`{
  render: args => {
    const [value, setValue] = React.useState(12345.6);
    const burst = () => {
      ;
      [0, 250, 500].forEach((delay, i) => setTimeout(() => setValue(v => v + [98765, -1234, 4321][i]!), delay));
    };
    return <div style={{
      textAlign: 'center'
    }}>
        <NumberFlow {...args} value={value} />
        <div style={{
        marginTop: '1rem'
      }}>
          <button style={{
          fontSize: '1rem',
          padding: '0.5rem 1rem'
        }} onClick={burst}>
            인터럽트 연타
          </button>
        </div>
      </div>;
  }
}`,...F.parameters?.docs?.source},description:{story:"애니메이션 도중 값을 연달아 바꿔도 accumulate 합성으로 자연스럽게 이어집니다.",...F.parameters?.docs?.description}}};M.parameters={...M.parameters,docs:{...M.parameters?.docs,source:{originalSource:`{
  render: args => {
    const [value, setValue] = React.useState(12345.6);
    React.useEffect(() => {
      setEngineMode('raf');
      return () => setEngineMode('auto');
    }, []);
    return <div style={{
      textAlign: 'center'
    }}>
        <NumberFlow {...args} value={value} />
        <div style={{
        marginTop: '1rem',
        fontSize: '0.9rem',
        color: '#666'
      }}>
          이 브라우저의 자동 감지 결과:{' '}
          {supportsNativeAnimations ? '네이티브 WAAPI' : 'rAF 폴백'}
        </div>
        <div style={{
        marginTop: '0.5rem'
      }}>
          <button style={{
          fontSize: '1rem',
          padding: '0.5rem 1rem'
        }} onClick={() => setValue(v => v + 123456)}>
            +123,456
          </button>
        </div>
      </div>;
  }
}`,...M.parameters?.docs?.source},description:{story:`구형 브라우저가 타는 rAF 폴백 엔진을 강제로 켠 상태입니다.
네이티브 WAAPI 경로("기본" 스토리)와 육안으로 구분되지 않아야 정상입니다.`,...M.parameters?.docs?.description}}};N.parameters={...N.parameters,docs:{...N.parameters?.docs,source:{originalSource:`{
  render: () => {
    const [value, setValue] = React.useState(1523790);
    return <div style={{
      textAlign: 'center'
    }}>
        <NumberFlowGroup>
          <div style={{
          fontSize: '3rem',
          fontWeight: 600
        }}>
            <NumberFlow value={value} locales="ko-KR" format={{
            style: 'currency',
            currency: 'KRW'
          }} />
          </div>
          <div style={{
          fontSize: '1.5rem',
          color: '#3b82f6'
        }}>
            <NumberFlow value={value / 15237900} locales="ko-KR" format={{
            style: 'percent',
            minimumFractionDigits: 2
          }} />
          </div>
        </NumberFlowGroup>
        <div style={{
        marginTop: '1rem'
      }}>
          <button style={{
          fontSize: '1rem',
          padding: '0.5rem 1rem'
        }} onClick={() => setValue(v => randomWalk(v) | 0)}>
            랜덤 변경
          </button>
        </div>
      </div>;
  }
}`,...N.parameters?.docs?.source},description:{story:"NumberFlowGroup: 여러 인스턴스의 애니메이션 타이밍을 묶어 동기화합니다.",...N.parameters?.docs?.description}}};U.parameters={...U.parameters,docs:{...U.parameters?.docs,source:{originalSource:`{
  args: {
    value: 100,
    suffix: undefined,
    plugins: [continuous]
  },
  render: args => {
    const [value, setValue] = React.useState(100);
    return <div style={{
      textAlign: 'center'
    }}>
        <NumberFlow {...args} value={value} />
        <div style={{
        marginTop: '1rem',
        display: 'flex',
        gap: '0.5rem',
        justifyContent: 'center'
      }}>
          <button style={{
          fontSize: '1rem',
          padding: '0.5rem 1rem'
        }} onClick={() => setValue(v => v + 1)}>
            +1
          </button>
          <button style={{
          fontSize: '1rem',
          padding: '0.5rem 1rem'
        }} onClick={() => setValue(v => v + 100)}>
            +100
          </button>
        </div>
      </div>;
  }
}`,...U.parameters?.docs?.source},description:{story:"continuous 플러그인: 중간 숫자들을 거쳐가는 듯한 연속적인 스핀.",...U.parameters?.docs?.description}}};const ft=["기본","통화","백분율","실시간_티커","인터럽트","RAF_폴백_강제","그룹","Continuous_플러그인"];export{U as Continuous_플러그인,M as RAF_폴백_강제,ft as __namedExportsOrder,ht as default,N as 그룹,k as 기본,$ as 백분율,T as 실시간_티커,F as 인터럽트,C as 통화};
