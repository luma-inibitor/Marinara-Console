// Imports THROUGH the barrel, which is the arrangement a barrel is for: the
// re-export is live and Widget.tsx is reached only via the forwarding line.
import { Widget } from "./barrel";

console.log(Widget);
