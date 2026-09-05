import { useState } from "react";

export default function PaymentPage() {
  const paymentId = window.location.pathname.split("/").pop();

  const [loading, setLoading] = useState(false);
  const [paid, setPaid] = useState(false);

  const handlePayment = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        `http://localhost:3000/payments/${paymentId}/success`,
        { method: "POST" },
      );

      if (!response.ok) {
        throw new Error("Payment failed");
      }

      setPaid(true);
    } catch (error) {
      console.error(error);
      alert("Payment failed");
    } finally {
      setLoading(false);
    }
  };

  if (paid) {
    return (
      <div className="payment-page">
        <div className="payment-card">
          <h1>Payment Successful</h1>
          <p>Your payment has been completed successfully.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-page">
      <div className="payment-card">
        <h1>Complete Payment</h1>

        <p>Payment ID</p>
        <strong>{paymentId}</strong>

        <button onClick={handlePayment} disabled={loading}>
          {loading ? "Processing..." : "Pay Now"}
        </button>
      </div>
    </div>
  );
}