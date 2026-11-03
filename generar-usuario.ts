import { randomBytes, scryptSync } from 'crypto';

type UsuarioBaseConfig = {
  usuario: string;
  areas: string[];
  personaId: number;
};
type UsuarioConfig = UsuarioBaseConfig & { password: string };

const usuarios: UsuarioBaseConfig[] = [
  {
    usuario: 'Brenda_R',
    areas: ['produccion'],
    personaId: 15,
  },
  {
    usuario: 'Yesenia',
    areas: ['calidad'],
    personaId: 13,
  },
  {
    usuario: 'Gabriel_Escamilla',
    areas: ['id'],
    personaId: 19,
  },
    {
    usuario: 'Mauricio_Garcia',
    areas: ['costos', 'ventas'],
    personaId: 11,
  },
  {
    usuario: 'Fernando_Franco',
    areas: ['ventas'],
    personaId: 18,
  },
  {
    usuario: 'Raul_Molina',
    areas: ['ventas'],
    personaId: 16,
  },
    {
    usuario: 'Elena_Gallegos',
    areas: ['ventas'],
    personaId: 17,
  },
  {
    usuario: 'Rodrigo_Chavez',
    areas: ['ventas'],
    personaId: 21,
  },
  {
    usuario: 'Melissa_Vargas',
    areas: ['seguridad'],
    personaId: 20,
  },
    {  usuario: 'almacen_UST',
    areas: ['almacen'],
    personaId: 24,
  },
    {  usuario: 'logistica_UST',
    areas: ['logistica'],
    personaId: 23,
  },
    {  usuario: 'contabilidad_UST',
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
type CuentaGenerada = {
  usuario: string;
  areas: string[];
  personaId: number;
  salt: string;
  hash: string;
};
const cuentaConPassword = ({ usuario, password, areas, personaId }: UsuarioConfig): CuentaGenerada => {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return { usuario, areas, personaId, salt, hash };
};

// Para agregar el admin a las cuentas ya configuradas, se puede pasar el JSON
// actual de Railway y conservar sus hashes sin conocer ni regenerar contraseñas.
const baseJson = process.env.UST_USUARIOS_BASE_JSON;
let cuentas: CuentaGenerada[];
if (baseJson) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(baseJson);
  } catch {
    throw new Error('UST_USUARIOS_BASE_JSON debe contener un JSON válido.');
  }
  if (!Array.isArray(parsed))
    throw new Error('UST_USUARIOS_BASE_JSON debe ser un arreglo de cuentas.');
  cuentas = parsed.map((cuenta: any) => {
    if (
      typeof cuenta?.usuario !== 'string' ||
      !Array.isArray(cuenta.areas) ||
      !cuenta.areas.every((area: unknown) => typeof area === 'string') ||
      !Number.isSafeInteger(cuenta.personaId) ||
      cuenta.personaId <= 0 ||
      typeof cuenta.salt !== 'string' ||
      typeof cuenta.hash !== 'string'
    )
      throw new Error('UST_USUARIOS_BASE_JSON contiene una cuenta inválida.');
    return {
      usuario: cuenta.usuario,
      areas: cuenta.areas,
      personaId: cuenta.personaId,
      salt: cuenta.salt,
      hash: cuenta.hash,
    };
  });
} else {
  const usuariosPasswordJson = process.env.UST_USUARIOS_PASSWORDS_JSON;
  if (!usuariosPasswordJson)
    throw new Error(
      'Define UST_USUARIOS_BASE_JSON o UST_USUARIOS_PASSWORDS_JSON para las cuentas existentes.',
    );
  let passwords: Record<string, unknown>;
  try {
    const parsed = JSON.parse(usuariosPasswordJson);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    passwords = parsed as Record<string, unknown>;
  } catch {
    throw new Error('UST_USUARIOS_PASSWORDS_JSON debe ser un objeto JSON válido.');
  }
  cuentas = usuarios.map((usuario) => {
    const password = passwords[usuario.usuario];
    if (typeof password !== 'string' || password.length === 0)
      throw new Error(`Falta la contraseña local para ${usuario.usuario}.`);
    return cuentaConPassword({ ...usuario, password });
  });
}

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
  if (cuentas.some((u) => u.usuario.toLowerCase() === adminUsuario.toLowerCase()))
    throw new Error('El usuario administrador CRM ya está definido en la lista.');
  cuentas.push(
    cuentaConPassword({
      usuario: adminUsuario,
      password: adminPassword,
      areas: ['crm_admin'],
      personaId: adminPersonaId,
    }),
  );
}

console.log('\n=== USUARIOS ===\n');

for (const usuario of cuentas) {
  console.log(
    `${usuario.usuario} -> áreas: ${usuario.areas.join(', ')}`,
  );
}

console.log('\n=== UST_USUARIOS_JSON ===\n');

console.log(`UST_USUARIOS_JSON=${JSON.stringify(cuentas)}`);
