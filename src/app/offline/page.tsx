import { copy } from "@/domain/copy";
export default function Offline() {
  return (
    <main>
      <h1>{copy.offline.heading}</h1>
      <p>{copy.offline.body}</p>
      <a href="https://github.com/firatkill/bidlock">{copy.offline.link}</a>
    </main>
  );
}
