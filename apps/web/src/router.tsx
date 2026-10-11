import { createBrowserRouter, Navigate } from "react-router-dom";
import { Shell } from "./components/Shell";
import { Morning } from "./routes/Morning";
import { Today } from "./routes/Today";
import { Focus } from "./routes/Focus";
import { NightRitual } from "./routes/NightRitual";
import { Inbox } from "./routes/Inbox";
import { Capture } from "./routes/Capture";
import { WelcomeBack } from "./routes/WelcomeBack";
import { WeeklyReview } from "./routes/WeeklyReview";
import { MonthlyReview } from "./routes/MonthlyReview";
import { Cycle } from "./routes/Cycle";
import { Notes } from "./routes/Notes";
import { Settings } from "./routes/Settings";
import { Login } from "./routes/Login";

/** "/" decides: lapse → /welcome-back, before P1 started → /morning, after 21:00 → /ritual, else /today. */
function Home() {
  // TODO(v1)
  return <Navigate to="/today" replace />;
}

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },                // phase0, outside Shell
  {
    element: <Shell />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/morning", element: <Morning /> },          // v1
      { path: "/today", element: <Today /> },              // v1
      { path: "/focus", element: <Focus /> },              // v1
      { path: "/ritual", element: <NightRitual /> },       // v1
      { path: "/inbox", element: <Inbox /> },              // v1
      { path: "/capture", element: <Capture /> },          // v1 (share target)
      { path: "/welcome-back", element: <WelcomeBack /> }, // v1
      { path: "/review/week", element: <WeeklyReview /> }, // v2
      { path: "/review/month", element: <MonthlyReview /> },// v2
      { path: "/cycle", element: <Cycle /> },              // v2
      { path: "/notes/*", element: <Notes /> },            // v3
      { path: "/settings", element: <Settings /> },        // v1+
    ],
  },
]);
