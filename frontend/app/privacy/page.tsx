export default function Page() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10 text-ivory">
      <h1 className="text-2xl font-semibold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-soft-gray">
        Last updated: {new Date().toLocaleDateString()}
      </p>

      <div className="mt-6 space-y-4 text-sm leading-relaxed text-soft-gray">
        <p>
          This Privacy Policy covers the RichyKicks Inventory Management
          System, an internal tool used only by RichyKicks Admin and Staff.
          It does not apply to any customer-facing service, because this
          system has none.
        </p>

        <h2 className="text-base font-medium text-ivory">What we store</h2>
        <p>
          For each user account: name, email address, a securely hashed
          password (never the password itself), account role, and account
          activity such as login timestamps. For business operations:
          product, sales, and stock receiving records, each linked to the
          staff member who created them.
        </p>

        <h2 className="text-base font-medium text-ivory">How it&apos;s used</h2>
        <p>
          Account data is used only to authenticate users and enforce
          role-based access. Business records power the dashboard, reports,
          and inventory tracking described in this system. Nothing
          collected here is sold or shared with advertisers.
        </p>

        <h2 className="text-base font-medium text-ivory">Email</h2>
        <p>
          Password reset emails are sent through Resend, a transactional
          email provider. Resend receives only the recipient&apos;s email
          address and the content necessary to deliver that message.
        </p>

        <h2 className="text-base font-medium text-ivory">Data retention</h2>
        <p>
          Historical sales and stock receiving records are kept
          indefinitely as business records and are not casually deleted,
          consistent with standard inventory-management practice.
        </p>

        <h2 className="text-base font-medium text-ivory">Contact</h2>
        <p>Questions about this policy can be directed to the shop Admin.</p>
      </div>
    </main>
  );
}