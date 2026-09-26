// node scripts/crear-cuenta.cjs usuario personaId areasSeparadasPorComa
// Genera contraseña aleatoria para entrega privada al usuario. Agrega el JSON a UST_USUARIOS_JSON.
const {randomBytes,scryptSync}=require('crypto');
const [usuario,id,lista]=process.argv.slice(2),areas=(lista||'').split(',');
if(!usuario||!Number.isSafeInteger(Number(id))||Number(id)<=0||areas.some(a=>!['ventas','id','calidad','produccion'].includes(a)))throw new Error('Uso: node scripts/crear-cuenta.cjs usuario personaId ventas,id');
const password=randomBytes(18).toString('base64url'),salt=randomBytes(16).toString('hex');
console.log('Contraseña generada (entrégala de forma privada):',password);
console.log(JSON.stringify({usuario,personaId:Number(id),areas,salt,hash:scryptSync(password,salt,64).toString('hex')}));
