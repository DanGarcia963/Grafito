'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

type Area = 'produccion' | 'calidad';

const USUARIOS = [
{
area: 'produccion' as Area,
usuario: 'produccion',
password: '123',
},
{
area: 'calidad' as Area,
usuario: 'calidad',
password: '123',
},
];

export default function LoginPage() {
const [area, setArea] = useState<Area>('produccion');
const [usuario, setUsuario] = useState('');
const [password, setPassword] = useState('');
const [error, setError] = useState('');

const router = useRouter();

const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
e.preventDefault();
setError('');


const usuarioEncontrado = USUARIOS.find(
  (item) =>
    item.area === area &&
    item.usuario === usuario.trim() &&
    item.password === password
);

if (!usuarioEncontrado) {
  setError(
    'Los datos de acceso no coinciden con el área y rol seleccionados.'
  );
  return;
}

localStorage.setItem(
  'sesion',
  JSON.stringify({
    area: usuarioEncontrado.area,
    usuario: usuarioEncontrado.usuario,
  })
);

if (usuarioEncontrado.area === 'produccion') {
  router.push('/tanques');
} else if (usuarioEncontrado.area === 'calidad') {
  router.push('/calidad');
}


};

return ( <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4"> <form
     onSubmit={handleSubmit}
     className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8"
   > <h1 className="text-2xl font-bold text-slate-800 text-center">
Sistema de Flujo de Ventas </h1>
    <p className="text-center text-slate-500 mt-1 mb-6">
      Iniciar sesión por Área
    </p>

    <label className="block text-sm font-medium text-slate-700 mb-1">
      Área
    </label>

    <select
      value={area}
      onChange={(e) => setArea(e.target.value as Area)}
      className="w-full border rounded-lg p-2.5 mb-4"
    >
      <option value="produccion">Producción</option>
      <option value="calidad">Control de Calidad</option>
    </select>

    <label className="block text-sm font-medium text-slate-700 mb-1">
      Usuario
    </label>

    <input
      type="text"
      value={usuario}
      onChange={(e) => setUsuario(e.target.value)}
      className="w-full border rounded-lg p-2.5 mb-4"
      placeholder="Ej. produccion"
      required
    />

    <label className="block text-sm font-medium text-slate-700 mb-1">
      Contraseña
    </label>

    <input
      type="password"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      className="w-full border rounded-lg p-2.5 mb-4"
      placeholder="123"
      required
    />

    {error && (
      <p className="text-sm text-red-600 mb-4">
        {error}
      </p>
    )}

    <button
      type="submit"
      className="w-full bg-blue-600 text-white rounded-lg p-2.5 hover:bg-blue-700 transition font-medium"
    >
      Entrar al Sistema
    </button>
  </form>
</main>


);
}
