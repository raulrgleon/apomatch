# Entrega de ApoMatch — 15 de octubre de 2026

**Estado: plataforma piloto funcional de extremo a extremo, con límites de producción explícitos.** No se ha fusionado a main ni desplegado en el servidor DNET.

| Entregable        | Ubicación / resultado                                                                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repositorio       | https://github.com/raulrgleon/apomatch                                                                                                                                  |
| Rama              | `feat/civic-platform`                                                                                                                                                   |
| Revisión          | https://github.com/raulrgleon/apomatch/pull/1                                                                                                                           |
| Código validado   | `37097ecc2435b6b90e7afa877a2a53d963f0f090`                                                                                                                              |
| CI aceptada       | https://github.com/raulrgleon/apomatch/actions/runs/38790449489                                                                                                         |
| Arquitectura      | Next.js App Router, React, TypeScript, PostgreSQL 16, Prisma y aplicación modular con API; [decisiones](architecture.md)                                                |
| Instalación       | [Guía y variables](installation.md), `.env.example`, Dockerfile y Compose                                                                                               |
| Coolify           | [Plan aislado, rollback, backup y restauración](deployment.md); requiere autorización independiente                                                                     |
| Pruebas           | 21 unitarias/componentes, 10 de integración y 12 recorridos de navegador; formato, linter, tipos, compilación, arranque Docker, backup y restauración aislada aprobados |
| Capturas reales   | [Escritorio](screenshots/desktop-overview.png), [móvil](screenshots/mobile-overview.png), [español oscuro](screenshots/desktop-spanish-dark.png)                        |
| Riesgos y alcance | [Seguridad y privacidad](security.md), [estado de implementación](implementation-status.md)                                                                             |

## Funciones disponibles

- Búsqueda por ciudad/código postal; interfaz pública en inglés y español; temas claro/oscuro y navegación móvil.
- Autenticación persistente, sesiones revocables, roles por organización, permisos comprobados en servidor, auditoría y exportación/eliminación de cuenta.
- BarrioDecide con reportes en PostgreSQL, moderación, filtros, búsqueda, paginación y seguimiento. Las actuaciones de autoridades requieren evidencia verificada.
- CeroRuido con fuentes oficiales del piloto, fecha electoral y responsabilidades públicas; ausencia de candidatos reales claramente indicada hasta su verificación.
- ApoMatch con temas guardados solo en el dispositivo y comparación descriptiva de propuestas verificadas, sin recomendaciones ni puntuaciones.
- ImpactoReal con una calculadora hipotética, fórmulas, unidades, supuestos y validación probada.
- VotoEnGrupo con grupos privados, invitaciones de un solo uso, eventos y recordatorios en la bandeja privada de la plataforma.
- Panel administrativo para contenido electoral, fuentes, correcciones con historial, revisión independiente, moderación, roles y auditoría.
- Adaptador opcional de IA documental para Ollama, desactivado por defecto; conserva procedencia y produce únicamente borradores.
- Organizaciones separadas y estructura de suscripciones preparada, sin cobros ni venta de perfiles políticos.

## Ejecución rápida

Requiere Node.js 24 y PostgreSQL 16. Después de clonar la rama:

```bash
npm ci
cp .env.example .env
# Configurar credenciales propias y origen, sin subir .env.
docker compose up -d db
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Abrir http://localhost:3000. Para la demostración ficticia aislada: http://localhost:3000/?org=demo. No hay contraseñas ni administradores predeterminados; el alta inicial está documentada.

Variables básicas: DATABASE_URL, APP_ORIGIN, SESSION_SECRET y POSTGRES_PASSWORD para Compose. IA opcional: AI_PROVIDER, OLLAMA_URL y OLLAMA_MODEL. No hace falta una API de pago.

## Pendientes y próximos pasos

Importación editorial completa y verificada de candidaturas/distritos; MFA y recuperación/verificación de correo; carga segura de imágenes; mensajes externos; mapas con límites oficiales; calculadoras basadas en presupuestos reales; pantallas ampliadas de compromisos públicos y autoservicio comercial. Algunas tablas preparan estas ampliaciones sin afirmar que sus interfaces estén terminadas.

La auditoría de dependencias de producción no reportó vulnerabilidades conocidas. El ensayo de backup/restauración se ejecutó en CI, no en DNET.

Antes de lanzamiento: revisión legal y de seguridad, auditoría de accesibilidad completa, configuración de un entorno aislado autorizado y una prueba de restauración en ese entorno. Los detalles y prioridades están en [estado de implementación](implementation-status.md).

Ningún contenedor, red, puerto, proxy, volumen, certificado, backup o servicio existente de DNET fue modificado.
