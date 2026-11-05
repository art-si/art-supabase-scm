# Yiqi Workshop SCM · Supply Chain Management

Sales quotations, contracts, purchasing, shipping, and inventory traceability for [Yiqi Workshop](https://gitee.com/art-si/art-supabase-pro).

[Gitee](https://gitee.com/art-si/art-supabase-scm) · [GitHub](https://github.com/art-si/art-supabase-scm) · [Documentation](https://art-si.github.io/art-supabase-doc/modules/scm) · [简体中文](./README.md)

## Current capabilities

| Area | Scope |
| --- | --- |
| Quotations | Expense definitions, quotation categories, sales quotations, project summaries and related records |
| Conversions | Selected quotation lines and quantities into materials, sales contracts/orders, purchase requests/orders, quotation BOMs and MES work orders |
| Sales | Contracts, orders, shipping notices, loading, outbound allocations and partial fulfillment tracking |
| Purchasing | Contracts, requests, orders, receipt notices, source selection, contract pricing and printing |
| Integration | MDM materials and unit conversion, WMS receipts and issues, platform approvals, business references and inventory movements |

Recent work improves partial conversions, actual converted/remaining quantities, project quotation summaries, document/line selection, buyer assignment, historical purchase prices, source traceability and purchasing progress. Loading outbound operations support batches, serial numbers, partial posting and retry identity. Forms use the shared `ArtForm` configuration, with shared selectors, attachments, detail panels and retry states.

## Workflow boundaries

```text
MDM materials / units / warehouses / projects
  ├─ Quotation → Contract → Sales order → Shipping notice → Loading → WMS issue
  ├─ Purchase request / Contract → Purchase order → Receipt notice → WMS receipt
  └─ Quotation lines → Materials / Quotation BOM / MES work orders
```

Sales quotations, contracts and orders integrate with the platform approval engine. Active approvals protect document state; eligible originators may withdraw with the required permission. The server checks amounts, source relationships, conversion limits, stock and state changes. Inventory results come from WMS posting.

Warehouse receipts, returns and related operations belong to WMS. The purchase-request action for generating MES production plans is not connected yet. WMS issues and TMS carrier handover also require a separate integration contract.

## Development

Requires Node.js `>= 22.13.0` and pnpm `11.28.2`, as declared in `package.json`.

```powershell
pnpm install
pnpm dev
```

Open `http://localhost:3021/`. For an integrated checkout, initialize submodules and configure the backend using the host README first. The module resolves the shared platform runtime from the host workspace, the declared `art-supabase-pro` dependency, or `ART_SUPABASE_PLATFORM_ROOT`. Only public client credentials belong in frontend environment variables.

```powershell
pnpm typecheck
pnpm check
pnpm build
pnpm preview
```

`check` runs the boundary audit, UI audit, typecheck, ESLint and local unit tests. The versioned production output is `docs/`, with `/art-supabase-scm/` as its default public base path.

## Architecture and access

This repository owns domain pages, APIs, types and rules at `modules/art-supabase-scm`. Authentication, tenant scope, menus, permissions, layout, shared components and the common Supabase client belong to the host.

Ordinary users operate within their authenticated tenant and business permissions. Platform superusers may work across tenants or select a tenant; mutations retain an explicit record or parent tenant. Cross-module actions also require target-module permissions. Deletions use `MasterDataDeleteGuard` before confirmation and server-side reference enforcement; failed checks block deletion and allow retry.

Sales and purchase contract attachments live in document `details.contract_attachments` with a name, resource URL, file type and byte size. Saving a contract checks and locks the tenant-owned `sys_attachment` row; resource deletion is blocked while a contract references it. Conversion to another document kind removes this contract-only field. The host regression script is `tests/integration/scm-contract-attachments.sql`.

Commit and push module changes before updating the host's submodule pointer. Keep both README languages aligned with the implementation and documentation.

## License

[MulanPSL-2.0](LICENSE)
