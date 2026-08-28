import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

// jika result 503, bisa klik send lagi
// jika masih error, bisa ganti modelnya ke opsi model:
// gemini-2.5-flash-lite
// gemini-3.5-flash
// gemini-3.1-flash-lite
const GEMINI_MODEL = 'gemini-3.1-flash-lite';

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server ready on http://localhost:${PORT}`));

app.post('/api/chat', async (req, res) => {
    const { conversation } = req.body;
    try {
        if (!Array.isArray(conversation)) throw new Error('Messages must be an array');
        const contents = conversation.map(({ role, text, image, mimeType }) => {
            const parts = [];
            if (image && mimeType) {
                parts.push({
                    inlineData: {
                        mimeType,
                        data: image
                    }
                });
            }
            if (text) {
                parts.push({ text });
            } else if (parts.length === 0) {
                parts.push({ text: "" });
            }
            return {
                role,
                parts
            };
        });
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents,
            config: {
                temperature: 0.5,
                systemInstruction: `    
                    Anda adalah pelatih lari (Running Coach) profesional yang membantu pengguna menyusun program latihan lari yang efektif,
                    jawab hanya terkait pertanyaan seputar lari, kesehatan fisik, nutrisi pelari, dan tips latihan,
                    sapa pengguna dengan ramah dan penuh semangat, lalu tanyakan apa target lari mereka (misalnya: lari 5K pertama kali atau meningkatkan kecepatan), 
                    Tanyakan informasi pengguna secara bertahap, satu per satu, dan tunggu jawaban pengguna sebelum mengajukan pertanyaan berikutnya.
                    Jangan mengajukan semua pertanyaan sekaligus. Ikuti alur berikut:
                    1. Sapa pengguna dengan ramah, lalu tanyakan: "Apa target larimu saat ini? (contoh: lari 5K pertama, menambah kecepatan, atau lari jarak jauh)"
                    2. Setelah pengguna menjawab, simpan informasinya, lalu tanyakan: "Berapa kali dalam seminggu kamu bisa meluangkan waktu untuk berlatih lari?"
                    3. Setelah pengguna menjawab, simpan informasinya, lalu tanyakan: "Bagaimana tingkat kebugaranmu saat ini? (apakah baru mulai, atau sudah rutin berlari?)"
                    4. Setelah semua informasi terkumpul, berikan ringkasan data paling simple dan mudah di mengerti tersebut dan buatkan rencana latihan yang terstruktur dan personal.
                    jika pertanyaan dari user tidak ada hubungannya dengan lari maka jawab:  "maaf pertanyaan anda tidak bisa kami jawab karena tidak berhubungan dengan lari, adakah pertanyaan lain yang berhubungan dengan lari?"
                `
            }
        });
        res.status(200).json({ result: response.text })
    }
    catch (e) {
        res.status(500).json({ error: e.message })
    }
});