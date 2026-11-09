import{p as rt}from"./chunk-JWPE2WC7-CxcQTIE_.js";import{D as T,b0 as B,f as nt,V as it,aP as ot,W as st,aQ as lt,$ as ct,aS as pt,a as g,at as G,Y as ut,r as gt,aO as dt,aC as ht,B as mt,s as ft,N as vt}from"./mermaid.core-CUwlsqYF.js";import{p as xt}from"./cynefin-VYW2F7L2-D4Xr31sQ.js";import"./transform-C3k1rBga.js";import{d as Z}from"./arc-aB2WyMwf.js";import{o as St}from"./ordinal-Cboi1Yqb.js";import"./index-X8VNd1Qb.js";import"./react-vendor-CsZD9bLw.js";import"./tanstack-query-BjZ08O4H.js";import"./dayjs.min-C5-DKurV.js";import"./AiFieldAssistSectionContext-Dc3GTQMY.js";import"./useHwyPublicCultureId-CzNTV3a_.js";import"./terminal-Cw-U0C22.js";import"./motion-CZjBJ88L.js";import"./HeroFieldControls-C11371Oz.js";import"./loader-circle-BOi6z1rb.js";import"./lucide-react-Bhi41pQe.js";import"./lock-3ohAIp8f.js";import"./flask-conical-CeC0ipDJ.js";import"./id-card-CUXrXPjF.js";import"./mail-DYrZWqUj.js";import"./FormChoiceFields-DXE7pFNe.js";import"./index-CX2UUQsi.js";import"./HwyPublicPortalLayout-CmutilE3.js";import"./useHwyPublicPortalDocumentTitle-RN3hsb1n.js";import"./hwySelfRegistrationNumericInput-DEuxNN2L.js";import"./UsersIcon-DCeYIj7S.js";import"./tanstack-virtual-BF62Is0T.js";import"./iconify-DuHxJVmX.js";import"./init-Gi6I4Gst.js";function yt(t,n){return n<t?-1:n>t?1:n>=t?0:NaN}function wt(t){return t}function At(){var t=wt,n=yt,y=null,b=T(0),l=T(B),d=T(0);function i(e){var r,s=(e=nt(e)).length,h,w,$=0,m=new Array(s),o=new Array(s),D=+b.apply(this,arguments),E=Math.min(B,Math.max(-B,l.apply(this,arguments)-D)),k,W=Math.min(Math.abs(E)/s,d.apply(this,arguments)),p=W*(E<0?-1:1),A;for(r=0;r<s;++r)(A=o[m[r]=r]=+t(e[r],r,e))>0&&($+=A);for(n!=null?m.sort(function(M,f){return n(o[M],o[f])}):y!=null&&m.sort(function(M,f){return y(e[M],e[f])}),r=0,w=$?(E-s*p)/$:0;r<s;++r,D=k)h=m[r],A=o[h],k=D+(A>0?A*w:0)+p,o[h]={data:e[h],index:r,value:A,startAngle:D,endAngle:k,padAngle:W};return o}return i.value=function(e){return arguments.length?(t=typeof e=="function"?e:T(+e),i):t},i.sortValues=function(e){return arguments.length?(n=e,y=null,i):n},i.sort=function(e){return arguments.length?(y=e,n=null,i):y},i.startAngle=function(e){return arguments.length?(b=typeof e=="function"?e:T(+e),i):b},i.endAngle=function(e){return arguments.length?(l=typeof e=="function"?e:T(+e),i):l},i.padAngle=function(e){return arguments.length?(d=typeof e=="function"?e:T(+e),i):d},i}var Ct=vt.pie,I={sections:new Map,showData:!1},O=I.sections,V=I.showData,$t=structuredClone(Ct),Dt=g(()=>structuredClone($t),"getConfig"),Tt=g(()=>{O=new Map,V=I.showData,ft()},"clear"),bt=g(({label:t,value:n})=>{if(n<0)throw new Error(`"${t}" has invalid value: ${n}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);O.has(t)||(O.set(t,n),G.debug(`added new section: ${t}, with value: ${n}`))},"addSection"),kt=g(()=>O,"getSections"),zt=g(t=>{V=t},"setShowData"),Et=g(()=>V,"getShowData"),q={getConfig:Dt,clear:Tt,setDiagramTitle:pt,getDiagramTitle:ct,setAccTitle:lt,getAccTitle:st,setAccDescription:ot,getAccDescription:it,addSection:bt,getSections:kt,setShowData:zt,getShowData:Et},Mt=g((t,n)=>{rt(t,n),n.setShowData(t.showData),t.sections.map(n.addSection)},"populateDb"),Rt={parse:g(async t=>{const n=await xt("pie",t);G.debug(n),Mt(n,q)},"parse")},Wt=g(t=>`
  .pieCircle{
    stroke: ${t.pieStrokeColor};
    stroke-width : ${t.pieStrokeWidth};
    opacity : ${t.pieOpacity};
  }
  .pieCircle.highlighted{
    scale: 1.05;
    opacity: 1;
  }
  .pieCircle.highlightedOnHover:hover{
    transition-duration: 250ms;
    scale: 1.05;
    opacity: 1;
  }
  .pieOuterCircle{
    stroke: ${t.pieOuterStrokeColor};
    stroke-width: ${t.pieOuterStrokeWidth};
    fill: none;
  }
  .pieTitleText {
    text-anchor: middle;
    font-size: ${t.pieTitleTextSize};
    fill: ${t.pieTitleTextColor};
    font-family: ${t.fontFamily};
  }
  .slice {
    font-family: ${t.fontFamily};
    fill: ${t.pieSectionTextColor};
    font-size:${t.pieSectionTextSize};
    // fill: white;
  }
  .legend text {
    fill: ${t.pieLegendTextColor};
    font-family: ${t.fontFamily};
    font-size: ${t.pieLegendTextSize};
  }
`,"getStyles"),Lt=Wt,Nt=g(t=>{const n=[...t.values()].reduce((l,d)=>l+d,0),y=[...t.entries()].map(([l,d])=>({label:l,value:d})).filter(l=>l.value/n*100>=1);return At().value(l=>l.value).sort(null)(y)},"createPieArcs"),Ot=g((t,n,y,b)=>{var Y;G.debug(`rendering pie chart
`+t);const l=b.db,d=ut(),i=gt(l.getConfig(),d.pie),e=40,r=18,s=4,h=450,w=h,$=dt(n),m=$.append("g");m.attr("transform","translate("+w/2+","+h/2+")");const{themeVariables:o}=d;let[D]=ht(o.pieOuterStrokeWidth);D??(D=2);const E=i.legendPosition,k=i.textPosition,W=i.donutHole>0&&i.donutHole<=.9?i.donutHole:0,p=Math.min(w,h)/2-e,A=Z().innerRadius(W*p).outerRadius(p),M=Z().innerRadius(p*k).outerRadius(p*k),f=m.append("g");f.append("circle").attr("cx",0).attr("cy",0).attr("r",p+D/2).attr("class","pieOuterCircle");const L=l.getSections(),J=Nt(L),K=[o.pie1,o.pie2,o.pie3,o.pie4,o.pie5,o.pie6,o.pie7,o.pie8,o.pie9,o.pie10,o.pie11,o.pie12];let P=0;L.forEach(a=>{P+=a});const U=J.filter(a=>(a.data.value/P*100).toFixed(0)!=="0"),F=St(K).domain([...L.keys()]);f.selectAll("mySlices").data(U).enter().append("path").attr("d",A).attr("fill",a=>F(a.data.label)).attr("class",a=>{let c="pieCircle";return i.highlightSlice==="hover"?c+=" highlightedOnHover":i.highlightSlice===a.data.label&&(c+=" highlighted"),c}),f.selectAll("mySlices").data(U).enter().append("text").text(a=>(a.data.value/P*100).toFixed(0)+"%").attr("transform",a=>"translate("+M.centroid(a)+")").style("text-anchor","middle").attr("class","slice");const tt=m.append("text").text(l.getDiagramTitle()).attr("x",0).attr("y",-400/2).attr("class","pieTitleText"),R=[...L.entries()].map(([a,c])=>({label:a,value:c})),C=m.selectAll(".legend").data(R).enter().append("g").attr("class","legend");C.append("rect").attr("width",r).attr("height",r).style("fill",a=>F(a.label)).style("stroke",a=>F(a.label)),C.append("text").attr("x",r+s).attr("y",r-s).text(a=>l.getShowData()?`${a.label} [${a.value}]`:a.label);const z=Math.max(...C.selectAll("text").nodes().map(a=>(a==null?void 0:a.getBoundingClientRect().width)??0));let N=h,H=w+e;const u=r+s,_=R.length*u;switch(E){case"center":C.attr("transform",(a,c)=>{const v=u*R.length/2,x=-z/2-(r+s),S=c*u-v;return"translate("+x+","+S+")"});break;case"top":N+=_,C.attr("transform",(a,c)=>{const v=p,x=-z/2-(r+s),S=c*u-v;return`translate(${x}, ${S})`}),f.attr("transform",()=>`translate(0, ${_+u})`);break;case"bottom":N+=_,C.attr("transform",(a,c)=>{const v=-p-u,x=-z/2-(r+s),S=c*u-v;return"translate("+x+","+S+")"});break;case"left":H+=r+s+z,C.attr("transform",(a,c)=>{const v=u*R.length/2,x=-p-(r+s),S=c*u-v;return"translate("+x+","+S+")"}),f.attr("transform",()=>`translate(${z+r+s}, 0)`);break;case"right":default:H+=r+s+z,C.attr("transform",(a,c)=>{const v=u*R.length/2,x=12*r,S=c*u-v;return"translate("+x+","+S+")"});break}const j=((Y=tt.node())==null?void 0:Y.getBoundingClientRect().width)??0,et=w/2-j/2,at=w/2+j/2,Q=Math.min(0,et),X=Math.max(H,at)-Q;$.attr("viewBox",`${Q} 0 ${X} ${N}`),mt($,N,X,i.useMaxWidth)},"draw"),Pt={draw:Ot},me={parser:Rt,db:q,renderer:Pt,styles:Lt};export{me as diagram};
