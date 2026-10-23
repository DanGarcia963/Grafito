import { SeguridadService } from './seguridad.service';

describe('alta de trámites al catálogo legal', () => {
  const coincidencia = {
    id_Tramite_Catalogo: 7,
    id_Area: 1,
    nombre_Tramite: 'Visto bueno de protección civil municipal',
    activo: true,
    areas_legales: { nombre_Area: 'Municipal' },
  };

  const crearServicio = () => {
    const prisma = {
      areas_legales: {
        findUnique: jest.fn().mockResolvedValue({ id_Area: 2, activo: true }),
      },
      catalogo_tramites: {
        findMany: jest.fn().mockResolvedValue([coincidencia]),
        create: jest.fn().mockResolvedValue({
          id_Tramite_Catalogo: 8,
          id_Area: 2,
          nombre_Tramite: 'Visto bueno de protección civil municipal',
          areas_legales: { nombre_Area: 'Federal' },
        }),
      },
    };
    const eventos = { notificar: jest.fn() };
    return {
      servicio: new SeguridadService(prisma as any, eventos as any),
      prisma,
      eventos,
    };
  };

  it('devuelve nombres parecidos y sus áreas antes de insertar', async () => {
    const { servicio, prisma } = crearServicio();

    const resultado = await servicio.crearCatalogoTramite({
      id_Area: 2,
      nombre_Tramite: 'Visto bueno de protección civil municipal',
    });

    expect(resultado).toMatchObject({
      success: false,
      requiere_confirmacion: true,
      coincidencias: [
        {
          nombre_Tramite: coincidencia.nombre_Tramite,
          nombre_Area: 'Municipal',
          coincidencia: 100,
        },
      ],
    });
    expect(prisma.catalogo_tramites.create).not.toHaveBeenCalled();
  });

  it('permite continuar tras confirmar y notifica a las demás sesiones de Seguridad', async () => {
    const { servicio, prisma, eventos } = crearServicio();

    const resultado = await servicio.crearCatalogoTramite({
      id_Area: 2,
      nombre_Tramite: 'Visto bueno de protección civil municipal',
      confirmar_coincidencias: true,
    });

    expect(resultado).toMatchObject({
      success: true,
      coincidencias_detectadas: 1,
      tramite: {
        id_Tramite_Catalogo: 8,
        nombre_Area: 'Federal',
      },
    });
    expect(prisma.catalogo_tramites.create).toHaveBeenCalledTimes(1);
    expect(eventos.notificar).toHaveBeenCalledWith('TRAMITE_CATALOGO_CREADO', {
      id_Tramite_Catalogo: 8,
    });
  });
});
