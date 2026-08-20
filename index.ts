import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS"
};

const CATEGORIES=["食事","体を動かす","旅行","屋内施設","屋外施設","遊園地・テーマパーク","水族館・動物園","自然・公園","キャンプ","買い物","イベント","その他"];

const SYSTEM=`あなたは家族向けおでかけ候補を整理するリサーチAIです。
SNSやWebから共有されたURL・タイトル・本文を手掛かりに、場所や施設を特定し、家族のおでかけ候補として整理してください。
必要ならWeb検索を使ってください。公式サイト・自治体・施設公式情報を優先し、SNSだけで断定しないでください。

重要ルール:
- 施設名や所在地などの事実は、確認できない場合に推測で埋めない。
- URLだけで施設を特定できない場合は found=false とし、分かる項目だけ返す。
- category は指定された候補のどれか1つ。
- budget は確認できた料金の要約。料金が不明なら空文字。
- ages は「おすすめ年齢」の目安なので、施設内容から常識的に提案してよい。ただし断定的な利用条件と混同しない。
- duration は滞在時間の目安。分からなければ空文字。
- memo は家族で後から見て役立つ短い日本語メモ。営業日・料金など変動しやすい数字は、確証が弱ければ書かない。
- photo_url は、直接表示できる画像URLを確実に確認できた場合だけ。推測・検索結果ページURLは不可。不明なら空文字。
- video_url は共有URL自体がInstagram Reel/TikTok/YouTube等の動画なら、そのURLを入れてよい。
- 元の共有URLは返却不要。
- 日本語で整理する。`;

const schema={
  type:"object",
  additionalProperties:false,
  properties:{
    found:{type:"boolean"},
    name:{type:"string"},
    category:{type:"string",enum:CATEGORIES},
    place:{type:"string"},
    budget:{type:"string"},
    ages:{type:"string"},
    duration:{type:"string"},
    memo:{type:"string"},
    photo_url:{type:"string"},
    video_url:{type:"string"},
    confidence:{type:"number",minimum:0,maximum:1}
  },
  required:["found","name","category","place","budget","ages","duration","memo","photo_url","video_url","confidence"]
};

function outputText(data:any){
  for(const item of data?.output||[]){
    for(const c of item?.content||[]){
      if(c?.type==="output_text" && typeof c.text==="string") return c.text;
    }
  }
  return "";
}

serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return new Response(JSON.stringify({error:"POST only"}),{status:405,headers:{...cors,"Content-Type":"application/json"}});

  try{
    const {title="",text="",url=""}=await req.json();
    if(!title && !text && !url) throw new Error("共有情報がありません");

    const apiKey=Deno.env.get("OPENAI_API_KEY");
    if(!apiKey) throw new Error("OPENAI_API_KEY が設定されていません");

    const model=Deno.env.get("OPENAI_MODEL")||"gpt-5.6-luna";
    const userInput=`共有タイトル: ${String(title).slice(0,1000)}\n共有本文: ${String(text).slice(0,3000)}\n共有URL: ${String(url).slice(0,2000)}\n\nこの共有先がどの施設・場所についてのものか調べ、IKOT用に整理してください。`;

    const r=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":`Bearer ${apiKey}`},
      body:JSON.stringify({
        model,
        instructions:SYSTEM,
        input:userInput,
        tools:[{type:"web_search"}],
        text:{
          format:{
            type:"json_schema",
            name:"ikot_place",
            strict:true,
            schema
          }
        }
      })
    });

    const data=await r.json();
    if(!r.ok) throw new Error(data?.error?.message||"OpenAI API error");
    const textOut=outputText(data);
    if(!textOut) throw new Error("AIの出力を取得できませんでした");
    const parsed=JSON.parse(textOut);

    return new Response(JSON.stringify(parsed),{headers:{...cors,"Content-Type":"application/json; charset=utf-8"}});
  }catch(e){
    console.error(e);
    return new Response(JSON.stringify({error:String(e?.message||e)}),{status:500,headers:{...cors,"Content-Type":"application/json; charset=utf-8"}});
  }
});
