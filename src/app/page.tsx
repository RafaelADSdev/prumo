import { authenticated } from "@/lib/auth";
import { db } from "@/lib/db";
import App from "./ui";
export const dynamic = "force-dynamic";
export default async function Page() {
  return (
    <App
      loggedIn={await authenticated()}
      cloudStorage={/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL || "")}
      needsSetup={(await db.admin.count()) === 0}
    />
  );
}
