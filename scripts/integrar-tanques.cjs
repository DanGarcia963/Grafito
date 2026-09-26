// Ejecutar desde frontend. La página de tanques no venía incluida en UST2.zip.
const fs=require('fs'),file='src/app/tanques/page.tsx';
if(!fs.existsSync(file)){console.error('No existe '+file+'. Ejecuta este script en el proyecto completo.');process.exit(1);}
let s=fs.readFileSync(file,'utf8');
if(s.includes('apiFetch as fetch')){console.log('Tanques ya utiliza la sesión.');process.exit(0);}
const re=/import\s*\{([^}]+)\}\s*from\s*['"]@\/utils\/api['"];?/;
if(re.test(s))s=s.replace(re,(_,members)=>'import {'+members+', apiFetch as fetch} from "@/utils/api";');
else {
 const directive=/(['"])use client\1;?/;
 if(!directive.test(s))throw new Error('Revisar manualmente: falta use client.');
 s=s.replace(directive,m=>m+'\nimport { apiFetch as fetch } from "@/utils/api";');
}
fs.copyFileSync(file,file+'.antes-id.bak');
fs.writeFileSync(file,s);
console.log('Integrado Authorization en fetch de tanques. Revisa que las URL coincidan con NEXT_PUBLIC_API_URL.');
