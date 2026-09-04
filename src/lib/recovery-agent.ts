export type FailureReason = "UPI_REQUEST_EXPIRED" | "INCORRECT_OTP" | "BANK_TIMEOUT" | "INSUFFICIENT_FUNDS" | "CARD_EXPIRED" | "CARD_DECLINED" | "CHECKOUT_ABANDONED" | "SUBSCRIPTION_FAILED" | "INVOICE_OVERDUE" | "PAYMENT_REQUEST_EXPIRED" | "CUSTOMER_CANCELLED" | "SUSPECTED_FRAUD";
export type Transaction = { id:string; customer:string; amount:number; method:"UPI"|"Card"|"Netbanking"; failureReason:FailureReason; attempts:number; previousSuccesses:number; consent:boolean; doNotContact?:boolean; alreadyPaid?:boolean };
export type RecoveryDecision = { score:number; probability:number; action:string; delayMinutes:number; requiresApproval:boolean; stopped:boolean; explanation:string };

const strategies: Record<FailureReason, Omit<RecoveryDecision,"score"|"requiresApproval"|"stopped">> = {
  UPI_REQUEST_EXPIRED:{probability:86,action:"Create fresh UPI payment link",delayMinutes:10,explanation:"The collect request expired; a fresh link removes the expired payment window."},
  INCORRECT_OTP:{probability:78,action:"Send secure retry link",delayMinutes:10,explanation:"This customer-correctable authentication failure usually succeeds on a careful retry."},
  BANK_TIMEOUT:{probability:71,action:"Wait, then offer alternate method",delayMinutes:30,explanation:"The bank is temporarily unavailable, so an immediate repeat may fail again."},
  INSUFFICIENT_FUNDS:{probability:52,action:"Schedule a low-pressure reminder",delayMinutes:720,explanation:"Repeated immediate attempts create fatigue; recovery should be delayed."},
  CARD_EXPIRED:{probability:68,action:"Offer UPI or another card",delayMinutes:15,explanation:"The same expired card cannot succeed; an alternative method is required."},
  CARD_DECLINED:{probability:61,action:"Offer alternative payment method",delayMinutes:30,explanation:"A different payment rail is safer than retrying the declined card."},
  CHECKOUT_ABANDONED:{probability:58,action:"Send one low-pressure recovery reminder",delayMinutes:60,explanation:"The checkout was not completed, so one consented reminder is appropriate after a short delay."},
  SUBSCRIPTION_FAILED:{probability:64,action:"Offer a secure subscription retry link",delayMinutes:30,explanation:"A secure retry link can restore the subscription without charging the customer automatically."},
  INVOICE_OVERDUE:{probability:54,action:"Send a payment reminder",delayMinutes:1440,explanation:"An overdue invoice should receive a measured reminder rather than repeated immediate attempts."},
  PAYMENT_REQUEST_EXPIRED:{probability:76,action:"Create a fresh payment link",delayMinutes:10,explanation:"The payment request expired; a fresh link removes the expired payment window."},
  CUSTOMER_CANCELLED:{probability:35,action:"Send one low-pressure reminder",delayMinutes:1440,explanation:"A customer cancellation permits at most one respectful reminder when consent is available."},
  SUSPECTED_FRAUD:{probability:5,action:"Escalate for human review",delayMinutes:0,explanation:"The risk signal blocks autonomous recovery and customer contact."},
};

export function analyzeTransaction(tx:Transaction):RecoveryDecision {
  const strategy=strategies[tx.failureReason];
  const stopped=Boolean(tx.alreadyPaid||tx.doNotContact||!tx.consent||tx.attempts>=3||tx.failureReason==="SUSPECTED_FRAUD");
  const stopReason=tx.alreadyPaid?"Payment is already confirmed.":tx.doNotContact||!tx.consent?"Customer communication consent is unavailable.":tx.attempts>=3?"Maximum of three recovery attempts reached.":tx.failureReason==="SUSPECTED_FRAUD"?"Risk policy requires human review.":"";
  const valueScore=Math.min(tx.amount/500,100), loyaltyScore=Math.min(tx.previousSuccesses*8,100), fatiguePenalty=tx.attempts*8;
  const score=Math.max(0,Math.min(100,Math.round(valueScore*.35+strategy.probability*.4+loyaltyScore*.25-fatiguePenalty)));
  return {...strategy,score,requiresApproval:tx.amount>=10000||tx.failureReason==="SUSPECTED_FRAUD",stopped,action:stopped?"Stop automated recovery":strategy.action,explanation:stopped?stopReason:strategy.explanation};
}
