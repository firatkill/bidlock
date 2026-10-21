import Link from "next/link";
import { shellCopy as copy } from "@/domain/copy";
export default function NotFound() {
  return (
    <main>
      <h1>{copy.notFound}</h1>
      <Link href="/" className="mt-6 inline-block text-accent underline">
        {copy.lobby}
      </Link>
    </main>
  );
}
