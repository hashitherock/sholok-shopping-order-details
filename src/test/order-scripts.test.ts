import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const html = readFileSync("public/order-details.html", "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1] ?? "").join("\n");

function initialize() {
  document.open();
  document.write(html.replace(/<script>[\s\S]*?<\/script>/g, ""));
  document.close();
  // Execute the actual uploaded scripts, with their original DOM and shared scope.
  return new Function(`${scripts}\nreturn { restoreSavedOrderState, getNotificationHistory, getStoredDeliveryAddress, saveDeliveryAddress, openNotificationComposer, trackingEvents, readOrderState, setStoredDeliveryAddress, savePaymentStatus, getCurrentPaymentStatus };`)() as {
    restoreSavedOrderState: () => void;
    getNotificationHistory: () => unknown[];
    getStoredDeliveryAddress: () => Record<string, string>;
    saveDeliveryAddress: () => void;
    openNotificationComposer: (context: string, text: string, message: string, type: string, channels: string[]) => void;
    trackingEvents: (shipment: Record<string, unknown>) => string[][];
    readOrderState: () => unknown;
    setStoredDeliveryAddress: (address: Record<string, string>) => void;
    savePaymentStatus: () => void;
    getCurrentPaymentStatus: () => string;
  };
}

describe("Uploaded order JavaScript regressions", () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it("restores the recorded payment amount rather than zeroing it", () => {
    const app = initialize();
    localStorage.setItem("sholok_order_state_#SHL-20260820-00453_payment", JSON.stringify({ status: "Partially Paid", amount: 100 }));
    app.restoreSavedOrderState();
    expect(document.getElementById("paymentStatusBadge")?.textContent).toBe("Partially Paid");
    expect(document.getElementById("paidAmount")?.textContent).toBe("৳100");
  });

  it("ignores malformed history and shipment data without throwing", () => {
    const app = initialize();
    localStorage.setItem("sholok_notification_history", '{"wrong":true}');
    localStorage.setItem("sholok_order_state_#SHL-20260820-00453", '{"shipments":[null]}');
    expect(app.getNotificationHistory()).toEqual([]);
    expect(() => app.restoreSavedOrderState()).not.toThrow();
  });

  it("carries the chosen notification channels into the composer", () => {
    const app = initialize();
    app.openNotificationComposer("order", "updated", "test", "Order Update", ["SMS"]);
    expect(document.querySelector<HTMLInputElement>("#manualEmail")?.checked).toBe(false);
    expect(document.querySelector<HTMLInputElement>("#manualSms")?.checked).toBe(true);
    expect(document.querySelector<HTMLInputElement>("#manualPush")?.checked).toBe(false);
  });

  it("keeps an address change available when browser storage is blocked", () => {
    const app = initialize();
    const address = { ...app.getStoredDeliveryAddress(), recipient: "Changed recipient" };
    const blocked = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    try {
      expect(() => app.setStoredDeliveryAddress(address)).not.toThrow();
      expect(app.getStoredDeliveryAddress()["recipient"]).toBe("Changed recipient");
    } finally { blocked.mockRestore(); }
  });

  it("includes recorded shipment status events in tracking", () => {
    const app = initialize();
    const events = app.trackingEvents({ status: "Cancelled", events: [{ status: "Cancelled", at: "2026-11-26T06:52:00Z", actor: "Admin" }] });
    expect(events.at(-1)?.[0]).toBe("Cancelled");
  });

  it("saves the payment note and uses the recorded status in customer documents", () => {
    const app = initialize();
    const select = document.querySelector<HTMLSelectElement>("#paymentStatusSelect");
    const amount = document.querySelector<HTMLInputElement>("#paymentAmount");
    const note = document.querySelector<HTMLTextAreaElement>("#paymentNote");
    if (!select || !amount || !note) throw new Error("Payment fields missing");
    select.value = "Partially Paid";
    amount.value = "100";
    note.value = "Collection recorded";
    app.savePaymentStatus();
    const payment: unknown = JSON.parse(localStorage.getItem("sholok_order_state_#SHL-20260820-00453_payment") ?? "null");
    expect(payment).toMatchObject({ status: "Partially Paid", amount: 100, note: "Collection recorded" });
    expect(app.getCurrentPaymentStatus()).toBe("Partially Paid");
  });
});