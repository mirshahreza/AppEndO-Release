import{h as i,j as t,r as ys}from"./react-vendor-CsZD9bLw.js";import{tO as _t,Ep as ws,E0 as Ss,Em as Cs,fl as js,dx as Ae,Dm as It,Dp as Ot,v1 as Qt,v0 as Mt,aJ as Ns,uE as Es,iG as lt,fp as ks,fm as As,at as fe,E3 as Ts,a9 as We,E4 as Ds,e9 as $s,DS as Ls,DW as _s,DR as Is,a8 as Os,ht as Rt,oK as Qs,mA as Ms,mv as Rs,aO as Fs,gb as Ps,lW as qs,hs as Bs}from"./AiFieldAssistSectionContext-BoTUCqWw.js";import{hR as Oe,pu as Ft,qv as zs,qq as Gs,qI as Us,qE as Hs,q1 as Ks,pT as Vs,qY as Ws,q3 as Ys,nV as Js,nW as Xs,nX as Zs,lJ as rt,k_ as it,qy as en,oF as tn,cP as sn,eI as nn,k0 as Ye,cM as L,n7 as Pt,iY as Ee,j8 as ct,j7 as an,j6 as Me,ph as Ie,j0 as ae,m$ as P,pj as l,jp as W,m_ as y,jv as on,eY as rn,gU as qt,gS as Bt,gR as zt,dR as ln,gE as gt}from"./index-pnGHLJUm.js";import{D as g}from"./types-Owq6-75h.js";import{p as dt,i as Je}from"./sqlServerAddress-kz3pZ6Gp.js";import{b as cn}from"./nestedEditorShellHeader-8BOF_6Q5.js";import{bd as Gt,d7 as Ut,bT as Se,bR as te,dd as he,df as dn,dh as Ht,cV as Re,bm as un,di as mn,aS as pn,cW as hn}from"./HeroFieldControls-BJ1_fGXo.js";import{c as vt}from"./FormChoiceFields-oWPXFxiy.js";import{L as ut}from"./loader-circle-Dj1cdodG.js";import{eS as mt,dz as fn,df as Kt,cy as bn,v as Vt,as as xn,aJ as gn,H as vn,d7 as yn,a9 as wn,ac as Sn}from"./lucide-react-eXK3j4Qm.js";import{useQuery as Fe,useQueryClient as Pe,useMutation as qe}from"./tanstack-query-BjZ08O4H.js";import{C as Wt}from"./lock-Dooak1a4.js";import{D as Cn}from"./DataSourceTypeIcon-BwELZOF1.js";import{T as Yt}from"./ToolbarActionGroupWithRefresh-D9iJemgm.js";import"./useHwyPublicCultureId-jOpKWxju.js";import"./terminal-CHOKAhHr.js";import"./motion-CZjBJ88L.js";import"./mail-BMFRi3DY.js";import"./index-CxU6q1dv.js";import"./HwyPublicPortalLayout-DQEFURIc.js";import"./useHwyPublicPortalDocumentTitle-CgGlJFIc.js";import"./hwySelfRegistrationNumericInput-DEuxNN2L.js";import"./UsersIcon-DCeYIj7S.js";import"./tanstack-virtual-BF62Is0T.js";import"./flask-conical-aWjsIcyt.js";import"./id-card-DwVrPr5x.js";import"./InstallDatabaseProviderIcon-DHloci0A.js";import"./ToolbarActionGroup-DYcdAVyt.js";const Xe=8e3,jn=[{value:"name",label:"Name"},{value:"type",label:"Type"},{value:"status",label:"Status"},{value:"created_at",label:"Created"},{value:"updated_at",label:"Updated"}];jn.map(e=>e.value);const X={name:"",type:g.SQL_SERVER,host:"localhost",port:1433,database:"AppEnd",username:"",password:"",encrypt:!0,trustServerCertificate:!0,pooling:!1,optionsJson:""},Ze="h-5 w-5 inline-flex items-center justify-center rounded-sm transition-colors cursor-pointer disabled:opacity-100 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:text-slate-400 disabled:hover:bg-transparent",ke="data-sources",Jt="questions",Xt=e=>{try{return decodeURIComponent(e)}catch{return e}};function Zt(e){const s=(e==null?void 0:e.split("/").filter(Boolean))??[];if(s.length===0)return[];const n=s.lastIndexOf(ke);return n>=0?s.slice(n+1):s}function pt(e){var a;const s=Zt(e);if(s[0]!==Jt)return null;const n=(a=s[1])==null?void 0:a.trim();return n?Xt(n):null}function Nn(e){const s=e.replace(/^\/+/,"").split("/").filter(Boolean),n=s.lastIndexOf(ke);return n<0?null:pt(s.slice(n+1).join("/"))}function yt(e){const s=Zt(e);return s.length===0?!1:pt(s.join("/"))===null}function wt(e,s){const n=Xt(s).trim();if(n)return e.find(a=>a.id===n)}function et(e=Oe){return e===Oe?ke:Ft(ke)}function St(e,s=Oe){const n=`${ke}/${Jt}/${encodeURIComponent(e.id)}`;return s===Oe?n:Ft(n)}const Ne=(e,s)=>e instanceof DOMException&&e.name==="AbortError"?"Connectivity test timed out. Please check server availability and try again.":e instanceof Error?e.message.toLowerCase().includes("failed to fetch")?"Could not reach API server for connectivity test.":e.message||s:s,En=e=>e===g.SQLITE?{...X,type:e}:e===g.MYSQL?{...X,type:e,host:"localhost",port:3306,database:""}:e===g.POSTGRES?{...X,type:e,host:"localhost",port:5433,database:"AppEnd"}:e===g.ORACLE?{...X,type:e,host:"localhost",port:1521,database:""}:e===g.SQL_SERVER?{...X,type:e,host:"localhost",port:1433,database:"AppEnd"}:e===g.OLAP_BRIDGE?{...X,type:e,host:"http://localhost",port:8080,database:"",username:"",password:"",optionsJson:`{
  "catalog": "",
  "cube": "",
  "language": "MDX"
}`}:e===g.MONGODB_ANALYTICS?{...X,type:e,host:"localhost",port:27017,database:"",optionsJson:`{
  "collection": ""
}`}:e===g.ELASTICSEARCH_ANALYTICS?{...X,type:e,host:"http://localhost",port:9200,database:"",optionsJson:`{
  "index": ""
}`}:{...X,type:e},kn=e=>e!=null&&e.trim()?_t(e,""):"",Ct=(e,s="-")=>_t(e,s),tt=(e,s="-")=>(e==null?void 0:e.trim())||s,jt=e=>e.type===g.SQLITE?e.database||"database.sqlite":Number(e.port||0)>0?`${e.host||"-"}:${e.port}`:e.host||"-",An=e=>{if(e.type===g.SQL_SERVER){const s=(e.host||"").includes(","),n=dt(e.host||"localhost",Number(e.port||0));return{name:e.name||"",type:e.type,host:s?n.host:e.host||"localhost",port:s?n.port:Number(e.port||0),database:e.database||"",username:e.username||"",password:"",encrypt:e.encrypt??!0,trustServerCertificate:e.trustServerCertificate??!0,pooling:e.pooling??!1,optionsJson:e.options&&Object.keys(e.options).length>0?JSON.stringify(e.options,null,2):""}}return{name:e.name||"",type:e.type,host:e.host||"localhost",port:Number(e.port||0),database:e.database||"",username:e.username||"",password:"",encrypt:e.encrypt??!0,trustServerCertificate:e.trustServerCertificate??!0,pooling:e.pooling??!1,optionsJson:e.options&&Object.keys(e.options).length>0?JSON.stringify(e.options,null,2):""}},es=e=>{const s=e.trim();if(s)try{const n=JSON.parse(s);if(n&&typeof n=="object"&&!Array.isArray(n))return n}catch{return}},Tn=e=>{const s=e.type===g.SQLITE,n=e.type===g.SQL_SERVER,a=n?dt(e.host,Number(e.port||0)):null,r=es(e.optionsJson);return{name:e.name.trim(),type:e.type,host:s?"localhost":n?(a==null?void 0:a.host)??e.host:e.host,port:s?0:n?(a==null?void 0:a.port)??0:Number(e.port||0),database:e.database||null,username:s?"":e.username,password:s?"":e.password,encrypt:n?e.encrypt:void 0,trustServerCertificate:n?e.trustServerCertificate:void 0,pooling:n?e.pooling:void 0,options:r}},Dn=e=>{const s=e.type===g.SQLITE,n=e.type===g.SQL_SERVER,a=n?dt(e.host,Number(e.port||0)):null;return{type:e.type,host:s?"localhost":n?(a==null?void 0:a.host)??e.host:e.host,port:s?0:n?(a==null?void 0:a.port)??0:Number(e.port||0),database:e.database||null,username:s?"":e.username,password:s?"":e.password,encrypt:n?!!e.encrypt:void 0,trustServerCertificate:n?!!e.trustServerCertificate:void 0,pooling:n?!!e.pooling:void 0,options:es(e.optionsJson)}},st=(e,s)=>e.success?null:typeof e.error=="string"?e.error:s,ye=e=>{e.preventDefault(),e.stopPropagation()};function $n(){var bt,xt;const e=zs(),s=Gs(),n=ws(),{mountId:a,toMountPath:r}=Us(),o=Ss(),c=Hs()["*"],S=((o==null?void 0:o.pageRemainderPath.replace(/^\/+/,""))||void 0)??c,w=i.useMemo(()=>pt(S)??Nn(s.pathname),[s.pathname,S]),f=Ks(),N=Vs(),H=Ws(),oe=Ys(),T=((bt=f.data)==null?void 0:bt.items)??[],z=w?wt(T,w):void 0,I=((xt=f.data)==null?void 0:xt.error)??null,x=f.isLoading,b=f.isFetching&&!f.isLoading,G=!!I,h=I,[k,C]=i.useState(!1),[Z,K]=i.useState(!1),[se,O]=i.useState(null),[re,ee]=i.useState(!1),[q,V]=i.useState(X),[ge,Y]=i.useState(g.SQL_SERVER),[B,ie]=i.useState(null),[j,R]=i.useState(!1),[J,le]=i.useState(null),[Q,E]=i.useState(""),[Ce,D]=i.useState(""),Te=i.useMemo(()=>{const m=Object.values(g).filter(p=>p!==g.SQLITE),M=[g.SQL_SERVER,g.POSTGRES,g.MYSQL,g.ORACLE];return[...M,...m.filter(p=>!M.includes(p))]},[]),me=q.type===g.SQLITE,Ge=q.type===g.SQL_SERVER,pe=q.type===g.OLAP_BRIDGE||q.type===g.MONGODB_ANALYTICS||q.type===g.ELASTICSEARCH_ANALYTICS,Ue=!me,He=!me,Ke=!me,De=!me,$e=!pe||q.type===g.MONGODB_ANALYTICS;i.useEffect(()=>{I&&E(I)},[I]),i.useEffect(()=>{if(f.isLoading)return;if(yt(S)||yt(s.pathname)){e(r(et(a)),{replace:!0});return}w&&(wt(T,w)||e(r(et(a)),{replace:!0}))},[T,f.isLoading,s.pathname,a,e,S,w,r]);const Le=i.useCallback(m=>r(St(m,a)),[a,r]),d=i.useCallback(m=>{n(r(St(m,a)))},[a,n,r]),A=i.useCallback(()=>{e(r(et(a)))},[a,e,r]);i.useEffect(()=>{if(!Q)return;const m=window.setTimeout(()=>E(""),4500);return()=>window.clearTimeout(m)},[Q]),i.useEffect(()=>{if(!Ce)return;const m=window.setTimeout(()=>D(""),3500);return()=>window.clearTimeout(m)},[Ce]);const _=i.useCallback(async m=>{m!=null&&m.preserveFeedback||E(""),await f.refetch()},[f]),ne=(m=ge)=>{ie(null),Y(m),V(En(m)),E(""),D(""),R(!0)},ce=m=>{ie(m.id),V(An(m)),E(""),D(""),R(!0)},bs=()=>R(!1),xs=async()=>{if(!q.name.trim()){E("Name is required.");return}C(!0),E(""),D("");try{const m=Tn(q);if(B){const{data:M,response:p}=await H.mutateAsync({id:B,payload:m}),U=st(M,"Failed to save data source.");if(U||!p.ok)throw new Error(U||"Failed to save data source.")}else{const{data:M,response:p}=await N.mutateAsync(m),U=st(M,"Failed to save data source.");if(U||!p.ok)throw new Error(U||"Failed to save data source.")}V(X),ie(null),R(!1),await _()}catch(m){E(rt(m)?it(m):Ne(m,"Failed to save data source."))}finally{C(!1)}},gs=async()=>{ee(!0),E(""),D("");const m=new AbortController,M=window.setTimeout(()=>m.abort(),Xe);try{const{data:p,response:U}=await Zs(Dn(q),m.signal);if(!U.ok)throw new Error(typeof p.error=="string"?p.error:"Connectivity test failed for current form values.");(p==null?void 0:p.status)==="connected"?D(`Current values are reachable. ${(p==null?void 0:p.message)||""}`.trim()):E(`Current values are not reachable. ${(p==null?void 0:p.message)||""}`.trim())}catch(p){E(Ne(p,"Connectivity test failed for current form values.")),D("")}finally{window.clearTimeout(M),ee(!1)}},vs=async m=>{const M=T.find(p=>p.id===m);if(M!=null&&M.isDefault){E("Default data source cannot be deleted.");return}E(""),D("");try{const{data:p,response:U}=await oe.mutateAsync(m),$=st(p,"Failed to delete data source.");if($||!U.ok)throw new Error($||"Failed to delete data source.");await _()}catch(p){E(rt(p)?it(p):Ne(p,"Failed to delete data source."))}};return{typeOptions:Te,items:T,questionsIdFromUrl:w,questionsDataSource:z,resolveQuestionsHref:Le,openQuestions:d,closeQuestions:A,isError:G,listLoadError:h,isRetryingList:b,loading:x,submitting:k,testingAll:Z,testingId:se,testingDraft:re,form:q,setForm:V,editingId:B,isDialogOpen:j,deleteTarget:J,error:Q,successMessage:Ce,isSqlite:me,isSqlServer:Ge,showHost:Ue,showPort:He,showUsername:Ke,showPassword:De,showDatabase:$e,refreshList:_,openCreateDialog:ne,openEditDialog:ce,closeDialog:bs,saveDataSource:xs,testDraftConnectivity:gs,openDeleteConfirm:m=>{if(m.isDefault){E("Default data source cannot be deleted.");return}le(m)},confirmDelete:async()=>{J&&(await vs(J.id),le(null))},cancelDelete:()=>le(null),testConnectivity:async m=>{var U;O(m),E(""),D("");const M=new AbortController,p=window.setTimeout(()=>M.abort(),Xe);try{const{data:$,response:je}=await Xs(m,M.signal);if(!je.ok)throw new Error(typeof $.error=="string"?$.error:"Connectivity test failed.");const ve=((U=T.find(_e=>_e.id===m))==null?void 0:U.name)||"Data source";($==null?void 0:$.status)==="connected"?D(`${ve} is reachable. ${($==null?void 0:$.message)||""}`.trim()):E(`${ve} is not reachable. ${($==null?void 0:$.message)||""}`.trim()),await _({preserveFeedback:!0})}catch($){E(Ne($,"Connectivity test failed.")),D("")}finally{window.clearTimeout(p),O(null)}},testConnectivityAll:async()=>{K(!0),E(""),D("");const m=new AbortController,M=window.setTimeout(()=>m.abort(),Xe);try{const{data:p,response:U}=await Js(m.signal);if(!U.ok)throw new Error(typeof p.error=="string"?p.error:"Connectivity test for all data sources failed.");const $=Array.isArray(p==null?void 0:p.items)?p.items:[],je=$.length,ve=$.filter(Ve=>(Ve==null?void 0:Ve.status)==="connected").length,_e=je-ve;_e===0?D(`All data sources are reachable (${ve}/${je}).`):E(`Connectivity check finished: ${ve}/${je} reachable, ${_e} unavailable.`),await _({preserveFeedback:!0})}catch(p){E(Ne(p,"Connectivity test for all data sources failed.")),D("")}finally{window.clearTimeout(M),K(!1)}},dismissError:()=>E(""),dismissSuccess:()=>D("")}}const Ln="sources",_n="Database",In="Questions";function On(e,s){return cn({listLabel:e,description:(s==null?void 0:s.trim())||void 0,icon:_n,modeLabel:In})}function Qn(e){const s=en(),n=tn(s==null?void 0:s.t,Ln,"Data Sources"),a=i.useMemo(()=>e.enabled?On(n,e.description):null,[e.description,e.enabled,n]);Cs(a)}const Mn=({target:e,onCancel:s,onConfirm:n})=>t.jsx(Gt,{size:"md",title:"Delete Data Source",icon:t.jsx(Ut,{className:"h-4 w-4"}),onClose:s,onConfirm:n,confirmLabel:"Delete",children:t.jsx(js,{question:"Are you sure you want to delete this data source?",entityName:e.name})}),Rn="OLAP Bridge",Fn="MongoDB Analytics",Pn="Elasticsearch Analytics",qn=e=>e===Rn||e===Fn||e===Pn,de="min-w-0 w-full",Bn="min-h-[14rem]",zn=({page:e})=>{if(!e.isDialogOpen)return null;const s=e.isSqlServer&&Je(e.form.host),n=r=>{e.setForm(o=>{if(o.type!==g.SQL_SERVER)return{...o,host:r};const c=Je(r),u=Je(o.host);return{...o,host:r,port:c?0:u&&o.port===0?1433:o.port}})},a=()=>{if(e.isSqlite)return t.jsxs(t.Fragment,{children:[t.jsx("div",{className:"rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-900",children:"SQLite stores data in a local file. Use an absolute or workspace-relative path."}),t.jsx(te,{label:"Database file path",required:!0,className:de,hint:"Absolute or workspace-relative path to the SQLite file on the host. Example: data/app.sqlite",children:t.jsx(he,{size:"sm",autoDir:!1,value:e.form.database,onChange:o=>e.setForm(c=>({...c,database:o.target.value})),placeholder:"database.sqlite",ariaLabel:"SQLite database path"})})]});const r=s?"grid-cols-2":"grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,1fr)]";return t.jsxs(t.Fragment,{children:[t.jsxs("div",{className:Ye("grid w-full items-start gap-3",r),children:[e.showHost?t.jsx(te,{label:"Host",required:!0,className:de,hint:"Hostname, IP, or SQL Server named instance (host\\\\instance).",children:t.jsx(he,{size:"sm",autoDir:!1,value:e.form.host,onChange:o=>n(o.target.value),ariaLabel:"Host"})}):null,e.showPort&&!s?t.jsx(te,{label:"Port",required:!0,className:de,hint:"TCP port for this engine. Named SQL Server instances leave this empty.",children:t.jsx(he,{size:"sm",type:"number",value:e.form.port,onChange:o=>e.setForm(c=>({...c,port:Number(o.target.value||0)})),ariaLabel:"Port"})}):null,e.showDatabase?t.jsx(te,{label:"Database",required:!0,className:de,hint:"Catalog or schema name this connection should use.",children:t.jsx(he,{size:"sm",autoDir:!1,value:e.form.database,onChange:o=>e.setForm(c=>({...c,database:o.target.value})),ariaLabel:"Database"})}):null,e.showUsername?t.jsx(te,{label:"Username",required:!0,className:de,hint:"Login used by EdgeDbRouter for server-side queries.",children:t.jsx(he,{size:"sm",autoDir:!1,value:e.form.username,onChange:o=>e.setForm(c=>({...c,username:o.target.value})),ariaLabel:"Username"})}):null,e.showPassword?t.jsx(te,{label:"Password",hint:"Stored for server-side access. Leave blank when editing to keep the current secret.",className:Ye(de,!s&&e.showUsername?"col-span-2":void 0),children:t.jsx(dn,{size:"sm",value:e.form.password,onChange:o=>e.setForm(c=>({...c,password:o.target.value})),ariaLabel:"Password"})}):null]}),e.isSqlServer?t.jsxs("div",{className:"flex w-full flex-wrap items-center gap-4",children:[t.jsx(vt,{id:"datasource-encrypt",checked:e.form.encrypt!==!1,onChange:o=>e.setForm(c=>({...c,encrypt:o})),children:"Encrypt connection"}),t.jsx(vt,{id:"datasource-trust-cert",checked:e.form.trustServerCertificate!==!1,onChange:o=>e.setForm(c=>({...c,trustServerCertificate:o})),children:"Trust server certificate"})]}):null]})};return t.jsxs(t.Fragment,{children:[e.formFeedback?ys.createPortal(t.jsx(sn,{type:e.formFeedback.type,text:e.formFeedback.message,className:nn}),document.body):null,t.jsx(Ae,{size:"lg",title:e.editingId?"Edit Data Source":`New ${e.form.type} Data Source`,onClose:e.closeDialog,onBackdropClick:e.closeDialog,bodyClassName:"min-h-0 w-full",footer:t.jsxs("div",{className:"flex w-full min-w-0 items-center justify-between gap-2",children:[t.jsx(L,{type:"button",intent:"secondary",onClick:()=>void e.testDraftConnectivity(),disabled:e.testingDraft||e.submitting,...Pt("Test connection","Validate the draft host, port, and credentials before saving.",16),children:e.testingDraft?t.jsxs(t.Fragment,{children:[t.jsx(ut,{className:"h-3.5 w-3.5 animate-spin"}),"Testing…"]}):t.jsxs(t.Fragment,{children:[t.jsx(mt,{className:"h-3.5 w-3.5"}),"Test connection"]})}),t.jsxs("div",{className:"flex shrink-0 items-center gap-2",children:[t.jsxs(L,{type:"button",intent:"cancel",onClick:e.closeDialog,children:[t.jsx(Ee,{className:"h-3.5 w-3.5"}),"Cancel"]}),t.jsx(L,{type:"button",intent:"primary",disabled:e.submitting,onClick:()=>void e.saveDataSource(),children:e.editingId?t.jsxs(t.Fragment,{children:[t.jsx(fn,{className:"h-3.5 w-3.5"}),"Save Changes"]}):t.jsxs(t.Fragment,{children:[t.jsx(Kt,{className:"h-3.5 w-3.5"}),"Create"]})})]})]}),children:t.jsxs("div",{className:"flex w-full flex-col gap-1",children:[t.jsx(Se,{title:"Source",hint:"Identity of this data source in lists and Data Studio.",ink:"accent",children:t.jsx(te,{label:"Name",className:de,hint:"Operator-facing label for this connection in Data Studio and hubs.",children:t.jsx(he,{size:"sm",autoDir:!0,value:e.form.name,onChange:r=>e.setForm(o=>({...o,name:r.target.value})),placeholder:"Source name",ariaLabel:"Data source name"})})}),t.jsx(Se,{title:"Connection",hint:"Engine address and credentials EdgeDbRouter uses for this data source.",ink:"contrast",divided:!0,children:t.jsx("div",{className:Ye("flex w-full flex-col gap-3",Bn),children:a()})}),qn(e.form.type)?t.jsx(Se,{title:"Analytics options",hint:"Provider extras (catalog/cube, collection, index, field whitelist) stored as JSON. Secrets stay in the credential vault.",ink:"accent",divided:!0,children:t.jsx(te,{label:"Options JSON",className:de,hint:e.form.type===g.OLAP_BRIDGE?"catalog, cube, language (MDX or DAX), optional fields whitelist.":e.form.type===g.MONGODB_ANALYTICS?"collection and optional fields whitelist.":"index and optional fields whitelist.",children:t.jsx(he,{size:"sm",autoDir:!1,value:e.form.optionsJson,onChange:r=>e.setForm(o=>({...o,optionsJson:r.target.value})),placeholder:'{"catalog":"Adventure Works","cube":"Sales"}',ariaLabel:"Analytics options JSON"})})}):null]})})]})},F={all:["db-enrichment"],runs:e=>[...F.all,"runs",e],metrics:e=>[...F.all,"metrics",e],questions:(e,s)=>[...F.all,"questions",e,s],documentation:e=>[...F.all,"documentation",e]},Be=async e=>{const{data:s,response:n}=await e;if(!n.ok||!s.success)throw new Error(s.error||n.statusText||"Request failed.");return s};function Gn(e,s){return Fe({queryKey:F.metrics(e),queryFn:async()=>(await Be(Me(`/api/db-enrichment/metrics?dataSourceId=${encodeURIComponent(e)}`))).metrics,enabled:((s==null?void 0:s.enabled)??!0)&&!!e,refetchInterval:s==null?void 0:s.refetchInterval})}function ts(e,s){return Fe({queryKey:F.runs(e),queryFn:async()=>(await Be(Me(`/api/db-enrichment/runs?dataSourceId=${encodeURIComponent(e)}`))).items,enabled:((s==null?void 0:s.enabled)??!0)&&!!e,refetchInterval:s==null?void 0:s.refetchInterval})}function ss(e,s,n){return Fe({queryKey:F.questions(e,s),queryFn:async()=>(await Be(Me(`/api/db-enrichment/questions?dataSourceId=${encodeURIComponent(e)}&status=${s}`))).items,enabled:((n==null?void 0:n.enabled)??!0)&&!!e})}function Un(e,s){return Fe({queryKey:F.documentation(e),queryFn:async()=>(await Be(Me(`/api/db-enrichment/documentation?dataSourceId=${encodeURIComponent(e)}`))).documentation,enabled:((s==null?void 0:s.enabled)??!0)&&!!e,staleTime:3e4})}function Hn(){const e=Pe();return qe({mutationFn:async s=>{const{data:n,response:a}=await ct("/api/db-enrichment/runs",s);if(!a.ok||!n.success)throw new Error(n.error||a.statusText||"Failed to start enrichment.");return n},onSuccess:(s,n)=>{e.invalidateQueries({queryKey:F.runs(n.dataSourceId)}),e.invalidateQueries({queryKey:F.metrics(n.dataSourceId)})}})}function Kn(){return qe({mutationFn:async({id:e,modelId:s})=>{const{data:n,response:a}=await ct(`/api/db-enrichment/questions/${e}/draft`,s?{modelId:s}:{});if(!a.ok||!n.success||typeof n.draft!="string")throw new Error(n.error||a.statusText||"Failed to generate a draft answer.");return n.draft}})}function Vn(e){const s=Pe();return qe({mutationFn:async({id:n,answer:a})=>{const{data:r,response:o}=await an(`/api/db-enrichment/questions/${n}`,{answer:a});if(!o.ok||!r.success)throw new Error(r.error||o.statusText||"Failed to save the answer.")},onSuccess:()=>{s.invalidateQueries({queryKey:[...F.all,"questions",e]}),s.invalidateQueries({queryKey:F.metrics(e)})}})}function Wn(e){const s=Pe();return qe({mutationFn:async n=>{const{data:a,response:r}=await ct(`/api/db-enrichment/questions/${n}/dismiss`);if(!r.ok||!a.success)throw new Error(a.error||r.statusText||"Failed to dismiss the question.")},onSuccess:()=>{s.invalidateQueries({queryKey:[...F.all,"questions",e]}),s.invalidateQueries({queryKey:F.metrics(e)})}})}const we=e=>rt(e)?it(e):e instanceof Error?e.message:"Something went wrong.",Yn=e=>e.find(s=>s.status==="completed")??e.find(s=>!!s.finishedAt)??e[0],Nt=e=>{if(e==null||e==="")return null;const s=typeof e=="number"?e:Number(e);return Number.isFinite(s)?s:null},Jn=e=>e.reduce((s,n)=>{var r;const a=((r=n.createdAt)==null?void 0:r.trim())||null;return a&&(!s||a>s)?a:s},null);function Xn(e,s,n){const a=e??[],r=s??[],o=Yn(a),c=new Set(r.map(H=>H.objectName)).size,u=o!=null&&o.tablesProcessed&&o.tablesProcessed>0?o.tablesProcessed:c,S=Math.max((o==null?void 0:o.tablesTotal)??0,u),w={enrichedAt:(o==null?void 0:o.finishedAt)??(o==null?void 0:o.startedAt)??(o==null?void 0:o.createdAt)??Jn(r),tablesEnriched:u,tablesTotal:S,coverage:S>0?Math.min(u/S,1):0,overallConfidence:Nt(o==null?void 0:o.overallConfidence),openQuestionCount:r.length,columnsResolved:(o==null?void 0:o.columnsResolved)??0,columnsAmbiguous:(o==null?void 0:o.columnsAmbiguous)??0,humanShare:0,latestRun:a[0],isReady:!0};if(!n)return w;const f=Math.max(n.tablesEnriched,w.tablesEnriched),N=Math.max(n.tablesTotal,w.tablesTotal);return{...w,enrichedAt:n.enrichedAt??w.enrichedAt,tablesEnriched:f,tablesTotal:N,coverage:N>0?Math.min(f/N,1):w.coverage,overallConfidence:Nt(n.overallConfidence)??w.overallConfidence,openQuestionCount:Math.max(n.openQuestionCount,w.openQuestionCount),columnsResolved:n.columnsResolved||w.columnsResolved,columnsAmbiguous:n.columnsAmbiguous||w.columnsAmbiguous,humanShare:n.humanShare}}function ht(e,s){const n=(s==null?void 0:s.enabled)??!0,a=ts(e,{enabled:n}),r=ss(e,"open",{enabled:n}),o=Gn(e,{enabled:n});return i.useMemo(()=>({...Xn(a.data,r.data,o.data),isReady:a.isSuccess||r.isSuccess||o.isSuccess}),[o.data,o.isSuccess,r.data,r.isSuccess,a.data,a.isSuccess])}const Zn=50,nt=e=>`${Math.round(e*100)}%`,ea=e=>{const s=new Date(e);return Number.isNaN(s.getTime())?"":s.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",second:"2-digit"})},ta=({dataSource:e,onClose:s,onOpenQuestions:n})=>{var ge,Y,B,ie;const a=(e==null?void 0:e.id)??"",r=!!e,o=Pe(),c=i.useRef(null),[u,S]=i.useState(!1),[w,f]=i.useState(!1),[N,H]=i.useState(""),oe=It({enabled:r}),T=Ot(r),z=i.useMemo(()=>{var j;return(((j=T.data)==null?void 0:j.models)??[]).filter(R=>Qt(R))},[(ge=T.data)==null?void 0:ge.models]),I=Mt((Y=oe.data)==null?void 0:Y.enabled),x=z.length>0,b=I&&x,h=(B=ts(a,{enabled:r,refetchInterval:j=>{var J;const R=(J=j.state.data)==null?void 0:J[0];return R&&(R.status==="pending"||R.status==="running")?1e3:!1}}).data)==null?void 0:B[0],k=(h==null?void 0:h.status)==="pending"||(h==null?void 0:h.status)==="running",C=ht(a,{enabled:r}),Z=Hn(),K=C.tablesTotal,se=C.isReady&&(C.tablesEnriched>0||C.openQuestionCount>0||C.overallConfidence!==null||!!C.enrichedAt),O=K>Zn,re=w?[]:(h==null?void 0:h.progressLog)??[],ee=(h==null?void 0:h.status)==="completed"||(h==null?void 0:h.status)==="failed",q=u&&!k&&ee;if(i.useEffect(()=>{S(!1),f(!1),H("")},[a]),i.useEffect(()=>{var J,le;if(!r||N||z.length===0)return;const j=(J=T.data)==null?void 0:J.defaultModelId,R=(j&&z.some(Q=>Q.id===j)?j:(le=z.find(Q=>Q.isDefault))==null?void 0:le.id)??z[0].id;H(R)},[z,(ie=T.data)==null?void 0:ie.defaultModelId,r,N]),i.useEffect(()=>{k&&(S(!0),f(!1))},[k]),i.useEffect(()=>{var j;(j=c.current)==null||j.scrollIntoView({block:"end"})},[re.length]),i.useEffect(()=>{a&&((h==null?void 0:h.status)!=="completed"&&(h==null?void 0:h.status)!=="failed"||(o.invalidateQueries({queryKey:F.metrics(a)}),o.invalidateQueries({queryKey:[...F.all,"questions",a]})))},[a,h==null?void 0:h.status,o]),!r||!e)return null;const V=()=>{S(!0),f(!0),Z.mutate({dataSourceId:a,scope:"FULL",modelId:N||void 0},{onError:j=>{S(!1),f(!1),Ie(we(j),{type:"error"})}})};return t.jsx(Ae,{size:"maximized",title:t.jsx("span",{className:"truncate",children:`Enrich "${e.name}"`}),ariaLabel:`Enrich ${e.name}`,gradient:!1,onClose:s,onBackdropClick:s,bodyOuterClassName:"flex min-h-0 flex-1 flex-col",bodyClassName:"flex min-h-0 flex-1 flex-col overflow-hidden",metaBandClassName:"py-2.5",metaBand:t.jsxs("div",{className:"grid w-full min-w-0 flex-1 grid-cols-3 gap-3",children:[t.jsxs("div",{className:"min-w-0",children:[t.jsx("p",{className:"text-[10px] font-semibold uppercase tracking-wide text-violet-500",children:"Coverage"}),t.jsx("p",{className:"truncate text-sm font-semibold text-slate-800",children:se&&C.tablesTotal>0?nt(C.coverage):"—"}),t.jsx("p",{className:"truncate text-[10px] text-slate-500",children:se?`${C.tablesEnriched} / ${C.tablesTotal} tables`:""})]}),t.jsxs("div",{className:"min-w-0",children:[t.jsx("p",{className:"text-[10px] font-semibold uppercase tracking-wide text-emerald-600",children:"Confidence"}),t.jsx("p",{className:"truncate text-sm font-semibold text-slate-800",children:C.overallConfidence!==null?nt(C.overallConfidence):"—"}),t.jsx("p",{className:"truncate text-[10px] text-slate-500",children:C.humanShare>0?`${nt(C.humanShare)} human-verified`:""})]}),t.jsxs("button",{type:"button",className:"min-w-0 rounded-sm text-start hover:bg-amber-50/60",onClick:n,"aria-label":"Open questions",children:[t.jsx("p",{className:"text-[10px] font-semibold uppercase tracking-wide text-amber-600",children:"Open questions"}),t.jsx("p",{className:"truncate text-sm font-semibold text-slate-800",children:C.isReady?C.openQuestionCount:"—"}),t.jsx("p",{className:"truncate text-[10px] text-slate-500",children:se?`${C.columnsResolved} resolved, ${C.columnsAmbiguous} ambiguous`:""})]})]}),children:u?t.jsxs("div",{className:"flex min-h-0 flex-1 flex-col gap-3",children:[t.jsxs("div",{className:"min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-700",children:[re.length===0?t.jsx("p",{className:"text-slate-400",children:"Starting enrichment…"}):re.map((j,R)=>t.jsxs("div",{className:"flex gap-2 py-0.5",children:[t.jsx("span",{className:"shrink-0 text-slate-400",children:ea(j.at)}),t.jsx("span",{children:j.message})]},`${j.at}-${R}`)),k?t.jsx("p",{className:"mt-1 animate-pulse text-violet-600",children:"Working…"}):null,(h==null?void 0:h.status)==="failed"&&h.errorMessage?t.jsx("p",{className:"mt-1 text-rose-600",children:h.errorMessage}):null,t.jsx("div",{ref:c})]}),q?t.jsx("div",{className:"flex shrink-0 justify-start",children:t.jsxs(L,{intent:"warning",size:"sm",onClick:n,children:[t.jsx(Wt,{className:"h-3.5 w-3.5"}),"Open questions"]})}):null]}):t.jsxs("div",{className:"flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center",children:[t.jsx("p",{className:"max-w-xl text-xs text-slate-500",children:"Builds a persistent knowledge base for this database — table purposes, column meanings, and value glossaries — so the SQL Console AI assistant can answer questions faster and more accurately."}),I?x?null:t.jsx("p",{className:"rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700",children:"No chat-capable AI model is configured. Configure one in AI settings before running the DB Enricher."}):t.jsx("p",{className:"rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700",children:"AI is disabled in platform settings. Enable it before running the DB Enricher."}),O?t.jsxs("p",{className:"rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800",children:["This database has ",K," tables/views — a full run means roughly that many sequential AI calls and can take a while."]}):null,b?t.jsx(te,{label:"Model",className:"w-full max-w-sm text-start",hint:"Chat model used for this enrichment run.",reserveHintSlot:!1,children:t.jsx(Ht,{size:"sm",value:N,onChange:j=>H(j.target.value),isDisabled:T.isLoading||z.length===0||Z.isPending,ariaLabel:"Enrichment model",children:z.map(j=>t.jsx("option",{value:j.id,children:j.name},j.id))})}):null,t.jsxs(L,{intent:"primary",size:"sm",disabled:!b||Z.isPending||!N,onClick:V,children:[t.jsx(Re,{className:"h-3.5 w-3.5"}),"Start Enrichment"]})]})})},sa=[{value:"createdAt",label:"Created"},{value:"objectName",label:"Object"},{value:"kind",label:"Kind"}],xe={column_meaning:"Column meaning",value_glossary:"Value glossary",relation_intent:"Relation",table_purpose:"Table purpose"},na={open:"border-amber-200 bg-amber-50 text-amber-800",answered:"border-emerald-200 bg-emerald-50 text-emerald-800",dismissed:"border-slate-200 bg-slate-100 text-slate-600"},aa=Es(1),ns=e=>{var s;return e.status==="open"&&!((s=e.answer)!=null&&s.trim())};function as(e,s){return ns(e)?[]:[{id:"view",label:"View",icon:t.jsx(un,{className:"h-3.5 w-3.5"}),intent:"view",onClick:()=>s.onView(e)}]}function oa(e){return[{id:"question",label:"Question",wrap:!0,cellClassName:"align-top",card:{role:"title"},sort:!1,renderCell:s=>t.jsx("span",{className:"text-xs font-medium leading-5 text-slate-800",children:s.question})},{id:"objectName",label:"Object",width:180,card:{role:"subtitle"},sort:{mode:"client"},getSortValue:s=>s.objectName,renderCell:s=>t.jsx("span",{className:"font-mono text-xs text-slate-600",title:s.objectType,children:s.objectName})},{id:"columnName",label:"Column",width:140,card:{role:"field",label:"Column"},renderCell:s=>t.jsx("span",{className:"font-mono text-xs text-slate-600",children:s.columnName??"—"})},{id:"kind",label:"Kind",width:140,card:{role:"field",label:"Kind"},sort:{mode:"client"},getSortValue:s=>s.kind,renderCell:s=>t.jsx("span",{className:"text-xs text-slate-600",children:xe[s.kind]})},{id:"status",label:"Status",width:110,cellClassName:"text-center",headerClassName:"text-center [&>div]:justify-center",card:{role:"field",label:"Status"},sort:!1,renderCell:s=>t.jsx("span",{className:`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${na[s.status]}`,children:s.status})},{id:"answer",label:"Answer",wrap:!0,card:{role:"field",label:"Answer"},renderCell:s=>ns(s)?t.jsxs("div",{className:"flex flex-wrap items-center gap-1.5",children:[t.jsxs(L,{type:"button",intent:"secondary",size:"sm","aria-label":"Answer",onClick:n=>{n.stopPropagation(),e.onAnswer(s)},children:[t.jsx(bn,{className:"h-3.5 w-3.5"}),"Answer"]}),t.jsxs(L,{type:"button",intent:"destructive-soft",size:"sm","aria-label":"Dismiss",onClick:n=>{n.stopPropagation(),e.onDismiss(s)},children:[t.jsx(Vt,{className:"h-3.5 w-3.5"}),"Dismiss"]})]}):t.jsx("span",{className:"text-xs leading-5 text-slate-600",children:s.answer??"—"})},{id:"actions",label:"",width:aa,layout:{hideable:!1},filter:!1,sort:!1,card:{role:"actions"},renderCell:s=>t.jsx(Ns,{actions:as(s,e)})}]}const os={human_authored:"Human authored",human_answered:"Human answered",fk_lookup_sampled:"Foreign key lookup",value_sampled:"Sampled values",name_pattern_only:"Name pattern only",unresolved:"Unresolved"},ft={open:"Open",answered:"Answered",dismissed:"Dismissed"},v=e=>e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"),rs=e=>e.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")||"x",is=e=>`${e.objectType.toLowerCase()}-${rs(e.objectName)}`,ue=e=>e===null?"—":`${Math.round(e*100)}%`,Qe=e=>{const s=new Date(e);return Number.isNaN(s.getTime())?e:s.toLocaleString("en-GB",{year:"numeric",month:"short",day:"2-digit",hour:"2-digit",minute:"2-digit"})},ze=e=>e===null?"neutral":e>=.8?"good":e>=.5?"warn":"bad",Et=(e,s)=>{const n=e.generatedAt.slice(0,10);return`db-doc-${rs(e.dataSourceName)}-${n}.${s}`},kt=(e,s,n)=>{const a=new Blob([e],{type:n}),r=URL.createObjectURL(a),o=document.createElement("a");o.href=r,o.download=s,o.rel="noopener",o.style.display="none",document.body.appendChild(o),o.click(),document.body.removeChild(o),URL.revokeObjectURL(r)},ra={good:"High confidence",warn:"Medium confidence",bad:"Low confidence",neutral:"No enrichment yet"},ls=e=>{const s=[e.objectName,e.purpose??""];for(const n of e.columns){s.push(n.name,n.dataType,n.meaning??"");for(const a of n.valueGlossary??[])s.push(a.value,a.meaning)}for(const n of e.relations)s.push(n.fromColumn,n.toTable,n.toColumn,n.intent);return s.join(" ").toLowerCase()},cs=e=>[e.objectName,e.columnName??"",xe[e.kind],ft[e.status],e.question,e.answer??""].join(" ").toLowerCase(),ia=e=>!e.valueGlossary||e.valueGlossary.length===0?"":`<div class="glossary">${e.valueGlossary.map(n=>`<span class="chip"><code>${v(n.value)}</code> ${v(n.meaning)}</span>`).join("")}</div>`,la=e=>`
    <div class="table-scroll">
      <table class="columns-table">
        <thead>
          <tr><th>Column</th><th>Type</th><th>Meaning</th><th>Confidence</th></tr>
        </thead>
        <tbody>${e.columns.map(n=>{const a=ze(n.confidence);return`
      <tr>
        <td class="col-name"><code>${v(n.name)}</code>${n.isPrimaryKey?'<span class="pk-badge" title="Primary key">PK</span>':""}</td>
        <td class="col-type"><code>${v(n.dataType)}</code></td>
        <td class="col-meaning">
          ${n.meaning?v(n.meaning):'<span class="muted">Not documented yet</span>'}
          ${ia(n)}
        </td>
        <td class="col-confidence">
          <div class="confidence-badge tone-${a}">${ue(n.confidence)}</div>
          ${n.confidenceBasis?`<div class="basis-label">${v(os[n.confidenceBasis])}</div>`:""}
        </td>
      </tr>`}).join("")||'<tr><td colspan="4" class="muted">No columns.</td></tr>'}</tbody>
      </table>
    </div>`,ca=e=>e.relations.length===0?"":`<div class="relations"><h3>Relationships</h3><ul>${e.relations.map(n=>`<li><code>${v(n.fromColumn)}</code><span class="arrow">→</span><code>${v(n.toTable)}.${v(n.toColumn)}</code><span class="relation-intent">${v(n.intent)}</span></li>`).join("")}</ul></div>`,ds='<a class="back-link" href="#doc-top">↑ Back to top</a>',At=(e,s)=>{const n=ze(e.confidence),a=e.confidence===null?0:Math.round(e.confidence*100);return`
    <article class="item-card ${e.objectType==="TABLE"?"kind-table":"kind-view"}" id="${is(e)}" data-object-section data-search="${v(ls(e))}">
      <div class="item-head">
        <span class="item-id">${s}</span>
        <h3 class="item-title">${v(e.objectName)}</h3>
        <span class="item-type-badge">${e.objectType}</span>
      </div>
      <p class="item-desc">${e.purpose?v(e.purpose):'<span class="muted">No documented purpose yet.</span>'}</p>
      <div class="confidence-row" title="${ra[n]}">
        <div class="confidence-bar"><div class="confidence-bar-fill tone-${n}" style="width:${a}%"></div></div>
        <span class="pill tone-${n}">${ue(e.confidence)}</span>
      </div>
      ${la(e)}
      ${ca(e)}
      <div class="item-tags">
        ${e.sourceOfTruth?`<span class="pill tag-outline">${e.sourceOfTruth}</span>`:""}
        <span class="pill tag-outline">${e.columns.length} column${e.columns.length===1?"":"s"}</span>
        ${ds}
      </div>
    </article>`},da=(e,s)=>`
    <article class="item-card kind-question" id="q-${e.id}" data-question-row data-search="${v(cs(e))}">
      <div class="item-head">
        <span class="item-id">${s}</span>
        <h3 class="item-title">${v(e.question)}</h3>
      </div>
      <p class="item-desc">
        <code>${v(e.objectName)}${e.columnName?`.${v(e.columnName)}`:""}</code>
        <span class="muted"> · ${v(xe[e.kind])}</span>
      </p>
      ${e.reason.length>0?`<ul class="reason-list">${e.reason.map(n=>`<li>${v(n)}</li>`).join("")}</ul>`:""}
      ${e.answer?`<p class="answer-note">${v(e.answer)}</p>`:""}
      <div class="item-tags">
        <span class="pill status-${e.status}">${ft[e.status]}</span>
        <span class="pill tag-outline">${v(xe[e.kind])}</span>
        ${ds}
      </div>
    </article>`,at=e=>e.count===0?"":`
    <section class="tier"${e.anchorId?` id="${e.anchorId}"`:""}>
      <div class="tier-head">
        <span class="tier-dot" style="background:${e.dotColor}"></span>
        <h2>${e.title}</h2>
        <span class="pill tag-outline">${e.count} item${e.count===1?"":"s"}</span>
      </div>
      <p class="tier-desc">${e.description}</p>
      <div class="item-card-list">${e.bodyHtml}</div>
    </section>`,Tt=e=>e.map(s=>{const n=ze(s.confidence);return`
      <li class="tree-item" data-toc-object data-search="${v(ls(s))}">
        <a class="tree-link" href="#${is(s)}">
          <span class="tree-dot tone-${n}" aria-hidden="true"></span>
          <span class="tree-name">${v(s.objectName)}</span>
        </a>
      </li>`}).join(""),ua=e=>e.map((s,n)=>{const a=s.status==="open"?"warn":s.status==="answered"?"good":"neutral",r=`Q${n+1} · ${s.objectName}${s.columnName?`.${s.columnName}`:""}`;return`
      <li class="tree-item" data-toc-object data-search="${v(cs(s))}">
        <a class="tree-link" href="#q-${s.id}">
          <span class="tree-dot tone-${a}" aria-hidden="true"></span>
          <span class="tree-name">${v(r)}</span>
        </a>
      </li>`}).join(""),ot=e=>e.count===0?"":`
    <details class="tree-group" open>
      <summary>
        <span class="tree-group-dot" style="background:${e.groupColor}" aria-hidden="true"></span>
        <span class="tree-group-title">${e.title}</span>
        <span class="tree-group-count">${e.count}</span>
        <span class="tree-chevron" aria-hidden="true"></span>
      </summary>
      <ul class="tree-list">${e.bodyHtml}</ul>
    </details>`,ma=e=>{const s=e.objects.filter(a=>a.objectType==="TABLE"),n=e.objects.filter(a=>a.objectType==="VIEW");return[ot({groupColor:"var(--accent)",title:"Tables",count:s.length,bodyHtml:Tt(s)}),ot({groupColor:"var(--accent2)",title:"Views",count:n.length,bodyHtml:Tt(n)}),ot({groupColor:"var(--warn)",title:"Ambiguities",count:e.questions.length,bodyHtml:ua(e.questions)})].join("")},pa=()=>`
