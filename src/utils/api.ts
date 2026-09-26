export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002').replace(/\/$/, '');
export function sesionActual(){try{return JSON.parse(localStorage.getItem('sesion')||'null');}catch{return null;}}
export async function apiFetch(input:RequestInfo|URL,init:RequestInit={}){
 const headers=new Headers(init.headers),sesion=typeof window==='undefined'?null:sesionActual();
 const url=String(input);
 if(sesion?.token&&(url===API_URL||url.startsWith(API_URL+'/')))headers.set('Authorization',`Bearer ${sesion.token}`);
 const res=await globalThis.fetch(input,{...init,headers});
 if(res.status===401&&typeof window!=='undefined'&&!url.endsWith('/auth/login')){
  localStorage.removeItem('sesion');window.dispatchEvent(new Event('sesion-cambiada'));window.location.assign('/');
 }
 return res;
}
export async function pedir(ruta:string,body?:unknown,method='POST'){
 const r=await apiFetch(`${API_URL}${ruta}`,body===undefined?{method}:{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const d=await r.json();if(!r.ok||d.success===false)throw new Error(Array.isArray(d.message)?d.message.join(', '):d.message||d.error||'No se pudo completar la operación');return d;
}
