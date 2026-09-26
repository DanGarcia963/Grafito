import { randomBytes, scryptSync } from 'crypto';

type UsuarioConfig = {
  usuario: string;
  password: string;
  areas: string[];
  personaId: number;
};

const usuarios: UsuarioConfig[] = [
  {
    usuario: 'usuario_produccion',
    password: 'Produccion123!',
    areas: ['produccion'],
    personaId: 1,
  },
  {
    usuario: 'usuario_calidad',
    password: 'Calidad123!',
    areas: ['calidad'],
    personaId: 2,
  },
  {
    usuario: 'usuario_id',
    password: 'Id123!',
    areas: ['id'],
    personaId: 3,
  },
  {
    usuario: 'usuario_ventas',
    password: 'Ventas123!',
    areas: ['ventas'],
    personaId: 4,
  },
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

for (const usuario of usuarios) {
  console.log(
    `${usuario.usuario} -> contraseña: ${usuario.password}`
  );
}

console.log('\n=== UST_USUARIOS_JSON ===\n');

console.log(`UST_USUARIOS_JSON=${JSON.stringify(cuentas)}`);