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
    usuario: 'usuario_id',
    password: 'Id123!',
    areas: ['id'],
    personaId: 3,
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

for (const usuario of usuarios) {
  console.log(
    `${usuario.usuario} -> contraseña: ${usuario.password}`
  );
}

console.log('\n=== UST_USUARIOS_JSON ===\n');

console.log(`UST_USUARIOS_JSON=${JSON.stringify(cuentas)}`);