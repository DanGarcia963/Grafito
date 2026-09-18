'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Area, Rol } from '@/types/flujo';

const USUARIOS = [
  // Ventas (Único que crea)
  { area: 'ventas' as Area, rol: 'visualizacion' as Rol, usuario: 'ventas', password: '123' },
  { area: 'ventas' as Area, rol: 'editor' as Rol, usuario: 'ventas_editor', password: '123' },

  { area: 'seguridad' as Area, rol: 'visualizacion' as Rol, usuario: 'seguridad', password: '123' },
  { area: 'seguridad' as Area, rol: 'editor' as Rol, usuario: 'seguridad_editor', password: '123' },

  // Plan de Producción
  { area: 'plan_produccion' as Area, rol: 'visualizacion' as Rol, usuario: 'plan', password: '123' },
  { area: 'plan_produccion' as Area, rol: 'editor' as Rol, usuario: 'plan_editor', password: '123' },

  // Producción
  { area: 'produccion' as Area, rol: 'visualizacion' as Rol, usuario: 'produccion', password: '123' },
  { area: 'produccion' as Area, rol: 'editor' as Rol, usuario: 'produccion_editor', password: '123' },

  // Calidad
  { area: 'calidad' as Area, rol: 'visualizacion' as Rol, usuario: 'calidad', password: '123' },
  { area: 'calidad' as Area, rol: 'editor' as Rol, usuario: 'calidad_editor', password: '123' },

  // Almacén
  { area: 'almacen' as Area, rol: 'visualizacion' as Rol, usuario: 'almacen', password: '123' },
  { area: 'almacen' as Area, rol: 'editor' as Rol, usuario: 'almacen_editor', password: '123' },

  // Logística
  { area: 'logistica' as Area, rol: 'visualizacion' as Rol, usuario: 'logistica', password: '123' },
  { area: 'logistica' as Area, rol: 'editor' as Rol, usuario: 'logistica_editor', password: '123' },

  // Cliente
  { area: 'cliente' as Area, rol: 'visualizacion' as Rol, usuario: 'cliente', password: '123' },
  { area: 'cliente' as Area, rol: 'editor' as Rol, usuario: 'cliente_editor', password: '123' },
];

export default function LoginPage() {
  const [area, setArea] = useState<Area>('ventas');
  const [rol, setRol] = useState<Rol>('editor');
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
        item.rol === rol &&
        item.usuario === usuario.trim() &&
        item.password === password
    );

    if (!usuarioEncontrado) {
      setError('Los datos de acceso no coinciden con el área y rol seleccionados.');
      return;
    }

    localStorage.setItem(
      'sesion',
      JSON.stringify({
        area: usuarioEncontrado.area,
        rol: usuarioEncontrado.rol,
        usuario: usuarioEncontrado.usuario,
      })
    );
    if (localStorage.getItem('sesion')) {
      const sesion = JSON.parse(localStorage.getItem('sesion') || '{}');
      if (sesion.area === "seguridad") {
        router.push('/matriz');
      }
          else{
    router.push('/');
    }
    
    }

  };

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-2xl font-bold text-slate-800 text-center">Sistema de Flujo de Ventas</h1>
        <p className="text-center text-slate-500 mt-1 mb-6">Iniciar sesión por Área</p>

        <label className="block text-sm font-medium text-slate-700 mb-1">Área</label>
        <select
          value={area}
          onChange={(e) => setArea(e.target.value as Area)}
          className="w-full border rounded-lg p-2.5 mb-4"
        >
          <option value="ventas">Ventas</option>
          <option value="plan_produccion">Plan de Producción</option>
          <option value="produccion">Producción</option>
          <option value="calidad">Control de Calidad</option>
          <option value="almacen">Almacén</option>
          <option value="logistica">Logística</option>
          <option value="cliente">Cliente</option>
          <option value="seguridad">Seguridad y Higiene</option>
        </select>

        <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
        <select
          value={rol}
          onChange={(e) => setRol(e.target.value as Rol)}
          className="w-full border rounded-lg p-2.5 mb-4"
        >
          <option value="visualizacion">Solo visualización</option>
          <option value="editor">Editor / Creador</option>
        </select>

        <label className="block text-sm font-medium text-slate-700 mb-1">Usuario</label>
        <input
          type="text"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          className="w-full border rounded-lg p-2.5 mb-4"
          placeholder="Ej. ventas_editor"
          required
        />

        <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded-lg p-2.5 mb-4"
          placeholder="123"
          required
        />

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

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