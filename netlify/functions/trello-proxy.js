const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

exports.handler = async (event) => {
  try {
    // CORS preflight
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 204,
        headers: corsHeaders,
        body: ""
      };
    }

    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: corsHeaders,
        body: "Method Not Allowed"
      };
    }

    const body = JSON.parse(event.body || "{}");
    const action = body.action;

    const key = process.env.TRELLO_KEY;
    const token = process.env.TRELLO_TOKEN;
    const defaultListId = process.env.TRELLO_LIST_ID;
    
    if (!key || !token) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ ok: false, error: "Missing env vars (TRELLO_KEY/TRELLO_TOKEN)" }) };
    }


    if (action === "create_card") {
      const name = body.name || "Bug report";
      const desc = body.desc || "";
      const labels = body.labels || "";

      const idListToUse = body.listId || defaultListId;

      console.log("create_card idListToUse =", idListToUse, "body.listId =", body.listId);

      if (!idListToUse) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ ok: false, error: "Missing listId (provide body.listId or set TRELLO_LIST_ID)" }) };
      }
      
      const params = new URLSearchParams({
        key,
        token,
        idList: idListToUse,
        name,
        desc,
      });


      if (labels) params.set("idLabels", labels);

      const resp = await fetch("https://api.trello.com/1/cards", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      const text = await resp.text();
      if (!resp.ok) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ ok: false, http: resp.status, resp: text }) };
      }

      const json = JSON.parse(text);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true, cardId: json.id, cardUrl: json.url }) };
    }

    if (action === "attach_base64") {
      const cardId = body.cardId;
      const fileName = body.fileName || "attachment.bin";
      const fileBase64 = body.fileBase64;

      if (!cardId || !fileBase64) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ ok: false, error: "Missing cardId or fileBase64" }) };
      }

      const bin = Buffer.from(fileBase64, "base64");

      const fd = new FormData();
      fd.append("key", key);
      fd.append("token", token);
      fd.append("file", new Blob([bin]), fileName);
      fd.append("name", fileName);

      const resp = await fetch(`https://api.trello.com/1/cards/${cardId}/attachments`, {
        method: "POST",
        body: fd,
      });

      const text = await resp.text();
      if (!resp.ok) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ ok: false, http: resp.status, resp: text }) };
      }

      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ ok: false, error: "Unknown action" }) };
  } catch (e) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ ok: false, error: String(e) }) };
  }
};

