'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Leaf, LockKeyhole, ShieldCheck, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { pedir, sesionActual } from '@/utils/api';

export default function AccesoCliente() {
  const router = useRouter();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const actual = sesionActual();
    if (actual?.token && actual.area === 'cliente') router.replace('/portal-cliente');
  }, [router]);

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError('');
    setProcesando(true);
    try {
      const datos = await pedir('/api/auth/cliente/login', {
        usuario: usuario.trim(), password
      });
      if (datos?.area !== 'cliente' || typeof datos?.token !== 'string' || !datos.token) {
        throw new Error('No fue posible verificar el acceso del cliente.');
      }
      localStorage.setItem('sesion', JSON.stringify(datos));
      window.dispatchEvent(new Event('sesion-cambiada'));
      router.replace('/portal-cliente');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.');
    } finally {
      setProcesando(false);
    }
  }

  return <main className="min-h-[calc(100vh-64px)] bg-[#f5f8f5] px-4 py-12 text-[#1a352d]">
    <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-[#dfeae1] bg-white shadow-[0_20px_80px_rgba(11,62,44,0.12)] md:grid-cols-2">
      <section className="bg-[#164b3d] p-8 text-white md:p-12">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">
          <Leaf size={19}/> US Technologies
        </div>
        <h1 className="mt-16 text-3xl font-semibold tracking-tight md:text-4xl">Tu material, en cada etapa.</h1>
        <p className="mt-5 text-sm leading-7 text-emerald-50/85">
          Consulta recepciones, seguimiento de procesamiento, humedad inicial, liberaciones y documentos de tus materiales con información registrada en Grafito.
        </p>
        <div className="mt-12 flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 p-4">
          <ShieldCheck size={26} className="shrink-0 text-emerald-200"/>
          <p className="text-xs leading-5 text-emerald-50">El portal es de solo consulta. Cada cliente tiene acceso exclusivo a sus propios registros.</p>
        </div>
      </section>
      <section className="flex flex-col justify-center p-8 md:p-12">
        <div className="mb-9 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
          <LockKeyhole size={24}/>
        </div>
        <h2 className="text-2xl font-semibold">Acceso de cliente</h2>
        <p className="mt-2 text-sm text-slate-500">Ingresa con las credenciales proporcionadas por US Technologies.</p>
        <form className="mt-8 space-y-5" onSubmit={entrar}>
          <label className="block text-sm font-semibold">Usuario
            <input className="mt-2 block w-full rounded-xl border border-slate-200 bg-[#fbfcfb] px-4 py-3 font-normal outline-none focus:border-emerald-600"
              value={usuario} onChange={e => setUsuario(e.target.value)} autoComplete="username" required maxLength={100} placeholder="Tu usuario"/>
          </label>
          <label className="block text-sm font-semibold">Contraseña
            <span className="relative mt-2 block">
              <input className="w-full rounded-xl border border-slate-200 bg-[#fbfcfb] px-4 py-3 pr-12 font-normal outline-none focus:border-emerald-600"
                value={password} onChange={e => setPassword(e.target.value)} type={visible ? 'text' : 'password'}
                autoComplete="current-password" required placeholder="Tu contraseña"/>
              <button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-3 top-3 text-slate-500 hover:text-emerald-800">
                {visible ? <EyeOff size={19}/> : <Eye size={19}/>}
              </button>
            </span>
          </label>
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          <button disabled={procesando} type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#13735c] p-3.5 text-sm font-semibold text-white hover:bg-[#105c49] disabled:opacity-60">
            {procesando ? 'Verificando...' : 'Entrar a mi dashboard'} <ArrowRight size={18}/>
          </button>
        </form>
        <p className="mt-8 text-center text-xs text-slate-500">
          ¿Eres parte del equipo? <Link href="/" className="font-semibold text-emerald-800 underline underline-offset-4">Acceder al sistema interno</Link>
        </p>
      </section>
    </div>
  </main>;
}
