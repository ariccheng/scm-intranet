/* ---- Apps ------------------------------------------------------------------------------
   The dock, in order. Each app module exports mount(body, ctx) and may
   return {open(arg), destroy()}. Names come from ui.json ("app.<id>").
   Modules load on first use, so a broken app only breaks its own window. */
export const APPS = [
  { id: "mail", icon: "mail", load: () => import("./mail.js") },
  { id: "contacts", icon: "users", load: () => import("./contacts.js") },
  { id: "files", icon: "folder", load: () => import("./files.js") },
  { id: "calendar", icon: "calendar-days", load: () => import("./calendar.js") },
  { id: "dashboards", icon: "layout-dashboard", load: () => import("./dashboards.js") }
];

/* not in the dock: Credits opens from the system menu, Desk is the phone layout's tab for desk objects */
export const EXTRA = [
  { id: "credits", icon: "info", load: () => import("./credits.js") },
  { id: "desk", icon: "monitor", load: () => import("./desk.js") }
];

export const findApp = id => APPS.find(a => a.id === id) || EXTRA.find(a => a.id === id);
