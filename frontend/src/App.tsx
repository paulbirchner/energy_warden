import { useState } from "react";
import "./App.css";
import DashboardPage from "./pages/DashboardPage";
import ConsumptionPage from "./pages/ConsumptionPage";
import TariffPage from "./pages/TariffPage";
import AnalysisPage from "./pages/AnalysisPage";
import NotificationsPage from "./pages/NotificationsPage";
import RecommendationsPage from "./pages/RecommendationsPage";
import ReportsPage from "./pages/ReportsPage";
import { DemoDataControls } from "./components/DemoDataControls";

type Page = "dashboard" | "consumption" | "tariffs" | "analysis" | "recommendations" | "notifications" | "reports";

/**
 * Wurzelkomponente der Anwendung.
 * Verwaltet die aktive Seite ohne zusätzliche Router-Bibliothek und rendert
 * die globale Kopfzeile sowie den jeweils ausgewählten Funktionsbereich.
 */
export default function App() {
  const [page, setPage] = useState<Page>("dashboard");

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setPage("dashboard")}>
          <span className="brand-mark" aria-hidden="true">EW</span>
          <span>
            <strong>Energy Warden</strong>
            <small>Take control of your energy</small>
          </span>
        </button>

        <div className="topbar-actions">
          <nav aria-label="Main navigation">
          <button
            className={page === "dashboard" ? "nav-item active" : "nav-item"}
            type="button"
            onClick={() => setPage("dashboard")}
          >
            Dashboard
          </button>
          <button
            className={page === "consumption" ? "nav-item active" : "nav-item"}
            type="button"
            onClick={() => setPage("consumption")}
          >
            Consumption
          </button>
          <button
            className={page === "tariffs" ? "nav-item active" : "nav-item"}
            type="button"
            onClick={() => setPage("tariffs")}
          >
            Tariffs &amp; Costs
          </button>
          <button
            className={page === "analysis" ? "nav-item active" : "nav-item"}
            type="button"
            onClick={() => setPage("analysis")}
          >
            Analysis
          </button>
          <button
            className={page === "recommendations" ? "nav-item active" : "nav-item"}
            type="button"
            onClick={() => setPage("recommendations")}
          >
            Recommendations
          </button>
          <button
            className={page === "notifications" ? "nav-item active" : "nav-item"}
            type="button"
            onClick={() => setPage("notifications")}
          >
            Alerts
          </button>
          <button
            className={page === "reports" ? "nav-item active" : "nav-item"}
            type="button"
            onClick={() => setPage("reports")}
          >
            Reports
          </button>
          </nav>
          <DemoDataControls />
        </div>
      </header>

      {page === "dashboard" && <DashboardPage onNavigate={setPage} />}
      {page === "consumption" && <ConsumptionPage />}
      {page === "tariffs" && <TariffPage />}
      {page === "analysis" && <AnalysisPage />}
      {page === "recommendations" && <RecommendationsPage />}
      {page === "notifications" && <NotificationsPage />}
      {page === "reports" && <ReportsPage />}
    </div>
  );
}
