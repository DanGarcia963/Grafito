'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { pedir } from '@/utils/api';

type Area = 'produccion' | 'calidad' | 'id' | 'ventas';

export default function LoginPage() {
const [area, setArea] = useState<Area>('produccion');
const [usuario, setUsuario] = useState('');
const [password, setPassword] = useState('');
const [error, setError] = useState('');

const router = useRouter();

const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
e.preventDefault();
setError('');


try {
 const sesion=await pedir('/api/auth/login',{usuario:usuario.trim(),password,area});
 if (typeof sesion?.token !== 'string' || !sesion.token.trim()) {
  throw new Error('El servidor no devolvió un token de sesión. Revisa la respuesta de /api/auth/login.');
 }
 localStorage.setItem('sesion',JSON.stringify(sesion));window.dispatchEvent(new Event('sesion-cambiada'));
 router.push(area==='calidad'?'/calidad':area==='produccion'?'/tanques':area==='ventas'?'/ventas-muestras':'/investigacion');
} catch(e){setError(e instanceof Error?e.message:'No se pudo iniciar sesión');}

};

return ( <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4"> <form
     onSubmit={handleSubmit}
     className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8"
   > <h1 className="text-2xl font-bold text-slate-800 text-center">
US Technologies · Muestras y procesos </h1>
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
      <option value="calidad">Muestras · Calidad</option>
      <option value="id">Muestras · Investigación y Desarrollo</option>
      <option value="ventas">Ventas · Registro de muestras I+D</option>
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
      placeholder="Tu contraseña"
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
