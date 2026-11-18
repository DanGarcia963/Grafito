import { randomBytes, scryptSync } from 'crypto';

type UsuarioConfig = {
  usuario: string;
  password: string;
  areas: string[];
  personaId: number;
};

// Para cuentas externas NO reimprimir ni modificar las cuentas internas.
// Uso: asigna UST_CLIENTE_PASSWORD temporalmente en PowerShell y ejecuta npx ts-node generar-usuario.ts --cliente-haas
// Salida: un único UST_CLIENTES_JSON que se configura por separado en Railway.
if (process.argv.includes('--cliente-haas')) {
  const password = process.env.UST_CLIENTE_PASSWORD ?? '';
  if (password.length < 14 || password.length > 256) {
    console.error('Define UST_CLIENTE_PASSWORD (entre 14 y 256 caracteres) únicamente en el entorno local antes de ejecutar.');
    process.exitCode = 1;
  } else {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    const cliente = {
      usuario: 'haas_cliente',
      areas: ['cliente'],
      personaId: 12, // Haas TCM de México en personas.id_Persona
      salt,
      hash,
    };
    console.log('UST_CLIENTES_JSON=' + JSON.stringify([cliente]));
  }
  delete process.env.UST_CLIENTE_PASSWORD;
} else {

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
  },
    {  usuario: 'admin_CRM_UST',
    password: 'admin123!',
    areas: ['crm_admin'],
    personaId: 18,
  }


];

const cuentas = usuarios.map(({ usuario, password, areas, personaId }) => {
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

// No imprimir contraseñas de usuarios existentes en la terminal.
console.log('Las contraseñas existentes no se muestran por seguridad.');

console.log('\n=== UST_USUARIOS_JSON ===\n');

console.log(`UST_USUARIOS_JSON=${JSON.stringify(cuentas)}`);
}
