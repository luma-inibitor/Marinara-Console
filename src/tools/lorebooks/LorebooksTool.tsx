import { Picker } from "./Picker";
import { BookAudit } from "./BookAudit";

export function LorebooksTool({ rest }: { rest: string[] }) {
  const bookId = rest[0];
  return bookId ? <BookAudit bookId={bookId} initialEntryId={rest[1]} key={bookId} /> : <Picker />;
}
