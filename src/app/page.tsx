import { authenticated } from "@/lib/auth";
import { db } from "@/lib/db";
import App from "./ui";
export const dynamic = "force-dynamic";
export default async function Page() {
  return (
    <App
      loggedIn={await authenticated()}
      needsSetup={(await db.admin.count()) === 0}
    />
  );
}
