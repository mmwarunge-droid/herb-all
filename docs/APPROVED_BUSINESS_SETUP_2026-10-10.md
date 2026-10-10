# Approved business setup — 2026-10-10

The owner approved these administrator emails: **mmwarunge@gmail.com** and **dwmuriu725@gmail.com**. No production accounts or passwords are created by deployment. Once the private production database and required Functions environment are configured, run `npm run db:migrate`, then `npm run admin:create -- mmwarunge@gmail.com` in an interactive terminal. The hidden password prompt creates the first Super administrator only. Sign in at `/admin/` and create the second approved administrator through Accounts, choosing the required role and a separate strong password. Verify both sign-ins and logout. Do not repeat bootstrap to add staff.

## Real seedling catalogue

[data/approved-seedlings.json](../data/approved-seedlings.json) contains **63 owner-supplied varieties and KES prices**, dated 2026-10-10. The grouped mango and cooking/ripening/sweet banana entries are separate varieties with the same supplied price. Internal SKUs and slugs are generated identifiers, not owner-supplied codes. Units are seedlings. No additional cultivar claims, descriptions, photographs or stock counts are assumed.

After administrator provisioning, run:

```sh
npm run catalogue:import -- mmwarunge@gmail.com
```

This explicit operator command requires an active Super administrator. It creates unpublished, unavailable product drafts with zero recorded stock because quantities are unconfirmed. It runs transactionally, is audited through product creation and serializes concurrent imports. Repeating it skips existing SKUs and preserves every administrator edit, including prices, stock and photos. Conflicting slugs cause rollback rather than overwriting another product. It never runs automatically during migration, build, deployment or startup. No production import has been performed in this session.

In Products & stock, review each draft, upload actual product photos, enter physically verified stock through an adjustment with a reason, confirm the price and publish when ready. Admins can subsequently change prices, add products, manage photos and adjust stock using the existing role-protected tools. Zero draft stock is a safe placeholder, not a claim that the farm has no stock.

## Payment and collection terms

The owner approved **Pochi la Biashara 0722603819** (normalized server form **+254722603819**). The exact payee name shown by M-Pesa is still unverified. Do not infer it from the founder name or enable payment instructions before the payee is independently checked.

Proposed customer instructions, to enter with the verified payee through Business settings:

> For delivery, send the confirmed 50% merchandise deposit to Pochi la Biashara 0722603819 once Herb-All has confirmed your stock and delivery terms. Transport is quoted separately; your order shows any transport payment due upfront. No upfront payment is required when collecting from our Rongai Farm — pay in full at collection before handover. Confirm the displayed M-Pesa payee before approving payment, then submit the transaction code on your private order page. Never share your PIN.

New collection orders reserve stock without an upfront deposit and can be prepared after stock confirmation. Full verified payment is required at collection before handover, even if the general delivery balance policy allows payment on delivery. The current reconciliation mechanism records externally completed Pochi payments; it does not execute payments or introduce a cash payment ledger. Collection must be enabled explicitly in Business settings after arrangements are confirmed. Unpaid reservations retain the configured expiry window.

Migration 003 records the collection exception on new orders. Existing orders keep their original deposit terms, and migrations 001/002 remain unchanged. Apply all migrations before serving the updated commerce backend; rolling back application code to universal-deposit behavior would misrepresent new collection orders, so keep checkout closed and reconcile these orders before any such rollback.

## Production gate

GitHub `main` pushes automatically deploy to the existing Netlify project. This deploys source code; it does not provision PostgreSQL, inject private secrets, run production migrations, bootstrap administrators or import stock. Production database access and Netlify Functions configuration are still unavailable in this session. Checkout must remain disabled until those operations, actual stock, verified payee and the documented launch checks are complete. No production account, inventory import, payment or refund is claimed.
