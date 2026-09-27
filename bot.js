const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason,
    downloadMediaMessage
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { exec } = require('child_process');

// Interface input terminal untuk nombor telefon Pairing Code
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

let isBotFeaturesOn = false;
const repliedUsers = new Set();
let lastActiveTime = 0;
const OFFLINE_THRESHOLD = 5 * 60 * 1000; // 5 minit
const botStartTime = Date.now();

// Simpan sesi user untuk stiker & permainan teka ayat
const waitingStickerUsers = new Set();
const tekaAyatSessions = new Map(); // Simpan { question, timer } per chat

// Bank 100 Soalan & Level Teka Ayat
const tekaAyatData = [
    { level: 1, clue: "Orang yang suka membaca buku", answer: "ulat buku" },
    { level: 2, clue: "Seseorang yang tidak tahu malu", answer: "muka tembok" },
    { level: 3, clue: "Suka mengambil barang orang tanpa izin", answer: "panjang tangan" },
    { level: 4, clue: "Menerima rasuah", answer: "makan suap" },
    { level: 5, clue: "Hadiah yang dibawa semasa menziarahi orang", answer: "buah tangan" },
    { level: 6, clue: "Anak yang sangat disayangi oleh ibu bapa", answer: "anak emas" },
    { level: 7, clue: "Sukar untuk mendengar atau pekak", answer: "berat telinga" },
    { level: 8, clue: "Orang yang malas bekerja", answer: "berat tulang" },
    { level: 9, clue: "Orang yang suka bercakap banyak", answer: "mulut murai" },
    { level: 10, clue: "Orang yang tidak tahu bermain bola sepak", answer: "kaki bangku" },
    { level: 11, clue: "Tidak sombong atau peramah", answer: "rendah hati" },
    { level: 12, clue: "Orang yang sangat kedekut", answer: "tangkai jering" },
    { level: 13, clue: "Marah yang terpendam", answer: "makan hati" },
    { level: 14, clue: "Orang yang berasa megah atau sombong", answer: "hidung tinggi" },
    { level: 15, clue: "Berasa iri hati atau cemburu", answer: "buta hati" },
    { level: 16, clue: "Mencari rezeki atau nafkah", answer: "cari makan" },
    { level: 17, clue: "Suka membantu orang lain", answer: "ringan tulang" },
    { level: 18, clue: "Hasil karya tulisan atau buku seseorang", answer: "buah fikiran" },
    { level: 19, clue: "Mati katak / mati sia-sia", answer: "mati katak" },
    { level: 20, clue: "Berjalan tanpa arah tujuan", answer: "cuci mata" },
    { level: 21, clue: "Peluang yang datang secara kebetulan", answer: "langkah kanan" },
    { level: 22, clue: "Bernasib malang atau lambat sampai", answer: "langkah kiri" },
    { level: 23, clue: "Menyimpan dendam yang lama", answer: "menabur bara" },
    { level: 24, clue: "Orang yang cepat marah", answer: "naik darah" },
    { level: 25, clue: "Suka berkhayal perkara yang mustahil", answer: "angan angan mat jenin" },
    { level: 26, clue: "Tidak tahu membaca atau buta huruf", answer: "buta huruf" },
    { level: 27, clue: "Bersendirian tanpa kawan", answer: "sebatang kara" },
    { level: 28, clue: "Suka mengintip atau mendengar rahsia", answer: "pasang telinga" },
    { level: 29, clue: "Mendapat keuntungan berganda", answer: "durian runtuh" },
    { level: 30, clue: "Tidak tahu membalas budi", answer: "kacang lupakan kulit" },
    { level: 31, clue: "Bercakap besar tetapi tiada bukti", answer: "tin kosong" },
    { level: 32, clue: "Hilang sabar atau mengamuk", answer: "naik angin" },
    { level: 33, clue: "Orang yang menjadi harapan keluarga", answer: "tulang belakang" },
    { level: 34, clue: "Menyerah kalah dalam perjuangan", answer: "angkat bendera putih" },
    { level: 35, clue: "Mencuri tumpuan orang ramai", answer: "tarik perhatian" },
    { level: 36, clue: "Memulakan sesuatu usaha dengan tekun", answer: "ikat perut" },
    { level: 37, clue: "Bekerja tanpa henti atau sangat gigih", answer: "mandi peluh" },
    { level: 38, clue: "Masa depan yang cerah dan baik", answer: "ada jalan" },
    { level: 39, clue: "Orang yang menjadi ejen pengintip", answer: "mata mata" },
    { level: 40, clue: "Hati yang sangat sedih dan hiba", answer: "hancur hati" },
    { level: 41, clue: "Percakapan yang tidak masuk akal", answer: "cakap angin" },
    { level: 42, clue: "Suka membocorkan rahsia rakan", answer: "pecah tembelang" },
    { level: 43, clue: "Perasaan takut atau cemas secara tiba-tiba", answer: "patah semangat" },
    { level: 44, clue: "Seseorang yang amat setia dan jujur", answer: "lurus bendul" },
    { level: 45, clue: "Berlagak pandai padahal tidak tahu", answer: "otak udang" },
    { level: 46, clue: "Menghabiskan wang dengan boros", answer: "buang duit" },
    { level: 47, clue: "Keluarga atau sanak saudara sendiri", answer: "darah daging" },
    { level: 48, clue: "Cepat faham atau cerdik", answer: "terang hati" },
    { level: 49, clue: "Susah untuk belajar atau lambat faham", answer: "gelap hati" },
    { level: 50, clue: "Pergaduhan yang tidak berkesudahan", answer: "anjing dengan kucing" },
    { level: 51, clue: "Orang yang selalu berpindah-randah", answer: "seperti belut pulang ke lumpur" },
    { level: 52, clue: "Mementingkan diri sendiri", answer: "bagai enau dalam belukar" },
    { level: 53, clue: "Malu yang amat sangat", answer: "tebal muka" },
    { level: 54, clue: "Orang tengah yang mendamaikan perselisihan", answer: "orang perantaraan" },
    { level: 55, clue: "Suka berbelanja besar tanpa kawalan", answer: "boros belanja" },
    { level: 56, clue: "Mati kerana dibunuh secara rahsia", answer: "hilang nyawa" },
    { level: 57, clue: "Mendapat malu besar di khalayak", answer: "jatuh air muka" },
    { level: 58, clue: "Senyuman yang dibuat-buat atau palsu", answer: "senyum kambing" },
    { level: 59, clue: "Perkhabaran yang belum tentu sahih", answer: "khabar angin" },
    { level: 60, clue: "Memasang niat yang jahat", answer: "ada udang di sebalik batu" },
    { level: 61, clue: "Berputus asa daripada mencuba", answer: "patah arang" },
    { level: 62, clue: "Sentiasa bersiap sedia sebelum terlambat", answer: "sedia payung sebelum hujan" },
    { level: 63, clue: "Meniru gaya orang lain tanpa sedar", answer: "ikut telunjuk" },
    { level: 64, clue: "Sukar membuat pilihan antara dua yang baik", answer: "rambang mata" },
    { level: 65, clue: "Orang yang bersubahat dengan musuh", answer: "musuh dalam selimut" },
    { level: 66, clue: "Berbuat baik berpada-pada", answer: "buat baik berpada pada" },
    { level: 67, clue: "Usaha yang sia-sia atau membazir masa", answer: "mencurah air ke daun keladi" },
    { level: 68, clue: "Tidak tetap pendirian atau sering berubah", answer: "bagai lalang ditiup angin" },
    { level: 69, clue: "Seseorang yang terlalu mengikut perasaan", answer: "ikut rasa binasa" },
    { level: 70, clue: "Kata-kata manis yang memikat", answer: "mulut manis" },
    { level: 71, clue: "Sangat pantas berlari atau melarikan diri", answer: "pantas akal" },
    { level: 72, clue: "Perasaan gembira yang meluap-luap", answer: "besar hati" },
    { level: 73, clue: "Menanggung kerugian yang amat banyak", answer: "gulung tikar" },
    { level: 74, clue: "Pergaduhan adik-beradik yang cepat berbaik", answer: "carik carik bulu ayam" },
    { level: 75, clue: "Membawa nasib yang buruk", answer: "pembawa sial" },
    { level: 76, clue: "Orang yang suka berpura-pura baik", answer: "talam dua muka" },
    { level: 77, clue: "Kelihatan lemah tetapi sebenarnya handal", answer: "diam diam ubi berisi" },
    { level: 78, clue: "Suka tidur lewat malam", answer: "burung hantu" },
    { level: 79, clue: "Suka mencari salah orang lain", answer: "cari fasal" },
    { level: 80, clue: "Terpaksa menurut perintah orang kuat", answer: "bagai lembu dicucuk hidung" },
    { level: 81, clue: "Hutang yang terlalu bertimbun", answer: "keliling pinggang" },
    { level: 82, clue: "Dua orang yang sangat sepadan dan cocok", answer: "bagai pinang dibelah dua" },
    { level: 83, clue: "Harta yang tidak boleh dijual beli", answer: "harta pusaka" },
    { level: 84, clue: "Orang yang suka mengadu domba", answer: "batu api" },
    { level: 85, clue: "Berdiam diri tanpa memberi jawapan", answer: "kunci mulut" },
    { level: 86, clue: "Perkara yang mustahil untuk dipisahkan", answer: "isi dengan kuku" },
    { level: 87, clue: "Sangat rapat seperti saudara kandung", answer: "bagai aur dengan tebing" },
    { level: 88, clue: "Bekerja separuh jalan dan tinggalkan", answer: "hangat hangat tahi ayam" },
    { level: 89, clue: "Rasa serba salah untuk bertindak", answer: "makan buah simalakama" },
    { level: 90, clue: "Orang yang tamak mahukan segalanya", answer: "tangan terbuka" },
    { level: 91, clue: "Mengaku salah sebelum dituduh", answer: "siapa makan cili terasa pedas" },
    { level: 92, clue: "Berani kerana benar takut kerana salah", answer: "berani mati" },
    { level: 93, clue: "Membuka pekung di dada sendiri", answer: "buka rahsia" },
    { level: 94, clue: "Tempat bergantung hidup", answer: "tempat bernaung" },
    { level: 95, clue: "Mendapat sesuatu tanpa perlu bersusah payah", answer: "rezeki terpijak" },
    { level: 96, clue: "Sombong kerana mendapat pangkat baru", answer: "kera dapat bunga" },
    { level: 97, clue: "Ketinggalan zaman atau tidak moden", answer: "katak bawah tempurung" },
    { level: 98, clue: "Perasaan hampa apabila hajat tidak tercapai", answer: "gigit jari" },
    { level: 99, clue: "Keadaan yang sangat tenang tanpa masalah", answer: "senang hati" },
    { level: 100, clue: "Kejayaan tertinggi yang dicapai dalam hidup", answer: "puncak kejayaan" }
];

