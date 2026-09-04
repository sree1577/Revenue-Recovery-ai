import { analyzeTransaction, type Transaction } from "./recovery-agent";
const transactions:Transaction[]=[
 {id:"PAY-1048",customer:"Aarav Kumar",amount:2499,method:"UPI",failureReason:"UPI_REQUEST_EXPIRED",attempts:1,previousSuccesses:8,consent:true},
 {id:"PAY-1049",customer:"Meera Rao",amount:8900,method:"Netbanking",failureReason:"BANK_TIMEOUT",attempts:1,previousSuccesses:5,consent:true},
 {id:"PAY-1050",customer:"Vikram Shah",amount:18500,method:"Card",failureReason:"CARD_EXPIRED",attempts:1,previousSuccesses:11,consent:true},
 {id:"PAY-1051",customer:"Ananya Singh",amount:52000,method:"Card",failureReason:"CARD_DECLINED",attempts:2,previousSuccesses:3,consent:true},
 {id:"PAY-1052",customer:"Rohan Das",amount:3999,method:"Card",failureReason:"SUSPECTED_FRAUD",attempts:1,previousSuccesses:0,consent:true},
];
export const demoCases=transactions.map(transaction=>({transaction,decision:analyzeTransaction(transaction)}));
