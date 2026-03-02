import { NextRequest, NextResponse } from 'next/server';

// Extend Netlify function timeout (seconds) — free plan max is 10s, paid is 26s
export const maxDuration = 60;

const GEMINI_KEY = process.env.GEMINI_API_KEY;
// Use gemini-2.0-flash — faster and more available than 1.5-flash
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4MB limit to stay within Gemini inline data limits

const PROMPT = `Analizza questa fattura/documento di acquisto e restituisci un JSON con la seguente struttura esatta (nient'altro, solo JSON valido, senza markdown):
{
  "supplier": "nome del fornitore",
  "invoiceDate": "YYYY-MM-DD",
  "invoiceNumber": "numero fattura o stringa vuota",
  "totalAmount": 123.45,
  "products": [
    {
      "name": "nome prodotto",
      "brand": "marca (se visibile, altrimenti stringa vuota)",
      "category": "categoria merceologica stimata (es: Colorazione, Trattamento, Shampoo, Attrezzatura, Detergente, ecc.)",
      "quantity": 2,
      "unit": "pz",
      "purchasePrice": 12.50,
      "totalPrice": 25.00
    }
  ]
}
Regole:
- quantity deve essere un numero intero positivo
- purchasePrice è il prezzo unitario IVA inclusa (o esclusa se è B2B, indica il prezzo scritto)
- unit può essere: pz, ml, g, l, kg, flacone, conf
- Se non riesci a leggere un valore, usa 0 per i numeri e "" per le stringhe
- Se la fattura contiene più righe dello stesso prodotto, accorpale
- Restituisci SOLO il JSON, senza testo aggiuntivo`;

export async function POST(req: NextRequest) {
  if (!GEMINI_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY non configurata.' }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nessun file ricevuto.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: `File troppo grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Massimo 4MB. Comprimi l\'immagine prima di caricarla.` }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mimeType = file.type || 'image/jpeg';

    // Gemini supports: image/jpeg, image/png, image/webp, image/heic, image/heif, application/pdf
    const supportedMime = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
    if (!supportedMime.includes(mimeType)) {
      return NextResponse.json({ error: `Formato non supportato: ${mimeType}. Usa JPG, PNG, WebP o PDF.` }, { status: 400 });
    }

    const geminiBody = {
      contents: [{
        parts: [
          { inlineData: { mimeType, data: base64 } },
          { text: PROMPT },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        topP: 0.95,
        maxOutputTokens: 4096,
      },
    };

    const resp = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Gemini API error:', errText);
      let userMsg = 'Errore API Gemini.';
      try {
        const errJson = JSON.parse(errText);
        const geminiMsg: string = errJson?.error?.message ?? '';
        if (geminiMsg.includes('API_KEY')) userMsg = 'Chiave API Gemini non valida o non autorizzata.';
        else if (geminiMsg.includes('quota') || geminiMsg.includes('QUOTA')) userMsg = 'Quota API Gemini esaurita. Riprova più tardi.';
        else if (geminiMsg.includes('size') || geminiMsg.includes('large')) userMsg = 'File troppo grande. Usa un\'immagine più piccola (max 4MB).';
        else if (geminiMsg) userMsg = `Gemini: ${geminiMsg}`;
      } catch { /* keep default */ }
      return NextResponse.json({ error: userMsg }, { status: 502 });
    }

    const data = await resp.json();
    const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    // Strip markdown code fences if present
    const cleaned = rawText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('Failed to parse Gemini output:', rawText);
      return NextResponse.json({ error: 'Impossibile interpretare la risposta AI. Riprova con un\'immagine più nitida.', raw: rawText }, { status: 422 });
    }

    return NextResponse.json({ success: true, data: parsed });
  } catch (e) {
    console.error('parse-invoice route error:', e);
    return NextResponse.json({ error: 'Errore server.' }, { status: 500 });
  }
}
