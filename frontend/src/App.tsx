import { useEffect, useState } from "react";
import "./App.css";

type Summary = {
  revenueAtRisk: number;
  recovered: number;
  failedPayments: number;
  recoveryRate: number;
};

type Recovery = {
  id: string;
  paymentId: string;
  orderId: string;
  amount: number;
  failureReason: string;
  status: string;
  retryCount: number;
  nextRetryAt: string | null;
  strategy: string | null;
  priority: string;
};

function App() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recoveries, setRecoveries] = useState<Recovery[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState("overview");
  const [statusFilter, setStatusFilter] = useState("all");

  // Load dashboard data
  const loadDashboard = async () => {
    try {
      const [summaryResponse, recoveryResponse] = await Promise.all([
        fetch("http://localhost:3000/dashboard/summary"),
        fetch("http://localhost:3000/recovery"),
      ]);

      const summaryData = await summaryResponse.json();
      const recoveryData = await recoveryResponse.json();

      setSummary(summaryData);
      setRecoveries(recoveryData);
    } catch (error) {
      console.error("Failed to load dashboard:", error);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  // Filter recovery queue
  const filteredRecoveries =
    statusFilter === "all"
      ? recoveries
      : recoveries.filter(
          (recovery) => recovery.status === statusFilter,
        );

  // Retry / recovery action
  const handleRecovery = async (recovery: Recovery) => {
    try {
      setLoadingId(recovery.id);

      const response = await fetch(
        `http://localhost:3000/recovery/${recovery.id}/retry`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error("Recovery request failed");
      }

      const updated = await response.json();

      console.log("Recovery updated:", updated);

      // Refresh dashboard after retry
      await loadDashboard();
    } catch (error) {
      console.error("Recovery action failed:", error);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="app">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <h2>Revenue OS</h2>

        <nav>
          <div
            className={`nav-item ${
              activePage === "overview" ? "active" : ""
            }`}
            onClick={() => setActivePage("overview")}
          >
            Overview
          </div>

          <div
            className={`nav-item ${
              activePage === "recovery" ? "active" : ""
            }`}
            onClick={() => setActivePage("recovery")}
          >
            Recovery
          </div>

          <div
            className={`nav-item ${
              activePage === "payments" ? "active" : ""
            }`}
            onClick={() => setActivePage("payments")}
          >
            Payments
          </div>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main">
        <header>
          <div>
            <h1>
              {activePage === "overview"
                ? "Revenue Recovery"
                : activePage === "recovery"
                  ? "Recovery Queue"
                  : "Payments"}
            </h1>

            <p>
              {activePage === "overview"
                ? "Monitor and recover failed payments."
                : activePage === "recovery"
                  ? "Manage and optimize payment recovery."
                  : "Monitor all payment activity."}
            </p>
          </div>
        </header>

        {/* STATS */}
        <section className="stats">
          <div className="card">
            <span>Revenue at Risk</span>
            <strong>
              ₹{summary?.revenueAtRisk?.toLocaleString("en-IN") ?? 0}
            </strong>
          </div>

          <div className="card">
            <span>Recovered</span>
            <strong>
              ₹{summary?.recovered?.toLocaleString("en-IN") ?? 0}
            </strong>
          </div>

          <div className="card">
            <span>Failed Payments</span>
            <strong>{summary?.failedPayments ?? 0}</strong>
          </div>

          <div className="card">
            <span>Recovery Rate</span>
            <strong>{summary?.recoveryRate ?? 0}%</strong>
          </div>
        </section>

        {/* RECOVERY QUEUE */}
        <section className="recovery-section">
          <div className="section-header">
            <div>
              <h2>Recovery Queue</h2>
              <p>Prioritized actions for failed payments</p>
            </div>

            {/* FILTER */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="status-filter"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="retrying">Retrying</option>
              <option value="action_required">
                Action Required
              </option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="recovery-list">
            {filteredRecoveries.map((recovery) => (
              <div className="recovery-row" key={recovery.id}>
                
                {/* PAYMENT INFO */}
                <div className="payment-info">
                  <strong>{recovery.orderId}</strong>

                  <span className="payment-meta">
                    ₹{recovery.amount.toLocaleString("en-IN")} ·{" "}
                    {recovery.failureReason.replaceAll("_", " ")}
                  </span>

                  <span className="strategy">
                    {recovery.strategy?.replaceAll("_", " ") ||
                      "standard retry"}
                  </span>
                </div>

                {/* PRIORITY */}
                <span
                  className={`priority ${recovery.priority}`}
                >
                  {recovery.priority}
                </span>

                {/* STATUS */}
                <span
                  className={`status ${recovery.status}`}
                >
                  {recovery.status.replaceAll("_", " ")}
                </span>

                {/* RETRIES */}
                <span className="retry-count">
                  Retries: {recovery.retryCount}
                </span>

                {/* ACTION BUTTON */}
                {(recovery.status === "pending" ||
                  recovery.status === "retrying") && (
                  <button
                    className="action-button"
                    onClick={() => handleRecovery(recovery)}
                    disabled={loadingId === recovery.id}
                  >
                    {loadingId === recovery.id
                      ? "Processing..."
                      : recovery.status === "retrying"
                        ? "Retry Again"
                        : recovery.strategy ===
                            "payment_method_update"
                          ? "Update Payment Method"
                          : "Retry Now"}
                  </button>
                )}
              </div>
            ))}

            {filteredRecoveries.length === 0 && (
              <div className="empty-state">
                No recovery actions found.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;