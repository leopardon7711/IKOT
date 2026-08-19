import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const prompt=`あなたは家族のおでかけ候補を整理するAIです。入力されたSNS/WEB共有情報から、わかる範囲だけを推定せず抽出してください。
JSONだけを返してください。キー:
name, category, place, budget, ages, duration, memo, photo_url, video_url
categoryは 食事,体を動かす,旅行,屋内施設,屋外施設,遊園地・テーマパーク,水族館・動物園,自然・公園,キャンプ,買い物,イベント,その他 のいずれか。
不明は空文字。`;

serve(async (req)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 try{
  const {title="",text="",url=""}=await req.json();
  const apiKey=Deno.env.get("OPENAI_API_KEY");
  if(!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${apiKey}`},
   body:JSON.stringify({model:Deno.env.get("OPENAI_MODEL")||"gpt-5-mini",input:[{role:"system",content:prompt},{role:"user",content:`title:${title}\ntext:${text}\nurl:${url}`}],text:{format:{type:"json_object"}}})});
  const d=await r.json(); if(!r.ok) throw new Error(d.error?.message||"OpenAI error");
  const out=d.output?.flatMap(x=>x.content||[]).find(x=>x.type==="output_text")?.text||"{}";
  return new Response(out,{headers:{...cors,"Content-Type":"application/json"}});
 }catch(e){return new Response(JSON.stringify({error:String(e.message||e)}),{status:500,headers:{...cors,"Content-Type":"application/json"}})}
});