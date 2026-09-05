import { useEffect, useState } from "react";
import PaymentPage from "./pages/PaymentPage";
import "./App.css";

type Summary = {
  revenueAtRisk: number;
  recovered: number;
  failedPayments: number;
  recoveryRate: number;
  failedRecoveryAmount: number;
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
  recoveryScore: number;
  confidence: number;
  reason: string | null;
  history: {
    action: string;
    timestamp: string;
    result?: string;
  }[];
};

type Payment = {
  id: string;
  orderId: string;
  amount: number;
  status: string;
  failureReason: string | null;
};

function App() {
    if (window.location.pathname.startsWith("/pay/")) {
    return <PaymentPage />;
  }
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recoveries, setRecoveries] = useState<Recovery[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [intelligenceSummary, setIntelligenceSummary] = useState<any[]>([]);

  const [activePage, setActivePage] = useState("overview");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedRecovery, setSelectedRecovery] = useState<Recovery | null>(
    null,
  );

  useEffect(() => {
    loadDashboard();

    const interval = setInterval(() => {
      loadDashboard();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const loadDashboard = async () => {
    try {
      const [
  summaryResponse,
  recoveryResponse,
  paymentsResponse,
  intelligenceResponse,
] = await Promise.all([
  fetch("http://localhost:3000/dashboard/summary"),
  fetch("http://localhost:3000/recovery"),
  fetch("http://localhost:3000/payments"),
  fetch("http://localhost:3000/recovery/intelligence-summary"),
]);

      if (
  !summaryResponse.ok ||
  !recoveryResponse.ok ||
  !paymentsResponse.ok ||
  !intelligenceResponse.ok
) {
  throw new Error("Failed to load dashboard data");
}

      const summaryData = await summaryResponse.json();
      const recoveryData = await recoveryResponse.json();
      const paymentsData = await paymentsResponse.json();
      const intelligenceData = await intelligenceResponse.json();

      setSummary(summaryData);
      setRecoveries(recoveryData);
      setPayments(paymentsData);
      setIntelligenceSummary(intelligenceData);
      
      // Keep selected recovery updated after actions / auto-refresh
      if (selectedRecovery) {
        const updatedRecovery = recoveryData.find(
          (item: Recovery) => item.id === selectedRecovery.id,
        );

        if (updatedRecovery) {
          setSelectedRecovery(updatedRecovery);
        }
      }
    } catch (error) {
      console.error("Failed to load dashboard:", error);
    }
  };

  const filteredRecoveries = (
    statusFilter === "all"
      ? [...recoveries]
      : recoveries.filter((recovery) => recovery.status === statusFilter)
  ).sort((a, b) => {
    const priorityWeight: Record<string, number> = {
      high: 3,
      medium: 2,
      low: 1,
    };

    const priorityDifference =
      (priorityWeight[b.priority] ?? 0) - (priorityWeight[a.priority] ?? 0);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return b.recoveryScore - a.recoveryScore;
  });

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

  const handlePaymentSuccess = async (payment: Payment) => {
  try {
    setLoadingId(payment.id);

    const response = await fetch(
      `http://localhost:3000/payments/${payment.id}/success`,
      {
        method: "POST",
      },
    );

    if (!response.ok) {
      throw new Error("Payment update failed");
    }

    await response.json();
    await loadDashboard();
  } catch (error) {
    console.error("Payment update failed:", error);
  } finally {
    setLoadingId(null);
  }
};
  const handleResolveAction = async (recovery: Recovery) => {
    try {
      setLoadingId(recovery.id);

      const response = await fetch(
        `http://localhost:3000/recovery/${recovery.id}/resolve`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error("Action resolution failed");
      }

      await response.json();
      await loadDashboard();
    } catch (error) {
      console.error("Action resolution failed:", error);
    } finally {
      setLoadingId(null);
    }
  };

  const handleReminder = async (recovery: Recovery) => {
    try {
      setLoadingId(recovery.id);

      const response = await fetch(
        `http://localhost:3000/recovery/${recovery.id}/remind`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error("Reminder failed");
      }

      await response.json();
      await loadDashboard();
    } catch (error) {
      console.error("Reminder failed:", error);
    } finally {
      setLoadingId(null);
    }
  };

  const handlePaymentLink = async (recovery: Recovery) => {
    try {
      setLoadingId(recovery.id);

      const response = await fetch(
        `http://localhost:3000/recovery/${recovery.id}/payment-link`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error("Payment link failed");
      }

      const data = await response.json();

      if (data.paymentLink) {
        await navigator.clipboard.writeText(data.paymentLink);
        alert("Recovery payment link copied!");
      }

      await loadDashboard();
    } catch (error) {
      console.error("Payment link failed:", error);
    } finally {
      setLoadingId(null);
    }
  };

  const handleDismiss = async (recovery: Recovery) => {
    try {
      setLoadingId(recovery.id);

      const response = await fetch(
        `http://localhost:3000/recovery/${recovery.id}/dismiss`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error("Dismiss failed");
      }

      await response.json();
      await loadDashboard();
    } catch (error) {
      console.error("Dismiss failed:", error);
    } finally {
      setLoadingId(null);
    }
  };

  const formatAmount = (amount: number) =>
    `₹${Number(amount).toLocaleString("en-IN")}`;

  const formatText = (text: string | null | undefined) =>
    text ? text.replaceAll("_", " ") : "Unknown";

  const formatDate = (date: string | null) => {
    if (!date) return "Not scheduled";

    return new Date(date).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "High chance";
    if (score >= 60) return "Moderate chance";
    return "Low chance";
  };

  const recoveryOpportunities = filteredRecoveries
    .filter(
      (recovery) =>
        recovery.status === "pending" ||
        recovery.status === "retrying" ||
        recovery.status === "action_required",
    )
    .sort((a, b) => b.recoveryScore - a.recoveryScore);

  return (
    <div className="app">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <h2>Revenue OS</h2>

        <nav>
          <div
            className={`nav-item ${activePage === "overview" ? "active" : ""}`}
            onClick={() => {
              setActivePage("overview");
              setSelectedRecovery(null);
            }}
          >
            Overview
          </div>

          <div
            className={`nav-item ${activePage === "recovery" ? "active" : ""}`}
            onClick={() => {
              setActivePage("recovery");
              setSelectedRecovery(null);
            }}
          >
            Recovery
          </div>

          <div
            className={`nav-item ${activePage === "payments" ? "active" : ""}`}
            onClick={() => {
              setActivePage("payments");
              setSelectedRecovery(null);
            }}
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
                  ? selectedRecovery
                    ? "Recovery Details"
                    : "Recovery Queue"
                  : "Payments"}
            </h1>

            <p>
              {activePage === "overview"
                ? "Monitor and recover failed payments."
                : activePage === "recovery"
                  ? selectedRecovery
                    ? "Complete recovery history and payment intelligence."
                    : "Manage and optimize payment recovery."
                  : "Monitor all payment activity."}
            </p>
          </div>
        </header>

        {/* ================= OVERVIEW ================= */}
        {activePage === "overview" && (
          <>
            <section className="stats">
              <div className="card">
                <span>Revenue at Risk</span>
                <strong>{formatAmount(summary?.revenueAtRisk ?? 0)}</strong>
                <small>Failed revenue requiring recovery</small>
              </div>

              <div className="card">
                <span>Recovered Revenue</span>
                <strong>{formatAmount(summary?.recovered ?? 0)}</strong>
                <small>Successfully recovered payments</small>
              </div>

              <div className="card">
                <span>Failed Payments</span>
                <strong>{summary?.failedPayments ?? 0}</strong>
                <small>Payments requiring attention</small>
              </div>

              <div className="card">
                <span>Recovery Rate</span>
                <strong>{summary?.recoveryRate ?? 0}%</strong>
                <small>Successful recovery percentage</small>
              </div>

              <div className="card">
                <span>Failed Recovery</span>
                <strong>
                  {formatAmount(summary?.failedRecoveryAmount ?? 0)}
                </strong>
              </div>
            </section>

            <section className="recovery-section">
              <h2>Smart Recovery Insights</h2>

              <p>
                Revenue OS analyzes payment failures and recommends the most
                suitable recovery strategy.
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
                    <div className="recovery-row" key={recovery.id}>
                      <div className="payment-info">
                        <strong
                          className="order-link"
                          onClick={() => {
                            setActivePage("recovery");
                            setSelectedRecovery(recovery);
                          }}
                        >
                          {recovery.orderId}
                        </strong>

                        <span className="payment-meta">
                          {formatAmount(recovery.amount)} ·{" "}
                          {formatText(recovery.failureReason)}
                        </span>

                        <span className="strategy">
                          Recommended:{" "}
                          <strong>{formatText(recovery.strategy)}</strong>
                        </span>

                        <span className="strategy">
                          {recovery.reason ||
                            "Standard recovery flow recommended."}
                        </span>

                        <span className="strategy">
                          Recovery Score:{" "}
                          <strong>{recovery.recoveryScore}/100</strong> ·{" "}
                          {getScoreLabel(recovery.recoveryScore)}
                        </span>

                        <span className="strategy">
                          Confidence: <strong>{recovery.confidence}%</strong>
                        </span>
                      </div>

                      <span className={`priority ${recovery.priority}`}>
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

            <section className="recovery-section">
  <h2>Top Recovery Opportunities</h2>

  <p>
    Payments with the highest probability of successful recovery.
  </p>

  <div className="recovery-list">
    {recoveries
      .filter(
        (recovery) =>
          recovery.status === "pending" ||
          recovery.status === "retrying" ||
          recovery.status === "action_required",
      )
      .sort((a, b) => b.recoveryScore - a.recoveryScore)
      .slice(0, 3)
      .map((recovery) => (
        <div
          className="recovery-row opportunity-row"
          key={recovery.id}
          onClick={() => {
            setActivePage("recovery");
            setSelectedRecovery(recovery);
          }}
        >
          <div className="payment-info">
            <strong className="order-link">
              {recovery.orderId}
            </strong>

            <span className="payment-meta">
              {formatAmount(recovery.amount)} ·{" "}
              {formatText(recovery.failureReason)}
            </span>

            <span className="strategy">
              Recommended:{" "}
              <strong>{formatText(recovery.strategy)}</strong>
            </span>
          </div>

          <span className={`priority ${recovery.priority}`}>
            {recovery.priority}
          </span>

          <div>
            <strong>
              {recovery.recoveryScore}/100
            </strong>
            <span className="score-label">
              {getScoreLabel(recovery.recoveryScore)}
            </span>
          </div>
        </div>
      ))}

    {recoveries.filter(
      (recovery) =>
        recovery.status === "pending" ||
        recovery.status === "retrying" ||
        recovery.status === "action_required",
    ).length === 0 && (
      <div className="empty-state">
        No active recovery opportunities.
      </div>
    )}
  </div>
</section>
<section className="recovery-section">
  <h2>Recent Recovery Outcomes</h2>

  <div className="recovery-list">
    {recoveries
      .filter((r) =>
        ["recovered", "failed", "action_required", "cancelled"].includes(
          r.status,
        ),
      )
      .slice(0, 5)
      .map((recovery) => (
        <div className="recovery-row" key={recovery.id}>
          <div className="payment-info">
            <strong>{recovery.orderId}</strong>

            <span className="payment-meta">
              {formatAmount(recovery.amount)} ·{" "}
              {formatText(recovery.strategy)}
            </span>
          </div>

          <span className={`status ${recovery.status}`}>
            {formatText(recovery.status)}
          </span>
        </div>
      ))}

    {recoveries.filter((r) =>
      ["recovered", "failed", "action_required", "cancelled"].includes(
        r.status,
      ),
    ).length === 0 && (
      <div className="empty-state">
        No recovery outcomes yet.
      </div>
    )}
  </div>
</section>

<section className="recovery-section">
  <h2>Recovery Intelligence</h2>

  <p>
    Historical outcomes help Revenue OS improve future recovery decisions.
  </p>

  <div className="intelligence-grid">
    {intelligenceSummary.map((item) => (
      <div className="intelligence-item" key={item.reason}>
        <strong>{formatText(item.reason)}</strong>

        <span>
          {item.recoveryRate}% recovery rate
        </span>

        <small>
          {item.recovered} recovered · {item.attempts} attempts
        </small>
      </div>
    ))}
  </div>
</section>
          </>
        )}

        {/* ================= RECOVERY ================= */}
        {activePage === "recovery" && !selectedRecovery && (
          <section className="recovery-section">
            <h2>Recovery Queue</h2>

            <p>Click an order to view its complete recovery history.</p>

            {recoveryOpportunities.length > 0 && (
              <div className="best-opportunity">
                <div>
                  <span className="best-opportunity-label">
                    BEST RECOVERY OPPORTUNITY
                  </span>

                  <strong>{recoveryOpportunities[0].orderId}</strong>

                  <p>
                    {formatAmount(recoveryOpportunities[0].amount)} ·{" "}
                    {formatText(recoveryOpportunities[0].failureReason)}
                  </p>
                </div>

                <div className="best-opportunity-score">
                  <strong>{recoveryOpportunities[0].recoveryScore}</strong>

                  <span>/100 recovery score</span>
                </div>
              </div>
            )}

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="retrying">Retrying</option>
              <option value="recovered">Recovered</option>
              <option value="failed">Failed</option>
              <option value="action_required">Action Required</option>
              <option value="cancelled">Cancelled</option>
              <option value="dismissed">Dismissed</option>
            </select>

            <div className="recovery-list">
              {filteredRecoveries.map((recovery) => (
                <div
                  className="recovery-row clickable"
                  key={recovery.id}
                  onClick={() => setSelectedRecovery(recovery)}
                >
                  <div className="payment-info">
                    <strong
                      className="order-link"
                      onClick={() => setSelectedRecovery(recovery)}
                    >
                      {recovery.orderId}
                    </strong>

                    <span className="payment-meta">
                      {formatAmount(recovery.amount)} ·{" "}
                      {formatText(recovery.failureReason)}
                    </span>

                    <span className="strategy">
                      Strategy: <strong>{formatText(recovery.strategy)}</strong>
                    </span>

                    <span className="strategy">
                      Score: <strong>{recovery.recoveryScore}/100</strong> ·
                      Confidence: <strong>{recovery.confidence}%</strong>
                    </span>

                    <span className="strategy">
                      {recovery.reason || "No additional reasoning available."}
                    </span>

                    {recovery.status === "retrying" && (
                      <span className="strategy">
                        Next retry:{" "}
                        <strong>{formatDate(recovery.nextRetryAt)}</strong>
                      </span>
                    )}
                    <span className="recovery-flow">
  Flow:{" "}
  <strong>
    {recovery.retryCount > 0
      ? `Retry ${recovery.retryCount}`
      : "Initial recovery"}
  </strong>
  {" → "}
  <strong>
    {formatText(recovery.strategy)}
  </strong>
</span>
                  </div>

                  <span className={`priority ${recovery.priority}`}>
                    {recovery.priority}
                  </span>

                  <span className={`status ${recovery.status}`}>
                    {formatText(recovery.status)}
                  </span>

                  <span className="retry-count">
                    Retries: {recovery.retryCount}
                  </span>

                  {recovery.status === "pending" && (
                    <>
                      <button
                        className="action-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRecovery(recovery);
                        }}
                        disabled={loadingId === recovery.id}
                      >
                        {loadingId === recovery.id
                          ? "Processing..."
                          : "Retry Now"}
                      </button>
                    </>
                  )}

                  {recovery.status === "action_required" && (
                    <button
                      className="action-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResolveAction(recovery);
                      }}
                      disabled={loadingId === recovery.id}
                    >
                      {loadingId === recovery.id
                        ? "Updating..."
                        : "Resolve Action"}
                    </button>
                  )}

                  {recovery.status === "retrying" && (
                    <span className="scheduled-label">Scheduled</span>
                  )}
                </div>
              ))}

              {filteredRecoveries.length === 0 && (
                <div className="empty-state">No recoveries found.</div>
              )}
            </div>
          </section>
        )}

        {/* ================= RECOVERY DETAILS ================= */}
        {activePage === "recovery" && selectedRecovery && (
          <section className="recovery-section">
            <button
              className="back-button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedRecovery(null);
              }}
            >
              ← Back to Recovery Queue
            </button>

            <div className="detail-header">
              <div>
                <h2>{selectedRecovery.orderId}</h2>

                <p>
                  {formatAmount(selectedRecovery.amount)} ·{" "}
                  {formatText(selectedRecovery.failureReason)}
                </p>
              </div>

              <span className={`status ${selectedRecovery.status}`}>
                {formatText(selectedRecovery.status)}
              </span>
            </div>

            <div className="detail-grid">
              <div>
                <span>Recovery Score</span>
                <strong>{selectedRecovery.recoveryScore}/100</strong>
              </div>

              <div>
                <span>Confidence</span>
                <strong>{selectedRecovery.confidence}%</strong>
              </div>

              <div>
                <span>Strategy</span>
                <strong>{formatText(selectedRecovery.strategy)}</strong>
              </div>

              <div>
                <span>Priority</span>
                <strong>{formatText(selectedRecovery.priority)}</strong>
              </div>

              <div>
                <span>Retries</span>
                <strong>{selectedRecovery.retryCount}</strong>
              </div>

              <div>
                <span>Payment ID</span>
                <strong>{selectedRecovery.paymentId}</strong>
              </div>
            </div>

            <div className="detail-reason">
              <strong>Why this strategy?</strong>

              <p>
                {selectedRecovery.reason ||
                  "No additional reasoning available."}
              </p>
            </div>
                    <div className="detail-actions">
  {selectedRecovery.status !== "recovered" &&
    selectedRecovery.status !== "dismissed" && (
      <>
        

        
      </>
    )}
