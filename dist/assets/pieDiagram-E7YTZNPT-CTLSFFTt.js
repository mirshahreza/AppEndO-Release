import{p as et}from"./chunk-JWPE2WC7-uLvLwc_1.js";import{g as at,s as rt,a as it,b as ot,p as nt,o as st,_ as l,l as E,c as lt,B as ct,F as pt,G as dt,H as U,d as gt,q as ht,I as mt,D as ft}from"./mermaid.core-CgobNDXm.js";import{p as ut}from"./cynefin-OW5HDTMX-CUagmNof.js";import{o as vt}from"./d3-scale-L8qsBSc3.js";import"./index-DIHG-h7Q.js";import"./react-vendor-DelaA65R.js";import"./tanstack-query-CQz7GcnD.js";import"./dayjs.min-CrKCef5E.js";import"./DesignerFormFields-BKiQU2-d.js";import"./HeroFieldControls-DR4zCw5u.js";import"./trash-2-zmzTNMxq.js";import"./index-DLLvKHfV.js";import"./index-Dqp_Gt79.js";import"./loader-circle-D0DQ_czg.js";import"./triangle-alert-CjtwA9rD.js";import"./designerDatePickerConfig-BSFQIAhw.js";import"./CalendarDate-BqDpojlb.js";import"./lucide-react-CQdqI_cB.js";import"./lock-CnOcs5Zf.js";import"./bot-CUnfXOaj.js";import"./terminal-DkeUqCSm.js";import"./flask-conical-Bv7o5DLU.js";import"./id-card-BCNhUeHD.js";import"./mail-AcE3F4o1.js";import"./refresh-cw-B1UAwEsw.js";import"./index-BdgjMRiR.js";import"./d3-selection-D5hwjrp8.js";import"./iconify-Cw1FXWvc.js";import"./d3-interpolate-7N3Rrv4i.js";var St=ft.pie,R={sections:new Map,showData:!1},T=R.sections,F=R.showData,xt=structuredClone(St),wt=l(()=>structuredClone(xt),"getConfig"),$t=l(()=>{T=new Map,F=R.showData,ht()},"clear"),Ct=l(({label:t,value:a})=>{if(a<0)throw new Error(`"${t}" has invalid value: ${a}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);T.has(t)||(T.set(t,a),E.debug(`added new section: ${t}, with value: ${a}`))},"addSection"),Dt=l(()=>T,"getSections"),yt=l(t=>{F=t},"setShowData"),Tt=l(()=>F,"getShowData"),q={getConfig:wt,clear:$t,setDiagramTitle:st,getDiagramTitle:nt,setAccTitle:ot,getAccTitle:it,setAccDescription:rt,getAccDescription:at,addSection:Ct,getSections:Dt,setShowData:yt,getShowData:Tt},bt=l((t,a)=>{et(t,a),a.setShowData(t.showData),t.sections.map(a.addSection)},"populateDb"),At={parse:l(async t=>{const a=await ut("pie",t);E.debug(a),bt(a,q)},"parse")},_t=l(t=>`
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
`,"getStyles"),kt=_t,zt=l(t=>{const a=[...t.values()].reduce((n,u)=>n+u,0),H=[...t.entries()].map(([n,u])=>({label:n,value:u})).filter(n=>n.value/a*100>=1);return mt().value(n=>n.value).sort(null)(H)},"createPieArcs"),Et=l((t,a,H,L)=>{var N;E.debug(`rendering pie chart
`+t);const n=L.db,u=lt(),h=ct(n.getConfig(),u.pie),W=40,i=18,c=4,$=450,S=$,b=pt(a),C=b.append("g");C.attr("transform","translate("+S/2+","+$/2+")");const{themeVariables:o}=u;let[G]=dt(o.pieOuterStrokeWidth);G??(G=2);const V=h.legendPosition,M=h.textPosition,X=h.donutHole>0&&h.donutHole<=.9?h.donutHole:0,m=Math.min(S,$)/2-W,Z=U().innerRadius(X*m).outerRadius(m),j=U().innerRadius(m*M).outerRadius(m*M),x=C.append("g");x.append("circle").attr("cx",0).attr("cy",0).attr("r",m+G/2).attr("class","pieOuterCircle");const D=n.getSections(),J=zt(D),K=[o.pie1,o.pie2,o.pie3,o.pie4,o.pie5,o.pie6,o.pie7,o.pie8,o.pie9,o.pie10,o.pie11,o.pie12];let A=0;D.forEach(e=>{A+=e});const O=J.filter(e=>(e.data.value/A*100).toFixed(0)!=="0"),_=vt(K).domain([...D.keys()]);x.selectAll("mySlices").data(O).enter().append("path").attr("d",Z).attr("fill",e=>_(e.data.label)).attr("class",e=>{let r="pieCircle";return h.highlightSlice==="hover"?r+=" highlightedOnHover":h.highlightSlice===e.data.label&&(r+=" highlighted"),r}),x.selectAll("mySlices").data(O).enter().append("text").text(e=>(e.data.value/A*100).toFixed(0)+"%").attr("transform",e=>"translate("+j.centroid(e)+")").style("text-anchor","middle").attr("class","slice");const Q=C.append("text").text(n.getDiagramTitle()).attr("x",0).attr("y",-400/2).attr("class","pieTitleText"),w=[...D.entries()].map(([e,r])=>({label:e,value:r})),f=C.selectAll(".legend").data(w).enter().append("g").attr("class","legend");f.append("rect").attr("width",i).attr("height",i).style("fill",e=>_(e.label)).style("stroke",e=>_(e.label)),f.append("text").attr("x",i+c).attr("y",i-c).text(e=>n.getShowData()?`${e.label} [${e.value}]`:e.label);const v=Math.max(...f.selectAll("text").nodes().map(e=>(e==null?void 0:e.getBoundingClientRect().width)??0));let y=$,k=S+W;const s=i+c,z=w.length*s;switch(V){case"center":f.attr("transform",(e,r)=>{const p=s*w.length/2,d=-v/2-(i+c),g=r*s-p;return"translate("+d+","+g+")"});break;case"top":y+=z,f.attr("transform",(e,r)=>{const p=m,d=-v/2-(i+c),g=r*s-p;return`translate(${d}, ${g})`}),x.attr("transform",()=>`translate(0, ${z+s})`);break;case"bottom":y+=z,f.attr("transform",(e,r)=>{const p=-m-s,d=-v/2-(i+c),g=r*s-p;return"translate("+d+","+g+")"});break;case"left":k+=i+c+v,f.attr("transform",(e,r)=>{const p=s*w.length/2,d=-m-(i+c),g=r*s-p;return"translate("+d+","+g+")"}),x.attr("transform",()=>`translate(${v+i+c}, 0)`);break;case"right":default:k+=i+c+v,f.attr("transform",(e,r)=>{const p=s*w.length/2,d=12*i,g=r*s-p;return"translate("+d+","+g+")"});break}const P=((N=Q.node())==null?void 0:N.getBoundingClientRect().width)??0,Y=S/2-P/2,tt=S/2+P/2,B=Math.min(0,Y),I=Math.max(k,tt)-B;b.attr("viewBox",`${B} 0 ${I} ${y}`),gt(b,y,I,h.useMaxWidth)},"draw"),Rt={draw:Et},ce={parser:At,db:q,renderer:Rt,styles:kt};export{ce as diagram};
