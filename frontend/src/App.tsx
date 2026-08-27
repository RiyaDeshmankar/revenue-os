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

type Payment = {
  id: string;
  orderId: string;
  amount: number;
  status: string;
  failureReason: string | null;
};

function App() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recoveries, setRecoveries] = useState<Recovery[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const [activePage, setActivePage] = useState("overview");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [summaryResponse, recoveryResponse, paymentsResponse] =
        await Promise.all([
          fetch("http://localhost:3000/dashboard/summary"),
          fetch("http://localhost:3000/recovery"),
          fetch("http://localhost:3000/payments"),
        ]);

      const summaryData = await summaryResponse.json();
      const recoveryData = await recoveryResponse.json();
      const paymentsData = await paymentsResponse.json();

      setSummary(summaryData);
      setRecoveries(recoveryData);
      setPayments(paymentsData);
    } catch (error) {
      console.error("Failed to load dashboard:", error);
    }
  };

  const filteredRecoveries =
    statusFilter === "all"
      ? recoveries
      : recoveries.filter(
          (recovery) => recovery.status === statusFilter,
        );

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

      await response.json();

      await loadDashboard();
    } catch (error) {
      console.error("Recovery action failed:", error);
    } finally {
      setLoadingId(null);
    }
  };

  const formatAmount = (amount: number) =>
    `₹${Number(amount).toLocaleString("en-IN")}`;

  const formatText = (text: string | null | undefined) =>
    text ? text.replaceAll("_", " ") : "Unknown";

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

      {/* MAIN */}
      <main className="main">
        {/* HEADER */}
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

        {/* ================= OVERVIEW ================= */}
        {activePage === "overview" && (
          <>
            {/* STATS */}
            <section className="stats">
              <div className="card">
                <span>Revenue at Risk</span>
                <strong>
                  {formatAmount(summary?.revenueAtRisk ?? 0)}
                </strong>
              </div>

              <div className="card">
                <span>Recovered</span>
                <strong>
                  {formatAmount(summary?.recovered ?? 0)}
                </strong>
              </div>

              <div className="card">
                <span>Failed Payments</span>
                <strong>
                  {summary?.failedPayments ?? 0}
                </strong>
              </div>

              <div className="card">
                <span>Recovery Rate</span>
                <strong>
                  {summary?.recoveryRate ?? 0}%
                </strong>
              </div>
            </section>

            {/* SMART INSIGHTS */}
            <section className="recovery-section">
              <h2>Smart Recovery Insights</h2>

              <p>
                Recommended actions based on payment failure
                patterns.
              </p>

              <div className="recovery-list">
                {recoveries
                  .filter(
                    (recovery) =>
                      recovery.status !== "recovered" &&
                      recovery.status !== "cancelled" &&
                      recovery.status !== "failed",
                  )
                  .map((recovery) => (
                    <div
                      className="recovery-row"
                      key={recovery.id}
                    >
                      <div className="payment-info">
                        <strong>{recovery.orderId}</strong>

                        <span className="payment-meta">
                          {formatAmount(recovery.amount)} ·{" "}
                          {formatText(recovery.failureReason)}
                        </span>

                        <span className="strategy">
                          Recommended:{" "}
                          <strong>
                            {formatText(recovery.strategy)}
                          </strong>
                        </span>

                        <span className="strategy">
                          {recovery.strategy ===
                          "payment_method_update"
                            ? "Customer should update their payment method."
                            : recovery.strategy === "quick_retry"
                              ? "Retry quickly while the failure is likely temporary."
                              : recovery.strategy ===
                                  "delayed_retry"
                                ? "Wait before retrying to improve recovery probability."
                                : "Use the standard recovery flow."}
                        </span>
                      </div>

                      <span
                        className={`priority ${recovery.priority}`}
                      >
                        {recovery.priority}
                      </span>
                    </div>
                  ))}

                {recoveries.filter(
                  (recovery) =>
                    recovery.status !== "recovered" &&
                    recovery.status !== "cancelled" &&
                    recovery.status !== "failed",
                ).length === 0 && (
                  <div className="empty-state">
                    No active recovery recommendations.
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {/* ================= RECOVERY ================= */}
        {activePage === "recovery" && (
          <section className="recovery-section">
            <h2>Recovery Queue</h2>

            <p>Prioritized actions for failed payments.</p>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="retrying">Retrying</option>
              <option value="failed">Failed</option>
              <option value="action_required">
                Action Required
              </option>
              <option value="cancelled">Cancelled</option>
            </select>

            <div className="recovery-list">
              {filteredRecoveries.map((recovery) => (
                <div
                  className="recovery-row"
                  key={recovery.id}
                >
                  <div className="payment-info">
                    <strong>{recovery.orderId}</strong>

                    <span className="payment-meta">
                      {formatAmount(recovery.amount)} ·{" "}
                      {formatText(recovery.failureReason)}
                    </span>

                    <span className="strategy">
                      {formatText(recovery.strategy)}
                    </span>
                  </div>

                  <span
                    className={`priority ${recovery.priority}`}
                  >
                    {recovery.priority}
                  </span>

                  <span
                    className={`status ${recovery.status}`}
                  >
                    {formatText(recovery.status)}
                  </span>

                  <span className="retry-count">
                    Retries: {recovery.retryCount}
                  </span>

                  {(recovery.status === "pending" ||
                    recovery.status === "retrying") && (
                    <button
                      className="action-button"
                      onClick={() =>
                        handleRecovery(recovery)
                      }
                      disabled={
                        loadingId === recovery.id
                      }
                    >
                      {loadingId === recovery.id
                        ? "Processing..."
                        : recovery.status === "retrying"
                          ? "Retry Again"
                          : "Retry Now"}
                    </button>
                  )}
                </div>
              ))}

              {filteredRecoveries.length === 0 && (
                <div className="empty-state">
                  No recoveries found.
                </div>
              )}
            </div>
          </section>
        )}

        {/* ================= PAYMENTS ================= */}
        {activePage === "payments" && (
          <section className="recovery-section">
            <h2>Payment Activity</h2>

            <p>
              All payments processed through Revenue OS.
            </p>

            <div className="recovery-list">
              {payments.map((payment) => (
                <div
                  className="recovery-row"
                  key={payment.id}
                >
                  <div className="payment-info">
                    <strong>{payment.orderId}</strong>

                    <span className="payment-meta">
                      {formatAmount(payment.amount)}
                    </span>

                    <span className="strategy">
                      {formatText(payment.failureReason)}
                    </span>
                  </div>

                  <span
                    className={`status ${payment.status}`}
                  >
                    {formatText(payment.status)}
                  </span>
                </div>
              ))}

              {payments.length === 0 && (
                <div className="empty-state">
                  No payments found.
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;