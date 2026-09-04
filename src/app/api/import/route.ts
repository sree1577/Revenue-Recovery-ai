import Papa from "papaparse";
import { z } from "zod";
import { analyzeTransaction, type Transaction } from "@/lib/recovery-agent";

const rowSchema=z.object({transaction_id:z.string().min(1),customer_name:z.string().min(1),amount:z.coerce.number().positive(),payment_method:z.enum(["UPI","Card","Netbanking"]),failure_reason:z.enum(["UPI_REQUEST_EXPIRED","INCORRECT_OTP","BANK_TIMEOUT","INSUFFICIENT_FUNDS","CARD_EXPIRED","CARD_DECLINED","SUSPECTED_FRAUD"]),attempts:z.coerce.number().int().min(0),previous_successes:z.coerce.number().int().min(0),consent:z.string().transform(v=>v.toLowerCase()==="true")});
export async function POST(request:Request){
 const form=await request.formData(),file=form.get("file");if(!(file instanceof File))return Response.json({error:"Please choose a CSV file."},{status:400});if(file.size>2_000_000)return Response.json({error:"CSV must be smaller than 2 MB."},{status:400});
 const parsed=Papa.parse<Record<string,string>>(await file.text(),{header:true,skipEmptyLines:true,transformHeader:h=>h.trim().toLowerCase()});const seen=new Set<string>(),cases:unknown[]=[],errors:{row:number;message:string}[]=[];let duplicates=0;
 parsed.data.forEach((raw,index)=>{const result=rowSchema.safeParse(raw);if(!result.success){errors.push({row:index+2,message:result.error.issues.map(i=>`${i.path.join(".")}: ${i.message}`).join("; ")});return}if(seen.has(result.data.transaction_id)){duplicates++;return}seen.add(result.data.transaction_id);const tx:Transaction={id:result.data.transaction_id,customer:result.data.customer_name,amount:result.data.amount,method:result.data.payment_method,failureReason:result.data.failure_reason,attempts:result.data.attempts,previousSuccesses:result.data.previous_successes,consent:result.data.consent};cases.push({transaction:tx,decision:analyzeTransaction(tx)})});
 return Response.json({summary:{total:parsed.data.length,valid:cases.length,invalid:errors.length,duplicates},cases,errors:errors.slice(0,10)});
}
