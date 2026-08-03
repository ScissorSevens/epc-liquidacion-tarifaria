# PRODUCT

## What this is

`sistema-epc` is a tariff liquidation system for rural water providers
(EPC — Empresas Prestadoras de Servicios Públicos de Agua) in the
department of Cundinamarca, Colombia. It runs as part of the
**"Agua la Vereda"** program coordinated by EPC Cundinamarca.

The product serves the **administrative operators** of approximately
**300 rural water providers** who need to configure prestador data,
municipal subsidy agreements (Acuerdo Municipal), tariff parameters
(costo fijo, bloques, mínimo vital), and bulk-import prestadores from
CSV before performing field captures and monthly liquidations.

## Register

**Product, not marketing site.** This is operational software — design
serves the product, not the other way around. The interface is a tool
that administrators use daily to record readings, settle monthly
balances, and configure regulatory parameters per prestador. Visual
ambition is welcome where it earns its place (data clarity, error
prevention, regulatory traceability), but decoration is not.

## Users

**Administrative operators** working at rural water providers in
Cundinamarca. They are not tech-savvy power users; they are municipal
employees juggling field work, billing cycles, and regulatory
reporting. They need:

- Clear, jargon-light labels (legal citations live in the docs, not on
  every label).
- Forms that survive typo-heavy input without losing their work.
- Visible audit trail (Ley 1581/2012 consentimiento, Res CRA 825/2017
  segmento classification).
- Recovery from intermittent connectivity (offline-first local
  storage).

## Personality

**Professional, clear, sober.** This is a regulatory-adjacent utility
that handles real money and real public-interest data. Voice should
feel like a competent municipal clerk, not a SaaS landing page.

## Anti-references

These aesthetics are wrong for this product:

- **ALL CAPS in body copy.** Labels and CTAs use Title Case. Legal
  citations live in documentation, not as parentheticals on every
  field label.
- **Promotional copy.** No "empower", "streamline", "seamless",
  "next-generation". Pick a specific verb for what the action does
  (Ver prestadores, Editar acuerdo, Importar prestadores).
- **Decorative color.** Accent color carries hierarchy, not
  decoration. Backgrounds are neutral.
- **Repeated card grids.** Menu surfaces are list rows with clear
  hierarchy, not four identical icon+title+description cards in a 2x2.
- **"2010 utility" aesthetic.** No beveled buttons, no rainbow chips,
  no uppercase tracked-out labels pretending to be design.

## Non-negotiables

- **Regulatory traceability.** Ley 1581/2012 (Habeas Data) and Res
  CRA 825/2017 (tariff structure) are referenced where they apply,
  but not as visual decoration.
- **Verb + object for CTAs.** Buttons say what they do.
- **Title Case for labels.** No `textTransform: 'uppercase'` on body
  sizes; reserved for badges ≤ 4 words if at all.
- **Accessibility.** Touch targets ≥ 44px, contrast ≥ 4.5:1, screen
  readers get standalone-meaning link text.

## Surfaces in scope

- `mobile/src/pantallas/SetupInicial.tsx` — first-run wizard for new
  prestador configuration.
- `mobile/src/pantallas/admin/Admin.tsx` — operator menu hub for the
  4 admin sub-flows.
- `mobile/src/pantallas/admin/*.tsx` — GestionPrestadores,
  AcuerdoMunicipal, ParametrosTarifa, ImportarPrestadores.
