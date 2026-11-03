import { randomBytes, scryptSync } from 'crypto';

type UsuarioConfig = {
  usuario: string;
  password: string;
  areas: string[];
  personaId: number;
};

const usuarios: UsuarioConfig[] = [
  {
    usuario: 'Brenda_R',
    password: 'BrendaR123!',
    areas: ['produccion'],
    personaId: 15,
  },
  {
    usuario: 'Yesenia',
    password: 'Yesenia123!',
    areas: ['calidad'],
    personaId: 13,
  },
  {
    usuario: 'Gabriel_Escamilla',
    password: 'EscamillaG123!',
    areas: ['id'],
    personaId: 19,
  },
    {
    usuario: 'Mauricio_Garcia',
    password: 'Usteyl2026$',
    areas: ['costos', 'ventas'],
    personaId: 11,
  },
  {
    usuario: 'Fernando_Franco',
    password: 'FrancoF123!',
    areas: ['ventas'],
    personaId: 18,
  },
  {
    usuario: 'Raul_Molina',
    password: 'MolinaR123!',
    areas: ['ventas'],
    personaId: 16,
  },
    {
    usuario: 'Elena_Gallegos',
    password: 'GallegosE123!',
    areas: ['ventas'],
    personaId: 17,
  },
  {
    usuario: 'Rodrigo_Chavez',
    password: 'ChavezR123!',
    areas: ['ventas'],
    personaId: 21,
  },
  {
    usuario: 'Melissa_Vargas',
    password: 'VargasM123!',
    areas: ['seguridad'],
    personaId: 20,
  },
    {  usuario: 'almacen_UST',
    password: 'UstA123!',
    areas: ['almacen'],
    personaId: 24,
  },
    {  usuario: 'logistica_UST',
    password: 'UstL123!',
    areas: ['logistica'],
    personaId: 23,
  },
    {  usuario: 'contabilidad_UST',
    password: 'UstC123!',
    areas: ['contaduria'],
    personaId: 22,
  }

];

// El administrador CRM se agrega al JSON generado cuando se definen estos datos
// en el entorno local. No se guardan credenciales reales en el repositorio.
const adminUsuario = process.env.CRM_ADMIN_USUARIO?.trim();
const adminPassword = process.env.CRM_ADMIN_PASSWORD;
const adminPersonaIdRaw = process.env.CRM_ADMIN_PERSONA_ID;
const adminConfigPresente = Boolean(adminUsuario || adminPassword || adminPersonaIdRaw);
const usuariosFinales = [...usuarios];

if (adminConfigPresente) {
  const adminPersonaId = Number(adminPersonaIdRaw);
  if (
    !adminUsuario ||
    !adminPassword ||
    !Number.isSafeInteger(adminPersonaId) ||
    adminPersonaId <= 0
  ) {
    throw new Error(
      'Para generar Administrador CRM define CRM_ADMIN_USUARIO, CRM_ADMIN_PASSWORD y CRM_ADMIN_PERSONA_ID.',
    );
  }
  if (adminPassword.length < 12)
    throw new Error('La contraseña del administrador CRM debe tener al menos 12 caracteres.');
  if (usuarios.some((u) => u.usuario.toLowerCase() === adminUsuario.toLowerCase()))
    throw new Error('El usuario administrador CRM ya está definido en la lista.');
  usuariosFinales.push({
    usuario: adminUsuario,
    password: adminPassword,
    areas: ['crm_admin'],
    personaId: adminPersonaId,
  });
}

const cuentas = usuariosFinales.map(({ usuario, password, areas, personaId }) => {
  const salt = randomBytes(16).toString('hex');

  const hash = scryptSync(password, salt, 64).toString('hex');

  return {
    usuario,
    areas,
    personaId,
    salt,
    hash,
  };
});

console.log('\n=== USUARIOS ===\n');

for (const usuario of usuariosFinales) {
  console.log(
    `${usuario.usuario} -> contraseña: ${usuario.password}`
  );
}

console.log('\n=== UST_USUARIOS_JSON ===\n');

console.log(`UST_USUARIOS_JSON=${JSON.stringify(cuentas)}`);
