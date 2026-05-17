const { ethers } = require("ethers");
require('dotenv').config();

// Конфигурация
// В .env файле: SIGNER_PRIVATE_KEY=приватный_ключ_от_0xc1a7...
// В .env файле: CONTRACT_ADDRESS=адрес_задеплоенного_контракта
const rawPrivateKey = process.env.SIGNER_PRIVATE_KEY;
const PRIVATE_KEY = rawPrivateKey && !rawPrivateKey.trim().startsWith("0x")
    ? "0x" + rawPrivateKey.trim()
    : rawPrivateKey?.trim();
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS?.trim();

if (!PRIVATE_KEY || !CONTRACT_ADDRESS) {
    console.error("❌ Setup .env file with SIGNER_PRIVATE_KEY and CONTRACT_ADDRESS");
}

// Создаем кошелек для подписей
// Ethers v6: Provider is optional for signing messages not transactions, but good to check connectivity if needed
const signerWallet = new ethers.Wallet(PRIVATE_KEY);

console.log(`🤖 Signer Bot Ready. Address: ${signerWallet.address}`);

/**
 * Функция генерирует подпись для минта
 * @param {string} userAddress - Адрес кошелька пользователя, который платит газ
 * @param {string} tokenURI - Ссылка ipfs://... которую выбрал сервер
 */
async function generateMintSignature(userAddress, tokenURI) {
    try {
        // Normalize addresses
        const normalizedUser = ethers.getAddress(userAddress);
        const normalizedContract = ethers.getAddress(CONTRACT_ADDRESS);

        // 1. Создаем уникальный nonce (alpha-numeric only to avoid 0x confusion)
        const nonce = "sig-" + Date.now().toString(36) + Math.random().toString(36).substring(2);

        console.log(`🔏 [SIGNER] Signing Request:`);
        console.log(`   - User (Normalized): ${normalizedUser}`);
        console.log(`   - URI:  ${tokenURI}`);
        console.log(`   - Nonce: ${nonce}`);
        console.log(`   - Contract: ${normalizedContract}`);

        // 2. Хэшируем данные. ВАЖНО: Типы данных должны совпадать с Solidity (address, string, string, address)
        const messageHash = ethers.solidityPackedKeccak256(
            ["address", "string", "string", "address"],
            [normalizedUser, tokenURI, nonce, normalizedContract]
        );

        // 3. Подписываем хэш 
        const messageHashBytes = ethers.getBytes(messageHash);
        const signature = await signerWallet.signMessage(messageHashBytes);

        // 4. Проверка (Self-test)
        const recovered = ethers.verifyMessage(messageHashBytes, signature);
        console.log(`   - Recovered Signer: ${recovered}`);
        if (recovered.toLowerCase() !== signerWallet.address.toLowerCase()) {
            throw new Error("Self-verification failed: Recovered address mismatch");
        }

        return {
            success: true,
            data: {
                tokenURI: tokenURI,
                nonce: nonce,
                signature: signature,
                price: "0.0"
            }
        };
    } catch (error) {
        console.error("Error signing:", error);
        return { success: false, error: error.message };
    }
}

// Пример использования (раскомментируйте для теста)
/*
(async () => {
    const testUser = "0xUserAddressHere...";
    const testURI = "ipfs://QmTestHash...";
    const result = await generateMintSignature(testUser, testURI);
    console.log("Отправить на фронтенд:", result);
})();
*/

module.exports = { generateMintSignature };