</div>
            {/* ACTIONS */}
            <div className="detail-actions">
              {selectedRecovery.status === "pending" && (
                <>
                  <button
                    className="action-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRecovery(selectedRecovery);
                    }}
                    disabled={loadingId === selectedRecovery.id}
                  >
                    {loadingId === selectedRecovery.id
                      ? "Processing..."
                      : "Retry Now"}
                  </button>

                  <button
                    className="action-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReminder(selectedRecovery);
                    }}
                    disabled={loadingId === selectedRecovery.id}
                  >
                    Send Reminder
                  </button>

                  <button
                    className="action-button"
                    onClick={(e) => {
                      e.stopPropagation();

                      handlePaymentLink(selectedRecovery);
                    }}
                    disabled={loadingId === selectedRecovery.id}
                  >
                    Payment Link
                  </button>

                  <button
                    className="action-button"
                    onClick={(e) => {
                      e.stopPropagation();

                      handleDismiss(selectedRecovery);
                    }}
                    disabled={loadingId === selectedRecovery.id}
                  >
                    Dismiss
                  </button>
                </>
              )}

              {selectedRecovery.status === "action_required" && (
                <button
                  className="action-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResolveAction(selectedRecovery);
                  }}
                  disabled={loadingId === selectedRecovery.id}
                >
                  {loadingId === selectedRecovery.id
                    ? "Updating..."
                    : "Resolve Action"}
                </button>
              )}
            </div>

            {/* TIMELINE */}
            <div className="recovery-timeline">
              <h3>Recovery Timeline</h3>

              {(selectedRecovery.history ?? []).length === 0 ? (
                <div className="empty-state">
                  No recovery actions recorded yet.
                </div>
              ) : (
                <div className="timeline-list">
                  {[...(selectedRecovery.history ?? [])]
                    .reverse()
                    .map((event, index) => (
                      <div
                        className="timeline-event"
                        key={`${event.timestamp}-${index}`}
                      >
                        <div className="timeline-dot">●</div>

                        <div className="timeline-content">
                          <strong>{formatText(event.action)}</strong>

                          {event.result && <p>{event.result}</p>}

                          <small>{formatDate(event.timestamp)}</small>
                        </div>
                      </div>
                    ))}
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
              Payment status and recovery intelligence for every transaction.
            </p>

            <div className="recovery-list">
              {payments.map((payment) => {
                const recovery = recoveries.find(
                  (item) => item.paymentId === payment.id,
                );

                return (
                  <div className="recovery-row" key={payment.id}>
                    <div className="payment-info">
                      <strong>{payment.orderId}</strong>

                      <span className="payment-meta">
                        {formatAmount(payment.amount)}
                      </span>

                      <span className="strategy">
                        {payment.failureReason
                          ? formatText(payment.failureReason)
                          : "No failure"}
                      </span>

                      {recovery && (
                        <>
                          <span className="strategy">
                            Recovery strategy:{" "}
                            <strong>{formatText(recovery.strategy)}</strong>
                          </span>

                          <span className="strategy">
                            Recovery score:{" "}
                            <strong>{recovery.recoveryScore}/100</strong> ·
                            Confidence: <strong>{recovery.confidence}%</strong>
                          </span>

                          <span className="strategy">
                            Retries: <strong>{recovery.retryCount}</strong>
                          </span>
                        </>
                      )}
                    </div>

                    <span className={`status ${payment.status}`}>
                      {formatText(payment.status)}
                    </span>

                    {recovery && (
                      <span className={`status ${recovery.status}`}>
                        {formatText(recovery.status)}
                      </span>
                    )}
                    {payment.status === "failed" && (
  <button
    className="action-button"
    onClick={(e) => {
      e.stopPropagation();
      handlePaymentSuccess(payment);
    }}
    disabled={loadingId === payment.id}
  >
    {loadingId === payment.id
      ? "Updating..."
      : "Mark Successful"}
  </button>
)}
                  </div>
                );
              })}

              {payments.length === 0 && (
                <div className="empty-state">No payments found.</div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