// Jana pembayang huruf rawak daripada jawapan
function generateHint(answer) {
    return answer.split('').map(char => {
        if (char === ' ') return '   ';
        return Math.random() > 0.5 ? char.toUpperCase() : '_';
    }).join(' ');
}

// Format masa aktif bot
function formatRuntime(seconds) {
    seconds = Number(seconds);
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d > 0 ? d + 'h ' : ''}${h > 0 ? h + 'j ' : ''}${m > 0 ? m + 'm ' : ''}${s}s`;
}

// Fungsi EXIF WhatsApp Stiker
function createExif(packname, author, outputPath) {
    const json = {
        'sticker-pack-id': 'com.vernuxproject.anip',
        'sticker-pack-name': packname,
        'sticker-pack-publisher': author,
        'emojis': ['😁']
    };

    const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
    const jsonBuff = Buffer.from(JSON.stringify(json), 'utf-8');
    const exif = Buffer.concat([exifAttr, jsonBuff]);
    exif.writeUIntLE(jsonBuff.length, 14, 4);

    fs.writeFileSync(outputPath, exif);
}

// Buat stiker berserta metadata EXIF
function createStickerWithExif(imageBuffer, packname, author) {
    return new Promise((resolve, reject) => {
        const id = Date.now();
        const inputImg = path.join(__dirname, `temp_${id}.png`);
        const tempWebp = path.join(__dirname, `temp_${id}.webp`);
        const exifPath = path.join(__dirname, `temp_${id}.exif`);
        const finalWebp = path.join(__dirname, `final_${id}.webp`);

        fs.writeFileSync(inputImg, imageBuffer);
        createExif(packname, author, exifPath);

        const cmdFfmpeg = `ffmpeg -y -i "${inputImg}" -vcodec libwebp -filter:v "scale='if(gt(a,1),512,-1)':'if(gt(a,1),-1,512)',pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000" -lossless 0 -compression_level 6 -q:v 50 -loop 0 -preset default -an -fps_mode passthrough "${tempWebp}"`;

        exec(cmdFfmpeg, (err) => {
            if (err) {
                cleanFiles([inputImg, tempWebp, exifPath, finalWebp]);
                return reject(err);
            }

            const cmdMux = `webpmux -set exif "${exifPath}" "${tempWebp}" -o "${finalWebp}"`;

            exec(cmdMux, (muxErr) => {
                if (muxErr) {
                    cleanFiles([inputImg, tempWebp, exifPath, finalWebp]);
                    return reject(muxErr);
                }

                const resultBuffer = fs.readFileSync(finalWebp);
                cleanFiles([inputImg, tempWebp, exifPath, finalWebp]);
                resolve(resultBuffer);
            });
        });
    });
}

// WebP -> JPG
function convertWebpToJpg(webpBuffer) {
    return new Promise((resolve, reject) => {
        const id = Date.now();
        const inputWebp = path.join(__dirname, `temp_${id}.webp`);
        const outputJpg = path.join(__dirname, `temp_${id}.jpg`);

        fs.writeFileSync(inputWebp, webpBuffer);

        const cmd = `ffmpeg -y -i "${inputWebp}" "${outputJpg}"`;

        exec(cmd, (err) => {
            if (err) {
                cleanFiles([inputWebp, outputJpg]);
                return reject(err);
            }

            const jpgBuffer = fs.readFileSync(outputJpg);
            cleanFiles([inputWebp, outputJpg]);
            resolve(jpgBuffer);
        });
    });
}

function cleanFiles(files) {
    files.forEach(f => {
        if (fs.existsSync(f)) fs.unlinkSync(f);
    });
}

// Penjana Quote Chat Stabil (Multi-Server + Canvas Fallback)
async function generateQuoteSticker(name, text, avatarUrl, packname, author) {
    const payload = {
        type: 'quote',
        format: 'png',
        backgroundColor: '#0b141a',
        width: 512,
        height: 768,
        scale: 2,
        messages: [
            {
                entities: [],
                avatar: Boolean(avatarUrl),
                from: {
                    id: 1,
                    name: name,
                    ...(avatarUrl ? { photo: { url: avatarUrl } } : {})
                },
                text: text,
                replyMessage: {}
            }
        ]
    };

    const servers = [
        'https://quote-generator-green-three.vercel.app/api/quote',
        'https://quotly.netorare.codes/generate',
        'https://bot.lyo.su/quote/generate'
    ];

    let base64Img = null;

    for (const server of servers) {
        try {
            const res = await axios.post(server, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 8000
            });
            base64Img = res.data?.result?.image || res.data?.image;
            if (base64Img) break;
        } catch (e) {
            // Cuba server seterusnya
        }
    }

    if (!base64Img) {
        const encodedText = encodeURIComponent(text);
        const encodedName = encodeURIComponent(name);
        const fallbackUrl = `https://quickchart.io/watermark?mainImageUrl=https://i.ibb.co/3p5b1W2/default-avatar.png&markImageUrl=https://via.placeholder.com/512x200/005c4b/ffffff?text=${encodedName}:+${encodedText}&opacity=1`;
        
        const fallbackRes = await axios.get(fallbackUrl, { responseType: 'arraybuffer', timeout: 10000 });
        return await createStickerWithExif(Buffer.from(fallbackRes.data), packname, author);
    }

    return await createStickerWithExif(Buffer.from(base64Img, 'base64'), packname, author);
}

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('session_auth');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false
    });

    // SISTEM PAIRING CODE (JIKA BELUM REGISTER)
    if (!sock.authState.creds.registered) {
        let phoneNumber = await question('\n[?] Masukkan nombor WhatsApp bot anda (cth: 60123456789): ');
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join('-') || code;
                console.log(`\n=========================================`);
                console.log(`🔑 KOD PAIRING WHATSAPP: \x1b[32m${code}\x1b[0m`);
                console.log(`=========================================`);
                console.log(`1. Buka WhatsApp > Titik Tiga (Menu) > Linked Devices`);
                console.log(`2. Tekan "Link a Device"`);
                console.log(`3. Tekan "Link with phone number instead"`);
                console.log(`4. Masukkan kod 8 aksara di atas.\n`);
            } catch (err) {
                console.error('Gagal mendapatkan pairing code:', err.message);
            }
        }, 3000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log(`[STATUS] Terputus (${statusCode}). Reconnecting: ${shouldReconnect}`);
            
            if (shouldReconnect) {
                connectToWhatsApp();
            } else {
                console.log('[STATUS] Sesi tamat. Sila padam folder session_auth dan imbas/pair semula.');
            }
        } else if (connection === 'open') {
            console.log('\n[STATUS] Bot WhatsApp Anip telah bersedia dan aktif!\n');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Fungsi pemasa 2 minit untuk Teka Ayat
    function startTekaAyatTimer(targetChat, question) {
        if (tekaAyatSessions.has(targetChat)) {
            clearTimeout(tekaAyatSessions.get(targetChat).timer);
        }

        const timer = setTimeout(async () => {
            if (tekaAyatSessions.has(targetChat)) {
                const current = tekaAyatSessions.get(targetChat);
                if (current.question.level === question.level) {
                    tekaAyatSessions.delete(targetChat);
                    await sock.sendMessage(targetChat, { 
                        text: `⏰ *MASA 2 MINIT TELAH TAMAT!*\n\nSoalan Level ${question.level} gagal dijawab.\nJawapan sebenar: *${question.answer.toUpperCase()}*\n\nTaip *.tekaayat* untuk cuba soalan baharu.` 
                    });
                }
            }
        }, 2 * 60 * 1000);

        tekaAyatSessions.set(targetChat, { question, timer });
    }

    sock.ev.on('messages.upsert', async (m) => {
        try {
            if (m.type !== 'notify') return;

            const msg = m.messages[0];
            if (!msg.message) return;

            const targetChat = msg.key.remoteJid;
            const isFromMe = msg.key.fromMe;

            if (targetChat.includes('status@broadcast')) return;

            const text = (msg.message.conversation || 
                          msg.message.extendedTextMessage?.text || 
                          msg.message.imageMessage?.caption || 
                          msg.message.videoMessage?.caption || 
                          '').trim();

            const lowerText = text.toLowerCase();

            // ==========================================
            // 1. KAWALAN PERINTAH OLEH ANIP (fromMe)
            // ==========================================
            if (isFromMe) {
                lastActiveTime = Date.now();

                if (repliedUsers.has(targetChat)) {
                    repliedUsers.delete(targetChat);
                }

                if (lowerText === '.on') {
                    isBotFeaturesOn = true;
                    const menuText = 
`Hallo Tuan
 
SAYA BOT YG DICIPTAKAN OLEH ANIPP.

FITUR AKTIF:
• .ttmp3 <link> - Unduh Audio TikTok
• .ttvideo <link> - Unduh Video TikTok (No WM)
• .stikerwa - Tukar gambar kepada stiker WA
• .toimg - Balas stiker untuk jadikan gambar
• .qc <teks> - Quote Chat WA Bubble (Multi-Server)
• .deletechat - Balas mesej untuk dipadam
• .tekaayat - Permainan Teka Ayat (Timer 2 Minit)
• .tekaayat pass - Langkau soalan semasa
• .tekaayat stop - Hentikan sesi teka ayat
• .ai <soalan> - Tanya soalan AI
• .ssweb <link> - Tangkap layar laman web
• .unshort <link> - Semak destinasi pautan
• .ping / .runtime - Kelajuan & masa aktif bot

SELAMAT MENGUNAKKAN TUAN😁`;

                    await sock.sendMessage(targetChat, { text: menuText }, { quoted: msg });
                    console.log('[PERINTAH] Fitur bot diaktifkan oleh Anip.');
                    return;
                }

                if (lowerText === '.off') {
                    isBotFeaturesOn = false;
                    await sock.sendMessage(targetChat, { text: 'Fitur bot telah dimatikan, Tuan.' }, { quoted: msg });
                    console.log('[PERINTAH] Fitur bot dimatikan oleh Anip.');
                    return;
                }
            }

            // ==========================================
            // 2. MODUL FITUR
            // ==========================================
            if (isBotFeaturesOn) {
                // FITUR DELETE CHAT (.deletechat / .del / .delete dgn reply mesej)
                if (lowerText === '.deletechat' || lowerText === '.del' || lowerText === '.delete') {
                    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
                    const quotedMsg = contextInfo?.quotedMessage;

                    if (!quotedMsg || !contextInfo?.stanzaId) {
                        await sock.sendMessage(targetChat, { 
                            text: 'Sila *reply/balas* mesej yang ingin dipadam dengan arahan *.deletechat*' 
                        }, { quoted: msg });
                        return;
                    }

                    try {
                        const deleteKey = {
                            remoteJid: targetChat,
                            fromMe: contextInfo.participant ? (contextInfo.participant === sock.user.id.split(':')[0] + '@s.whatsapp.net') : isFromMe,
                            id: contextInfo.stanzaId,
                            participant: contextInfo.participant
                        };

                        await sock.sendMessage(targetChat, { delete: deleteKey });
                        await sock.sendMessage(targetChat, { delete: msg.key });

                        console.log(`[DELETE] Berjaya memadam mesej di ${targetChat}`);
                    } catch (err) {
                        console.error('Error deletechat:', err.message);
                        await sock.sendMessage(targetChat, { text: 'Gagal memadam mesej. Pastikan bot mempunyai akses atau admin.' }, { quoted: msg });
                    }
                    return;
                }

                // MODUL PERMAINAN .TEKAAYAT (DENGAN TIMER 2 MINIT)
                if (lowerText.startsWith('.tekaayat')) {
                    const args = lowerText.split(' ');
                    const action = args[1] || '';

                    // Hentikan permainan
                    if (action === 'stop') {
                        if (tekaAyatSessions.has(targetChat)) {
                            clearTimeout(tekaAyatSessions.get(targetChat).timer);
                            tekaAyatSessions.delete(targetChat);
                            await sock.sendMessage(targetChat, { text: 'Permainan Teka Ayat telah dihentikan.' }, { quoted: msg });
                        } else {
                            await sock.sendMessage(targetChat, { text: 'Tiada sesi permainan aktif untuk dihentikan.' }, { quoted: msg });
                        }
                        return;
                    }

                    // Langkau (Pass) soalan
                    if (action === 'pass') {
                        if (!tekaAyatSessions.has(targetChat)) {
                            await sock.sendMessage(targetChat, { text: 'Tiada permainan aktif. Taip *.tekaayat* untuk mula.' }, { quoted: msg });
                            return;
                        }
                        const current = tekaAyatSessions.get(targetChat);
                        clearTimeout(current.timer);

                        await sock.sendMessage(targetChat, { 
                            text: `⏩ Soalan dilepaskan!\nJawapan sebenar: *${current.question.answer.toUpperCase()}*` 
                        }, { quoted: msg });

                        let nextIndex = Math.floor(Math.random() * tekaAyatData.length);
                        const nextQuestion = tekaAyatData[nextIndex];
                        startTekaAyatTimer(targetChat, nextQuestion);

                        const replyPass = 
`🎯 *TEKA AYAT (LEVEL ${nextQuestion.level}/100)*
Petunjuk: *${nextQuestion.clue}*
Pembayang: \`${generateHint(nextQuestion.answer)}\`
⏳ *Masa menjawab:* 2 Minit!

_Balas terus chat ini dengan jawapan anda!_`;

                        await sock.sendMessage(targetChat, { text: replyPass }, { quoted: msg });
                        return;
                    }

                    // Mula sesi baru / Pilih level
                    let selectedQuestion;
                    if (args[1] && !isNaN(args[1])) {
                        const requestedLevel = parseInt(args[1]);
                        selectedQuestion = tekaAyatData.find(q => q.level === requestedLevel) || tekaAyatData[0];
                    } else {
                        const randomIndex = Math.floor(Math.random() * tekaAyatData.length);
                        selectedQuestion = tekaAyatData[randomIndex];
                    }

                    startTekaAyatTimer(targetChat, selectedQuestion);

                    const gameMessage = 
`🎯 *GAME TEKA AYAT (LEVEL ${selectedQuestion.level}/100)*

Petunjuk: *${selectedQuestion.clue}*
Pembayang: \`${generateHint(selectedQuestion.answer)}\`
⏳ *Masa:* 2 Minit untuk menjawab!

_Taip jawapan terus dalam perbualan ini._
• *.tekaayat pass* (Langkau)
• *.tekaayat stop* (Henti)`;

                    await sock.sendMessage(targetChat, { text: gameMessage }, { quoted: msg });
                    return;
                }

                // SEMAK JAWAPAN TEKA AYAT
                if (tekaAyatSessions.has(targetChat) && !lowerText.startsWith('.')) {
                    const sessionData = tekaAyatSessions.get(targetChat);
                    const currentQuestion = sessionData.question;

                    if (lowerText === currentQuestion.answer.toLowerCase()) {
                        clearTimeout(sessionData.timer);

                        await sock.sendMessage(targetChat, { 
                            text: `🎉 *TAHNIAH! JAWAPAN TEPAT!* 🎉\n\nJawapan: *${currentQuestion.answer.toUpperCase()}*\nLevel diselesaikan: *Level ${currentQuestion.level}*` 
                        }, { quoted: msg });

                        let nextIndex = Math.floor(Math.random() * tekaAyatData.length);
                        const nextQuestion = tekaAyatData[nextIndex];
                        startTekaAyatTimer(targetChat, nextQuestion);

                        const nextMessage = 
`🎯 *SOALAN SETERUSNYA (LEVEL ${nextQuestion.level}/100)*
Petunjuk: *${nextQuestion.clue}*
Pembayang: \`${generateHint(nextQuestion.answer)}\`
⏳ *Masa menjawab:* 2 Minit!`;

                        await sock.sendMessage(targetChat, { text: nextMessage }, { quoted: msg });
                        return;
                    }
                }

                // FITUR WHATSAPP QUOTE CHAT (.qc <teks> atau balas mesej)
                if (lowerText.startsWith('.qc')) {
                    let qcText = text.slice(3).trim();
                    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                    let targetSender = msg.key.participant || targetChat;
                    let senderName = msg.pushName || 'Pengguna';

                    if (quotedMsg) {
                        const quotedText = quotedMsg.conversation || 
                                           quotedMsg.extendedTextMessage?.text || 
                                           quotedMsg.imageMessage?.caption || '';
                        if (!qcText && quotedText) {
                            qcText = quotedText;
                        }
                        targetSender = msg.message.extendedTextMessage.contextInfo?.participant || targetSender;
                    }

                    if (!qcText) {
                        await sock.sendMessage(targetChat, { 
                            text: 'Sila masukkan teks atau balas mana-mana mesej!\nContoh: *.qc Helo geng*' 
                        }, { quoted: msg });
                        return;
                    }

                    await sock.sendMessage(targetChat, { text: 'Sedang membina Quote Chat...' }, { quoted: msg });

                    try {
                        let avatarUrl = '';
                        try {
                            avatarUrl = await sock.profilePictureUrl(targetSender, 'image');
                        } catch {}

                        const stickerBuffer = await generateQuoteSticker(
                            senderName,
                            qcText,
                            avatarUrl,
                            'Vernuxproject',
                            'Anipp'
                        );

                        await sock.sendMessage(targetChat, { 
                            sticker: stickerBuffer 
                        }, { quoted: msg });

                        console.log(`[QC] Stiker berjaya dihantar ke ${targetChat}`);
                    } catch (err) {
                        console.error('Error QC:', err.message);
                        await sock.sendMessage(targetChat, { text: 'Gagal menjana quote chat. Sila cuba lagi.' }, { quoted: msg });
                    }
                    return;
                }

                // FITUR PING / RUNTIME
                if (lowerText === '.ping' || lowerText === '.runtime') {
                    const startPing = Date.now();
                    const uptime = formatRuntime(process.uptime());
                    const pingSpeed = Date.now() - startPing;

                    const statusMsg = 
`⚡ *STATUS BOT VERNUXPROJECT*
• *Kelajuan Respon:* ${pingSpeed}ms
• *Tempoh Berjalan:* ${uptime}
• *Platform:* Termux (Node.js)`;

                    await sock.sendMessage(targetChat, { text: statusMsg }, { quoted: msg });
                    return;
                }

                // FITUR AI (.ai <soalan>)
                if (lowerText.startsWith('.ai')) {
                    const query = text.slice(3).trim();

                    if (!query) {
                        await sock.sendMessage(targetChat, { 
                            text: 'Sila masukkan soalan anda!\nContoh: *.ai Terangkan tentang graviti*' 
                        }, { quoted: msg });
                        return;
                    }

                    await sock.sendMessage(targetChat, { text: 'Sedang memproses jawapan...' }, { quoted: msg });

                    try {
                        const response = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(query)}?model=openai`, {
                            timeout: 25000,
                            headers: { 'User-Agent': 'Mozilla/5.0' }
                        });

                        const answer = response.data;

                        if (answer && typeof answer === 'string') {
                            await sock.sendMessage(targetChat, { 
                                text: `🤖 *JAWAPAN AI*\n\n${answer.trim()}\n\n_Vernuxproject AI_` 
                            }, { quoted: msg });
                        } else {
                            await sock.sendMessage(targetChat, { text: 'AI tidak dapat menghasilkan jawapan saat ini.' }, { quoted: msg });
                        }
                    } catch (err) {
                        console.error('Error AI:', err.message);
                        await sock.sendMessage(targetChat, { text: 'Gagal memproses pertanyaan AI. Sila cuba sebentar lagi.' }, { quoted: msg });
                    }
                    return;
                }

                // FITUR UNSHORTEN LINK (.unshort <pautan>)
                if (lowerText.startsWith('.unshort')) {
                    const args = text.split(' ');
                    let inputUrl = args[1];

                    if (!inputUrl) {
                        await sock.sendMessage(targetChat, { 
                            text: 'Sila masukkan pautan yang dipendekkan!\nContoh: *.unshort https://tinyurl.com/xxxx*' 
                        }, { quoted: msg });
                        return;
                    }

                    if (!inputUrl.startsWith('http://') && !inputUrl.startsWith('https://')) {
                        inputUrl = 'https://' + inputUrl;
                    }

                    await sock.sendMessage(targetChat, { text: 'Sedang menyemak destinasi asal pautan...' }, { quoted: msg });

                    try {
                        const response = await axios.get(inputUrl, {
                            maxRedirects: 5,
                            timeout: 10000,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                            }
                        });

                        const finalUrl = response.request?.res?.responseUrl || inputUrl;

                        const replyMsg = 
`🔗 *MAKLUMAT DESTINASI PAUTAN*
• *Pautan Asal:* ${inputUrl}
• *Destinasi Sebenar:* ${finalUrl}`;

                        await sock.sendMessage(targetChat, { text: replyMsg }, { quoted: msg });
                    } catch (err) {
                        console.error('Error Unshorten:', err.message);
                        await sock.sendMessage(targetChat, { text: 'Gagal mengesan pautan sebenar. Pautan mungkin tidak sah atau telah tamat tempoh.' }, { quoted: msg });
                    }
                    return;
                }

                // FITUR SCREENSHOT WEB (.ssweb <link>)
                if (lowerText.startsWith('.ssweb')) {
                    const args = text.split(' ');
                    let siteUrl = args[1];

                    if (!siteUrl) {
                        await sock.sendMessage(targetChat, { 
                            text: 'Sila masukkan pautan web!\nContoh: *.ssweb https://google.com*' 
                        }, { quoted: msg });
                        return;
                    }

                    if (!siteUrl.startsWith('http://') && !siteUrl.startsWith('https://')) {
                        siteUrl = 'https://' + siteUrl;
                    }

                    await sock.sendMessage(targetChat, { text: 'Sedang mengambil tangkap layar laman web...' }, { quoted: msg });

                    try {
                        const ssUrl = `https://image.thum.io/get/width/1280/crop/800/noanimate/${siteUrl}`;
                        const ssResponse = await axios.get(ssUrl, {
                            responseType: 'arraybuffer',
                            timeout: 20000
                        });

                        const imgBuffer = Buffer.from(ssResponse.data);

                        await sock.sendMessage(targetChat, {
                            image: imgBuffer,
                            caption: `📸 *TANGKAP LAYAR LAMAN WEB*\n*URL:* ${siteUrl}`
                        }, { quoted: msg });

                        console.log(`[SSWEB] Tangkap layar dihantar ke ${targetChat}`);
                    } catch (err) {
                        console.error('Error SSWEB:', err.message);
                        await sock.sendMessage(targetChat, { text: 'Gagal mengambil tangkap layar web. Pastikan URL sah dan boleh diakses awam.' }, { quoted: msg });
                    }
                    return;
                }

                // FITUR TIKTOK VIDEO TANPA WATERMARK (.ttvideo <link>)
                if (lowerText.startsWith('.ttvideo')) {
                    const args = text.split(' ');
                    const url = args[1];

                    if (!url || !url.includes('tiktok.com')) {
                        await sock.sendMessage(targetChat, { 
                            text: 'Sila masukkan pautan TikTok yang sah!\nContoh: *.ttvideo https://vt.tiktok.com/xxxx/*' 
                        }, { quoted: msg });
                        return;
                    }

                    await sock.sendMessage(targetChat, { text: 'Sedang memproses video TikTok... Sila tunggu sebentar.' }, { quoted: msg });

                    const id = Date.now();
                    const rawVideoPath = path.join(__dirname, `raw_${id}.mp4`);
                    const fixedVideoPath = path.join(__dirname, `fixed_${id}.mp4`);

                    try {
                        const res = await axios.post('https://www.tikwm.com/api/', { url: url }, {
                            headers: { 'User-Agent': 'Mozilla/5.0' },
                            timeout: 20000
                        });
                        
                        const data = res.data;

                        if (data.code === 0 && (data.data?.play || data.data?.wmplay)) {
                            const videoUrl = data.data.play || data.data.wmplay;
                            const caption = data.data.title || 'Video TikTok';

                            const responseStream = await axios({
                                method: 'GET',
                                url: videoUrl,
                                responseType: 'stream',
                                headers: { 'User-Agent': 'Mozilla/5.0' }
                            });

                            const writer = fs.createWriteStream(rawVideoPath);
                            responseStream.data.pipe(writer);

                            await new Promise((resolve, reject) => {
                                writer.on('finish', resolve);
                                writer.on('error', reject);
                            });

                            const ffmpegCmd = `ffmpeg -y -i "${rawVideoPath}" -c:v libx264 -pix_fmt yuv420p -preset ultrafast -c:a aac -b:a 128k -movflags +faststart "${fixedVideoPath}"`;

                            await new Promise((resolve, reject) => {
                                exec(ffmpegCmd, (err) => {
                                    if (err) return reject(err);
                                    resolve();
                                });
                            });

                            await sock.sendMessage(targetChat, {
                                video: fs.readFileSync(fixedVideoPath),
                                mimetype: 'video/mp4',
                                caption: `🎬 *${caption}*\n\n_Muat turun oleh Bot Vernuxproject_`
                            }, { quoted: msg });

                            cleanFiles([rawVideoPath, fixedVideoPath]);
                            console.log(`[TTVIDEO] Video dihantar ke ${targetChat}`);
                        } else {
                            cleanFiles([rawVideoPath, fixedVideoPath]);
                            await sock.sendMessage(targetChat, { text: 'Gagal mendapatkan video TikTok. Pastikan akaun bukan privat.' }, { quoted: msg });
                        }
                    } catch (err) {
                        cleanFiles([rawVideoPath, fixedVideoPath]);
                        console.error('Error TikTok Video:', err.message);
                        await sock.sendMessage(targetChat, { text: 'Ralat semasa memproses video.' }, { quoted: msg });
                    }
                    return;
                }

                // FITUR STIKER KE GAMBAR (.toimg balas stiker)
                if (lowerText === '.toimg') {
                    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                    const isQuotedSticker = quotedMsg?.stickerMessage;

                    if (!isQuotedSticker) {
                        await sock.sendMessage(targetChat, { 
                            text: 'Sila *reply/balas* stiker dengan menaip *.toimg*' 
                        }, { quoted: msg });
                        return;
                    }

                    await sock.sendMessage(targetChat, { text: 'Sedang menukar stiker kepada gambar...' }, { quoted: msg });

                    try {
                        const stickerBuffer = await downloadMediaMessage(
                            { message: quotedMsg },
                            'buffer',
                            {},
                            { 
                                logger: pino({ level: 'silent' }),
                                reuploadRequest: sock.updateMediaMessage
                            }
                        );

                        const jpgBuffer = await convertWebpToJpg(stickerBuffer);

                        await sock.sendMessage(targetChat, {
                            image: jpgBuffer,
                            caption: 'Berjaya ditukar menjadi gambar!'
                        }, { quoted: msg });

                        console.log(`[TOIMG] Berjaya dihantar ke ${targetChat}`);
                    } catch (err) {
                        console.error('Error toimg:', err);
                        await sock.sendMessage(targetChat, { text: 'Gagal menukar stiker. Pastikan stiker bukan animasi.' }, { quoted: msg });
                    }
                    return;
                }

                // FITUR BUAT STIKER (.stikerwa)
                if (lowerText === '.stikerwa') {
                    waitingStickerUsers.add(targetChat);
                    await sock.sendMessage(targetChat, { 
                        text: 'Sila hantar gambar yang ingin dijadikan stiker.' 
                    }, { quoted: msg });
                    return;
                }

                // PROSES GAMBAR JADI STIKER
                const isImage = msg.message.imageMessage;
                if (isImage && waitingStickerUsers.has(targetChat)) {
                    await sock.sendMessage(targetChat, { text: 'Sedang membuat stiker Vernuxproject...' }, { quoted: msg });

                    try {
                        const imageBuffer = await downloadMediaMessage(
                            msg,
                            'buffer',
                            {},
                            { 
                                logger: pino({ level: 'silent' }),
                                reuploadRequest: sock.updateMediaMessage
                            }
                        );

                        const stickerBuffer = await createStickerWithExif(
                            imageBuffer, 
                            'Vernuxproject', 
                            'Anipp'
                        );

                        await sock.sendMessage(targetChat, { 
                            sticker: stickerBuffer 
                        }, { quoted: msg });

                        waitingStickerUsers.delete(targetChat);
                        console.log(`[STIKER] Berjaya dihantar ke ${targetChat}`);
                    } catch (err) {
                        console.error('Error proses stiker:', err);
                        await sock.sendMessage(targetChat, { text: 'Gagal membuat stiker. Sila cuba lagi.' }, { quoted: msg });
                    }
                    return;
                }

                // FITUR TIKTOK MP3 (.ttmp3 <link>)
                if (lowerText.startsWith('.ttmp3')) {
                    const args = text.split(' ');
                    const url = args[1];

                    if (!url || !url.includes('tiktok.com')) {
                        await sock.sendMessage(targetChat, { 
                            text: 'Sila masukkan pautan TikTok yang sah!\nContoh: *.ttmp3 https://vt.tiktok.com/xxxx/*' 
                        }, { quoted: msg });
                        return;
                    }

                    await sock.sendMessage(targetChat, { text: 'Sedang memuat turun audio TikTok... Sila tunggu.' }, { quoted: msg });

                    try {
                        const res = await axios.post('https://www.tikwm.com/api/', { url: url }, {
                            headers: { 'User-Agent': 'Mozilla/5.0' },
                            timeout: 20000
                        });
                        const data = res.data;

                        if (data.code === 0 && data.data?.music) {
                            const musicUrl = data.data.music;
                            const title = data.data.title || 'TikTok Audio';

                            const audioResponse = await axios.get(musicUrl, {
                                responseType: 'arraybuffer',
                                headers: { 'User-Agent': 'Mozilla/5.0' }
                            });

                            const audioBuffer = Buffer.from(audioResponse.data);

                            await sock.sendMessage(targetChat, {
                                audio: audioBuffer,
                                mimetype: 'audio/mp4',
                                ptt: false,
                                fileName: `${title}.mp3`
                            }, { quoted: msg });

                            console.log(`[TTMP3] Audio dihantar ke ${targetChat}`);
                        } else {
                            await sock.sendMessage(targetChat, { text: 'Gagal mendapatkan audio. Pastikan video bukan privat.' }, { quoted: msg });
                        }
                    } catch (err) {
                        console.error('Error TikTok MP3:', err.message);
                        await sock.sendMessage(targetChat, { text: 'Ralat semasa memproses audio TikTok.' }, { quoted: msg });
                    }
                    return;
                }
            }

            // ==========================================
            // 3. LOGIK AUTO-REPLY OFFLINE 5 MINIT
            // ==========================================
            if (isFromMe || targetChat.endsWith('@g.us')) return;

            const currentTime = Date.now();
            const timeDiff = currentTime - lastActiveTime;
            const isUserOnline = timeDiff < OFFLINE_THRESHOLD;

            if (isUserOnline) return;
            if (repliedUsers.has(targetChat)) return;

            const replyMessage = `Hallo.\nSekiranya Anip tidak membalas jgn spam chat atau  call.`;
            await sock.sendMessage(targetChat, { text: replyMessage }, { quoted: msg });
            
            repliedUsers.add(targetChat);
            console.log(`[AUTO-REPLY] Dihantar ke ${targetChat} (Mod Offline)`);

        } catch (error) {
            console.error('[ERROR]', error);
        }
    });
}

connectToWhatsApp();
