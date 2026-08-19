# 1. Desarrollo del módulo de liquidación tarifaria

**Indicador de medida:** Sistema calcula tarifas correctamente
**Fecha de inicio:** 22/06/2026
**Fecha de terminación:** 4/07/2026
**% Avance:** 5%

## Resumen ejecutivo

Esta actividad implementa el núcleo del cálculo tarifario según la metodología CRA 825/2017 + 907/2019, soportando prestadores rurales con menos de 5.000 suscriptores. Incluye el rewrite del motor tarifario, la introducción de multi-tenancy (prestador, acuerdo, parámetros) y la migración de persistencia para soportar las nuevas entidades.

## Trabajo realizado

- **Motor tarifario reescrito** según Res CRA 825/2017 art. 14 y 907/2019 — fórmulas de CF, CC, subsidios (E1-E3), contribuciones (E5-E6) y CMA mínimo.
- **Multi-tenancy introducido** en backend y mobile: entidades `Prestador`, `Acuerdo`, `Parametros` con FK `id_prestador` en todas las tablas operativas.
- **Backend .NET 8:** repos EF Core para Prestador/Acuerdo/Parametros, `Acuerdo` + `Parametros` + `importar-csv` endpoints, `LiquidacionValidator/Mapper/Servicio` con Acuerdo vigente.
- **Mobile:** SQLite migrations 009-014, adaptadores expo-sqlite para prestador/acuerdo/parametros, bootstrap multi-tenant.
- **Dominio:** captura-lecturas con firma multi-tenant (prestador + parámetros), selector `categoria_uso` en AltaSuscriptor/EditarSuscriptor.
- **Cleanup:** remoción de `parametros-tarifarios-demo.ts` obsoleto.
- **Tests:** rewrite completo de los tests del motor tarifario para alinear con la nueva normativa (+98 tests).

## Evidencia

- **Commits:** 34 commits en el rango 22/06-04/07/2026
- **Archivos clave:**
  - `mobile/src/motor-tarifario/` (rewrite completo)
  - `backend/src/MediApp.Api/Features/Prestador/`, `Acuerdo/`, `Parametros/`
  - `mobile/src/persistencia/expo-sqlite/migraciones/009-014`
- **Métrica:** tests del motor tarifario pasan al 100% con la nueva normativa

## Estado

✅ **Completo.** El sistema calcula tarifas correctamente para prestadores rurales bajo CRA 825/2017 + 907/2019 dentro del alcance del MVP.
