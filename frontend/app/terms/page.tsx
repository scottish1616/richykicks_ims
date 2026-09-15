export default function Page() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10 text-ivory">
      <h1 className="text-2xl font-semibold">Terms of Use</h1>
      <p className="mt-2 text-sm text-soft-gray">
        Last updated: {new Date().toLocaleDateString()}
      </p>

      <div className="mt-6 space-y-4 text-sm leading-relaxed text-soft-gray">
        <p>
          RichyKicks Inventory Management System is an internal tool built for
          RichyKicks shop staff to manage products, inventory, sales, and
          stock receiving. It is not a public-facing service and is not
          intended for use by customers.
        </p>
        <p>
          Access is limited to one Admin account and up to two Staff
          accounts, created and managed by the Admin. Each person is
          responsible for keeping their own login credentials confidential
          and must not share their account with anyone else.
        </p>
        <p>
          Records created in this system - including sales, stock receiving,
          and inventory history - are business records of RichyKicks and may
          not be altered or deleted except through the workflows the system
          provides. For example, sales records cannot be edited after the
          fact, and stock changes only take effect after Admin approval.
        </p>
        <p>
          This system is provided as-is for internal business use. RichyKicks
          makes no warranties about uptime or fitness for any purpose beyond
          its intended use as an internal inventory tool.
        </p>
        <p>Questions about these terms can be directed to the shop Admin.</p>
      </div>
    </main>
  );
}