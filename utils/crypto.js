const CryptoJS = require('./crypto-js.min.js');
// 修正：引用JS文件而非JSON文件
const secrets = require('../config/secrets.js');

// AES-128-CBC加密
function aesEncrypt(data) {
  const key = CryptoJS.enc.Utf8.parse(secrets.aesKey);
  const iv = CryptoJS.enc.Utf8.parse(secrets.aesIv);
  const srcs = CryptoJS.enc.Utf8.parse(JSON.stringify(data));
  const encrypted = CryptoJS.AES.encrypt(srcs, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  return encrypted.ciphertext.toString();
}

// AES-128-CBC解密
function aesDecrypt(data) {
  const key = CryptoJS.enc.Utf8.parse(secrets.aesKey);
  const iv = CryptoJS.enc.Utf8.parse(secrets.aesIv);
  const encryptedHexStr = CryptoJS.enc.Hex.parse(data);
  const srcs = CryptoJS.enc.Base64.stringify(encryptedHexStr);
  const decrypt = CryptoJS.AES.decrypt(srcs, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  const decryptedStr = decrypt.toString(CryptoJS.enc.Utf8);
  return decryptedStr ? JSON.parse(decryptedStr) : null;
}

module.exports = {
  aesEncrypt,
  aesDecrypt
};
    