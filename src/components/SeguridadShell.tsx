"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { API_URL, apiFetch, pedir, sesionActual } from '@/utils/api';

export default function SeguridadShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [estado, setEstado] = useState<'cargando' | 'permitido' | 'denegado' | 'error'>('cargando');
  const area = sesionActual()?.area;

  useEffect(() => {
    const controller = new AbortController();
    const comprobar = async () => {
      const sesion = sesionActual();
      if (!sesion?.token) { router.replace('/'); return; }
      try {
        const response = await apiFetch(`${API_URL}/api/auth/sesion`, { signal: controller.signal });
        if (!response.ok) { if (response.status !== 401) setEstado('error'); return; }
        const usuario = await response.json();
        if (usuario.area === 'contaduria' && pathname.startsWith('/kpis')) {
          setEstado('denegado');
          router.replace('/matriz');
          return;
        }
        setEstado(['seguridad', 'contaduria'].includes(usuario.area) ? 'permitido' : 'denegado');
      } catch { if (!controller.signal.aborted) setEstado('error'); }
    };
    setEstado('cargando');
    comprobar();
    const cambio = () => { setEstado('cargando'); comprobar(); };
    window.addEventListener('sesion-cambiada', cambio);
    window.addEventListener('storage', cambio);
    return () => { controller.abort(); window.removeEventListener('sesion-cambiada', cambio); window.removeEventListener('storage', cambio); };
  }, [pathname, router]);

  const salir = async () => {
    try { await pedir('/api/auth/salir', {}); }
    catch { /* El cierre local también funciona si la API no está disponible. */ }
    finally { localStorage.removeItem('sesion'); window.dispatchEvent(new Event('sesion-cambiada')); router.replace('/'); }
  };

  if (estado !== 'permitido' || (area === 'contaduria' && pathname.startsWith('/kpis'))) {
    return <main className="p-8 text-slate-800"><p role="status">{estado === 'cargando' ? 'Verificando sesión…' : estado === 'denegado' ? 'Este módulo no está disponible para el área de Contaduría.' : estado === 'error' ? 'No se pudo verificar la sesión. Recarga la página para reintentar.' : 'Verificando acceso…'}</p><Link href="/" className="underline">Volver al inicio</Link></main>;
  }

  const modulos = [
    { href: '/matriz', title: 'Matriz legal' },
    ...(area === 'seguridad' ? [{ href: '/kpis', title: 'KPIs' }] : []),
    { href: '/manifiestos', title: 'Manifiestos' },
  ];

  return <><header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4 text-slate-900"><strong>{area === 'contaduria' ? 'Contaduría' : 'Seguridad'}</strong><nav aria-label={area === 'contaduria' ? 'Módulos de Contaduría' : 'Módulos de Seguridad'} className="flex flex-wrap gap-3">{modulos.map(item => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? 'page' : undefined} className={`rounded-lg px-4 py-2 font-medium ${pathname === item.href ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'}`}>{item.title}</Link>)}<button type="button" onClick={salir} className="rounded-lg border border-slate-300 px-4 py-2">Cerrar sesión</button></nav></header>{children}</>;
}