(function () {
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var input = document.getElementById('search-input');
  var countEl = document.getElementById('search-count');
  var tocItems = Array.prototype.slice.call(document.querySelectorAll('[data-toc-object]'));
  var treeGroups = Array.prototype.slice.call(document.querySelectorAll('.tree-group'));
  var sections = Array.prototype.slice.call(document.querySelectorAll('[data-object-section]'));
  var questionRows = Array.prototype.slice.call(document.querySelectorAll('[data-question-row]'));
  var total = tocItems.length;

  function applyFilter() {
    var query = input ? input.value.trim().toLowerCase() : '';
    var visible = 0;
    tocItems.forEach(function (li) {
      var match = !query || (li.getAttribute('data-search') || '').indexOf(query) !== -1;
      li.style.display = match ? '' : 'none';
      if (match) visible += 1;
    });
    sections.forEach(function (section) {
      var match = !query || (section.getAttribute('data-search') || '').indexOf(query) !== -1;
      section.style.display = match ? '' : 'none';
    });
    questionRows.forEach(function (row) {
      var match = !query || (row.getAttribute('data-search') || '').indexOf(query) !== -1;
      row.style.display = match ? '' : 'none';
    });
    treeGroups.forEach(function (group) {
      var items = Array.prototype.slice.call(group.querySelectorAll('.tree-item'));
      var anyVisible = items.some(function (li) { return li.style.display !== 'none'; });
      group.style.display = anyVisible ? '' : 'none';
    });
    if (countEl) {
      countEl.textContent = query ? (visible + ' / ' + total + ' match' + (visible === 1 ? '' : 'es')) : (total + ' total');
    }
  }

  if (input) {
    input.addEventListener('input', applyFilter);
    document.addEventListener('keydown', function (event) {
      if (event.key === '/' && document.activeElement !== input) {
        event.preventDefault();
        input.focus();
      }
    });
    applyFilter();
  }

  document.addEventListener('click', function (event) {
    var anchor = event.target.closest ? event.target.closest('a[href^="#"]') : null;
    if (!anchor) return;
    var id = anchor.getAttribute('href').slice(1);
    var target = id ? document.getElementById(id) : null;
    if (target) {
      event.preventDefault();
      target.scrollIntoView(reduceMotion ? { block: 'start' } : { block: 'start', behavior: 'smooth' });
    }
  });

  var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.tree-link[href^="#"]'));
  var linkByTarget = {};
  tocLinks.forEach(function (a) { linkByTarget[a.getAttribute('href').slice(1)] = a; });
  var observedSections = Array.prototype.slice.call(document.querySelectorAll('main [id]'));
  if ('IntersectionObserver' in window && observedSections.length) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = linkByTarget[entry.target.id];
        if (!link || !entry.isIntersecting) return;
        tocLinks.forEach(function (l) { l.classList.remove('active'); });
        link.classList.add('active');
      });
    }, { rootMargin: '-15% 0px -70% 0px', threshold: 0 });
    observedSections.forEach(function (section) { observer.observe(section); });
  }
})();
`,ha=e=>{const s=`${e.dataSourceName} — Database Documentation`,n=e.objects.filter(f=>f.objectType==="TABLE"),a=e.objects.filter(f=>f.objectType==="VIEW"),r=e.tablesTotal>0?e.tablesEnriched/e.tablesTotal:null,o=ze(e.overallConfidence),c=f=>`var(--${f})`,u=at({dotColor:"var(--accent)",title:"Tables",description:"Base tables — the source of truth for this database.",count:n.length,bodyHtml:n.map((f,N)=>At(f,`T${N+1}`)).join("")}),S=at({dotColor:"var(--good)",title:"Views",description:"Derived views built on top of the tables above.",count:a.length,bodyHtml:a.map((f,N)=>At(f,`V${N+1}`)).join("")}),w=at({dotColor:"var(--warn)",title:"Ambiguities & Open Questions",description:"Left unresolved by automatic enrichment — each one needs a human answer.",count:e.questions.length,anchorId:"open-questions",bodyHtml:e.questions.map((f,N)=>da(f,`Q${N+1}`)).join("")});return`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${v(s)}</title>
<style>
  :root {
    --bg: #ffffff; --surface: #fafaf9; --line: #ebeae5; --ink: #14161a; --ink-soft: #686e78;
    --accent: #3654d6; --accent-soft: #ebeefb; --accent2: #7c3aed; --accent2-soft: #f1eafd;
    --good: #0f8f6c; --good-bg: #e7f5ef; --warn: #b4650d; --warn-bg: #fbeedd; --bad: #d33b2c; --bad-bg: #fbe7e3; --neutral: #7a756b; --neutral-bg: #f0eee8;
    --font-sans: -apple-system, 'Segoe UI', 'Helvetica Neue', Roboto, Arial, sans-serif;
    --font-mono: ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, 'Roboto Mono', monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #101114; --surface: #1a1c20; --ink: #ece9e2; --ink-soft: #9a978d; --line: #2b2d32;
      --accent: #86a0f2; --accent-soft: #1d2646; --accent2: #b79bf5; --accent2-soft: #271f3d;
      --good: #52c9a0; --good-bg: #12281f; --warn: #e5a957; --warn-bg: #332510; --bad: #ef7a6a; --bad-bg: #3a1d18; --neutral: #a69f91; --neutral-bg: #232019;
    }
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
  body {
    margin: 0; background: var(--bg); color: var(--ink); overflow-x: hidden;
    font-family: var(--font-sans); font-size: 14.5px; line-height: 1.65; font-weight: 440;
  }
  h1, h2, h3 { font-family: var(--font-sans); color: var(--ink); text-wrap: balance; letter-spacing: -0.015em; }
  code { font-family: var(--font-mono); font-size: 0.86em; background: var(--surface); padding: 0.12em 0.4em; border-radius: 5px; overflow-wrap: anywhere; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  a:focus-visible, button:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .muted { color: var(--ink-soft); }

  .layout { display: grid; grid-template-columns: 272px 1fr; max-width: 1240px; margin: 0 auto; min-height: 100vh; }
  .sidebar {
    position: sticky; top: 0; align-self: start; height: 100vh; overflow-y: auto;
    border-right: 1px solid var(--line); background: var(--surface); padding: 22px 16px; display: flex; flex-direction: column; gap: 16px;
  }
  .brand-row { display: flex; align-items: center; gap: 9px; }
  .brand-mark {
    display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 7px; flex-shrink: 0;
    background: var(--accent); color: var(--bg); font-family: var(--font-mono); font-weight: 700; font-size: 10.5px;
  }
  .brand-name { font-weight: 700; font-size: 13px; line-height: 1.3; overflow-wrap: anywhere; }
  .brand-sub { font-size: 10.5px; color: var(--ink-soft); }
  .sidebar input#search-input {
    width: 100%; font: inherit; font-size: 13px; padding: 8px 10px; border-radius: 8px;
    border: 1px solid var(--line); background: var(--bg); color: var(--ink);
  }
  .sidebar input#search-input::placeholder { color: var(--ink-soft); }
  .search-count { font-size: 10.5px; color: var(--ink-soft); font-variant-numeric: tabular-nums; padding-left: 2px; }

  .tree-group { border: none; }
  .tree-group summary {
    list-style: none; cursor: pointer; display: flex; align-items: center; gap: 8px;
    padding: 6px 6px; border-radius: 6px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-soft);
  }
  .tree-group summary::-webkit-details-marker { display: none; }
  .tree-group summary:hover { background: var(--bg); }
  .tree-group-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .tree-group-title { flex: 1; }
  .tree-group-count { font-variant-numeric: tabular-nums; }
  .tree-chevron::before { content: '▸'; color: var(--ink-soft); font-size: 10px; }
  .tree-group[open] .tree-chevron::before { content: '▾'; }
  .tree-list { list-style: none; margin: 2px 0 6px; padding: 0 0 0 14px; border-left: 1px solid var(--line); }
  .tree-item { margin: 0; }
  .tree-link { display: flex; align-items: center; gap: 7px; padding: 5px 8px; border-radius: 6px; font-size: 12.5px; color: var(--ink); }
  .tree-link:hover { background: var(--bg); text-decoration: none; }
  .tree-link.active { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
  .tree-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .tree-dot.tone-good { background: var(--good); }
  .tree-dot.tone-warn { background: var(--warn); }
  .tree-dot.tone-bad { background: var(--bad); }
  .tree-dot.tone-neutral { background: var(--neutral); }
  .tree-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .doc { max-width: 860px; padding: 48px 48px 110px; overflow-x: hidden; }
  .eyebrow { margin: 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--accent); }
  .doc-header h1 { margin: 10px 0 0; font-size: 34px; font-weight: 800; overflow-wrap: anywhere; }
  .intro { max-width: 68ch; margin: 14px 0 0; color: var(--ink-soft); font-size: 15px; overflow-wrap: anywhere; }
  .intro strong { color: var(--ink); font-weight: 700; }

  #overview { margin: 40px 0 0; }
  .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .stat-card { border: 1px solid var(--line); border-radius: 8px; padding: 15px 16px; background: var(--surface); }
  .stat-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-soft); margin-bottom: 7px; }
  .stat-value { font-size: 24px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .stat-sub { font-size: 11px; color: var(--ink-soft); margin-top: 4px; }

  .tier { margin: 48px 0 0; }
  .tier-head { display: flex; align-items: center; gap: 10px; }
  .tier-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
  .tier-head h2 { margin: 0; font-size: 19px; font-weight: 700; }
  .tier-desc { margin: 5px 0 0 19px; color: var(--ink-soft); font-size: 12.5px; }
  .item-card-list { display: flex; flex-direction: column; gap: 14px; margin-top: 16px; }

  .item-card {
    border: 1px solid var(--line); border-left: 3px solid var(--line); border-radius: 8px;
    background: var(--bg); padding: 20px 22px; scroll-margin-top: 76px; overflow-wrap: anywhere;
  }
  .item-card.kind-table { border-left-color: var(--accent); }
  .item-card.kind-view { border-left-color: var(--accent2); }
  .item-card.kind-question { border-left-color: var(--warn); }
  .item-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; }
  .item-id { font-family: var(--font-mono); font-size: 11px; font-weight: 700; }
  .kind-table .item-id { color: var(--accent); }
  .kind-view .item-id { color: var(--accent2); }
  .kind-question .item-id { color: var(--warn); }
  .item-title { margin: 0; font-size: 16.5px; font-weight: 700; flex: 1; min-width: 0; }
  .item-type-badge { font-family: var(--font-mono); font-size: 9.5px; font-weight: 700; letter-spacing: 0.03em; padding: 3px 9px; border-radius: 999px; }
  .kind-table .item-type-badge { background: var(--accent-soft); color: var(--accent); }
  .kind-view .item-type-badge { background: var(--accent2-soft); color: var(--accent2); }
  .item-desc { color: var(--ink-soft); max-width: 70ch; margin: 4px 0 14px; font-size: 13px; }
  .back-link { margin-left: auto; font-size: 11px; color: var(--ink-soft); white-space: nowrap; }
  .back-link:hover { color: var(--accent); text-decoration: none; }
  .confidence-row { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
  .confidence-bar { flex: 0 0 120px; height: 6px; border-radius: 999px; background: var(--surface); overflow: hidden; }
  .confidence-bar-fill { height: 100%; border-radius: 999px; }
  .confidence-bar-fill.tone-good { background: var(--good); }
  .confidence-bar-fill.tone-warn { background: var(--warn); }
  .confidence-bar-fill.tone-bad { background: var(--bad); }
  .confidence-bar-fill.tone-neutral { background: var(--neutral); }
  .pill { display: inline-block; font-size: 11.5px; font-weight: 700; padding: 3px 10px; border-radius: 999px; font-variant-numeric: tabular-nums; }
  .pill.tone-good { color: var(--good); background: var(--good-bg); }
  .pill.tone-warn { color: var(--warn); background: var(--warn-bg); }
  .pill.tone-bad { color: var(--bad); background: var(--bad-bg); }
  .pill.tone-neutral { color: var(--neutral); background: var(--neutral-bg); }
  .pill.tag-outline { color: var(--ink-soft); background: var(--bg); border: 1px solid var(--line); font-weight: 600; }
  .pill.status-open { color: var(--warn); background: var(--warn-bg); }
  .pill.status-answered { color: var(--good); background: var(--good-bg); }
  .pill.status-dismissed { color: var(--neutral); background: var(--neutral-bg); }
  .item-tags { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 14px; }

  .table-scroll { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; }
  .columns-table { width: 100%; border-collapse: collapse; min-width: 500px; }
  .columns-table th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-soft); background: var(--surface); border-bottom: 1px solid var(--line); padding: 9px 12px; }
  .columns-table td { padding: 11px 12px; border-bottom: 1px solid var(--line); vertical-align: top; overflow-wrap: break-word; }
  .columns-table td code { overflow-wrap: anywhere; }
  .columns-table tbody tr:last-child td { border-bottom: none; }
  .columns-table tbody tr:hover { background: var(--accent-soft); }
  .col-name { white-space: nowrap; }
  .col-confidence { width: 76px; text-align: center; white-space: normal; }
  .pk-badge { margin-left: 6px; font-family: var(--font-mono); font-size: 9.5px; font-weight: 700; color: var(--warn); background: var(--warn-bg); border-radius: 4px; padding: 1px 5px; vertical-align: middle; }
  .confidence-badge {
    display: flex; align-items: center; justify-content: center; margin: 0 auto;
    width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
    font-size: 10.5px; font-weight: 700; font-variant-numeric: tabular-nums;
  }
  .confidence-badge.tone-good { color: var(--good); background: var(--good-bg); }
  .confidence-badge.tone-warn { color: var(--warn); background: var(--warn-bg); }
  .confidence-badge.tone-bad { color: var(--bad); background: var(--bad-bg); }
  .confidence-badge.tone-neutral { color: var(--neutral); background: var(--neutral-bg); }
  .basis-label { font-size: 10px; color: var(--ink-soft); margin-top: 5px; text-align: center; }
  .glossary { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 5px; }
  .chip { font-size: 11.5px; background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 3px 9px; color: var(--ink-soft); line-height: 1.4; }
  .chip code { background: none; padding: 0; color: var(--ink); }

  .relations { margin-top: 18px; }
  .relations h3 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-soft); margin: 0 0 8px; }
  .relations ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .relations li { display: flex; align-items: center; gap: 8px; font-size: 12.5px; flex-wrap: wrap; }
  .arrow { color: var(--ink-soft); }
  .relation-intent { color: var(--ink-soft); }

  .answer-note { margin: 8px 0 0; padding: 10px 12px; border-radius: 8px; background: var(--good-bg); color: var(--ink); font-size: 12.5px; }
  .reason-list { margin: 6px 0 0; padding-left: 16px; font-size: 12px; color: var(--ink-soft); }

  .doc-footer { margin-top: 56px; padding-top: 18px; border-top: 1px solid var(--line); color: var(--ink-soft); font-size: 11.5px; display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }

  @media (max-width: 900px) {
    .layout { grid-template-columns: 1fr; }
    .sidebar { position: static; height: auto; border-right: none; border-bottom: 1px solid var(--line); }
  }
  @media (max-width: 640px) {
    .doc { padding: 32px 20px 80px; }
    .doc-header h1 { font-size: 26px; }
    .stat-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media print {
    .sidebar { display: none; }
    .layout { grid-template-columns: 1fr; }
    .item-card { break-inside: avoid; }
    a { color: inherit; text-decoration: none; }
  }
</style>
</head>
<body>
<div class="layout">
  <nav class="sidebar" aria-label="Table of contents">
    <div class="brand-row">
      <span class="brand-mark">DB</span>
      <div>
        <div class="brand-name">${v(e.dataSourceName)}</div>
        <div class="brand-sub">${v(e.dataSourceType)}</div>
      </div>
    </div>
    <div>
      <input id="search-input" type="search" placeholder="Search… ( / )" aria-label="Search documentation" autocomplete="off">
      <div id="search-count" class="search-count">${e.tablesTotal} total</div>
    </div>
    ${ma(e)}
  </nav>
  <main class="doc">
  <header class="doc-header" id="doc-top">
    <p class="eyebrow">AppEndO · Database Documentation</p>
    <h1>${v(e.dataSourceName)}</h1>
    <p class="intro">
      A living reference for the <strong>${v(e.dataSourceType)}</strong> database behind ${v(e.dataSourceName)} —
      <strong>${e.tablesEnriched} of ${e.tablesTotal}</strong> objects enriched so far
      (<strong>${ue(e.overallConfidence)}</strong> average confidence)${e.openQuestionCount>0?`, with <strong>${e.openQuestionCount}</strong> open question${e.openQuestionCount===1?"":"s"} still needing a human answer`:""}.
      Generated ${Qe(e.generatedAt)}.
    </p>
  </header>

  <section id="overview">
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">Tables &amp; Views</div>
        <div class="stat-value" style="color:var(--accent)">${e.tablesTotal}</div>
        <div class="stat-sub">${n.length} table${n.length===1?"":"s"} · ${a.length} view${a.length===1?"":"s"}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Enriched</div>
        <div class="stat-value" style="color:var(--good)">${e.tablesEnriched} / ${e.tablesTotal}</div>
        <div class="stat-sub">${ue(r)} coverage</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Confidence</div>
        <div class="stat-value" style="color:${c(o)}">${ue(e.overallConfidence)}</div>
        <div class="stat-sub">across enriched columns</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Open Questions</div>
        <div class="stat-value" style="color:${e.openQuestionCount>0?"var(--warn)":"var(--neutral)"}">${e.openQuestionCount}</div>
        <div class="stat-sub">need human input</div>
      </div>
    </div>
  </section>

  ${u}
  ${S}
  ${w}

  <footer class="doc-footer">
    <span>Generated by AppEndO DB Enricher on ${Qe(e.generatedAt)}.</span>
    <span>Press <code>/</code> to search.</span>
  </footer>
  </main>
</div>
<script>${pa()}<\/script>
</body>
</html>`},be=e=>e.replace(/\|/g,"\\|").replace(/\n/g," "),Dt=e=>e.toLowerCase().trim().replace(/[^\w\s-]/g,"").replace(/\s+/g,"-"),fa=e=>{if(e.columns.length===0)return`_No columns._
`;const s=`| Column | Type | Meaning | Confidence |
|---|---|---|---|
`,n=e.columns.map(a=>{const r=`${a.name}${a.isPrimaryKey?" `PK`":""}`,o=a.valueGlossary&&a.valueGlossary.length>0?` (${a.valueGlossary.map(S=>`\`${S.value}\`=${S.meaning}`).join(", ")})`:"",c=`${a.meaning?be(a.meaning):"—"}${o}`,u=`${ue(a.confidence)}${a.confidenceBasis?` (${os[a.confidenceBasis]})`:""}`;return`| ${be(r)} | \`${be(a.dataType)}\` | ${be(c)} | ${u} |`}).join(`
`);return`${s}${n}
`},ba=e=>{const s=[];if(s.push(`## ${e.objectName} (${e.objectType})`),s.push(""),s.push(e.purpose?e.purpose:"_No documented purpose yet._"),s.push(""),s.push(`**Confidence:** ${ue(e.confidence)}${e.sourceOfTruth?` · **Source:** ${e.sourceOfTruth}`:""} · **Columns:** ${e.columns.length}`),s.push(""),s.push(fa(e)),e.relations.length>0){s.push("**Relationships**"),s.push("");for(const n of e.relations)s.push(`- \`${n.fromColumn}\` → \`${n.toTable}.${n.toColumn}\` — ${n.intent}`);s.push("")}return s.join(`
`)},xa=e=>{if(e.length===0)return"";const s=`| Status | Object | Kind | Question | Answer |
|---|---|---|---|---|
`,n=e.map(a=>{const r=`${a.objectName}${a.columnName?`.${a.columnName}`:""}`;return`| ${ft[a.status]} | \`${be(r)}\` | ${xe[a.kind]} | ${be(a.question)} | ${a.answer?be(a.answer):"—"} |`}).join(`
`);return`## Ambiguities & Open Questions

${s}${n}
`},ga=e=>{const s=[];s.push(`# ${e.dataSourceName} — Database Documentation`),s.push(""),s.push(`${e.dataSourceType} database documentation · generated ${Qe(e.generatedAt)}`),s.push(""),s.push("## Overview"),s.push(""),s.push(`- **Tables / Views:** ${e.tablesTotal}`),s.push(`- **Enriched:** ${e.tablesEnriched}`),s.push(`- **Overall confidence:** ${ue(e.overallConfidence)}`),s.push(`- **Open questions:** ${e.openQuestionCount}`),s.push(""),s.push("## Contents"),s.push("");for(const n of e.objects){const a=`${n.objectName} (${n.objectType})`;s.push(`- [${n.objectName}](#${Dt(a)}) (${n.objectType})`)}return e.questions.length>0&&s.push(`- [Ambiguities & Open Questions](#${Dt("Ambiguities & Open Questions")})`),s.push(""),s.push(e.objects.map(ba).join(`
`)),s.push(xa(e.questions)),s.push(`_Generated by AppEndO DB Enricher on ${Qe(e.generatedAt)}._`),s.join(`
`)},va=({dataSource:e,onClose:s})=>{const n=(e==null?void 0:e.id)??"",a=!!e,[r,o]=i.useState("html"),c=Un(n,{enabled:a}),u=c.data,S=i.useMemo(()=>u?ha(u):"",[u]),w=i.useMemo(()=>u?ga(u):"",[u]);if(!a||!e)return null;const f=()=>{u&&kt(S,Et(u,"html"),"text/html;charset=utf-8")},N=()=>{u&&kt(w,Et(u,"md"),"text/markdown;charset=utf-8")};return t.jsx(Ae,{size:"maximized",title:t.jsx("span",{className:"truncate",children:`Documentation — "${e.name}"`}),ariaLabel:`Documentation for ${e.name}`,gradient:!1,onClose:s,onBackdropClick:s,bodyOuterClassName:"flex min-h-0 flex-1 flex-col",bodyClassName:"flex min-h-0 flex-1 flex-col overflow-hidden p-0",headerExtra:u?t.jsxs("div",{className:"flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5",children:[t.jsx("button",{type:"button",onClick:()=>o("html"),className:`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${r==="html"?"bg-white text-violet-700 shadow-sm":"text-slate-500 hover:text-slate-700"}`,children:"HTML preview"}),t.jsx("button",{type:"button",onClick:()=>o("markdown"),className:`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${r==="markdown"?"bg-white text-violet-700 shadow-sm":"text-slate-500 hover:text-slate-700"}`,children:"Markdown"})]}):null,footer:t.jsxs("div",{className:"flex items-center gap-2",children:[t.jsx(L,{intent:"cancel",size:"sm",onClick:s,children:"Close"}),t.jsxs(L,{intent:"secondary",size:"sm",disabled:!u,onClick:N,children:[t.jsx(xn,{className:"h-3.5 w-3.5"}),"Save as Markdown"]}),t.jsxs(L,{intent:"primary",size:"sm",disabled:!u,onClick:f,children:[t.jsx(gn,{className:"h-3.5 w-3.5"}),"Save as HTML"]})]}),children:c.isLoading?t.jsxs("div",{className:"flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-sm text-slate-500",children:[t.jsx(ut,{className:"h-5 w-5 animate-spin text-violet-500"}),"Gathering schema knowledge and building the documentation…"]}):c.isError?t.jsx("div",{className:"p-4",children:t.jsx(lt,{message:"Failed to build documentation.",detail:we(c.error),onRetry:()=>{c.refetch()},isRetrying:c.isFetching})}):r==="html"?t.jsx("iframe",{title:`Documentation preview for ${e.name}`,srcDoc:S,sandbox:"allow-scripts",className:"h-full min-h-0 w-full flex-1 border-0"}):t.jsx("pre",{className:"h-full min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-700",children:w})})},ya="inline-flex h-5 items-center rounded px-2 text-[10px] font-semibold uppercase tracking-wide leading-none",us=ae(["human_authored","human_answered","fk_lookup_sampled","value_sampled","name_pattern_only","unresolved"]),wa={human_authored:1,human_answered:1,fk_lookup_sampled:.9,value_sampled:.7,name_pattern_only:.4,unresolved:0},ms=P({value:l(),meaning:l()}).strict(),Sa=P({columnName:l().min(1),meaning:l(),confidence:y().min(0).max(1),confidenceBasis:us,valueGlossary:W(ms).optional(),sampledAt:l().optional()}).strict(),Ca=P({fromColumn:l().min(1),toTable:l().min(1),toColumn:l().min(1),intent:l(),confidence:y().min(0).max(1)}).strict(),ps=ae(["HUMAN","INFERRED","MIXED"]);P({dataSourceId:l().min(1),objectType:ae(["TABLE","VIEW"]),objectName:l().min(1),tablePurpose:l().nullable().optional(),tableConfidence:y().min(0).max(1).nullable().optional(),columns:W(Sa).default([]),relations:W(Ca).default([]),sourceOfTruth:ps.default("INFERRED"),lastEnrichedRunId:y().nullable().optional(),staleSince:l().nullable().optional(),updatedAt:l().nullable().optional()}).strict();const hs=ae(["FULL","TABLES"]),ja=ae(["pending","running","completed","failed","cancelled"]);P({dataSourceId:l().min(1),scope:hs.default("FULL"),tables:W(l().min(1)).optional(),modelId:l().min(1).optional()}).strict();const Na=P({at:l(),message:l()}).strict(),Ea=P({id:y(),dataSourceId:l(),scope:hs,status:ja,jobId:y().nullable(),modelId:l().nullable(),tablesTotal:y(),tablesProcessed:y(),columnsResolved:y(),columnsAmbiguous:y(),questionsCreated:y(),overallConfidence:y().nullable(),progressLog:W(Na).default([]),errorMessage:l().nullable(),startedAt:l().nullable(),finishedAt:l().nullable(),createdAt:l().nullable()}).strict();P({dataSourceId:l(),tablesTotal:y(),tablesEnriched:y(),coverage:y(),overallConfidence:y().nullable(),openQuestionCount:y(),columnsResolved:y(),columnsAmbiguous:y(),humanShare:y(),enrichedAt:l().nullable(),lastRun:Ea.nullable()}).strict();const ka=ae(["column_meaning","value_glossary","relation_intent","table_purpose"]),Aa=ae(["open","answered","dismissed"]),Ta=P({id:y(),dataSourceId:l(),runId:y().nullable(),objectType:ae(["TABLE","VIEW"]),objectName:l(),columnName:l().nullable(),kind:ka,question:l(),reason:W(l()).default([]),candidates:W(l()).default([]),status:Aa,answer:l().nullable(),answeredBy:y().nullable(),answeredAt:l().nullable(),createdAt:l().nullable()}).strict();P({answer:l().min(1)}).strict();P({modelId:l().min(1).optional()}).strict();P({}).strict();const Da=P({name:l().min(1),dataType:l(),isPrimaryKey:on(),meaning:l().nullable(),confidence:y().min(0).max(1).nullable(),confidenceBasis:us.nullable(),valueGlossary:W(ms).optional()}).strict(),$a=P({fromColumn:l().min(1),toTable:l().min(1),toColumn:l().min(1),intent:l(),confidence:y().min(0).max(1)}).strict(),La=P({objectType:ae(["TABLE","VIEW"]),objectName:l().min(1),purpose:l().nullable(),confidence:y().min(0).max(1).nullable(),sourceOfTruth:ps.nullable(),columns:W(Da).default([]),relations:W($a).default([])}).strict();P({dataSourceId:l().min(1),dataSourceName:l(),dataSourceType:l(),generatedAt:l(),tablesTotal:y(),tablesEnriched:y(),overallConfidence:y().min(0).max(1).nullable(),openQuestionCount:y(),objects:W(La).default([]),questions:W(Ta).default([])}).strict();const $t=e=>`${Math.round(e*100)}%`,_a=[{basis:"human_answered",title:"Answer open questions",detail:"Your answers become the source of truth for that table or column and score 100%."},{basis:"human_authored",title:"Write meanings yourself",detail:"Human-authored table purpose and column meanings also score 100%."},{basis:"fk_lookup_sampled",title:"Keep foreign keys intact",detail:"The enricher samples lookup tables through declared FKs and scores those columns at 90%."},{basis:"value_sampled",title:"Let the enricher sample values",detail:"Distinct stored values and glossaries raise a column to 70% when names alone are not enough."},{basis:"name_pattern_only",title:"Avoid name-only guesses",detail:"Columns inferred only from the identifier sit at 40%. Stronger evidence replaces this floor."},{basis:"unresolved",title:"Clear unresolved columns",detail:"Ambiguous columns score 0% until a later run or a human answer fills them in."}],Ia=({dataSource:e,onClose:s,onOpenQuestions:n})=>{const a=!!e,r=ht((e==null?void 0:e.id)??"",{enabled:a});if(!a||!e)return null;const o=r.overallConfidence!==null?$t(r.overallConfidence):"—";return t.jsx(Ae,{size:"maximized",title:`Confidence for "${e.name}"`,ariaLabel:`How to raise confidence for ${e.name}`,gradient:!1,onClose:s,onBackdropClick:s,metaBandClassName:"py-2.5",metaBand:t.jsxs("div",{className:"grid w-full min-w-0 flex-1 grid-cols-3 gap-3",children:[t.jsxs("div",{className:"min-w-0",children:[t.jsx("p",{className:"text-[10px] font-semibold uppercase tracking-wide text-emerald-600",children:"Current"}),t.jsx("p",{className:"truncate text-sm font-semibold text-slate-800",children:o})]}),t.jsxs("div",{className:"min-w-0",children:[t.jsx("p",{className:"text-[10px] font-semibold uppercase tracking-wide text-violet-500",children:"Coverage"}),t.jsx("p",{className:"truncate text-sm font-semibold text-slate-800",children:r.tablesTotal>0?`${r.tablesEnriched} / ${r.tablesTotal} tables`:"—"})]}),t.jsxs("div",{className:"min-w-0",children:[t.jsx("p",{className:"text-[10px] font-semibold uppercase tracking-wide text-amber-600",children:"Open questions"}),t.jsx("p",{className:"truncate text-sm font-semibold text-slate-800",children:r.isReady?r.openQuestionCount:"—"})]})]}),footer:t.jsxs(L,{intent:"secondary",size:"sm",onClick:s,children:[t.jsx(Ee,{className:"h-3.5 w-3.5"}),"Close"]}),children:t.jsxs("div",{className:"flex flex-col gap-1",children:[t.jsx(Se,{title:"Score",ink:"accent",hint:"Overall confidence is a column-weighted average of stored table knowledge after the last enrichment run.",children:t.jsx("p",{className:"text-sm leading-relaxed text-slate-600",children:"Each column keeps an evidence basis. The card percentage is the average of those scores, weighted by column count. Stronger evidence on more columns raises the number."})}),t.jsx(Se,{title:"Evidence",ink:"complement",divided:!0,hint:"Replace weaker bases with stronger ones. Unresolved columns pull the average down.",children:t.jsx("ul",{className:"flex flex-col gap-3",children:_a.map(c=>t.jsxs("li",{className:"flex items-start gap-3",children:[t.jsx("span",{className:"w-12 shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-slate-800",children:$t(wa[c.basis])}),t.jsxs("div",{className:"min-w-0 flex-1",children:[t.jsx("p",{className:"text-sm font-semibold text-slate-800",children:c.title}),t.jsx("p",{className:"mt-0.5 text-xs leading-relaxed text-slate-500",children:c.detail})]})]},c.basis))})}),t.jsx(Se,{title:"Next",ink:"contrast",divided:!0,hint:"Human answers move a column to 100% immediately. A fresh AI run can fill remaining name-only and unresolved columns.",children:t.jsxs("div",{className:"flex flex-col gap-3",children:[t.jsx("p",{className:"text-sm leading-relaxed text-slate-600",children:r.openQuestionCount>0?`There are ${r.openQuestionCount} open questions on this data source. Answering them is the fastest way to raise confidence.`:"No open questions right now. Re-run Enrich with AI with a stronger chat model so remaining name-only and unresolved columns can pick up sampled values or lookup evidence."}),r.openQuestionCount>0?t.jsx("div",{children:t.jsxs(L,{intent:"warning",size:"sm",onClick:()=>n(e),children:[t.jsx(Wt,{className:"h-3.5 w-3.5"}),"Open questions"]})}):t.jsx("p",{className:"text-xs font-medium text-slate-500",children:"Use Enrich with AI on the card when you want another automated pass."})]})})]})})},Lt="flex min-h-11 items-center border-t border-slate-100 px-0 py-2.5 text-base leading-5 text-slate-600",Oa=({item:e,questionsHref:s,onOpenQuestions:n,onOpenConfidence:a})=>{const r=ht(e.id),o=kn(r.enrichedAt),c=r.overallConfidence!==null?`${Math.round(r.overallConfidence*100)}% conf.`:"— conf.";return t.jsxs(t.Fragment,{children:[t.jsx("div",{className:Lt,title:r.enrichedAt??void 0,children:t.jsx("span",{className:"min-w-0 truncate font-semibold",children:`Enriched at : ${o||"—"}`})}),t.jsxs("div",{className:`${Lt} justify-between gap-1.5 font-medium`,children:[t.jsx(fe,{content:`${r.tablesEnriched} / ${r.tablesTotal} tables enriched`,children:t.jsxs("span",{className:"inline-flex min-w-0 items-center gap-1 truncate",children:[t.jsx(Re,{className:"h-4 w-4 shrink-0 text-violet-500","aria-hidden":"true"}),r.tablesTotal>0?`${Math.round(r.coverage*100)}%`:"—"]})}),t.jsx(fe,{content:"How to raise knowledge confidence",children:t.jsx("button",{type:"button",onClick:u=>{ye(u),a(e)},className:"min-w-0 truncate font-semibold text-emerald-700 hover:text-emerald-800 hover:underline","aria-label":"How to raise confidence",children:c})}),r.openQuestionCount>0?t.jsx(fe,{content:"Open questions awaiting your input",children:t.jsxs("a",{href:s,onClick:u=>{u.stopPropagation(),!(u.defaultPrevented||u.metaKey||u.ctrlKey||u.shiftKey||u.altKey||u.button!==0)&&(u.preventDefault(),n(e))},className:"min-w-0 truncate font-semibold text-amber-600 hover:text-amber-800 hover:underline","aria-label":`Open ${r.openQuestionCount} questions`,children:[r.openQuestionCount," open Q"]})}):t.jsx("span",{className:"min-w-0 truncate text-slate-400",children:"0 open Q"})]})]})},Qa=e=>e==="connected"?"text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50":"text-rose-600 hover:text-rose-700 hover:bg-rose-50",Ma=({isLoading:e,isError:s,error:n,onRetry:a,isRetrying:r=!1,items:o,testingId:c,onTest:u,onEdit:S,onDelete:w,onEnrich:f,onGenerateDocs:N,resolveQuestionsHref:H,onOpenQuestions:oe,onScroll:T})=>{const[z,I]=i.useState(null);return e?t.jsx("div",{className:"flex h-40 items-center justify-center text-sm font-medium text-slate-400",children:"Loading data sources…"}):s&&n?t.jsx(lt,{message:"Failed to load data sources.",detail:n,onRetry:a,isRetrying:r}):o.length===0?t.jsx("div",{className:"flex h-40 items-center justify-center text-sm font-medium text-slate-400",children:"No data source found."}):t.jsxs("div",{className:"min-h-0 flex-1 overflow-auto",onScroll:T,children:[t.jsx(ks,{className:"grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4",children:o.map(x=>{const b=Ct(x.updated_at,""),G=tt(x.updated_by,""),h=[x.updated_at,G].filter(Boolean).join(" · ");return t.jsxs(As,{isLoading:c===x.id,className:"group relative !px-3 !py-2.5",children:[x.isDefault?t.jsx("div",{className:"absolute end-3 top-3",children:t.jsx("span",{className:`${ya} bg-emerald-100 text-emerald-700`,children:"Default"})}):t.jsx("div",{className:"absolute end-3 top-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",children:t.jsx(fe,{content:"Delete",children:t.jsx("button",{type:"button",onClick:k=>{ye(k),w(x)},className:`${Ze} text-rose-600 hover:text-rose-700 hover:bg-rose-50`,"aria-label":"Delete",children:t.jsx(Ut,{className:"h-3.5 w-3.5"})})})}),t.jsxs("div",{className:"pe-6",children:[t.jsxs("div",{className:"flex items-start gap-2",children:[t.jsx(Cn,{type:x.type,className:"mt-0.5 shrink-0"}),t.jsxs("div",{className:"min-w-0 flex-1",children:[t.jsx("h3",{className:"truncate text-sm font-semibold text-slate-900",title:x.name,children:x.name}),t.jsx("p",{className:"mt-0.5 truncate font-mono text-[11px] leading-snug text-slate-500",title:jt(x),children:jt(x)})]})]}),t.jsx("p",{className:"mt-2 text-xs font-medium text-slate-600",children:x.type}),t.jsxs("div",{className:"mt-2 space-y-0.5 text-[10px] font-mono text-slate-400",children:[t.jsxs("p",{title:`${x.created_at??""} · ${tt(x.created_by)}`,children:[t.jsx("span",{className:"font-semibold text-slate-500",children:"Created"})," ",Ct(x.created_at)," ",t.jsx("span",{className:"text-slate-300","aria-hidden":"true",children:"·"})," ",t.jsx("span",{className:"font-medium text-slate-500",children:tt(x.created_by)})]}),t.jsxs("p",{title:h||void 0,children:[t.jsx("span",{className:"font-semibold text-slate-500",children:"Updated"}),b?t.jsxs(t.Fragment,{children:[" ",b]}):null,b&&G?t.jsxs(t.Fragment,{children:[" ",t.jsx("span",{className:"text-slate-300","aria-hidden":"true",children:"·"})," "]}):null,G?t.jsx("span",{className:"font-medium text-slate-500",children:G}):null]})]})]}),t.jsxs("div",{className:"mt-auto",children:[t.jsx(Oa,{item:x,questionsHref:H(x),onOpenQuestions:oe,onOpenConfidence:I}),t.jsxs("div",{className:"flex items-center justify-between gap-2 border-t border-slate-100 pt-2",children:[t.jsxs("div",{className:"flex min-w-0 items-center gap-1.5",children:[t.jsxs(L,{intent:"secondary",size:"sm",onClick:k=>{ye(k),f(x)},"aria-label":"Enrich with AI",children:[t.jsx(Re,{className:"h-3.5 w-3.5"}),"Enrich"]}),t.jsx(fe,{content:"Generate Documentation",children:t.jsxs(L,{intent:"secondary",size:"sm",onClick:k=>{ye(k),N(x)},"aria-label":"Generate Documentation",children:[t.jsx(vn,{className:"h-3.5 w-3.5"}),"Docs"]})})]}),t.jsxs("div",{className:"flex shrink-0 items-center justify-end",children:[t.jsx(fe,{content:"Test",children:t.jsx("button",{type:"button",onClick:k=>{ye(k),u(x.id)},disabled:c===x.id,className:`${Ze} ${Qa(x.status)}`,"aria-label":"Test",children:t.jsx(mt,{className:"h-3.5 w-3.5"})})}),t.jsx("span",{className:rn,"aria-hidden":"true"}),t.jsx(fe,{content:"Edit",children:t.jsx("button",{type:"button",onClick:k=>{ye(k),S(x)},className:`${Ze} text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50`,"aria-label":"Edit",children:t.jsx(yn,{className:"h-3.5 w-3.5"})})})]})]})]})]},x.id)})}),t.jsx(Ia,{dataSource:z,onClose:()=>I(null),onOpenQuestions:x=>{I(null),oe(x)}})]})},Ra=({error:e,successMessage:s,onDismissError:n,onDismissSuccess:a})=>t.jsxs("div",{className:"fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none",children:[e&&t.jsx("div",{className:"pointer-events-auto min-w-[280px] max-w-[420px] rounded-lg border border-red-200 bg-white shadow-lg p-3",children:t.jsxs("div",{className:"flex items-start gap-2",children:[t.jsx(wn,{className:"w-4 h-4 mt-0.5 text-red-600 shrink-0"}),t.jsx("div",{className:"flex-1 text-xs text-slate-700",children:e}),t.jsx("button",{type:"button",onClick:n,className:"text-indigo-500 hover:text-indigo-700",children:t.jsx(Ee,{className:"w-3.5 h-3.5"})})]})}),s&&t.jsx("div",{className:"pointer-events-auto min-w-[280px] max-w-[420px] rounded-lg border border-emerald-200 bg-white shadow-lg p-3",children:t.jsxs("div",{className:"flex items-start gap-2",children:[t.jsx(Sn,{className:"w-4 h-4 mt-0.5 text-emerald-600 shrink-0"}),t.jsx("div",{className:"flex-1 text-xs text-slate-700",children:s}),t.jsx("button",{type:"button",onClick:a,className:"text-indigo-500 hover:text-indigo-700",children:t.jsx(Ee,{className:"w-3.5 h-3.5"})})]})})]}),Fa={searchInput:"",statusFilter:"open"},fs=[{value:"open",label:"Open"},{value:"answered",label:"Answered"},{value:"dismissed",label:"Dismissed"}];function Pa(e){if(typeof e!="object"||e===null||Array.isArray(e))return null;const s=e,n=typeof s.statusFilter=="string"?s.statusFilter:"open",a=n===qs||fs.some(r=>r.value===n);return{searchInput:typeof s.searchInput=="string"?s.searchInput:"",statusFilter:a?n:"open"}}const qa=(e,s,n,a)=>{const r=a==="asc"?1:-1,o=n==="createdAt"?e.createdAt??"":e[n],c=n==="createdAt"?s.createdAt??"":s[n];return String(o).localeCompare(String(c),void 0,{numeric:!0})*r},Ba=({dataSource:e,active:s,onBack:n})=>{var De,$e,Le;const a=e.id,[r,o]=Ts({listKey:We.dataSourceEnrichmentQuestions,defaultFilters:Fa,sanitize:Pa}),{searchInput:c,statusFilter:u}=r,[S,w]=i.useState(c),{pageSize:f,setPageSize:N,listMode:H,setListMode:oe}=Ds({listKey:We.dataSourceEnrichmentQuestions,defaultPageSize:$s}),[T,z]=i.useState("createdAt"),[I,x]=i.useState("desc"),[b,G]=i.useState(null),[h,k]=i.useState(""),[C,Z]=i.useState(""),[K,se]=i.useState(null),O=ss(a,"all",{enabled:s}),re=Vn(a),ee=Kn(),q=Wn(a),V=!!b&&(b==null?void 0:b.status)==="open",ge=It({enabled:V}),Y=Ot(V),B=i.useMemo(()=>{var d;return(((d=Y.data)==null?void 0:d.models)??[]).filter(A=>Qt(A))},[(De=Y.data)==null?void 0:De.models]),ie=Mt(($e=ge.data)==null?void 0:$e.enabled),j=V&&ie&&(Y.isLoading||B.length>0);i.useEffect(()=>{const d=window.setTimeout(()=>w(c),300);return()=>window.clearTimeout(d)},[c]),i.useEffect(()=>{if(!b){k(""),Z("");return}k(b.answer??""),Z("")},[b]),i.useEffect(()=>{var _,ne;if(!V||C||B.length===0)return;const d=(_=Y.data)==null?void 0:_.defaultModelId,A=(d&&B.some(ce=>ce.id===d)?d:(ne=B.find(ce=>ce.isDefault))==null?void 0:ne.id)??B[0].id;Z(A)},[B,C,V,(Le=Y.data)==null?void 0:Le.defaultModelId]);const R=i.useCallback(d=>{o(A=>({...A,searchInput:d}))},[o]),J=i.useCallback(d=>{o(A=>({...A,statusFilter:d}))},[o]),le=i.useMemo(()=>{const d=O.data??[],A=S.trim().toLowerCase();return d.filter(_=>{var ne,ce;return u&&_.status!==u?!1:A?_.question.toLowerCase().includes(A)||_.objectName.toLowerCase().includes(A)||(((ne=_.columnName)==null?void 0:ne.toLowerCase().includes(A))??!1)||(((ce=_.answer)==null?void 0:ce.toLowerCase().includes(A))??!1)||xe[_.kind].toLowerCase().includes(A)||_.status.toLowerCase().includes(A):!0}).sort((_,ne)=>qa(_,ne,T,I))},[O.data,S,u,T,I]),Q=Ls({items:le,pageSize:f,listMode:H,resetKeys:[S,u,T,I,a]}),{listToolbarCollapsed:E,handleGridScroll:Ce}=_s(Q.handleScrollEnd),D=i.useMemo(()=>({onAnswer:d=>G(d),onView:d=>G(d),onDismiss:d=>se(d)}),[]),Te=i.useMemo(()=>oa(D),[D]),{layout:me,setLayout:Ge}=Is({columns:Te,gridId:Os.dataSourceEnrichmentQuestions}),pe=(b==null?void 0:b.status)!=="open",Ue=()=>{!b||!h.trim()||re.mutate({id:b.id,answer:h.trim()},{onError:d=>Ie(we(d),{type:"error"}),onSuccess:()=>G(null)})},He=()=>{b&&ee.mutate({id:b.id,modelId:C||void 0},{onError:d=>Ie(we(d),{type:"error"}),onSuccess:d=>k(d)})},Ke=()=>{K&&q.mutate(K.id,{onError:d=>Ie(we(d),{type:"error"}),onSuccess:()=>se(null)})};return s?t.jsxs("div",{className:"flex h-full min-h-0 w-full flex-col",children:[t.jsxs(Rt,{children:[t.jsxs("div",{className:qt,children:[n?t.jsxs(t.Fragment,{children:[t.jsx(Qs,{ariaLabel:"Back to Data Sources",title:"Back to Data Sources",onClick:n}),t.jsx("span",{className:Bt,"aria-hidden":"true"})]}):null,t.jsx(Ms,{value:c,onChange:R,placeholder:"Search questions",ariaLabel:"Search questions"}),t.jsx(Rs,{value:u,options:fs,onChange:J,ariaLabel:"Filter questions by status"})]}),t.jsx("div",{className:zt,children:t.jsx(Yt,{onRefresh:()=>{O.refetch()},isRefreshing:O.isFetching&&!O.isLoading,actions:[]})})]}),t.jsx("div",{className:"flex min-h-0 w-full flex-1 flex-col",children:t.jsx(Fs,{presentation:"auto",columns:Te,rows:Q.displayItems,getRowKey:d=>d.id,enableColumnLayout:!0,persistListKey:We.dataSourceEnrichmentQuestions,columnLayout:me,onColumnLayoutChange:Ge,getCardRowActions:d=>as(d,D),onScroll:Ce,isLoading:O.isLoading,loadingMessage:"Loading questions…",errorContent:O.isError?t.jsx(lt,{message:"Failed to load questions.",detail:we(O.error),onRetry:()=>{O.refetch()},isRetrying:O.isFetching}):void 0,isEmpty:!O.isLoading&&!O.isError&&Q.displayItems.length===0,emptyMessage:"No questions found.",footer:t.jsx(Ps,{totalCount:Q.totalCount,safePage:Q.safePage,pageSize:f,onPageSizeChange:N,sortBy:T,sortOptions:sa,onSortByChange:z,sortDirection:I,onToggleSortDirection:()=>x(d=>d==="asc"?"desc":"asc"),showSortControls:!0,totalPages:Q.totalPages,pageNumbers:Q.pageNumbers,onPageChange:Q.setPage,listMode:H,onListModeChange:oe,visibleInfiniteCount:Q.visibleInfiniteCount})})}),b?t.jsx(Ae,{size:"5xl",title:pe?"Question":"Answer question",gradient:!1,shellClassName:"flex min-h-[32rem] max-h-[92vh] flex-col overflow-hidden",bodyOuterClassName:"flex min-h-0 flex-1 flex-col overflow-hidden",bodyClassName:"flex min-h-0 flex-1 flex-col overflow-hidden",onClose:()=>G(null),onBackdropClick:()=>G(null),footer:t.jsxs("div",{className:"flex items-center gap-2",children:[t.jsxs(L,{intent:"cancel",size:"sm",onClick:()=>G(null),children:[t.jsx(Ee,{className:"h-3.5 w-3.5"}),pe?"Close":"Cancel"]}),pe?null:t.jsxs(L,{intent:"primary",size:"sm",disabled:re.isPending||!h.trim(),onClick:Ue,children:[t.jsx(ln,{className:"h-3.5 w-3.5"}),"Save answer"]})]}),children:t.jsxs("div",{className:"flex h-full min-h-0 flex-1 flex-col gap-3",children:[t.jsxs("div",{className:"shrink-0 space-y-3 text-sm",children:[t.jsx("p",{className:"font-medium text-slate-800",children:b.question}),t.jsxs("p",{className:"font-mono text-xs text-slate-500",children:[b.objectName,b.columnName?`.${b.columnName}`:""," · ",xe[b.kind]]}),b.reason.length>0?t.jsx("ul",{className:"list-disc space-y-0.5 ps-4 text-xs text-slate-600",children:b.reason.map((d,A)=>t.jsx("li",{children:d},A))}):null,!pe&&b.candidates.length>0?t.jsx("div",{className:"flex flex-wrap gap-1.5",children:b.candidates.map((d,A)=>t.jsx(L,{type:"button",intent:"secondary",size:"sm",onClick:()=>k(d),children:d},A))}):null,j?t.jsxs("div",{className:"flex items-end gap-2",children:[t.jsx(te,{label:"Model",className:"min-w-0 flex-1",reserveHintSlot:!1,children:t.jsx(Ht,{size:"sm",value:C,onChange:d=>Z(d.target.value),isDisabled:ee.isPending||Y.isLoading||B.length===0,ariaLabel:"Answer model",children:B.map(d=>t.jsx("option",{value:d.id,children:d.name},d.id))})}),t.jsxs(L,{intent:"secondary",size:"sm",disabled:ee.isPending||!C,onClick:He,children:[ee.isPending?t.jsx(ut,{className:"h-3.5 w-3.5 animate-spin"}):t.jsx(Re,{className:"h-3.5 w-3.5"}),"Generate answer"]})]}):null]}),pe?t.jsx("p",{className:"min-h-0 flex-1 overflow-auto text-sm text-slate-600",children:b.status==="answered"?b.answer:"Dismissed without an answer."}):t.jsx("div",{className:"flex min-h-0 flex-1 flex-col overflow-hidden [&>div]:flex [&>div]:h-full [&>div]:min-h-0 [&>div]:flex-1 [&>div]:flex-col [&_textarea]:h-full [&_textarea]:min-h-0 [&_textarea]:resize-none",children:t.jsx(mn,{aiAssist:!1,value:h,onChange:d=>k(d.target.value),placeholder:"Type an answer…",ariaLabel:"Answer",rows:12,disabled:ee.isPending,className:"h-full min-h-0"})})]})}):null,t.jsx(Gt,{open:!!K,title:"Dismiss question",subtitle:K==null?void 0:K.objectName,confirmLabel:"Dismiss",confirmIntent:"destructive-soft",confirmIcon:t.jsx(Vt,{className:"h-3.5 w-3.5"}),isConfirming:q.isPending,onClose:()=>se(null),onConfirm:Ke,children:t.jsx("p",{className:"text-sm text-slate-600",children:"Dismiss this question without an answer?"})})]}):null},za=({dataSource:e,onBack:s})=>t.jsx(Bs,{children:t.jsx(Ba,{dataSource:e,active:!0,onBack:s})}),Ga=({page:e})=>{const[s,n]=i.useState(!1);return t.jsxs(Rt,{children:[t.jsx("div",{className:qt,children:t.jsxs("span",{className:"text-xs font-medium text-slate-600",children:[e.items.length," data source",e.items.length===1?"":"s"]})}),t.jsxs("div",{className:zt,children:[t.jsxs(L,{type:"button",intent:"utility",size:"sm",onClick:e.testConnectivityAll,disabled:e.testingAll||e.loading||e.items.length===0,...Pt(gt["pageGuide.page.sources.testAll.title"],gt["pageGuide.page.sources.testAll.hint"],18),children:[t.jsx(mt,{className:"h-3.5 w-3.5"}),"Test All"]}),t.jsx("span",{className:Bt,"aria-hidden":"true"}),t.jsx(pn,{intent:"secondary",size:"sm",icon:t.jsx(Kt,{className:"h-3.5 w-3.5"}),isOpen:s,onOpenChange:n,triggerAriaLabel:"Create new data source",menuAriaLabel:"Select data source type",menuClassName:"min-w-[190px]",children:e.typeOptions.map(a=>t.jsx(hn,{onClick:()=>{e.openCreateDialog(a),n(!1)},children:a},a))}),t.jsx(Yt,{onRefresh:()=>{e.refreshList()},isRefreshing:e.isRetryingList,actions:[]})]})]})},Ua=({page:e})=>{const[s,n]=i.useState(null),[a,r]=i.useState(null);return e.questionsIdFromUrl?e.questionsDataSource?t.jsx(za,{dataSource:e.questionsDataSource,onBack:e.closeQuestions}):t.jsx("div",{className:"flex h-full items-center justify-center text-sm font-medium text-slate-400",children:"Loading questions…"}):t.jsxs("div",{className:"flex h-full w-full flex-col bg-white",id:"data-sources-container",children:[t.jsx(Ga,{page:e}),t.jsx(Ma,{isLoading:e.loading,isError:e.isError,error:e.listLoadError,onRetry:()=>void e.refreshList(),isRetrying:e.isRetryingList,items:e.items,testingId:e.testingId,onTest:o=>{e.testConnectivity(o)},onEdit:e.openEditDialog,onDelete:e.openDeleteConfirm,onEnrich:o=>n(o),onGenerateDocs:o=>r(o),resolveQuestionsHref:e.resolveQuestionsHref,onOpenQuestions:e.openQuestions,onScroll:e.handleGridScroll}),t.jsx(zn,{page:e}),t.jsx(ta,{dataSource:s,onClose:()=>n(null),onOpenQuestions:()=>{if(!s)return;const o=s;n(null),e.openQuestions(o)}}),t.jsx(va,{dataSource:a,onClose:()=>r(null)}),e.deleteTarget&&t.jsx(Mn,{target:e.deleteTarget,onCancel:e.cancelDelete,onConfirm:()=>void e.confirmDelete()}),t.jsx(Ra,{error:e.error,successMessage:e.successMessage,onDismissError:e.dismissError,onDismissSuccess:e.dismissSuccess})]})},Ha=()=>{const e=$n();return Qn({enabled:!!e.questionsIdFromUrl}),t.jsx(Ua,{page:e})},To=()=>t.jsx(Ha,{});export{To as DataSourcesPage};
