/* GENGRAIL temporary Option 2 safety filter.
   Endpoint-agnostic: removes vintage/pre-2002 lanes before Grail Hub parses,
   prices, ranks or builds Grail Plan. Remove once printing identity is reliable.
*/
(function(){
'use strict';
const PATCH_EPOCH='pre2002-direct-v2';
const PATCH_EPOCH_KEY='gengrail_grail_patch_epoch';
const DAILY_SHEET_KEY='gengrail_grail_daily_sheet_v1';
try{
 if(localStorage.getItem(PATCH_EPOCH_KEY)!==PATCH_EPOCH){
  localStorage.removeItem(DAILY_SHEET_KEY);
  localStorage.setItem(PATCH_EPOCH_KEY,PATCH_EPOCH);
  console.info('[Gengrail] invalidated stale Daily Sheet for',PATCH_EPOCH);
 }
}catch(e){console.warn('[Gengrail] could not invalidate stale Daily Sheet',e)}
if(window.__gengrailPre2002SafetyInstalled)return;
window.__gengrailPre2002SafetyInstalled=true;
const upstream=window.fetch.bind(window);
const vintage=/(?:\b199[0-9]\b|\b2000\b|\b2001\b|\bbase\s*set\b|\bshadowless\b|\bbase\s*set\s*(?:2|ii)\b|\bneo\s+genesis\b|\bneo\s+discovery\b|\bwotc\b|\bwizards\s+of\s+the\s+coast\b)/i;
function reject(item){
 const title=String(item?.title||'');
 if(vintage.test(title))return true;
 const pools=[item?.localizedAspects,item?.aspects,item?.itemSpecifics,item?.product?.localizedAspects,item?.product?.aspects,item?.productDetails?.localizedAspects,item?.productDetails?.aspects];
 const text=[];
 for(const src of pools){
  if(Array.isArray(src)){for(const a of src)text.push(a?.name,a?.value,a?.localizedValue,...(Array.isArray(a?.values)?a.values:[]));}
  else if(src&&typeof src==='object'){for(const [k,v] of Object.entries(src))text.push(k,...(Array.isArray(v)?v:[v]));}
 }
 return vintage.test(text.filter(Boolean).map(v=>typeof v==='object'?(v.value??v.localizedValue??''):v).join(' '));
}
window.fetch=async function(input,init){
 const response=await upstream(input,init);
 if(!response?.ok)return response;
 const url=typeof input==='string'?input:String(input?.url||'');
 if(!/gengrail-ebay-backend|opportunit/i.test(url))return response;
 try{
  const data=await response.clone().json();
  if(!data?.ok||!Array.isArray(data.itemSummaries))return response;
  const before=data.itemSummaries.length;
  const filtered=data.itemSummaries.filter(item=>!reject(item));
  const headers=new Headers(response.headers);
  headers.set('content-type','application/json;charset=UTF-8');
  headers.set('cache-control','no-store');
  const diagnostic={version:'option2-direct-v2',mode:'PRE_2002_EXCLUDED',input:before,passed:filtered.length,rejected:before-filtered.length};
  window.__gengrailPre2002SafetyLast=diagnostic;
  console.info('[Gengrail] pre-2002 direct safety filter',diagnostic);
  return new Response(JSON.stringify({...data,itemSummaries:filtered,pre2002Safety:diagnostic}),{status:response.status,statusText:response.statusText,headers});
 }catch(e){
  console.warn('[Gengrail] pre-2002 safety filter could not inspect response',e);
  return response;
 }
};
})();
