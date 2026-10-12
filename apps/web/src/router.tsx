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
import { Applications } from "./routes/Applications";
import { Stories } from "./routes/Stories";
import { Japanese } from "./routes/Japanese";
import { Settings } from "./routes/Settings";
import { Login } from "./routes/Login";
import { Calendar } from "./routes/Calendar";
import { welcomeBackSeenKey } from "./lib/format";
import { useDay, useToday } from "./lib/hooks";
import { decideHome } from "./lib/plan";
import { storage } from "./lib/storage";

/**
 * "/" decides (shared design, web flavour): missed yesterday and nothing started today → /welcome-back
 * (once a day); otherwise /today. Morning is the phone's screen, and ritual time shows a prompt on
 * Today instead of redirecting.
 */
function Home() {
  const today = useToday();
  const { data: day } = useDay(today);
  if (!day) return <p className="text-ink-2">Opening…</p>;
  const target = decideHome({
    yesterdayMissed: day.yesterdayMissed,
    todayStarted: day.started,
    welcomeBackSeen: storage.get(welcomeBackSeenKey(today)) === "1",
  });
  return <Navigate to={target} replace />;
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
      { path: "/calendar", element: <Calendar /> },        // v1 month, v2 week planner
      { path: "/inbox", element: <Inbox /> },              // v1
      { path: "/capture", element: <Capture /> },          // v1 (share target)
      { path: "/welcome-back", element: <WelcomeBack /> }, // v1
      { path: "/review/week", element: <WeeklyReview /> }, // v2
      { path: "/review/month", element: <MonthlyReview /> },// v2
      { path: "/cycle", element: <Cycle /> },              // v2
      { path: "/notes/*", element: <Notes /> },            // v3
      { path: "/applications", element: <Applications /> },// v3
      { path: "/stories", element: <Stories /> },          // v3
      { path: "/japanese", element: <Japanese /> },        // v3
      { path: "/settings", element: <Settings /> },        // v1+
    ],
  },
]);
