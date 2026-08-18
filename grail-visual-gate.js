/* GENGRAIL identity safety gate v1.15
   Visual verification remains available for legacy Grail searches.
   The direct Opportunity Stream performs its own deterministic modern-card filtering and
   explicitly bypasses this expensive gate to keep mobile discovery responsive.
*/
(function(){
'use strict';
if(window.__gengrailVisualGateInstalled)return;
window.__gengrailVisualGateInstalled=true;
const nativeFetch=window.fetch.bind(window);
const EBAY_SEARCH_PATH='/api/ebay/opportunities/search';
const AI_BACKEND='https://gengrail-card-ai.gengrailtcg.workers.dev';
const CACHE_KEY='gengrail_grail_identity_gate_v115';
const clean=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,'').replace(/[^a-z0-9/]+/g,' ').replace(/\s+/g,' ').trim();
const cardNumber=v=>{const m=String(v||'').match(/\b(\d{1,4})\s*\/\s*(\d{1,4})\b/);return m?`${Number(m[1])}/${Number(m[2])}`:''};
function rejectTitle(title){const t=clean(title);if(!cardNumber(title))return'missing_collector_number';if(/\b(keychain|key ring|keyring|proxy|replica|reproduction|custom|fan art|digital|code card|empty slab|case only|repack|mystery|orica|bundle|job lot|lot of|metal card|gold card|novelty|card holder|card stand|card not included|no card included|without card)\b/.test(t))return'accessory_or_non_card';if(/\b(1995|1996|1997|1998|1999|2000|2001|base set|jungle|fossil|team rocket|gym heroes|gym challenge|neo genesis|neo discovery|neo revelation|wotc|wizards of the coast)\b/.test(t))return'pre2002_safety';return''}
async function legacyVerify(items){const out=[];for(const item of(Array.isArray(items)?items:[])){const reason=rejectTitle(item?.title||'');if(!reason)out.push(item)}return out}
window.fetch=async function(input,init){
 const url=typeof input==='string'?input:String(input?.url||'');
 const response=await nativeFetch(input,init);
 if(!url.includes(EBAY_SEARCH_PATH)||!response.ok)return response;
 /* Direct Opportunity Stream has its own fast deterministic filter. Never run image AI here. */
 if(url.includes('_gengrail_stream=direct'))return response;
 try{const data=await response.clone().json();if(!data?.ok||!Array.isArray(data.itemSummaries))return response;const verified=await legacyVerify(data.itemSummaries);const headers=new Headers(response.headers);headers.set('content-type','application/json;charset=UTF-8');headers.set('cache-control','no-store');return new Response(JSON.stringify({...data,itemSummaries:verified,identityGate:{version:'1.15',mode:'FAST_TITLE_SAFETY',input:data.itemSummaries.length,passed:verified.length,rejected:data.itemSummaries.length-verified.length}}),{status:response.status,statusText:response.statusText,headers})}catch{return response}
};
window.GengrailVisualGate={version:'1.15',mode:'FAST_TITLE_SAFETY',verifyItems:legacyVerify,clearCache(){try{localStorage.removeItem(CACHE_KEY)}catch{}},last:()=>null,aiBackend:AI_BACKEND};
})();