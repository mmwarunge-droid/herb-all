# Commerce implementation plan

Audit: existing Astro 7 static site, Node 22, Netlify build and headers, Markdown sample catalogues, no database/authentication/server or existing migrations. Existing content, founder David Muriu Warunge, photographs and routes remain. No verified live domain, database access, Maps credentials or payment account available at audit.

1. Add PostgreSQL migrations, integer-cent finance, transactional reservations and immutable history, role sessions and controlled CLI provisioning.
2. Expose same-origin Netlify Functions for published catalogue, server-priced checkout, token-protected tracking/evidence and role-authorized operations.
3. Add integrated shop/cart/checkout/tracking and accessible operational admin pages using the existing design and static shell.
4. Add configurable Routes distance estimates, manual quotation fallback, owner-configured Pochi instructions, optional durable notification outbox.
5. Exercise real PostgreSQL concurrency/security/financial tests and browser workflows; document migrations, operations, configuration and deployment gates.

No sample stock/prices enter production. Payment configuration must explicitly be verified by a super administrator; the contact number is not assumed to be a payment account. No doctor title added. Public product images and private payment attachments are normalized to non-executable WebP and stored durably in PostgreSQL, not ephemeral disk. Static catalogue entries remain educational and separate from purchasable inventory.
