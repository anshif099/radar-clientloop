import { createRoot } from "react-dom/client";
import { ChatWorkspace } from "../../src/components/chat-workspace";
import "../../src/app/globals.css";
import "../../src/components/chat.css";

// Standalone UI fixture. This is never an application route or an auth bypass.
createRoot(document.getElementById("root")!).render(<ChatWorkspace
  companies={[{ id: "company-a", name: "Acme Studio" }]}
  companyId="company-a" userId="client-a" isAdmin={false}
  initialKind="COMPANY" initialPostId="" initialPosts={[]}
/>);
