require('dotenv').config();
const { chromium } = require('playwright');
const { fakerID_ID: faker } = require('@faker-js/faker');
const fs = require('fs');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * FUNGSI UTAMA UNTUK SETIAP WORKER (DENGAN AUTO-RETRY)
 */
const startWorker = async (workerId, limit) => {
    const MAX_RETRY_PER_ACCOUNT = 3; // Maksimal percobaan ulang jika gagal total

    return limit(async () => {
        let currentRetry = 0;
        let isSuccessFinal = false;

        while (currentRetry < MAX_RETRY_PER_ACCOUNT && !isSuccessFinal) {
            currentRetry++;
            
            const targetUrl = process.env.TARGET_URL;
            const domain = process.env.DOMAIN;
            const password = process.env.ACCOUNT_PASSWORD;

            if (!targetUrl || !domain) {
                console.log(`\x1b[31m[W${workerId}] ERROR: Cek .env (TARGET_URL/DOMAIN)!\x1b[0m`);
                return;
            }

            // Generate Data Baru Setiap Percobaan
            const firstName = faker.person.firstName().toLowerCase();
            const lastName = faker.person.lastName().toLowerCase();
            const customEmail = `${firstName}.${lastName}${faker.number.int({min:100, max:999})}@${domain}`;
            const fullName = faker.person.fullName();
            const randomAge = faker.number.int({ min: 18, max: 35 }).toString();

            const tag = `\x1b[36m[W${workerId}]\x1b[0m`;
            const retryTag = currentRetry > 1 ? ` \x1b[35m(Retry ke-${currentRetry-1})\x1b[0m` : '';
            
            console.log(`${tag}${retryTag} 📧 Memulai: \x1b[33m${customEmail}\x1b[0m`);

            const browser = await chromium.launch({ 
                headless: false, 
                slowMo: 50 
            });
            const context = await browser.newContext();
            const page = await context.newPage();

            try {
                // 1. Pergi ke halaman target
                await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

                // 2. Step Umur
                await page.click('span:has-text("Claim Offer")', { timeout: 10000 });
                await delay(1000);
                await page.waitForSelector('[data-test="age-input"]');
                await page.fill('[data-test="age-input"]', randomAge);
                await page.click('[data-test="continue-button"]');
                await delay(1500);

                // 3. Isi Form Registrasi
                await page.waitForSelector('[data-test="email-input"]');
                await page.fill('[data-test="full-name-input"]', fullName);
                await page.fill('[data-test="email-input"]', customEmail);
                await page.fill('[data-test="password-input"]', password);
                await delay(2000);

                let registerSuccess = false;
                let attempt = 0;

                // 4. Loop Klik Register sampai Welcome muncul
                while (!registerSuccess && attempt < 5) {
                    attempt++;
                    console.log(`${tag} \x1b[34m[%] Percobaan Klik ${attempt}: Menekan Register...\x1b[0m`);
                    await page.click('[data-test="register-button"]', { force: true });
                    
                    await delay(6000); 

                    const welcomeElement = page.locator('h1:has-text("Welcome to Super Duolingo!")');
                    if (await welcomeElement.isVisible()) {
                        console.log(`${tag} \x1b[32m[✔] Welcome Terdeteksi!\x1b[0m`);
                        registerSuccess = true;

                        // --- ALUR FUNBOARDING ---
                        console.log(`${tag} [>] Menjalankan onboarding...`);
                        
                        await page.click('span:has-text("Start learning with Super")', { timeout: 8000 }).catch(() => {});
                        await delay(2000);

                        await page.click('div._3A4sF:has-text("English")', { timeout: 5000 }).catch(() => {});
                        await delay(1000);

                        await page.click('[data-test="funboarding-continue-button"]', { force: true }).catch(() => {});
                        await delay(2000);

                        // Animasi Gambar NeppJ (Klik 2x)
                        console.log(`${tag} [>] Klik Animasi NeppJ (2x)...`);
                        try {
                            await page.waitForSelector('img.NeppJ', { timeout: 5000 });
                            for (let j = 0; j < 2; j++) {
                                await page.evaluate(() => {
                                    const img = document.querySelector('img.NeppJ');
                                    if (img) img.click();
                                });
                                await delay(1500);
                            }
                        } catch (e) {}

                        console.log(`${tag} \x1b[32m[⭐] SELESAI SEMPURNA!\x1b[0m`);

                        // Simpan Hasil
                        const dataAkun = `Email: ${customEmail} | Pass: ${password} | Nama: ${fullName} | Tgl: ${new Date().toLocaleString()}\n`;
                        fs.appendFileSync('akun.txt', dataAkun, 'utf8');
                        isSuccessFinal = true; // Set sukses agar tidak retry lagi
                    } else {
                        console.log(`${tag} [!] Welcome belum muncul...`);
                    }
                }
                
                if (!registerSuccess) throw new Error("Gagal melewati halaman registrasi");

            } catch (err) {
                console.log(`${tag} \x1b[31m[✘] ERROR: ${err.message}\x1b[0m`);
                if (currentRetry < MAX_RETRY_PER_ACCOUNT) {
                    console.log(`${tag} \x1b[35m[!] Menyiapkan percobaan ulang...\x1b[0m`);
                }
            } finally {
                await browser.close();
                console.log(`${tag} \x1b[33m[Selesai]\x1b[0m Browser ditutup.`);
            }
        }
        
        if (!isSuccessFinal) {
            console.log(`\x1b[31m[W${workerId}] GAGAL TOTAL setelah ${MAX_RETRY_PER_ACCOUNT}x percobaan.\x1b[0m`);
        }
    });
};

/**
 * RUNNER DENGAN DYNAMIC IMPORT
 */
(async () => {
    console.clear();
    console.log("\x1b[35m%s\x1b[0m", "==================================================");
    console.log("\x1b[33m%s\x1b[0m", "          DUOLINGO AUTO PREMIUM @eatmin           ");
    console.log("\x1b[35m%s\x1b[0m", "==================================================");

    try {
        const { default: pLimit } = await import('p-limit');
        
        const MAX_WORKERS = 5; 
        const TOTAL_AKUN = 10; 
        const limit = pLimit(MAX_WORKERS);

        const tasks = [];
        for (let i = 1; i <= TOTAL_AKUN; i++) {
            tasks.push(startWorker(i, limit));
        }

        await Promise.all(tasks);

        console.log("\x1b[32m%s\x1b[0m", "\n[!] SEMUA TUGAS TELAH SELESAI.");
        console.log("--------------------------------------------------");
    } catch (error) {
        console.error("\x1b[31mGagal memuat library:\x1b[0m", error.message);
    }
})();